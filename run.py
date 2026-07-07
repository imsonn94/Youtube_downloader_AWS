import os
import subprocess
import sys

def main():
    print("==================================================")
    print("   유튜브 다운로더 (YouTube Downloader) 시작 중...   ")
    print("==================================================")
    
    # Path to our virtual environment python executable
    base_dir = os.path.dirname(os.path.abspath(__file__))
    venv_python = os.path.join(base_dir, 'venv', 'bin', 'python')
    app_script = os.path.join(base_dir, 'app.py')
    
    if not os.path.exists(venv_python):
        print("오류: 가상환경(venv)을 찾을 수 없습니다.")
        print("가상환경을 설정하려면 먼저 start.sh를 실행해주세요.")
        sys.exit(1)
        
    print("로컬 플라스크(Flask) 백엔드 서버를 시작합니다...")
    print("잠시 후 웹 브라우저가 자동으로 열립니다: http://127.0.0.1:5001")
    print("종료하려면 터미널에서 Ctrl+C를 누르세요.")
    print("==================================================")
    
    try:
        # Execute the flask server in venv
        subprocess.run([venv_python, app_script])
    except KeyboardInterrupt:
        print("\n프로그램을 종료합니다. 이용해주셔서 감사합니다!")
    except Exception as e:
        print(f"\n실행 중 오류 발생: {e}")

if __name__ == '__main__':
    main()
