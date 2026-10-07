@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
set "TASK=HCC - Tu dong cap nhat GitHub"
schtasks /Query /TN "%TASK%" >nul 2>&1
if errorlevel 1 (
  echo  Chưa bật tự động cập nhật - không có gì để tắt.
) else (
  schtasks /Delete /F /TN "%TASK%" >nul
  echo  Đã TẮT tự động cập nhật GitHub. Muốn bật lại: bấm đúp bat-tu-dong-cap-nhat.bat
)
echo.
pause
