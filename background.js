const TARGET_DOMAINS = [
  "ncaa.com",
  ".ncaa.com",
  "token.ncaa.com",
  "mmldata.ncaa.com",
  "www.ncaa.com"
];

const MM_URL_PATTERN = "*://*.ncaa.com/march-madness-live/*";
const DEFAULT_INTERVAL = 9; // minutes

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    autoReset: true,
    intervalMinutes: DEFAULT_INTERVAL,
    lastReset: null
  });
  startAlarm(DEFAULT_INTERVAL);
  updateBadge(true);
});

// Re-start alarm on service worker wake
chrome.storage.local.get(["autoReset", "intervalMinutes"], (data) => {
  if (data.autoReset) {
    startAlarm(data.intervalMinutes || DEFAULT_INTERVAL);
    updateBadge(true);
  }
});

// Handle alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "resetPreview") {
    resetPreview();
  }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "resetNow") {
    resetPreview().then(() => sendResponse({ success: true }));
    return true; // async response
  }
  if (msg.action === "setAutoReset") {
    chrome.storage.local.set({ autoReset: msg.enabled });
    if (msg.enabled) {
      chrome.storage.local.get("intervalMinutes", (data) => {
        startAlarm(data.intervalMinutes || DEFAULT_INTERVAL);
      });
    } else {
      chrome.alarms.clear("resetPreview");
    }
    updateBadge(msg.enabled);
    sendResponse({ success: true });
  }
  if (msg.action === "setInterval") {
    const mins = Math.max(1, Math.min(60, msg.minutes));
    chrome.storage.local.set({ intervalMinutes: mins });
    chrome.storage.local.get("autoReset", (data) => {
      if (data.autoReset) {
        startAlarm(mins);
      }
    });
    sendResponse({ success: true });
  }
});

function startAlarm(minutes) {
  chrome.alarms.clear("resetPreview", () => {
    chrome.alarms.create("resetPreview", { periodInMinutes: minutes });
  });
}

async function resetPreview() {
  // 1. Clear cookies for all target domains
  for (const domain of TARGET_DOMAINS) {
    try {
      const cookies = await chrome.cookies.getAll({ domain });
      for (const cookie of cookies) {
        const protocol = cookie.secure ? "https" : "http";
        const url = `${protocol}://${cookie.domain.replace(/^\./, "")}${cookie.path}`;
        await chrome.cookies.remove({ url, name: cookie.name });
      }
    } catch (e) {
      console.warn("Cookie clear error for", domain, e);
    }
  }

  // 2. Clear browsingData for ncaa.com origins
  try {
    await chrome.browsingData.remove(
      {
        origins: [
          "https://www.ncaa.com",
          "https://ncaa.com",
          "https://token.ncaa.com",
          "https://mmldata.ncaa.com"
        ]
      },
      {
        cacheStorage: true,
        indexedDB: true,
        serviceWorkers: true
      }
    );
  } catch (e) {
    console.warn("browsingData.remove error:", e);
  }

  // 3. Execute content script on matching tabs to clear localStorage
  try {
    const tabs = await chrome.tabs.query({ url: MM_URL_PATTERN });
    for (const tab of tabs) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          localStorage.clear();
          sessionStorage.clear();
        }
      });
    }

    // 4. Reload those tabs
    for (const tab of tabs) {
      chrome.tabs.reload(tab.id);
    }
  } catch (e) {
    console.warn("Tab clear/reload error:", e);
  }

  // 5. Record last reset time
  const now = Date.now();
  chrome.storage.local.set({ lastReset: now });
  console.log("Preview reset at", new Date(now).toLocaleTimeString());
}

function updateBadge(enabled) {
  chrome.action.setBadgeText({ text: enabled ? "ON" : "OFF" });
  chrome.action.setBadgeBackgroundColor({
    color: enabled ? "#F97316" : "#6B7280"
  });
}
