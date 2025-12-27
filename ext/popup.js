const API_URL = "http://localhost:5000";

document.addEventListener('DOMContentLoaded', async () => {
  const loading = document.getElementById('loading');
  const errorDiv = document.getElementById('error');
  const errorMsg = document.getElementById('error-msg');
  const content = document.getElementById('content');

  function showError(msg) {
    loading.style.display = 'none';
    content.style.display = 'none';
    errorDiv.style.display = 'block';
    errorMsg.textContent = msg;
  }

  function showContent() {
    loading.style.display = 'none';
    errorDiv.style.display = 'none';
    content.style.display = 'block';

    // Trigger animations
    document.querySelector('.video-info').style.display = 'block';
    document.querySelector('.formats-list').style.display = 'flex';
  }

  // Get current tab URL automatically
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url) {
      showError("Could not retrieve tab URL.");
      return;
    }

    if (tab.url.includes("youtube.com/watch")) {
      const cleanUrl = getCleanVideoUrl(tab.url);
      await fetchVideoInfo(cleanUrl, tab.title);
    } else {
      showError("Please open a valid YouTube video page.");
    }
  } catch (err) {
    showError("Error accessing tab: " + err.message);
  }
});

function getCleanVideoUrl(url) {
  try {
    const urlObj = new URL(url);
    const v = urlObj.searchParams.get('v');
    // User requested short format: https://youtu.be/VIDEO_ID
    if (v) return `https://youtu.be/${v}`;
  } catch (e) { }
  return url;
}

async function fetchVideoInfo(url, titleFromTab) {
  try {
    const res = await fetch(`${API_URL}/api/info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });

    if (!res.ok) throw new Error("Server error or invalid URL");

    const data = await res.json();
    renderUI(data, titleFromTab, url);
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';

    // Show content elements
    document.querySelector('.video-info').style.display = 'block';
    document.querySelector('.formats-list').style.display = 'flex';

  } catch (err) {
    // Determine if it's a connection error
    if (err.message.includes("Failed to fetch")) {
      document.getElementById('loading').style.display = 'none';
      document.getElementById('error').style.display = 'block';
      document.getElementById('error-msg').innerHTML = `
        Cannot connect to helper server.<br>
        Make sure <code>app1.py</code> is running.
      `;
    } else {
      document.getElementById('loading').style.display = 'none';
      document.getElementById('error').style.display = 'block';
      document.getElementById('error-msg').textContent = err.message;
    }
  }
}

function renderUI(data, tabTitle, videoUrl) {
  // Update Video Info
  const title = data.title || tabTitle || "Unknown Video";
  document.getElementById('video-title').textContent = title;

  const thumbnail = data.thumbnail || `https://img.youtube.com/vi/${getVideoId(videoUrl)}/mqdefault.jpg`;
  document.getElementById('thumbnail').src = thumbnail;

  const container = document.getElementById('formats-container');
  container.innerHTML = ""; // Clear previous

  // Video Formats Section
  if (data.formats && data.formats.length > 0) {
    const videoHeader = document.createElement('div');
    videoHeader.className = 'section-title';
    videoHeader.textContent = 'Video Qualities';
    container.appendChild(videoHeader);

    data.formats.forEach(format => {
      const btn = document.createElement('div');
      btn.className = 'format-btn';
      btn.onclick = () => triggerDownload(videoUrl, format.height, null);

      btn.innerHTML = `
        <span class="format-details">${format.label}</span>
        <span class="quality-badge">${format.ext || 'MP4'}</span>
      `;
      container.appendChild(btn);
    });
  }

  // Audio Formats Section
  if (data.audio_formats && data.audio_formats.length > 0) {
    const audioHeader = document.createElement('div');
    audioHeader.className = 'section-title';
    audioHeader.textContent = 'Audio Only';
    container.appendChild(audioHeader);

    data.audio_formats.forEach(audio => {
      const btn = document.createElement('div');
      btn.className = 'format-btn';
      btn.onclick = () => triggerDownload(videoUrl, null, audio.quality);

      btn.innerHTML = `
        <span class="format-details">${audio.label || 'Audio'}</span>
        <span class="quality-badge audio-badge">MP3</span>
      `;
      container.appendChild(btn);
    });
  }
}

function triggerDownload(url, height, audioQuality) {
  let downloadUrl = `${API_URL}/api/download?url=${encodeURIComponent(url)}`;
  if (height) downloadUrl += `&height=${height}`;
  if (audioQuality) downloadUrl += `&audio_quality=${audioQuality}`;

  window.open(downloadUrl, '_blank');
}

function getVideoId(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('v');
  } catch (e) {
    return "";
  }
}
