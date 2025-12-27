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

# Global dictionary to store download progress
# Key: request_id, Value: dict with status info
download_progress = {}

def get_ffmpeg_path():
    return shutil.which('ffmpeg')

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
    data = request.json
    url = data.get('url')
    
    if not url:
        return jsonify({'error': 'URL is required'}), 400

    try:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            duration_s = info.get('duration', 0)
            
            formats = []
            seen_heights = set()
            
            # Find best audio size estimate for merging cases
            best_audio_size = 0
            for f in info.get('formats', []):
                if f.get('acodec') != 'none' and f.get('vcodec') == 'none':
                    size = f.get('filesize') or f.get('filesize_approx') or 0
                    # Fallback using audio bitrate (abr) if size missing
                    if size == 0 and f.get('abr') and duration_s > 0:
                        size = (f.get('abr') * 1024 * duration_s) / 8
                    
                    if size > best_audio_size:
                        best_audio_size = size

            for f in info.get('formats', []):
                height = f.get('height')
                if not height: continue
                ext = f.get('ext')
                if f.get('vcodec') == 'none': continue 

                label = f"{height}p"
                if height >= 2160: label = "4K (2160p)"
                elif height >= 1440: label = "2K (1440p)"
                elif height >= 1080: label = "1080p(HD)"
                
                if height not in seen_heights:
                    # 1. Try direct size
                    video_size = f.get('filesize') or f.get('filesize_approx') or 0
                    
                    # 2. Fallback: Calculation via Bitrate (tbr or vbr)
                    if video_size == 0 and duration_s > 0:
                        # tbr is total bitrate, vbr is video bitrate. 
                        # If progressive (audio+video), tbr is good. 
                        # If video-only, vbr is good, or tbr might be just vbr.
                        bitrate = f.get('tbr') or f.get('vbr')
                        if bitrate:
                            video_size = (bitrate * 1024 * duration_s) / 8
                    
                    total_size = 0
                    is_video_only = (f.get('acodec') == 'none')
                    
                    if is_video_only:
                        # Add audio size if we have a valid video size
                        if video_size > 0:
                            total_size = video_size + best_audio_size
                    else:
                        # Progressive stream (has audio), so video_size is the total size
                        total_size = video_size
                    
                    formats.append({
                        'height': height,
                        'ext': 'mp4',
                        'label': label,
                        'filesize_approx': total_size
                    })
                    seen_heights.add(height)
            
            formats.sort(key=lambda x: x['height'], reverse=True)
            
            # Extract audio formats
            audio_formats = []
            seen_audio_bitrates = set()
            
            for f in info.get('formats', []):
                # Look for audio-only streams
                if f.get('acodec') != 'none' and f.get('vcodec') == 'none':
                    abr = f.get('abr')  # Audio bitrate in kbps
                    if not abr:
                        continue
                    
                    # Round to nearest common bitrate to avoid showing every slight variation
                    rounded_abr = round(abr / 16) * 16  # Round to nearest 16kbps
                    
                    if rounded_abr not in seen_audio_bitrates:
                        # Calculate approximate size
                        audio_size = f.get('filesize') or f.get('filesize_approx') or 0
                        if audio_size == 0 and duration_s > 0:
                            audio_size = (rounded_abr * 1024 * duration_s) / 8
                        
                        audio_formats.append({
                            'quality': f'{rounded_abr}k',
                            'bitrate': rounded_abr,
                            'ext': f.get('ext', 'm4a'),
                            'label': f'{rounded_abr}kbps',
                            'filesize_approx': audio_size
                        })
                        seen_audio_bitrates.add(rounded_abr)
            
            audio_formats.sort(key=lambda x: x['bitrate'], reverse=True)
            
            # Debug: Show what audio formats were found
            if audio_formats:
                print(f"Found {len(audio_formats)} audio formats: {[f['label'] for f in audio_formats]}")
            else:
                print("No audio formats found for this video")


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
        print(f"Error extracting info: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/progress/<request_id>', methods=['GET'])
def get_progress(request_id):
    return jsonify(download_progress.get(request_id, {'status': 'unknown'}))

@app.route('/api/download', methods=['GET'])
def download_video():
    url = request.args.get('url')
    height = request.args.get('height')
    audio_quality = request.args.get('audio_quality')  # New parameter for audio downloads
    request_id = request.args.get('id', str(uuid.uuid4()))
    
    if not url:
        return jsonify({'error': 'URL is required'}), 400

    download_progress[request_id] = {
        'status': 'starting', 
        'progress': 0, 
        'stage': 'Initializing...',
        'system_cpu': psutil.cpu_percent(),
        'system_ram': psutil.virtual_memory().percent
    }

    try:
        temp_id = str(uuid.uuid4())
        output_template = os.path.join(DOWNLOAD_DIR, f'{temp_id}.%(ext)s')
        
        # Determine if this is an audio or video download
        if audio_quality:
            # Audio-only download
            ydl_opts = {
                'format': 'bestaudio/best',
                'outtmpl': output_template,
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': audio_quality.replace('k', ''),  # Remove 'k' from '128k'
                }],
                'quiet': True,
                'progress_hooks': [lambda d: progress_hook(d, request_id)],
            }
            file_ext = 'mp3'
            download_name = f"audio_{audio_quality}.mp3"
        else:
            # Video download
            ydl_opts = {
                'format': f'bestvideo[height<={height}]+bestaudio/best[height<={height}]',
                'outtmpl': output_template,
                'merge_output_format': 'mp4',
                'quiet': True,
                'progress_hooks': [lambda d: progress_hook(d, request_id)],
            }
            file_ext = 'mp4'
            download_name = f"video_{height}.mp4"
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
            
        downloaded_file = None
        for file in os.listdir(DOWNLOAD_DIR):
            if file.startswith(temp_id):
                downloaded_file = os.path.join(DOWNLOAD_DIR, file)
                break
        
        if not downloaded_file or not os.path.exists(downloaded_file):
            download_progress[request_id] = {'status': 'error', 'error': 'File not found'}
            return jsonify({'error': 'Download failed or file not found'}), 500

        download_progress[request_id] = {'status': 'completed', 'progress': 100, 'stage': 'Sending to client...'}

        @after_this_request
        def remove_file(response):
            """Delete the file immediately after sending to client"""
            def delayed_delete():
                time.sleep(1)  # Small delay to ensure file transfer completes
                try:
                    if os.path.exists(downloaded_file):
                        os.remove(downloaded_file)
                        print(f"Successfully deleted: {downloaded_file}")
                    # Clean up progress dict
                    if request_id in download_progress:
                        del download_progress[request_id]
                except Exception as e:
                    print(f"Error removing file: {e}")
            
            # Run deletion in background thread
            threading.Thread(target=delayed_delete, daemon=True).start()
            return response

        return send_file(downloaded_file, as_attachment=True, download_name=download_name)

    except Exception as e:
        download_progress[request_id] = {'status': 'error', 'error': str(e)}
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Start background cleanup thread
    cleanup_thread = threading.Thread(target=cleanup_old_files, daemon=True)
    cleanup_thread.start()
    print("Started background file cleanup thread (runs every 30 minutes)")
    
    # threaded=True is required so that the progress polling requests 
    # are not blocked by the main download request
    app.run(debug=True, host='0.0.0.0', port=5000, threaded=True)
