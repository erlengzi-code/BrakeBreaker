@echo off
setlocal
title Brake Lab
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
echo.
echo Game server stopped. Press any key to close this window.
pause >nul
endlocal
