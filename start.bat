@echo off
title 유튜브 다운로더 (YouTube Downloader)
cd /d "%~dp0"

echo ==================================================
echo      유튜브 다운로더 데스크톱 앱 스타터 (Windows)
echo ==================================================

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 오류: Python이 설치되어 있지 않거나 환경 변수 PATH에 추가되지 않았습니다.
    echo Python을 설치하고 'Add Python to PATH' 옵션을 체크한 후 다시 실행하십시오.
    pause
    exit /b 1
)

:: Create virtual environment if it doesn't exist
if not exist "venv" (
    echo 가상환경(venv)을 생성합니다...
    python -m venv venv
    if %errorlevel% neq 0 (
        echo 가상환경 생성에 실패했습니다.
        pause
        exit /b 1
    )
    
    echo 필수 파이썬 라이브러리(Flask, yt-dlp, pywebview)를 설치합니다...
    call venv\Scripts\pip install flask pywebview
    call venv\Scripts\pip install -U --pre yt-dlp
)

:: Run the desktop app launcher
echo 로컬 서버 및 자체 창 애플리케이션을 구동합니다...
call venv\Scripts\python desktop.py
