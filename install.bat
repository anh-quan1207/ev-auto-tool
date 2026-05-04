@echo off
setlocal
title EV Auto Tool - Cai dat
cd /d "%~dp0"

echo ==========================================
echo   EV Auto Tool - Cai dat lan dau
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Khong tim thay Node.js tren may nay.
  echo.
  echo Vui long cai Node.js ban LTS truoc khi tiep tuc.
  echo Sau khi cai xong, hay mo lai file install.bat.
  echo.
  start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo Khong tim thay npm.
  echo Vui long cai lai Node.js ban LTS.
  echo.
  start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)

echo Dang cai dat thu vien cho backend...
call npm install --prefix backend
if errorlevel 1 (
  echo.
  echo Cai dat backend that bai.
  pause
  exit /b 1
)

echo.
echo Dang cai dat thu vien cho frontend...
call npm install --prefix frontend
if errorlevel 1 (
  echo.
  echo Cai dat frontend that bai.
  pause
  exit /b 1
)

echo.
echo Dang cai dat Playwright Chromium...
pushd backend
call npx playwright install chromium
set "PW_EXIT=%ERRORLEVEL%"
popd
if not "%PW_EXIT%"=="0" (
  echo.
  echo Cai dat Playwright/Chromium that bai.
  pause
  exit /b 1
)

echo.
echo Cai dat hoan tat.
echo Bay gio ban co the bam file start.bat de mo phan mem.
echo.
pause
exit /b 0
