@echo off
setlocal
cd /d "%~dp0"
set PORT=8123
set PY=

where python >nul 2>nul && set PY=python
if not defined PY (
  where py >nul 2>nul && set PY=py
)
if not defined PY (
  echo Python 3 was not found. Install it from https://www.python.org/downloads/
  pause
  exit /b 1
)

echo ============================================================
echo  EMBERFALL - LAN SERVER
echo  Keep this window open while you play.
echo.
echo  On this PC:    http://127.0.0.1:%PORT%/
echo  On your phone: http://YOUR-PC-IP:%PORT%/
echo.
echo  Your phone must be on the same Wi-Fi network.
echo  If Windows Firewall asks, allow Python / private networks.
echo ============================================================
echo.
echo IPv4 addresses on this machine:
ipconfig | findstr /i "IPv4"
echo.
%PY% -m http.server %PORT% --bind 0.0.0.0
pause
