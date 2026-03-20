// Content script injected into ncaa.com/march-madness-live/* pages
// Listens for clear commands from the background service worker

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "clearStorage") {
    localStorage.clear();
    sessionStorage.clear();
    sendResponse({ success: true });
  }
});
