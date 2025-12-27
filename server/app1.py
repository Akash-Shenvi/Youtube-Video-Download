from flask import Flask, request, jsonify, send_file, after_this_request, Response
from flask_cors import CORS
import yt_dlp
import os
import uuid
import shutil
import time
import json
import psutil
import threading
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)

DOWNLOAD_DIR = os.path.join(os.getcwd(), 'downloads')
if not os.path.exists(DOWNLOAD_DIR):
    os.makedirs(DOWNLOAD_DIR)

CACHE_DIR = os.path.join(os.getcwd(), 'cache')
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)

# Legacy cookie support (optional)
COOKIE_DIR = os.path.join(os.getcwd(), 'cookies')
if not os.path.exists(COOKIE_DIR):
    os.makedirs(COOKIE_DIR)
COOKIE_FILE_PATH = os.path.join(COOKIE_DIR, 'cookies.txt')

# Global dictionary to store download progress
# Key: request_id, Value: dict with status info
download_progress = {}

# Global dictionary to store download progress
# Key: request_id, Value: dict with status info
download_progress = {}

def get_ffmpeg_path():
    return shutil.which('ffmpeg')

def build_cookiefile_from_request(data):
    """
    Accepts Netscape cookie text from extension and writes a temp cookie file.
    Returns path or None.
    """
    cookies_txt = data.get("cookies")
    if not cookies_txt:
        return None

    temp_cookie = os.path.join(CACHE_DIR, f"{uuid.uuid4()}.txt")
    with open(temp_cookie, "w", encoding="utf-8") as f:
        f.write(cookies_txt)

    return temp_cookie

# Cleanup old files periodically (runs in background)
def cleanup_old_files():
    """Delete files older than 1 hour from the downloads directory"""
    while True:
        try:
            now = time.time()
            cutoff = now - (60 * 60)  # 1 hour
            
            for filename in os.listdir(DOWNLOAD_DIR):
                filepath = os.path.join(DOWNLOAD_DIR, filename)
                if os.path.isfile(filepath):
                    file_modified = os.path.getmtime(filepath)
                    if file_modified < cutoff:
                        try:
                            os.remove(filepath)
                            print(f"Cleaned up old file: {filename}")
                        except Exception as e:
                            print(f"Error deleting {filename}: {e}")
        except Exception as e:
            print(f"Cleanup error: {e}")
        
        # Run cleanup every 30 minutes
        time.sleep(30 * 60)

def progress_hook(d, request_id):
    if d['status'] == 'downloading':
        try:
            total = d.get('total_bytes') or d.get('total_bytes_estimate')
            downloaded = d.get('downloaded_bytes', 0)
            
            if total:
                p = (downloaded / total) * 100
            else:
                p = 0
            
            speed = d.get('_speed_str', 'N/A')
            eta = d.get('_eta_str', 'N/A')
            
            # Use ANSI strip just in case speed/eta have colors
            if hasattr(speed, 'replace'): speed = speed.replace('\x1b', '').replace('[0m', '')
            
            download_progress[request_id] = {
                'status': 'downloading',
                'progress': p,
                'speed': speed,
                'eta': eta,
                'stage': 'Downloading from YouTube...',
            }
        except Exception as e:
            print(f"Progress Hook Error: {e}")
    elif d['status'] == 'finished':
        download_progress[request_id] = {
            'status': 'processing',
            'progress': 100,
            'stage': 'Merging Video & Audio (FFmpeg)...',
            'speed': '-',
            'eta': '0s'
        }

@app.route('/api/info', methods=['POST'])
def get_video_info():
    data = request.json or {}
    url = data.get('url')

    if not url:
        return jsonify({'error': 'URL is required'}), 400

    temp_cookie = None

    try:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'socket_timeout': 15
        }

        # 🔐 INLINE COOKIES FROM EXTENSION
        temp_cookie = build_cookiefile_from_request(data)
        if temp_cookie:
            ydl_opts['cookiefile'] = temp_cookie
        elif os.path.exists(COOKIE_FILE_PATH):
            ydl_opts['cookiefile'] = COOKIE_FILE_PATH

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            duration_s = info.get('duration', 0)

            formats = []
            audio_formats = []
            seen_heights = set()
            seen_audio = set()

            # ---------- AUDIO SIZE ESTIMATE ----------
            best_audio_size = 0
            for f in info.get('formats', []):
                if f.get('vcodec') == 'none' and f.get('acodec') != 'none':
                    size = f.get('filesize') or f.get('filesize_approx') or 0
                    if size == 0 and f.get('abr') and duration_s:
                        size = (f['abr'] * 1024 * duration_s) / 8
                    best_audio_size = max(best_audio_size, size)

            # ---------- VIDEO FORMATS ----------
            for f in info.get('formats', []):
                height = f.get('height')
                if not height or f.get('vcodec') == 'none':
                    continue

                if height in seen_heights:
                    continue

                seen_heights.add(height)
                bitrate = f.get('tbr') or f.get('vbr') or 0
                size = f.get('filesize') or f.get('filesize_approx') or 0

                if size == 0 and duration_s and bitrate:
                    size = (bitrate * 1024 * duration_s) / 8

                if f.get('acodec') == 'none':
                    size += best_audio_size

                label = f"{height}p"
                formats.append({
                    'height': height,
                    'label': label,
                    'filesize_approx': int(size)
                })

            formats.sort(key=lambda x: x['height'], reverse=True)

            # ---------- AUDIO FORMATS ----------
            for f in info.get('formats', []):
                if f.get('vcodec') == 'none' and f.get('acodec') != 'none':
                    abr = round((f.get('abr') or 0) / 16) * 16
                    if abr and abr not in seen_audio:
                        seen_audio.add(abr)
                        audio_formats.append({
                            'quality': f"{abr}k",
                            'label': f"{abr}kbps"
                        })

            audio_formats.sort(key=lambda x: int(x['quality'].replace('k', '')), reverse=True)

            return jsonify({
                'title': info.get('title'),
                'thumbnail': info.get('thumbnail'),
                'duration': info.get('duration'),
                'formats': formats,
                'audio_formats': audio_formats,
                'author': info.get('uploader'),
                'ffmpeg_available': get_ffmpeg_path() is not None
            })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

    finally:
        if temp_cookie and os.path.exists(temp_cookie):
            os.remove(temp_cookie)


@app.route('/api/progress/<request_id>', methods=['GET'])
def get_progress(request_id):
    return jsonify(download_progress.get(request_id, {'status': 'unknown'}))

@app.route('/api/download', methods=['GET', 'POST'])
def download_video():
    # Support both GET (web client) and POST (extension)
    if request.method == 'POST':
        data = request.json or {}
        url = data.get('url')
        height = data.get('height')
        audio_quality = data.get('audio_quality')
        request_id = data.get('id', str(uuid.uuid4()))
    else:
        url = request.args.get('url')
        height = request.args.get('height')
        audio_quality = request.args.get('audio_quality')
        request_id = request.args.get('id', str(uuid.uuid4()))

    if not url:
        return jsonify({'error': 'URL is required'}), 400

    download_progress[request_id] = {
        'status': 'starting',
        'progress': 0,
        'stage': 'Initializing...'
    }

    temp_cookie = None

    try:
        temp_id = str(uuid.uuid4())
        output_template = os.path.join(DOWNLOAD_DIR, f'{temp_id}.%(ext)s')

        if audio_quality:
            ydl_opts = {
                'format': 'bestaudio/best',
                'outtmpl': output_template,
                'quiet': True,
                'socket_timeout': 15,
                'progress_hooks': [lambda d: progress_hook(d, request_id)],
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': audio_quality.replace('k', '')
                }]
            }
            download_name = f"audio_{audio_quality}.mp3"
        else:
            ydl_opts = {
                'format': f'bestvideo[height<={height}]+bestaudio/best',
                'outtmpl': output_template,
                'merge_output_format': 'mp4',
                'quiet': True,
                'socket_timeout': 15,
                'progress_hooks': [lambda d: progress_hook(d, request_id)]
            }
            download_name = f"video_{height}.mp4"

        # 🔐 INLINE COOKIES
        if request.method == 'POST':
            temp_cookie = build_cookiefile_from_request(data)
        else:
            temp_cookie = build_cookiefile_from_request(request.args)
            
        if temp_cookie:
            ydl_opts['cookiefile'] = temp_cookie
        elif os.path.exists(COOKIE_FILE_PATH):
            ydl_opts['cookiefile'] = COOKIE_FILE_PATH

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        downloaded_file = next(
            (os.path.join(DOWNLOAD_DIR, f) for f in os.listdir(DOWNLOAD_DIR) if f.startswith(temp_id)),
            None
        )

        if not downloaded_file:
            return jsonify({'error': 'Download failed'}), 500

        download_progress[request_id] = {'status': 'completed', 'progress': 100}

        return send_file(downloaded_file, as_attachment=True, download_name=download_name)

    except Exception as e:
        download_progress[request_id] = {'status': 'error', 'error': str(e)}
        return jsonify({'error': str(e)}), 500

    finally:
        if temp_cookie and os.path.exists(temp_cookie):
            os.remove(temp_cookie)


@app.route('/api/auth/check', methods=['GET'])
def check_auth():
    """Check if we have valid credentials (cookie)"""
    has_cookies = os.path.exists(COOKIE_FILE_PATH)
    return jsonify({
        'authenticated': has_cookies,
        'method': 'cookies' if has_cookies else 'none'
    })

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    """Clear credentials"""
    try:
        if os.path.exists(COOKIE_FILE_PATH):
            # os.remove(COOKIE_FILE_PATH) # User requested to KEEP manual cookies
            pass
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Cookie Upload Endpoints ---

@app.route('/api/cookies/upload', methods=['POST'])
def upload_cookies():
    """Upload YouTube cookies file for authentication"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Save the cookie file
        file.save(COOKIE_FILE_PATH)
        
        # Validate cookie file format
        try:
            with open(COOKIE_FILE_PATH, 'r') as f:
                content = f.read()
                if not content.strip():
                    os.remove(COOKIE_FILE_PATH)
                    return jsonify({'error': 'Cookie file is empty'}), 400
        except Exception as e:
            if os.path.exists(COOKIE_FILE_PATH):
                os.remove(COOKIE_FILE_PATH)
            return jsonify({'error': f'Invalid cookie file: {str(e)}'}), 400
        
        return jsonify({
            'success': True,
            'message': 'Cookies uploaded successfully',
            'authenticated': True
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cookies/status', methods=['GET'])
def cookie_status():
    # Redirect to generic auth check
    return check_auth()

@app.route('/api/cookies/delete', methods=['DELETE'])
def delete_cookies():
    """Delete stored cookies"""
    try:
        if os.path.exists(COOKIE_FILE_PATH):
            os.remove(COOKIE_FILE_PATH)
            return jsonify({
                'success': True,
                'message': 'Cookies deleted successfully'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'No cookies found'
            }), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Start background cleanup thread
    # cleanup_thread = threading.Thread(target=cleanup_old_files, daemon=True)
    # cleanup_thread.start() # Disabled to keep files
    print("Background file cleanup thread DISABLED (keeping files forever)")
    print("Started background file cleanup thread (runs every 30 minutes)")
    
    # threaded=True is required so that the progress polling requests 
    # are not blocked by the main download request
    app.run(debug=True, host='0.0.0.0', port=5000, threaded=True)
