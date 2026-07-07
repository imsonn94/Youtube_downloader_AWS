import os
import threading
import sys
import webbrowser
from flask import Flask, jsonify, request, render_template, send_from_directory

from downloader import (
    load_settings,
    save_settings,
    check_ffmpeg,
    get_video_info,
    DownloadQueueManager,
    update_ytdlp_package
)

app = Flask(__name__, template_folder='templates', static_folder='static')
queue_manager = DownloadQueueManager()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/analyze', methods=['POST'])
def analyze():
    data = request.get_json() or {}
    url = data.get('url')
    if not url:
        return jsonify({'error': '유튜브 URL 주소를 입력해주세요.'}), 400
        
    try:
        info = get_video_info(url)
        return jsonify(info)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/download', methods=['POST'])
def download():
    data = request.get_json() or {}
    url = data.get('url')
    title = data.get('title')
    thumbnail = data.get('thumbnail')
    duration_str = data.get('duration_str', '00:00')
    format_id = data.get('format_id')
    format_type = data.get('format_type', 'video') # video or audio
    ext = data.get('ext', 'mp4')
    
    if not url or not format_id:
        return jsonify({'error': '필수 매개변수(url, format_id)가 누락되었습니다.'}), 400
        
    try:
        item_id = queue_manager.add_item(
            url=url,
            title=title or "유튜브 동영상",
            thumbnail=thumbnail or "",
            duration_str=duration_str,
            format_id=format_id,
            format_type=format_type,
            ext=ext
        )
        return jsonify({'id': item_id, 'message': '대기열에 추가되었습니다.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/queue', methods=['GET'])
def get_queue():
    items = queue_manager.get_all_items()
    return jsonify({'queue': items})

@app.route('/api/queue/control', methods=['POST'])
def queue_control():
    data = request.get_json() or {}
    action = data.get('action') # pause, resume, cancel, delete, clear_completed
    item_id = data.get('id')
    
    if action == 'clear_completed':
        queue_manager.clear_completed()
        return jsonify({'success': True, 'message': '완료된 항목이 지워졌습니다.'})
        
    if not item_id:
        return jsonify({'error': '항목 ID가 누락되었습니다.'}), 400
        
    success = False
    message = ""
    
    if action == 'pause':
        success = queue_manager.pause_download(item_id)
        message = "일시 정지되었습니다." if success else "일시 정지할 수 없습니다. (이미 일시정지 중이거나 다운로드 중이 아님)"
    elif action == 'resume':
        success = queue_manager.resume_download(item_id)
        message = "다운로드가 재개되었습니다." if success else "재개할 수 없습니다."
    elif action == 'cancel':
        success = queue_manager.cancel_download(item_id)
        message = "다운로드가 취소되었습니다." if success else "취소할 수 없습니다."
    elif action == 'delete':
        success = queue_manager.remove_item(item_id)
        message = "대기열에서 제거되었습니다." if success else "제거할 수 없습니다."
    else:
        return jsonify({'error': '유효하지 않은 동작입니다.'}), 400
        
    return jsonify({'success': success, 'message': message})

@app.route('/api/settings', methods=['GET', 'POST'])
def settings_handler():
    if request.method == 'POST':
        new_settings = request.get_json() or {}
        current_settings = load_settings()
        
        # Update settings safely
        for key in ['save_path', 'theme', 'max_concurrent', 'default_format', 'auto_update']:
            if key in new_settings:
                current_settings[key] = new_settings[key]
                
        # Validate max_concurrent
        try:
            current_settings['max_concurrent'] = int(current_settings['max_concurrent'])
            if current_settings['max_concurrent'] < 1:
                current_settings['max_concurrent'] = 1
            elif current_settings['max_concurrent'] > 5:
                current_settings['max_concurrent'] = 5
        except ValueError:
            current_settings['max_concurrent'] = 2
            
        success = save_settings(current_settings)
        return jsonify({'success': success, 'settings': current_settings})
    else:
        settings = load_settings()
        return jsonify(settings)

@app.route('/api/settings/select-folder', methods=['POST'])
def select_folder():
    import subprocess
    cmd = [
        'osascript',
        '-e',
        'POSIX path of (choose folder with prompt "유튜브 다운로드 저장 폴더를 선택하세요")'
    ]
    try:
        # Run AppleScript natively on macOS
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0:
            selected_path = res.stdout.strip()
            return jsonify({'success': True, 'path': selected_path})
        else:
            # User canceled dialog
            return jsonify({'success': False, 'message': '선택이 취소되었습니다.'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/settings/open-folder', methods=['POST'])
def open_folder():
    data = request.get_json() or {}
    folder_path = data.get('path')
    if not folder_path:
        folder_path = load_settings().get('save_path')
        
    if not folder_path or not os.path.exists(folder_path):
        return jsonify({'success': False, 'error': '폴더가 존재하지 않습니다.'})
        
    try:
        import subprocess
        # On macOS, use 'open' command to open finder at the path
        subprocess.run(['open', folder_path])
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/update-ytdlp', methods=['POST'])
def update_ytdlp():
    result = update_ytdlp_package()
    return jsonify(result)

@app.route('/api/check-ffmpeg', methods=['GET'])
def check_ffmpeg_endpoint():
    status = check_ffmpeg()
    return jsonify(status)

def open_browser(port):
    import time
    time.sleep(1.5)
    webbrowser.open(f'http://127.0.0.1:{port}')

if __name__ == '__main__':
    port = 5001
    
    # Auto-open browser in a separate thread
    threading.Thread(target=open_browser, args=(port,), daemon=True).start()
    
    # Run the Flask app
    # debug=False is safer for production and avoids double-firing threads
    app.run(host='127.0.0.1', port=port, debug=False)
