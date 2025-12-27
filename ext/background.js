
async function syncCookies() {
  const cookies = await chrome.cookies.getAll({ domain: ".youtube.com" });
  await fetch("http://localhost:5000/api/cookies/auto-sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cookies })
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "VIDEO_URL") {
    syncCookies();
    chrome.storage.local.set({ videoUrl: msg.url });
  }
});
