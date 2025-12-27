# StreamBolt - YouTube Video Downloader

A modern, high-performance YouTube video downloader with a beautiful dark-themed UI. Download videos in any quality up to 4K with real-time progress tracking.

![StreamBolt Dashboard](https://img.shields.io/badge/Status-Production-success)
![Python](https://img.shields.io/badge/Python-3.8+-blue)
![React](https://img.shields.io/badge/React-18+-61DAFB)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

- 🎬 **High-Quality Downloads** - Support for all resolutions up to 4K (2160p)
- 📊 **Real-Time Progress** - Live download progress with speed and ETA tracking
- 🎨 **Modern UI** - Sleek dark-themed interface with glassmorphism effects
- 📱 **Fully Responsive** - Works seamlessly on desktop, tablet, and mobile
- 🌐 **Network Access** - Access from any device on your local network
- 🧹 **Auto Cleanup** - Automatic file deletion after download completion
- ⚡ **Fast & Efficient** - Powered by yt-dlp and FFmpeg

## 🛠️ Tech Stack

### Backend
- **Flask** - Lightweight Python web framework
- **yt-dlp** - YouTube video/audio downloader
- **FFmpeg** - Video/audio stream merging for high-quality downloads
- **psutil** - System monitoring

### Frontend
- **React** - Modern UI library
- **Vite** - Next-generation frontend tooling
- **Tailwind CSS** - Utility-first CSS framework
- **Axios** - HTTP client for API requests
- **Lucide React** - Beautiful icon library

## 📋 Prerequisites

- **Python 3.8+**
- **Node.js 16+** and npm
- **FFmpeg** (required for 1080p+ downloads)

### Installing FFmpeg

**Windows:**
```bash
# Using chocolatey
choco install ffmpeg

# Or download from: https://ffmpeg.org/download.html
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt install ffmpeg  # Debian/Ubuntu
sudo yum install ffmpeg  # CentOS/RHEL
```

## 🚀 Installation

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd "Youtube video download"
```

### 2. Backend Setup
```bash
# Create virtual environment
python -m venv server/venv

# Activate virtual environment
# Windows:
server\venv\Scripts\activate
# macOS/Linux:
source server/venv/bin/activate

# Install dependencies
pip install -r server/requirements.txt
```

### 3. Frontend Setup
```bash
cd client
npm install
cd ..
```

## 🎯 Usage

### Starting the Application

**Option 1: Local Access Only (localhost)**
```bash
# Terminal 1 - Start Backend
python server/app.py

# Terminal 2 - Start Frontend
cd client
npm run dev
```

Access at: `http://localhost:5173`

**Option 2: Network Access (Access from other devices)**

Backend is already configured for `0.0.0.0`. Frontend will automatically detect your IP.

1. Start the backend:
```bash
python server/app.py
```

2. Start the frontend:
```bash
cd client
npm run dev
```

3. Find your computer's IP address:
```bash
# Windows
ipconfig

# macOS/Linux
ifconfig
```

4. Access from any device on your network:
```
http://<YOUR_IP_ADDRESS>:5173
```

Example: `http://192.168.1.100:5173`

### Downloading Videos

1. **Paste YouTube URL** - Copy any YouTube video link
2. **Click "Get"** - Fetch video information and available qualities
3. **Select Quality** - Choose from available formats (144p to 4K)
4. **Download** - Click your preferred quality to start downloading

The video will automatically download to your browser's default download folder.

## 🎨 Features in Detail

### Progress Tracking
- **Real-time updates** - Progress bar updates every second
- **Download speed** - See current download speed (MB/s)
- **ETA** - Estimated time remaining
- **Visual feedback** - Smooth animations and status indicators

### Quality Options
- **2K (1440p)** - High quality with FFmpeg merging
- **1080p (Full HD)** - Requires FFmpeg for best quality
- **720p (HD)** - Standard HD quality
- **480p/360p/240p** - Lower resolutions for smaller file sizes

### Automatic File Cleanup
- Files are deleted from the server **1 second** after download completes
- Background cleanup removes orphaned files older than **1 hour**
- Runs automatically every **30 minutes**

## 🔧 Configuration

### Backend Configuration (`server/app.py`)
```python
# Default settings
HOST = '0.0.0.0'  # Listen on all interfaces
PORT = 5000
DEBUG = True
CLEANUP_INTERVAL = 30 * 60  # 30 minutes
FILE_RETENTION = 60 * 60  # 1 hour
```

### Frontend Configuration (`client/vite.config.js`)
```javascript
server: {
  host: '0.0.0.0',  // Expose to network
}
```

## 📁 Project Structure
```
Youtube video download/
├── client/                 # React frontend
│   ├── src/
│   │   ├── App.jsx        # Main application component
│   │   └── index.css      # Global styles
│   ├── package.json
│   └── vite.config.js
├── server/                # Flask backend
│   ├── app.py            # Main server file
│   ├── requirements.txt
│   └── venv/             # Virtual environment
├── downloads/            # Temporary download storage (auto-created)
└── README.md
```

## 🐛 Troubleshooting

### Issue: Progress bar stuck at 0%
**Solution:** Restart the backend with `threaded=True` (already configured)

### Issue: 4K/1080p downloads fail
**Solution:** Install FFmpeg (see Prerequisites section)

### Issue: Cannot access from mobile
**Solution:** 
- Ensure both devices are on the same network
- Check firewall settings (allow port 5000 and 5173)
- Use your computer's IP address, not localhost

### Issue: Files accumulating on server
**Solution:** Files should auto-delete. Check server logs for errors. Restart server if needed.

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🙏 Credits

- **yt-dlp** - YouTube downloading functionality
- **FFmpeg** - Video/audio processing
- **React** & **Tailwind CSS** - Modern UI framework
- **Flask** - Backend server

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests

## 📞 Support

If you encounter any issues, please check the Troubleshooting section or open an issue on GitHub.

---

**Enjoy downloading!** 🎉
