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

if not exist "frontend\node_modules\pdf-lib" (
  echo Frontend dang thieu thu vien moi de in/gop nhieu PDF.
  echo Vui long bam install.bat lai mot lan, sau do bam start.bat.
  echo.
  pause
  exit /b 1
)

echo Dang mo backend...
start "EV Auto Backend" cmd /k "cd /d ""%~dp0backend"" && npm run dev"

echo Dang mo frontend...
start "EV Auto Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

echo.
echo Dang doi backend san sang...
set "BACKEND_READY="
for /L %%I in (1,1,30) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "try { $r = Invoke-WebRequest -UseBasicParsing 'http://localhost:3001/health'; if ($r.StatusCode -ge 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
  if not errorlevel 1 (
    set "BACKEND_READY=1"
    goto :wait_frontend
  )
  timeout /t 2 /nobreak >nul
)

:wait_frontend
if not defined BACKEND_READY (
  echo Backend chua san sang sau 60 giay.
  echo Vui long xem cua so "EV Auto Backend" de kiem tra loi.
  echo Neu thay bao cong 3001 dang bi dung, hay dong phien cu roi bam lai start.bat.
  echo.
  pause
  exit /b 1
)

echo Dang doi frontend san sang...
set "APP_READY="
for /L %%I in (1,1,30) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "try { $r = Invoke-WebRequest -UseBasicParsing 'http://localhost:5173'; if ($r.StatusCode -ge 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
  if not errorlevel 1 (
    set "APP_READY=1"
    goto :open_browser
  )
  timeout /t 2 /nobreak >nul
)

:open_browser
if not defined APP_READY (
  echo Frontend chua san sang sau 60 giay.
  echo Vui long xem cua so "EV Auto Frontend" de kiem tra loi.
  echo Neu thay bao cong 5173 dang bi dung, hay dong phien cu roi bam lai start.bat.
  echo.
  pause
  exit /b 1
)

echo Dang mo trinh duyet...
start "" "http://localhost:5173"

echo.
echo Da mo phan mem.
echo Neu CMS duoc su dung, hay giu cac cua so backend/frontend dang chay.
echo.
pause
exit /b 0
