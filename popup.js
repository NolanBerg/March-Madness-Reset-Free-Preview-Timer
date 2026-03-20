const autoToggle = document.getElementById("autoToggle");
const intervalInput = document.getElementById("intervalInput");
const resetBtn = document.getElementById("resetBtn");
const status = document.getElementById("status");

// Load saved state
chrome.storage.local.get(["autoReset", "intervalMinutes", "lastReset"], (data) => {
  autoToggle.checked = data.autoReset ?? true;
  intervalInput.value = data.intervalMinutes ?? 9;
  updateStatus(data.lastReset);
});

// Auto-reset toggle
autoToggle.addEventListener("change", () => {
  chrome.runtime.sendMessage({
    action: "setAutoReset",
    enabled: autoToggle.checked
  });
});

// Interval change
let intervalTimeout;
intervalInput.addEventListener("input", () => {
  clearTimeout(intervalTimeout);
  intervalTimeout = setTimeout(() => {
    const mins = parseInt(intervalInput.value, 10);
    if (mins >= 1 && mins <= 60) {
      chrome.runtime.sendMessage({ action: "setInterval", minutes: mins });
    }
  }, 500);
});

// Reset now button
resetBtn.addEventListener("click", () => {
  resetBtn.textContent = "Resetting...";
  resetBtn.disabled = true;
  chrome.runtime.sendMessage({ action: "resetNow" }, () => {
    resetBtn.textContent = "Reset Now";
    resetBtn.disabled = false;
    updateStatus(Date.now());
  });
});

function updateStatus(timestamp) {
  if (timestamp) {
    const time = new Date(timestamp).toLocaleTimeString();
    status.textContent = `Last reset: ${time}`;
  } else {
    status.textContent = "No resets yet";
  }
}
