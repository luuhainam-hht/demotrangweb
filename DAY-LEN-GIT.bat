@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title Day code len GitHub - Mot Cua Thong Minh
rem =====================================================================================
rem  ĐẨY TOÀN BỘ CODE TRÊN MÁY LÊN GITHUB - KHÔNG CẦN NÉN, KHÔNG CẦN BIẾT GIT. BẤM ĐÚP LÀ CHẠY.
rem
rem  Cách làm (an toàn, không mất code ở cả 2 phía):
rem   1. Lấy bản mới nhất trên GitHub (nhánh main) làm gốc - KHÔNG đụng vào file trên máy.
rem   2. So thư mục trên máy với bản đó:
rem      - File trên máy là bản CŨ của GitHub (GitHub đã có bản mới hơn)  -> lấy bản mới về,
rem        KHÔNG đè ngược lên (lỗi hay gặp khi chép thư mục từ ổ khác / máy khác).
rem      - File có trên GitHub nhưng máy không có -> hỏi: xoá trên GitHub hay lấy về máy.
rem      - File anh mới sửa / mới thêm -> đưa lên.
rem   3. Chặn tuyệt đối file .env (mật khẩu CSDL, API key).
rem   4. Chạy bộ test - hỏng thì dừng, không đưa code hỏng lên Render.
rem   5. Hỏi lại, rồi commit + push vào main. Render tự deploy.
rem  Tự dọn mọi trạng thái git dở dang (rebase/merge hỏng, nhánh feature cũ...).
rem =====================================================================================
set "REPO_URL=https://github.com/luuhainam-hht/demotrangweb.git"
set "BRANCH=main"
set "TMPD=%TEMP%\hcc-day-git"
if not exist "%TMPD%" mkdir "%TMPD%"

echo.
echo  ===================== ĐẨY CODE LÊN GITHUB =====================
echo   Thư mục : %CD%
echo   Kho     : %REPO_URL%  (nhánh %BRANCH%)
echo  ================================================================
echo.

where git >nul 2>&1
if errorlevel 1 ( echo  [LỖI] Máy chưa cài Git: https://git-scm.com/download/win & goto loi )
where npm >nul 2>&1
if errorlevel 1 ( echo  [LỖI] Máy chưa cài Node.js: https://nodejs.org & goto loi )

rem ---------------- 1. Nối kho + dọn trạng thái dở dang ----------------
if not exist ".git" (
  echo  Thư mục chưa phải kho git - đang nối với GitHub ^(không sửa file nào^)...
  git init -q
  git remote add origin %REPO_URL%
)
git remote get-url origin >nul 2>&1
if errorlevel 1 git remote add origin %REPO_URL%
git remote set-url origin %REPO_URL%
git config core.fileMode false
git config core.quotePath false
git config user.name >nul 2>&1
if errorlevel 1 git config user.name "luuhainam-hht"
git config user.email >nul 2>&1
if errorlevel 1 git config user.email "luuhainam-hht@users.noreply.github.com"

if exist ".git\index.lock" (
  echo  Phát hiện khoá cũ .git\index.lock ^(do lần git trước bị tắt ngang^).
  echo  Hãy đóng VS Code và cửa sổ TU-DONG-DAY-GIT nếu đang mở.
  set "XOA="
  set /p "XOA=Xoá khoá này để tiếp tục? (y/n): "
  if /i not "!XOA!"=="y" goto huy
  del /f /q ".git\index.lock"
)
if exist ".git\rebase-merge" git rebase --abort >nul 2>&1
if exist ".git\rebase-apply" git rebase --abort >nul 2>&1
if exist ".git\MERGE_HEAD" git merge --abort >nul 2>&1

echo  [1/5] Đang tải bản mới nhất từ GitHub...
git fetch -q origin %BRANCH%
if errorlevel 1 (
  echo  [LỖI] Không tải được từ GitHub. Kiểm tra mạng / đăng nhập GitHub khi cửa sổ hiện ra.
  goto loi
)
rem Gắn thư mục vào main mới nhất: chỉ đổi "điểm gốc" của git, KHÔNG sửa/xoá file nào trên máy.
git symbolic-ref HEAD refs/heads/%BRANCH%
git reset -q origin/%BRANCH%
if errorlevel 1 goto loi

rem ---------------- 2. Chốt an toàn .env ----------------
findstr /x /c:".env" ".gitignore" >nul 2>&1
if errorlevel 1 echo .env>>".gitignore"
git add -A
git diff --cached --name-only | findstr /i /r /c:"^\.env$" >nul
if not errorlevel 1 (
  git reset -q
  echo  [LỖI] File .env lọt vào danh sách đẩy lên - đã huỷ. Kiểm tra lại .gitignore.
  goto loi
)

rem ---------------- 3. Bảo vệ code mới trên GitHub ----------------
echo  [2/5] Đang so sánh với bản trên GitHub...
git rev-list --objects origin/%BRANCH% > "%TMPD%\lich-su.txt"
git diff --cached --name-only --diff-filter=M > "%TMPD%\sua.txt"
set "SO_CU=0"
type nul > "%TMPD%\cu.txt"
for /f "usebackq delims=" %%F in ("%TMPD%\sua.txt") do (
  set "H="
  for /f "tokens=2" %%h in ('git ls-files -s -- "%%F"') do set "H=%%h"
  if defined H (
    findstr /b /c:"!H!" "%TMPD%\lich-su.txt" >nul
    if not errorlevel 1 (
      echo %%F>>"%TMPD%\cu.txt"
      set /a SO_CU+=1
    )
  )
)
if not "!SO_CU!"=="0" (
  echo.
  echo  CHÚ Ý: !SO_CU! file trên máy là BẢN CŨ - GitHub đã có bản mới hơn:
  for /f "usebackq delims=" %%F in ("%TMPD%\cu.txt") do echo     %%F
  echo  Đẩy lên sẽ làm MẤT tính năng mới trên GitHub. Khuyên: lấy bản mới về máy.
  set "LAY="
  set /p "LAY=Lấy bản mới từ GitHub về cho các file này? (y/n, Enter = y): "
  if /i not "!LAY!"=="n" (
    for /f "usebackq delims=" %%F in ("%TMPD%\cu.txt") do git checkout -q origin/%BRANCH% -- "%%F"
    echo  Đã lấy bản mới về máy.
  )
)

git diff --cached --name-only --diff-filter=D > "%TMPD%\xoa.txt"
for %%A in ("%TMPD%\xoa.txt") do if %%~zA GTR 0 (
  echo.
  echo  Các file sau CÓ trên GitHub nhưng KHÔNG có trên máy:
  for /f "usebackq delims=" %%F in ("%TMPD%\xoa.txt") do echo     %%F
  echo    y = xoá luôn trên GitHub ^(anh đã cố ý xoá^)
  echo    n = giữ trên GitHub và lấy về máy
  set "XOA="
  set /p "XOA=Chọn (y/n, Enter = n): "
  if /i not "!XOA!"=="y" (
    for /f "usebackq delims=" %%F in ("%TMPD%\xoa.txt") do git checkout -q origin/%BRANCH% -- "%%F"
    echo  Đã lấy các file đó về máy, không xoá trên GitHub.
  )
)

git add -A
git diff --cached --quiet
if not errorlevel 1 (
  echo.
  echo  Code trên máy đã giống hệt GitHub - không có gì để đẩy.
  goto xong
)

rem ---------------- 4. Chạy test ----------------
echo.
echo  [3/5] Chạy bộ test (khoảng 30-60 giây)...
if not exist "node_modules" (
  echo  Chưa có node_modules - đang cài thư viện...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto loi
)
call npm test >"%TMPD%\test.log" 2>&1
set "RC=!errorlevel!"
findstr /r /c:"^# tests" /c:"^# pass" /c:"^# fail" "%TMPD%\test.log"
if not "!RC!"=="0" (
  git reset -q
  echo  [DỪNG] Có test thất bại - KHÔNG đẩy code hỏng lên Render.
  echo         Chi tiết: %TMPD%\test.log
  goto loi
)
echo  Tất cả test đều đạt.

rem ---------------- 5. Commit + push ----------------
echo.
echo  [4/5] Những thay đổi sẽ đưa lên GitHub   (A = thêm, M = sửa, D = xoá):
git diff --cached --name-status
git diff --cached --shortstat
echo.
set "OK="
set /p "OK=Đồng ý đẩy lên GitHub? (y/n): "
if /i not "!OK!"=="y" ( git reset -q & goto huy )
set "MSG=Cap nhat code %date% %time:~0,5%"
set "NHAP="
set /p "NHAP=Ghi chú cho lần cập nhật (Enter = mặc định): "
if not "!NHAP!"=="" set "MSG=!NHAP!"
git commit -q -m "!MSG!"
if errorlevel 1 ( echo  [LỖI] Commit thất bại. & goto loi )

echo  [5/5] Đang đẩy lên GitHub...
git push origin HEAD:%BRANCH%
if errorlevel 1 (
  echo  [LỖI] Đẩy thất bại ^(mất mạng, chưa đăng nhập, hoặc vừa có người đẩy bản khác^).
  echo         Commit vẫn còn trên máy - chạy lại file này là được.
  goto loi
)
git branch -q --set-upstream-to=origin/%BRANCH% %BRANCH% >nul 2>&1
echo.
echo  ================================================================
echo   XONG - code đã lên GitHub. Render đang tự deploy:
echo   https://smart-queue-system-akpr.onrender.com
echo   Render Dashboard ^> Logs, thấy "Your service is live" là xong.
echo  ================================================================
goto xong

:huy
echo  Đã huỷ, chưa đẩy gì lên GitHub.
goto xong
:loi
echo.
pause
exit /b 1
:xong
echo.
pause
exit /b 0
