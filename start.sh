#!/bin/bash

# Move to the script's directory
cd "$(dirname "$0")"

echo "=================================================="
echo "    유튜브 다운로더 데스크톱 앱 스타터 (macOS)      "
echo "=================================================="

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "오류: Python3가 설치되어 있지 않습니다."
    echo "Python3을 설치한 후 다시 실행하십시오."
    exit 1
fi

# Check if venv exists, if not create it
if [ ! -d "venv" ]; then
    echo "가상환경(venv)을 생성합니다..."
    
    # Try using brew-installed python3 first if available
    BREW_PYTHON="/opt/homebrew/bin/python3"
    if [ -f "$BREW_PYTHON" ]; then
        echo "Homebrew Python3를 사용하여 가상환경을 구성합니다."
        $BREW_PYTHON -m venv venv
    else
        echo "시스템 기본 Python3를 사용하여 가상환경을 구성합니다."
        python3 -m venv venv
    fi
    
    echo "필수 파이썬 라이브러리(Flask, yt-dlp, pywebview)를 설치합니다..."
    ./venv/bin/pip install flask pywebview
    ./venv/bin/pip install -U --pre yt-dlp
fi

# Launch the standalone desktop app window
./venv/bin/python desktop.py
