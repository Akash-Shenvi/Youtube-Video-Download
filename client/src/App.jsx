import { useState, useRef } from 'react';
import axios from 'axios';
import {
  Search, Download, Loader2, AlertCircle, Cpu, HardDrive,
  Activity, CheckCircle2, Film, Settings, Wifi, ArrowRight, Music
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import './App.css';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Dynamically determine the backend URL based on where the frontend is loaded from
const API_BASE = `http://${window.location.hostname}:5000`;

// Simple UUID generator that works in non-secure contexts (HTTP)
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function App() {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [downloadMode, setDownloadMode] = useState('video'); // 'video' or 'audio'

  const fetchInfo = async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    setVideoInfo(null);

    try {
      const response = await axios.post(`${API_BASE}/api/info`, { url });
      setVideoInfo(response.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to fetch video info. Ensure server is running.');
    } finally {
      setLoading(false);
    }
  };

  const pollProgress = async (requestId) => {
    const interval = setInterval(async () => {
      try {
        const { data } = await axios.get(`${API_BASE}/api/progress/${requestId}`);
        if (data && data.status) {
          setProgress(data);
          if (data.status === 'completed' || data.status === 'error') {
            clearInterval(interval);
            setTimeout(() => setDownloading(false), 2000);
          }
        }
      } catch (e) {
        console.error("Progress poll error", e);
      }
    }, 1000);
    return interval;
  };

  const handleDownload = async (height) => {
    try {
      setDownloading(true);
      setProgress({ status: 'starting', progress: 0, stage: 'Initiating...', speed: '-', eta: '-' });

      const requestId = generateUUID();
      const intervalId = await pollProgress(requestId);

      const response = await axios.get(`${API_BASE}/api/download`, {
        params: { url, height, id: requestId },
        responseType: 'blob',
      });

      const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `${videoInfo.title.replace(/[^a-zA-Z0-9]/g, '_')}_${height}p.mp4`);
      document.body.appendChild(link);
      link.click();
      link.remove();

    } catch (err) {
      console.error("Download Error:", err);
      setProgress({ status: 'error', error: 'Download failed. Check server connection.' });
      alert("Download failed! Check console for details.");
      setDownloading(false);
    }
  };

  const handleAudioDownload = async (quality) => {
    try {
      setDownloading(true);
      setProgress({ status: 'starting', progress: 0, stage: 'Extracting audio...', speed: '-', eta: '-' });

      const requestId = generateUUID();
      const intervalId = await pollProgress(requestId);

      const response = await axios.get(`${API_BASE}/api/download`, {
        params: { url, audio_quality: quality, id: requestId },
        responseType: 'blob',
      });

      const downloadUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `${videoInfo.title.replace(/[^a-zA-Z0-9]/g, '_')}_${quality}.mp3`);
      document.body.appendChild(link);
      link.click();
      link.remove();

    } catch (err) {
      console.error("Audio Download Error:", err);
      setProgress({ status: 'error', error: 'Audio download failed. Ensure FFmpeg is installed.' });
      alert("Audio download failed! Check console for details.");
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 sm:p-6 font-sans text-slate-200">

      {/* Main Dashboard Container */}
      <div className="w-full max-w-[95vw] h-auto md:h-[90vh] bg-[#0f111a] border border-white/5 rounded-2xl sm:rounded-3xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col md:flex-row animate-slide-up relative">

        {/* Sidebar (Desktop Only) */}
        <div className="hidden md:flex w-72 bg-[#161b2c] border-r border-white/5 p-8 flex-col justify-between shrink-0 relative overflow-hidden">
          {/* Decorative Orb */}
          <div className="absolute top-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

          <div>
            <div className="flex items-center gap-3 mb-10 relative z-10">
              <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
                <Film className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">Stream<span className="text-blue-500">Bolt</span></span>
            </div>

            <nav className="space-y-2 relative z-10">
              <div className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl text-white font-medium border border-white/5">
                <Download className="w-5 h-5 text-blue-400" />
                <span>Downloader</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-slate-300 transition-colors cursor-not-allowed">
                <Settings className="w-5 h-5" />
                <span>Settings</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-slate-300 transition-colors cursor-not-allowed">
                <Activity className="w-5 h-5" />
                <span>History</span>
              </div>
            </nav>
          </div>

          <div className="relative z-10">
            <div className="bg-[#1e2336] p-4 rounded-xl border border-white/5">
              <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider font-semibold">Server Status</p>
              <div className="flex items-center gap-2 text-green-400">
                <Wifi className="w-4 h-4" />
                <span className="text-sm font-medium">Connected</span>
              </div>
            </div>
          </div>
        </div>

        {/* content Area */}
        <div className="flex-1 p-5 sm:p-10 flex flex-col relative bg-[#0f111a]">

          {/* Mobile Header */}
          <div className="md:hidden flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-500/20">
                <Film className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-white">Stream<span className="text-blue-500">Bolt</span></span>
            </div>
            <div className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded-full border border-white/10">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-mono text-slate-300">ONLINE</span>
            </div>
          </div>

          {/* Top Bar (Desktop) */}
          <div className="hidden md:flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Video Download</h2>
              <p className="text-slate-400 text-sm">Paste a URL to extract high-quality video.</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-mono text-slate-300">SYSTEM: ONLINE</span>
            </div>
          </div>

          {/* Mobile Title */}
          <div className="md:hidden mb-6">
            <h2 className="text-xl font-bold text-white">Video Download</h2>
            <p className="text-slate-400 text-xs">Paste a URL to extract high-quality video.</p>
          </div>

          {/* Input Section */}
          <div className="relative max-w-2xl w-full mb-8 group z-20">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-20 group-hover:opacity-60 transition duration-500" />
            <div className="relative flex items-center bg-[#1e2336] rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
              <Search className="ml-4 text-slate-400 w-5 h-5 shrink-0" />
              <input
                type="text"
                placeholder="Paste YouTube Link..."
                className="w-full bg-transparent border-none py-3 sm:py-4 px-3 sm:px-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-0 text-sm sm:text-base font-medium truncate"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchInfo()}
              />
              <button
                onClick={fetchInfo}
                disabled={loading}
                className="mr-1.5 my-1.5 bg-blue-600 hover:bg-blue-500 text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:grayscale flex items-center gap-2 text-sm shrink-0"
              >
                {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <span className="hidden sm:inline">Get</span>}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 animate-slide-up text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 relative min-h-[300px]">

            {!videoInfo && !loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-white/5 rounded-3xl bg-white/[0.02] p-4 text-center">
                <div className="bg-white/5 p-4 rounded-full mb-4">
                  <Film className="w-8 h-8 opacity-50" />
                </div>
                <p className="font-medium text-sm">Ready to process</p>
              </div>
            )}

            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                <p className="text-slate-400 animate-pulse text-sm">Analyzing video metadata...</p>
              </div>
            )}

            {videoInfo && (
              <div className="h-full flex flex-col gap-6 animate-slide-up">

                {/* Video Hero */}
                <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start">
                  <div className="w-full lg:w-48 aspect-video bg-black rounded-lg shadow-2xl overflow-hidden border border-white/10 shrink-0 relative group">
                    <img src={videoInfo.thumbnail} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <span className="absolute bottom-2 right-2 text-xs font-mono font-bold bg-black/60 backdrop-blur px-1.5 py-0.5 rounded text-white">
                      {Math.floor(videoInfo.duration / 60)}:{(videoInfo.duration % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                  <div className="flex-1 w-full">
                    <h3 className="text-lg sm:text-xl font-bold text-white leading-tight mb-2 line-clamp-2">{videoInfo.title}</h3>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="text-blue-400 text-sm font-medium">{videoInfo.author}</span>
                      {videoInfo.ffmpeg_available
                        ? <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/20 whitespace-nowrap">MERGE READY</span>
                        : <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-500/20 whitespace-nowrap">NO FFMPEG</span>
                      }
                    </div>
                    <div className="hidden sm:block text-sm text-slate-400 line-clamp-2">
                      Full professional quality options extracted successfully. Select a format below to begin conversion and download.
                    </div>
                  </div>
                </div>

                {/* Video/Audio Mode Toggle */}
                <div className="flex items-center gap-2 mb-6">
                  <button
                    onClick={() => setDownloadMode('video')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all",
                      downloadMode === 'video'
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                        : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Film className="w-4 h-4" />
                    <span className="text-sm">Video</span>
                  </button>
                  <button
                    onClick={() => setDownloadMode('audio')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all",
                      downloadMode === 'audio'
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                        : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Music className="w-4 h-4" />
                    <span className="text-sm">Audio Only</span>
                  </button>
                </div>

                {/* System / Download Area */}
                {downloading && progress ? (
                  <div className="bg-[#161b2c] rounded-2xl p-4 sm:p-6 border border-white/5 relative overflow-hidden">
                    {/* Live Monitor Effect */}
                    <div className="absolute top-0 right-0 p-4 opacity-50">
                      <Activity className="w-24 h-24 text-blue-500/10 absolute top-4 right-4 animate-pulse" />
                    </div>

                    <div className="flex justify-between items-end mb-4 relative z-10">
                      <div>
                        <h4 className="text-white font-bold mb-1 text-sm sm:text-base">Processing...</h4>
                        <p className="text-xs sm:text-sm text-slate-400 font-mono truncate max-w-[150px] sm:max-w-none">{progress.stage}</p>
                      </div>
                      <div className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 tabular-nums">
                        {progress.progress?.toFixed(0)}%
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 bg-black/50 rounded-full overflow-hidden mb-6 relative z-10">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all duration-300 ease-out"
                        style={{ width: `${progress.progress}%` }}
                      />
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-3 relative z-10 max-w-lg mx-auto">
                      <div className="bg-black/20 p-2 sm:p-3 rounded-lg border border-white/5 text-center">
                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Speed</div>
                        <div className="text-sm sm:text-lg font-mono text-emerald-3000 truncate">{progress.speed || '-'}</div>
                      </div>
                      <div className="bg-black/20 p-2 sm:p-3 rounded-lg border border-white/5 text-center">
                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">ETA</div>
                        <div className="text-sm sm:text-lg font-mono text-white truncate">{progress.eta || '-'}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Quality Selector */
                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    {downloadMode === 'video' ? (
                      /* Video Formats */
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {videoInfo.formats.map((format, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleDownload(format.height)}
                            className="group flex flex-col items-start p-3 sm:p-4 rounded-xl border border-white/5 bg-[#161b2c] hover:bg-[#1f263a] hover:border-blue-500/30 transition-all text-left relative overflow-hidden active:scale-98"
                          >
                            <div className="flex justify-between w-full mb-1 sm:mb-2">
                              <span className={cn(
                                "font-bold text-base sm:text-lg",
                                format.height >= 1080 ? "text-blue-400" : "text-white"
                              )}>{format.label}</span>
                              <span className="text-[10px] sm:text-xs font-mono text-slate-500 px-1.5 py-0.5 rounded bg-black/30 border border-white/5 uppercase">{format.ext}</span>
                            </div>
                            <div className="text-xs sm:text-sm text-slate-400 flex items-center gap-2">
                              <Download className="w-3 h-3 group-hover:text-blue-400 transition-colors" />
                              <span className="truncate">Click to Download</span>
                            </div>
                            {format.filesize_approx && (
                              <div className="mt-2 text-[10px] sm:text-xs text-slate-600 font-mono">
                                ~{(format.filesize_approx / 1024 / 1024).toFixed(1)} MB
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      /* Audio Formats */
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {videoInfo.audio_formats?.length > 0 ? (
                          videoInfo.audio_formats.map((format, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleAudioDownload(format.quality)}
                              className="group flex flex-col items-start p-3 sm:p-4 rounded-xl border border-white/5 bg-[#161b2c] hover:bg-[#1f263a] hover:border-purple-500/30 transition-all text-left relative overflow-hidden active:scale-98"
                            >
                              <div className="flex justify-between w-full mb-1 sm:mb-2">
                                <span className="font-bold text-base sm:text-lg text-purple-400">{format.label}</span>
                                <span className="text-[10px] sm:text-xs font-mono text-slate-500 px-1.5 py-0.5 rounded bg-black/30 border border-white/5 uppercase">MP3</span>
                              </div>
                              <div className="text-xs sm:text-sm text-slate-400 flex items-center gap-2">
                                <Music className="w-3 h-3 group-hover:text-purple-400 transition-colors" />
                                <span className="truncate">Extract Audio</span>
                              </div>
                              {format.filesize_approx && (
                                <div className="mt-2 text-[10px] sm:text-xs text-slate-600 font-mono">
                                  ~{(format.filesize_approx / 1024 / 1024).toFixed(1)} MB
                                </div>
                              )}
                            </button>
                          ))
                        ) : (
                          <div className="col-span-full text-center p-8 text-slate-500">
                            No audio formats available
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;
