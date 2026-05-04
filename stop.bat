@echo off
setlocal
title EV Auto Tool - Dung

echo ==========================================
echo   EV Auto Tool - Dung he thong
echo ==========================================
echo.

taskkill /FI "WINDOWTITLE eq EV Auto Backend*" /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq EV Auto Frontend*" /T /F >nul 2>nul

echo Da gui lenh dong backend va frontend.
echo Neu van con cua so nao mo, ban co the dong bang tay.
echo.
pause
exit /b 0
