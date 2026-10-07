@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title Day code len GitHub - Mot Cua Thong Minh
rem =====================================================================================
rem  ĐẨY TOÀN BỘ CODE MỚI LÊN GITHUB (Render tự deploy lại sau khi đẩy).
rem  Bấm đúp để chạy. Không cần PowerShell.
rem
rem  - Thư mục KHÔNG phải kho git (tải ZIP / chép tay từ ổ khác): script tự nối với kho
rem    GitHub bên dưới mà KHÔNG sửa hay xoá file nào của anh, rồi so sánh với bản trên GitHub.
rem  - Chặn tuyệt đối việc đưa file .env (mật khẩu CSDL, API key) lên GitHub.
rem  - Chạy bộ test trước; test hỏng thì dừng.
rem  - Hỏi lại trước khi commit và trước khi đẩy.
rem =====================================================================================
set "REPO_URL=https://github.com/luuhainam-hht/demotrangweb.git"
set "BRANCH=main"

echo.
echo ==================== ĐẨY CODE LÊN GITHUB ====================
echo  Kho GitHub: %REPO_URL%  (nhánh %BRANCH%)
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo  [LỖI] Máy chưa cài Git. Tải tại https://git-scm.com/download/win
  echo        Cài xong, mở lại file này.
  goto loi
)

rem ------------------------------------------------------------------------------
rem 1. Chưa phải kho git - nối với GitHub, KHÔNG đụng vào file trong thư mục
rem ------------------------------------------------------------------------------
if not exist ".git" (
  echo  Thư mục này chưa phải kho git. Đang nối với kho GitHub...
  git init -q
  git symbolic-ref HEAD refs/heads/%BRANCH%
  git remote add origin %REPO_URL%
)
git remote get-url origin >nul 2>&1
if errorlevel 1 git remote add origin %REPO_URL%
git config core.fileMode false

rem Khoá cũ còn sót do một lần git trước bị tắt ngang
if exist ".git\index.lock" (
  echo.
  echo  Phát hiện khoá cũ .git\index.lock - thường là rác do git bị tắt giữa chừng.
  echo  Trước khi đồng ý: đóng hết VS Code / cửa sổ git đang mở thư mục này.
  set "xoa="
  set /p "xoa=Xoá khoá này để tiếp tục? (y/n): "
  if /i not "!xoa!"=="y" goto huy
  del /f /q ".git\index.lock"
)

echo  Đang tải thông tin mới nhất từ GitHub...
git fetch -q origin %BRANCH%
if errorlevel 1 (
  echo  [LỖI] Không tải được từ GitHub. Kiểm tra mạng, hoặc đăng nhập GitHub khi cửa sổ hiện ra.
  goto loi
)

rem Kho vừa tạo (chưa có commit nào): lấy lịch sử GitHub làm gốc, file trên máy giữ nguyên.
rem Riêng thư mục .github (cấu hình kiểm thử tự động) lấy theo bản trên GitHub.
git rev-parse --verify -q HEAD >nul 2>&1
if errorlevel 1 (
  git reset -q origin/%BRANCH%
  git checkout -q origin/%BRANCH% -- .github
)

rem GitHub có commit mới hơn máy (VD sửa từ máy khác) - kéo về trước khi đẩy.
set "BEHIND=0"
for /f %%n in ('git rev-list --count HEAD..origin/%BRANCH% 2^>nul') do set "BEHIND=%%n"
if not "!BEHIND!"=="0" (
  echo  GitHub đang có !BEHIND! commit mới hơn máy này. Đang kéo về và ghép...
  git pull -q --rebase --autostash origin %BRANCH%
  if errorlevel 1 (
    echo  [LỖI] Không ghép tự động được vì cùng một đoạn bị sửa ở hai nơi.
    echo        Chạy: git rebase --abort   rồi nhờ người hỗ trợ.
    goto loi
  )
)

rem ------------------------------------------------------------------------------
rem 2. Chốt an toàn: .env chứa mật khẩu CSDL + API key, không bao giờ lên GitHub
rem ------------------------------------------------------------------------------
echo.
echo === Kiểm tra an toàn ===
git ls-files --error-unmatch .env >nul 2>&1
if not errorlevel 1 (
  echo  [LỖI] File .env đang bị git theo dõi - nó chứa mật khẩu database.
  echo        Chạy lệnh:  git rm --cached .env   rồi chạy lại file này.
  goto loi
)
findstr /x /c:".env" ".gitignore" >nul 2>&1
if errorlevel 1 (
  echo .env>>".gitignore"
  echo  Đã bổ sung .env vào .gitignore
)
echo  .env không bị đưa lên GitHub - an toàn

rem ------------------------------------------------------------------------------
rem 3. Chạy bộ test
rem ------------------------------------------------------------------------------
echo.
echo === Chạy bộ test (khoảng 30-60 giây) ===
where npm >nul 2>&1
if errorlevel 1 (
  echo  [LỖI] Máy chưa cài Node.js - tải tại https://nodejs.org  - rồi chạy lại.
  goto loi
)
if not exist "node_modules" (
  echo  Chưa có thư mục node_modules - đang cài thư viện ^(npm install^)...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto loi
)
set "LOG=%TEMP%\hcc-test.log"
call npm test >"%LOG%" 2>&1
set "TEST_RC=!errorlevel!"
findstr /r /c:"^# tests" /c:"^# pass" /c:"^# fail" "%LOG%"
if not "!TEST_RC!"=="0" (
  echo  [DỪNG] Có test thất bại - không đưa code hỏng lên hệ thống thật.
  echo         Chi tiết lỗi: %LOG%
  goto loi
)
echo  Tất cả test đều đạt

rem ------------------------------------------------------------------------------
rem 4. Gom thay đổi, kiểm tra lần hai, hỏi trước khi commit
rem ------------------------------------------------------------------------------
echo.
echo === Những thay đổi sẽ đưa lên ===
git add -A
if errorlevel 1 goto loi
git diff --cached --name-only | findstr /x /c:".env" >nul
if not errorlevel 1 (
  git reset -q
  echo  [LỖI] Phát hiện .env trong danh sách commit. Đã huỷ toàn bộ.
  goto loi
)

git diff --cached --quiet
if not errorlevel 1 goto khong_co_thay_doi

git diff --cached --name-status
echo.
git diff --cached --shortstat
echo.
set "ok="
set /p "ok=Đồng ý commit các thay đổi trên? (y/n): "
if /i not "!ok!"=="y" (
  git reset -q
  goto huy
)
set "MSG=Cap nhat code %date% %time:~0,5%"
set "NHAP="
set /p "NHAP=Ghi chú cho lần cập nhật này (Enter = mặc định): "
if not "!NHAP!"=="" set "MSG=!NHAP!"
git commit -q -m "!MSG!"
if errorlevel 1 (
  echo  [LỖI] Commit thất bại. Nếu git báo thiếu tên/email, chạy:
  echo        git config --global user.name "Ten cua ban"
  echo        git config --global user.email "email@cua.ban"
  goto loi
)
echo  Đã commit vào máy.
goto day

:khong_co_thay_doi
echo  Không có thay đổi mới so với GitHub.
set "AHEAD=0"
for /f %%n in ('git rev-list --count origin/%BRANCH%..HEAD 2^>nul') do set "AHEAD=%%n"
if "!AHEAD!"=="0" (
  echo  Code trên máy và trên GitHub đã giống nhau - không cần đẩy.
  goto xong
)
echo  Còn !AHEAD! commit trên máy chưa được đẩy lên.

rem ------------------------------------------------------------------------------
rem 5. Đẩy lên GitHub - Render bật autoDeploy nên sẽ tự triển khai bản mới
rem ------------------------------------------------------------------------------
:day
echo.
echo === Đẩy lên GitHub ===
echo  Lưu ý: Render tự động deploy ngay sau khi đẩy:
echo        https://smart-queue-system-akpr.onrender.com
echo  Nếu bản mới có sự cố, quay lui bằng:  git revert HEAD   rồi chạy lại file này.
set "ok="
set /p "ok=Đẩy lên GitHub ngay bây giờ? (y/n): "
if /i not "!ok!"=="y" (
  echo  Đã commit trên máy nhưng CHƯA đẩy. Lần sau chạy lại file này để đẩy.
  goto xong
)
git push origin HEAD:%BRANCH%
if errorlevel 1 (
  echo  [LỖI] Đẩy thất bại. Commit vẫn còn trên máy - chạy lại file này để thử lại.
  goto loi
)
echo.
echo  XONG. Code đã lên GitHub.
echo  Theo dõi deploy: Render Dashboard, tab Logs - thành công sẽ thấy dòng "Your service is live".
goto xong

:huy
echo  Đã huỷ, không thay đổi gì.
goto xong

:loi
echo.
pause
exit /b 1

:xong
echo.
pause
exit /b 0
