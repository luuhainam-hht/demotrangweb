@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title TU DONG DAY GIT - dang canh thu muc (dong cua so nay de tat)
rem =====================================================================================
rem  TỰ ĐỘNG ĐẨY CODE LÊN GITHUB KHI THẤY CODE SỬA - CHỈ CẦN BẤM ĐÚP FILE NÀY.
rem
rem  Cách hoạt động:
rem   - Cứ 30 giây kiểm tra thư mục 1 lần.
rem   - Thấy có file sửa thì CHỜ cho sửa xong (2 lần kiểm tra liên tiếp không đổi gì nữa,
rem     khoảng 1 phút) rồi mới đẩy - tránh đẩy code đang sửa dở.
rem   - Việc đẩy do tu-dong-github\cap-nhat-ngam.bat làm: ghép bản mới từ GitHub, chặn .env,
rem     CHẠY TEST (test hỏng thì KHÔNG đẩy), commit, push. Render tự deploy sau khi push.
rem   - Test hỏng: không thử lại liên tục, chờ tới khi anh sửa tiếp rồi mới thử lại.
rem   - Nhật ký chi tiết: tu-dong-github.log
rem  Tắt: đóng cửa sổ này.
rem =====================================================================================
set "CHU_KY=30"

where git >nul 2>&1
if errorlevel 1 (
  echo  [LỖI] Máy chưa cài Git: https://git-scm.com/download/win
  pause & exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
  echo  [LỖI] Máy chưa cài Node.js: https://nodejs.org
  pause & exit /b 1
)

rem Lần đầu (chưa nối GitHub / chưa đăng nhập): chạy bản có hỏi đáp 1 lần.
if not exist ".git" (
  echo  Thư mục chưa nối GitHub - chạy cap-nhat-github.bat 1 lần để nối và đăng nhập...
  call "%~dp0cap-nhat-github.bat"
  if not exist ".git" exit /b 1
)
if not exist "node_modules" (
  echo  Đang cài thư viện lần đầu ^(npm install^)...
  call npm install --no-audit --no-fund
)

echo.
echo  ================================================================
echo   ĐANG CANH THƯ MỤC: %CD%
echo   Sửa code xong, để yên khoảng 1 phút là tự đẩy lên GitHub.
echo   Thu nhỏ cửa sổ này lại. Đóng cửa sổ = tắt tự động.
echo  ================================================================
echo.

set "LAN_TRUOC="
set "DA_THU="

:vong
if exist ".git\index.lock" goto cho

rem "Dấu vân tay" toàn bộ thư mục (đã tôn trọng .gitignore) so với commit hiện tại.
git add -A >nul 2>&1
set "HIEN_TAI="
for /f %%t in ('git write-tree 2^>nul') do set "HIEN_TAI=%%t"
set "GOC="
for /f %%t in ('git rev-parse HEAD: 2^>nul') do set "GOC=%%t"
git reset -q >nul 2>&1

if "!HIEN_TAI!"=="" goto cho
if "!HIEN_TAI!"=="!GOC!" (
  set "LAN_TRUOC="
  goto cho
)

rem Đúng bản này vừa thử và hỏng -> chỉ thử lại sau khoảng 10 phút (20 lượt) hoặc khi sửa tiếp
if "!HIEN_TAI!"=="!DA_THU!" (
  set /a DEM_THU+=1
  if !DEM_THU! LSS 20 goto cho
  set "DA_THU="
)

rem Có thay đổi nhưng vẫn đang sửa -> chờ lượt sau
if not "!HIEN_TAI!"=="!LAN_TRUOC!" (
  if "!LAN_TRUOC!"=="" echo  [%time:~0,8%] Phát hiện code sửa - chờ sửa xong...
  set "LAN_TRUOC=!HIEN_TAI!"
  goto cho
)

echo  [%time:~0,8%] Code đã ổn định - chạy test và đẩy lên GitHub...
call "%~dp0tu-dong-github\cap-nhat-ngam.bat"
set "KQ=!errorlevel!"
set "DONG_CUOI="
for /f "usebackq delims=" %%l in ("tu-dong-github.log") do set "DONG_CUOI=%%l"
if "!KQ!"=="0" (
  echo  [%time:~0,8%] XONG: !DONG_CUOI!
  set "DA_THU="
) else (
  echo  [%time:~0,8%] KHÔNG ĐẨY: !DONG_CUOI!
  echo              Sửa lỗi rồi lưu file ^(hoặc chờ 10 phút^), sẽ tự thử lại.
  set "DA_THU=!HIEN_TAI!"
  set "DEM_THU=0"
)
set "LAN_TRUOC=!HIEN_TAI!"

:cho
timeout /t %CHU_KY% /nobreak >nul
goto vong
