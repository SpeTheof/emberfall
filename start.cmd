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
  echo.
  echo Python 3 was not found on this computer.
  echo Install Python from https://www.python.org/downloads/ and try again.
  echo.
  pause
  exit /b 1
)

echo Starting Emberfall on http://127.0.0.1:%PORT% ...
start "Emberfall local server" /min cmd /c "%PY% -m http.server %PORT% --bind 127.0.0.1"
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:%PORT%/"
exit /b 0
