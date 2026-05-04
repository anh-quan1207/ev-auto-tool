@echo off
setlocal
title EV Auto Tool - Khoi dong
cd /d "%~dp0"

echo ==========================================
echo   EV Auto Tool - Khoi dong
echo ==========================================
echo.

if not exist "backend\node_modules" (
  echo Chua cai dat backend.
  echo Vui long bam install.bat truoc.
  echo.
  pause
  exit /b 1
)

if not exist "frontend\node_modules" (
  echo Chua cai dat frontend.
  echo Vui long bam install.bat truoc.
  echo.
  pause
  exit /b 1
)

echo Dang mo backend...
start "EV Auto Backend" cmd /k "cd /d \"%~dp0backend\" && npm run dev"

echo Dang mo frontend...
start "EV Auto Frontend" cmd /k "cd /d \"%~dp0frontend\" && npm run dev"

echo.
echo Dang doi he thong khoi dong...
timeout /t 8 /nobreak >nul

echo Dang mo trinh duyet...
start "" "http://localhost:5173"

echo.
echo Da mo phan mem.
echo Neu CMS duoc su dung, hay giu cac cua so backend/frontend dang chay.
echo.
pause
exit /b 0
