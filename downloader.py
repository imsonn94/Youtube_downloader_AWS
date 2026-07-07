import os
import re
import json
import uuid
import signal
import shutil
import threading
import subprocess
from datetime import datetime

# Safe imports for yt-dlp
try:
    import yt_dlp
except ImportError:
    yt_dlp = None

SETTINGS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'settings.json')

def load_settings():
    default_path = os.path.expanduser('~/Downloads')
    default_settings = {
        'save_path': default_path,
        'theme': 'dark',
        'max_concurrent': 2,
        'default_format': 'video_high',
        'auto_update': True
    }
    
    if not os.path.exists(SETTINGS_FILE):
        save_settings(default_settings)
        return default_settings
        
    try:
        with open(SETTINGS_FILE, 'r', encoding='utf-8') as f:
            settings = json.load(f)
            # Ensure all keys exist
            for k, v in default_settings.items():
                if k not in settings:
                    settings[k] = v
            return settings
    except Exception:
        return default_settings

def save_settings(settings):
    try:
        with open(SETTINGS_FILE, 'w', encoding='utf-8') as f:
            json.dump(settings, f, indent=4, ensure_ascii=False)
        return True
    except Exception:
        return False

def check_ffmpeg():
    """Checks if ffmpeg and ffprobe are available in the system PATH."""
    ffmpeg_path = shutil.which('ffmpeg')
    ffprobe_path = shutil.which('ffprobe')
    
    # Check common Homebrew locations just in case they aren't in Flask's PATH
    brew_paths = [
        '/opt/homebrew/bin/ffmpeg',
        '/usr/local/bin/ffmpeg'
    ]
    if not ffmpeg_path:
        for path in brew_paths:
            if os.path.exists(path):
                ffmpeg_path = path
                break
                
    return {
        'ffmpeg_installed': ffmpeg_path is not None,
        'ffmpeg_path': ffmpeg_path,
        'ffprobe_installed': ffprobe_path is not None
    }

def format_duration(seconds):
    if not seconds:
        return "00:00"
    try:
        seconds = int(seconds)
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        secs = seconds % 60
        if hours > 0:
            return f"{hours:02d}:{minutes:02d}:{secs:02d}"
        else:
            return f"{minutes:02d}:{secs:02d}"
    except Exception:
        return "00:00"

def get_video_info(url):
    """Extracts metadata and format options from a YouTube URL."""
    # Ensure yt_dlp is installed and available
    if not yt_dlp:
        raise Exception("yt-dlp 라이브러리가 설치되지 않았습니다. 종속성을 확인하세요.")
        
    # We want to check ffmpeg status to decide what resolution formats we can support
    ffmpeg_status = check_ffmpeg()
    
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        # Avoid geo-blocking & extract info quickly
        'socket_timeout': 10,
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
        except Exception as e:
            error_str = str(e)
            # Make user friendly error messages in Korean
            if "Video unavailable" in error_str:
                raise Exception("동영상을 볼 수 없습니다. 비공개이거나 삭제된 영상일 수 있습니다.")
            elif "Incomplete" in error_str or "Invalid" in error_str:
                raise Exception("올바르지 않은 유튜브 URL 주소입니다.")
            elif "The page needs to be reloaded" in error_str:
                raise Exception("유튜브가 일시적으로 다운로더를 차단했습니다. 잠시 후 다시 시도하거나 프로그램 설정을 업데이트하세요.")
            else:
                raise Exception(f"URL 분석 실패: {error_str}")
                
        if not info:
            raise Exception("비디오 정보를 가져올 수 없습니다.")
            
        # Handle playlist if applicable
        if 'entries' in info:
            # It's a playlist. For this app, we'll return playlist info.
            entries = list(info['entries'])
            return {
                'is_playlist': True,
                'title': info.get('title', '재생목록'),
                'id': info.get('id'),
                'count': len(entries),
                'entries': [{
                    'title': entry.get('title'),
                    'url': f"https://www.youtube.com/watch?v={entry.get('id')}",
                    'id': entry.get('id')
                } for entry in entries if entry]
            }

        # Filter video formats
        formats = info.get('formats', [])
        video_formats = []
        audio_formats = []
        
        # Track added resolutions to avoid duplicates
        added_resolutions = set()
        
        # yt-dlp formats list is ordered by quality, we iterate to collect video resolutions
        for f in formats:
            # We want formats with video
            if f.get('vcodec') != 'none' and f.get('height'):
                height = f.get('height')
                # Map to standard resolution labels
                res_label = f"{height}p"
                if height >= 2160:
                    res_label = "4K (2160p)"
                elif height >= 1440:
                    res_label = "2K (1440p)"
                elif height >= 1080:
                    res_label = "1080p (FHD)"
                elif height >= 720:
                    res_label = "720p (HD)"
                elif height >= 480:
                    res_label = "480p"
                elif height >= 360:
                    res_label = "360p"
                else:
                    res_label = f"{height}p"
                
                # Deduplicate by resolution height & extension
                # Focus on mp4 or formats that can be merged into mp4
                ext = f.get('ext')
                res_key = (height, ext)
                
                if res_key not in added_resolutions:
                    added_resolutions.add(res_key)
                    
                    # Estimate filesize
                    filesize = f.get('filesize') or f.get('filesize_approx') or 0
                    filesize_str = f"{filesize / (1024*1024):.1f} MB" if filesize else "크기 확인 불가"
                    
                    video_formats.append({
                        'format_id': f.get('format_id'),
                        'resolution': res_label,
                        'height': height,
                        'ext': 'mp4', # Force merging to mp4
                        'fps': f.get('fps'),
                        'filesize_str': filesize_str,
                        'filesize_bytes': filesize
                    })
                    
        # Sort video formats by resolution height descending
        video_formats.sort(key=lambda x: x['height'], reverse=True)
        
        # Audio formats (MP3/M4A)
        # We can extract audio from the bestaudio format
        audio_formats.append({
            'format_id': 'bestaudio',
            'ext': 'mp3',
            'quality': '최고 음질 (MP3 320kbps)',
            'filesize_str': '음악 추출'
        })
        audio_formats.append({
            'format_id': 'bestaudio',
            'ext': 'm4a',
            'quality': '원본 오디오 (M4A)',
            'filesize_str': '오디오 추출'
        })
        
        # Get thumbnail
        thumbnails = info.get('thumbnails', [])
        thumbnail = info.get('thumbnail')
        if thumbnails and not thumbnail:
            thumbnail = thumbnails[-1].get('url')
            
        return {
            'is_playlist': False,
            'id': info.get('id'),
            'title': info.get('title'),
            'thumbnail': thumbnail,
            'duration': info.get('duration'),
            'duration_str': format_duration(info.get('duration')),
            'channel': info.get('uploader'),
            'video_formats': video_formats,
            'audio_formats': audio_formats,
            'url': url
        }

class DownloadQueueManager:
    def __init__(self):
        self.queue = []
        self.active_downloads = {} # key: download_id, value: subprocess.Popen
        self.lock = threading.Lock()
        self.settings = load_settings()
        
    def add_item(self, url, title, thumbnail, duration_str, format_id, format_type, ext):
        item_id = str(uuid.uuid4())
        settings = load_settings()
        
        item = {
            'id': item_id,
            'url': url,
            'title': title,
            'thumbnail': thumbnail,
            'duration_str': duration_str,
            'format_id': format_id,
            'format_type': format_type,
            'ext': ext,
            'status': 'queued', # queued, downloading, paused, completed, failed, canceled
            'progress': 0.0,
            'speed': '0 KB/s',
            'eta': '대기 중',
            'size': '대기 중',
            'error_message': None,
            'save_path': settings['save_path'],
            'added_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        with self.lock:
            self.queue.append(item)
            
        # Start download loop in background if not already running
        self._trigger_download_loop()
        return item_id
        
    def get_all_items(self):
        with self.lock:
            # Return a copy of the queue items
            return list(self.queue)
            
    def get_item(self, item_id):
        with self.lock:
            for item in self.queue:
                if item['id'] == item_id:
                    return item
        return None
        
    def remove_item(self, item_id):
        self.cancel_download(item_id)
        with self.lock:
            self.queue = [item for item in self.queue if item['id'] != item_id]
        return True
        
    def clear_completed(self):
        with self.lock:
            self.queue = [item for item in self.queue if item['status'] not in ['completed', 'failed', 'canceled']]
        return True

    def _trigger_download_loop(self):
        threading.Thread(target=self._process_queue, daemon=True).start()
        
    def _process_queue(self):
        settings = load_settings()
        max_concurrent = settings.get('max_concurrent', 2)
        
        # Check current running count
        with self.lock:
            running_count = sum(1 for item in self.queue if item['status'] == 'downloading')
            if running_count >= max_concurrent:
                return
                
            # Find next item in queue
            next_item = None
            for item in self.queue:
                if item['status'] == 'queued':
                    next_item = item
                    break
                    
            if not next_item:
                return
                
            next_item['status'] = 'downloading'
            next_item['eta'] = '시작 중...'
            
        # Run download in a separate thread to prevent blocking the queue process loop
        threading.Thread(target=self._run_download, args=(next_item['id'],), daemon=True).start()
        
        # Check if we can start more downloads
        self._process_queue()

    def _run_download(self, item_id):
        item = self.get_item(item_id)
        if not item:
            return
            
        settings = load_settings()
        save_dir = item['save_path']
        if not os.path.exists(save_dir):
            try:
                os.makedirs(save_dir, exist_ok=True)
            except Exception as e:
                with self.lock:
                    item['status'] = 'failed'
                    item['error_message'] = f"저장 폴더를 생성할 수 없습니다: {str(e)}"
                    item['eta'] = '실패'
                self._trigger_download_loop()
                return

        # Prepare yt-dlp arguments
        # We run the command line executable using the venv path
        ytdlp_bin = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'venv', 'bin', 'yt-dlp')
        if not os.path.exists(ytdlp_bin):
            ytdlp_bin = 'yt-dlp' # Fallback to path

        cmd = [
            ytdlp_bin,
            '--newline',
            '--no-playlist',
            '--progress',
            '--ignore-errors'
        ]
        
        # Check FFmpeg availability
        ffmpeg_info = check_ffmpeg()
        if ffmpeg_info['ffmpeg_installed']:
            cmd.extend(['--ffmpeg-location', ffmpeg_info['ffmpeg_path']])

        # Format and output arguments
        if item['format_type'] == 'audio':
            # Extract audio
            cmd.extend([
                '-f', 'bestaudio',
                '-x',
                '--audio-format', item['ext'],
                '--audio-quality', '0' # Highest quality
            ])
        else:
            # Video download
            # Download specific format merged with best audio or just format itself
            if ffmpeg_info['ffmpeg_installed']:
                # FFmpeg is installed, we can download best video format + best audio and merge them
                cmd.extend([
                    '-f', f"{item['format_id']}+bestaudio/best",
                    '--merge-output-format', item['ext']
                ])
            else:
                # FFmpeg missing, we must download pre-merged formats only or whatever resolution has audio
                # Using best video that already has audio or the single format_id
                cmd.extend([
                    '-f', f"{item['format_id']}/best"
                ])

        # Output template
        out_template = os.path.join(save_dir, '%(title)s.%(ext)s')
        cmd.extend(['-o', out_template])
        cmd.append(item['url'])
        
        # Regular expressions for parsing progress
        # [download]  12.3% of 45.67MiB at 12.34MiB/s ETA 00:03
        progress_pattern = re.compile(r'\[download\]\s+([0-9.]+)%\s+of\s+(?:~\s*)?([0-9.]+[a-zA-Z]+)\s+at\s+([0-9.]+[a-zA-Z]+/s)\s+ETA\s+([0-9:]+)')
        # ffmpeg actions
        merger_pattern = re.compile(r'\[Merger\]|\[ExtractAudio\]')

        try:
            # Start process in a new session group (os.setsid) to allow pausing the entire group
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                preexec_fn=os.setsid if hasattr(os, 'setsid') else None,
                bufsize=1,
                universal_newlines=True
            )
            
            with self.lock:
                self.active_downloads[item_id] = process
                
            for line in iter(process.stdout.readline, ''):
                line = line.strip()
                if not line:
                    continue
                
                # Check status inside the loop (it might have been paused/canceled)
                current_item = self.get_item(item_id)
                if not current_item or current_item['status'] in ['canceled', 'failed']:
                    break
                    
                # Parsing download progress
                match = progress_pattern.search(line)
                if match:
                    progress_val = float(match.group(1))
                    size_val = match.group(2)
                    speed_val = match.group(3)
                    eta_val = match.group(4)
                    
                    with self.lock:
                        if item['status'] == 'downloading': # Don't update if it was paused
                            item['progress'] = progress_val
                            item['size'] = size_val
                            item['speed'] = speed_val
                            item['eta'] = eta_val
                elif merger_pattern.search(line):
                    with self.lock:
                        if item['status'] == 'downloading':
                            item['progress'] = 99.0
                            item['eta'] = "처리 중..."
                            if "ExtractAudio" in line:
                                item['speed'] = "음원 추출 중"
                            else:
                                item['speed'] = "비디오 병합 중"
                                
            # Wait for process to complete
            stdout, _ = process.communicate()
            return_code = process.returncode
            
            # Clean up active process mapping
            with self.lock:
                if item_id in self.active_downloads:
                    del self.active_downloads[item_id]
            
            current_item = self.get_item(item_id)
            if current_item:
                if current_item['status'] == 'canceled':
                    # Already handled by cancel
                    pass
                elif return_code == 0:
                    with self.lock:
                        item['status'] = 'completed'
                        item['progress'] = 100.0
                        item['speed'] = '완료됨'
                        item['eta'] = '완료'
                else:
                    # Gather error logs from stdout if available
                    err_msg = "알 수 없는 다운로드 오류 발생"
                    for err_line in (stdout or "").split('\n'):
                        if "ERROR:" in err_line:
                            err_msg = err_line.replace("ERROR:", "").strip()
                            break
                    with self.lock:
                        item['status'] = 'failed'
                        item['error_message'] = err_msg
                        item['eta'] = '실패'
                        
        except Exception as e:
            with self.lock:
                if item_id in self.active_downloads:
                    del self.active_downloads[item_id]
                item['status'] = 'failed'
                item['error_message'] = str(e)
                item['eta'] = '실패'
                
        # Trigger download loop again to process remaining items
        self._trigger_download_loop()

    def pause_download(self, item_id):
        item = self.get_item(item_id)
        if not item or item['status'] != 'downloading':
            return False
            
        with self.lock:
            process = self.active_downloads.get(item_id)
            if process:
                try:
                    # Send SIGSTOP to the process group (negative PID)
                    # This pauses yt-dlp and its spawned processes (ffmpeg etc)
                    if hasattr(os, 'killpg'):
                        os.killpg(os.getpgid(process.pid), signal.SIGSTOP)
                    else:
                        # Fallback for systems without killpg (Windows requires different, but this is mac)
                        os.kill(process.pid, signal.SIGSTOP)
                    
                    item['status'] = 'paused'
                    item['speed'] = '일시중지됨'
                    item['eta'] = '일시중지'
                    return True
                except Exception as e:
                    print(f"Pause error: {e}")
                    return False
        return False
        
    def resume_download(self, item_id):
        item = self.get_item(item_id)
        if not item or item['status'] != 'paused':
            return False
            
        with self.lock:
            process = self.active_downloads.get(item_id)
            if process:
                try:
                    # Send SIGCONT to process group to resume execution
                    if hasattr(os, 'killpg'):
                        os.killpg(os.getpgid(process.pid), signal.SIGCONT)
                    else:
                        os.kill(process.pid, signal.SIGCONT)
                        
                    item['status'] = 'downloading'
                    item['eta'] = '재개 중...'
                    return True
                except Exception as e:
                    print(f"Resume error: {e}")
                    return False
        return False
        
    def cancel_download(self, item_id):
        item = self.get_item(item_id)
        if not item:
            return False
            
        with self.lock:
            process = self.active_downloads.get(item_id)
            
            # If the process is currently running or paused, terminate it
            if process:
                try:
                    # First send SIGCONT to make sure it can process the termination signal if paused
                    if item['status'] == 'paused':
                        if hasattr(os, 'killpg'):
                            os.killpg(os.getpgid(process.pid), signal.SIGCONT)
                        else:
                            os.kill(process.pid, signal.SIGCONT)
                            
                    # Send SIGKILL to the process group to kill all child processes instantly
                    if hasattr(os, 'killpg'):
                        os.killpg(os.getpgid(process.pid), signal.SIGKILL)
                    else:
                        os.kill(process.pid, signal.SIGKILL)
                except Exception as e:
                    print(f"Cancel error: {e}")
                    
                if item_id in self.active_downloads:
                    del self.active_downloads[item_id]
            
            item['status'] = 'canceled'
            item['progress'] = 0.0
            item['speed'] = '취소됨'
            item['eta'] = '취소됨'
            
        # Trigger download loop again to start the next queued items
        self._trigger_download_loop()
        return True

def update_ytdlp_package():
    """Updates yt-dlp to the latest pre-release or nightly version to ensure bypass works."""
    pip_bin = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'venv', 'bin', 'pip')
    if not os.path.exists(pip_bin):
        pip_bin = 'pip'
        
    try:
        # Run pip update command
        result = subprocess.run(
            [pip_bin, 'install', '-U', '--pre', 'yt-dlp'],
            capture_output=True,
            text=True,
            check=True
        )
        return {
            'success': True,
            'stdout': result.stdout,
            'message': 'yt-dlp가 성공적으로 업데이트되었습니다.'
        }
    except Exception as e:
        return {
            'success': False,
            'message': f"업데이트 실패: {str(e)}"
        }
