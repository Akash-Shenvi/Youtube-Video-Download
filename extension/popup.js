
const { createFFmpeg, fetchFile } = FFmpeg;
let ffmpeg = null;

document.addEventListener('DOMContentLoaded', () => {
    const scanBtn = document.getElementById('scan-btn');
    const statusBadge = document.getElementById('status-badge');
    const videoInfo = document.getElementById('video-info');
    const formatList = document.getElementById('format-list');
    const errorMsg = document.getElementById('error-msg');

    // Load FFmpeg immediately in background
    initFFmpeg();

    scanBtn.addEventListener('click', scanVideo);

    async function initFFmpeg() {
        try {
            ffmpeg = createFFmpeg({
                log: true,
                corePath: chrome.runtime.getURL('lib/ffmpeg-core.js')
            });
            await ffmpeg.load();
            console.log('FFmpeg loaded');
        } catch (e) {
            console.error('FFmpeg load failed:', e);
        }
    }

    async function scanVideo() {
        resetUI();
        setLoading(true);

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab.url.includes('youtube.com/watch')) {
                throw new Error('Not a YouTube video page.');
            }

            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                world: 'MAIN',
                func: getPlayerResponse
            });

            if (!results || !results[0] || !results[0].result) {
                throw new Error('Could not retrieve video data. Try reloading the page.');
            }

            processVideoData(results[0].result);

        } catch (err) {
            showError(err.message);
        } finally {
            setLoading(false);
        }
    }

    function getPlayerResponse() {
        try {
            const player = document.getElementById('movie_player');
            if (player && player.getPlayerResponse) return player.getPlayerResponse();
        } catch (e) { }
        if (window.ytInitialPlayerResponse) return window.ytInitialPlayerResponse;
        return null;
    }

    function processVideoData(data) {
        if (!data || !data.videoDetails || !data.streamingData) {
            showError('Invalid video data structure.');
            return;
        }

        const details = data.videoDetails;
        document.getElementById('video-title').textContent = details.title;
        document.getElementById('video-author').textContent = details.author;
        if (details.thumbnail?.thumbnails?.length) {
            document.getElementById('thumbnail').src = details.thumbnail.thumbnails[details.thumbnail.thumbnails.length - 1].url;
        }
        videoInfo.classList.remove('hidden');

        const formats = data.streamingData.formats || [];
        const adaptiveFormats = data.streamingData.adaptiveFormats || [];

        // Find best audio track
        let bestAudio = null;
        adaptiveFormats.forEach(f => {
            if (f.mimeType.includes('audio')) {
                if (!bestAudio || f.bitrate > bestAudio.bitrate) {
                    bestAudio = f;
                }
            }
        });

        const allFormats = [];

        // Progressive
        formats.forEach(f => {
            allFormats.push({
                itag: f.itag,
                qualityLabel: f.qualityLabel,
                container: 'mp4',
                url: f.url,
                isMerged: true,
                desc: 'Ready to Play'
            });
        });

        // Adaptive Video (High Res)
        adaptiveFormats.forEach(f => {
            if (f.mimeType.includes('video')) {
                const container = f.mimeType.includes('webm') ? 'webm' : 'mp4';
                const isHighRes = true;

                allFormats.push({
                    itag: f.itag,
                    qualityLabel: f.qualityLabel || 'Unknown',
                    container: container,
                    url: f.url,
                    audioUrl: bestAudio ? bestAudio.url : null,
                    isHighRes: true,
                    desc: bestAudio ? 'High Quality (Merged)' : 'Video Only (No Audio)'
                });
            }
        });

        // Sort
        allFormats.sort((a, b) => {
            const hA = parseInt(a.qualityLabel) || 0;
            const hB = parseInt(b.qualityLabel) || 0;
            return hB - hA;
        });

        // Deduplicate
        const unique = [];
        const seen = new Set();
        allFormats.forEach(f => {
            const key = f.qualityLabel + f.container;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(f);
            }
        });

        renderFormats(unique, details.title);
    }

    function renderFormats(formats, title) {
        formatList.innerHTML = '';
        formats.forEach(f => {
            const item = document.createElement('div');
            item.className = 'format-item';

            let label = f.qualityLabel;
            if (label.includes('2160') || label.includes('4320')) label = '🌟 ' + label;

            item.innerHTML = `
        <div>
          <div class="quality-tag">${label}</div>
          <div class="meta-tag">${f.container.toUpperCase()} | ${f.desc}</div>
        </div>
        <div style="font-size: 20px;">⬇️</div>
      `;

            item.addEventListener('click', () => initiateDownload(f, title));
            formatList.appendChild(item);
        });
        formatList.classList.remove('hidden');
    }

    async function initiateDownload(format, title) {
        if (!format.url) return showError('Invalid URL');
        const cleanTitle = title.replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `${cleanTitle}_${format.qualityLabel}.${format.container}`;

        if (format.isHighRes && format.audioUrl && ffmpeg) {
            // MERGE MODE
            statusBadge.textContent = 'Downloading...';
            scanBtn.disabled = true;

            try {
                // Download Video
                statusBadge.textContent = 'Fetching Video...';
                const vidData = await fetchFile(format.url);
                ffmpeg.FS('writeFile', 'video.mp4', vidData);

                // Download Audio
                statusBadge.textContent = 'Fetching Audio...';
                const audData = await fetchFile(format.audioUrl);
                ffmpeg.FS('writeFile', 'audio.mp4', audData);

                // Merge
                statusBadge.textContent = 'Merging (Wait)...';
                await ffmpeg.run('-i', 'video.mp4', '-i', 'audio.mp4', '-c', 'copy', 'output.mp4');

                // Save
                const data = ffmpeg.FS('readFile', 'output.mp4');
                const blob = new Blob([data.buffer], { type: 'video/mp4' });
                const url = URL.createObjectURL(blob);

                chrome.downloads.download({
                    url: url,
                    filename: filename,
                    saveAs: true
                });

                // Cleanup
                ffmpeg.FS('unlink', 'video.mp4');
                ffmpeg.FS('unlink', 'audio.mp4');
                ffmpeg.FS('unlink', 'output.mp4');

            } catch (e) {
                console.error(e);
                showError('Merge failed. Memory limit? Try 1080p.');
            } finally {
                statusBadge.textContent = 'Done';
                scanBtn.disabled = false;
            }

        } else {
            // STANDARD DOWNLOAD
            chrome.downloads.download({
                url: format.url,
                filename: filename,
                saveAs: true
            });
        }
    }

    function setLoading(loading) {
        statusBadge.textContent = loading ? 'Scanning...' : 'Ready';
        scanBtn.disabled = loading;
    }

    function resetUI() {
        errorMsg.classList.add('hidden');
        formatList.innerHTML = '';
    }

    function showError(msg) {
        errorMsg.textContent = msg;
        errorMsg.classList.remove('hidden');
    }
});
