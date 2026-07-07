import os
import sys
import threading
import webview
from app import app

def run_flask():
    # Run flask backend locally without reloader to prevent duplicate threads
    app.run(host='127.0.0.1', port=5001, debug=False, use_reloader=False)

def main():
    # Start flask server in a background thread
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()
    
    # Create the standalone desktop window
    webview.create_window(
        title="유튜브 다운로더 (YouTube Downloader)",
        url="http://127.0.0.1:5001",
        width=980,
        height=720,
        resizable=True,
        min_size=(640, 550)
    )
    
    # Start the GUI event loop. This blocks until the window is closed.
    # Once closed, the script ends and the daemon thread is destroyed.
    webview.start()

if __name__ == '__main__':
    main()
