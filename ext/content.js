
function sendVideoUrl() {
  const url = window.location.href;
  if (url.includes("watch?v=")) {
    chrome.runtime.sendMessage({ type: "VIDEO_URL", url });
  }
}

sendVideoUrl();

let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    sendVideoUrl();
  }
}).observe(document, { subtree: true, childList: true });
