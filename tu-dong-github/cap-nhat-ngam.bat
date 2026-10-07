@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion
rem =====================================================================================
rem  TỰ ĐỘNG ĐẨY CODE LÊN GITHUB - chạy ngầm theo lịch (Task Scheduler), KHÔNG hỏi gì.
rem  Được gọi bởi tu-dong-github\chay-an.vbs. Bật/tắt bằng bat-tu-dong-cap-nhat.bat /
rem  tat-tu-dong-cap-nhat.bat ở thư mục gốc. Nhật ký: tu-dong-github.log ở thư mục gốc.
rem
rem  Chỉ đẩy khi: có thay đổi + bộ test đạt + file .env không lọt vào. Nếu GitHub có commit
rem  mới hơn (sửa từ máy khác) thì ghép vào trước; ghép không được thì dừng, không ghi đè.
rem =====================================================================================
cd /d "%~dp0.."
set "REPO_URL=https://github.com/luuhainam-hht/demotrangweb.git"
set "BRANCH=main"
set "LOG=%CD%\tu-dong-github.log"
rem Chạy ngầm: tuyệt đối không bật hộp thoại hỏi mật khẩu (sẽ treo mãi vì không ai bấm).
set "GIT_TERMINAL_PROMPT=0"
set "GCM_INTERACTIVE=never"

if exist "%LOG%" for %%A in ("%LOG%") do if %%~zA GTR 500000 move /y "%LOG%" "%LOG%.cu" >nul

where git >nul 2>&1
if errorlevel 1 (
  call :ghi "LOI: may chua cai Git - https://git-scm.com/download/win"
  exit /b 1
)

rem --- Chạy ngầm KHÔNG tự nối thư mục mới: không biết bản trên máy hay bản GitHub mới hơn,
rem     đẩy nhầm sẽ xoá mất sửa đổi trên GitHub. Phải chạy cap-nhat-github.bat 1 lần để chọn. ---
if not exist ".git" (
  call :ghi "Bo qua: thu muc chua noi GitHub - chay cap-nhat-github.bat 1 lan truoc"
  exit /b 1
)
git remote get-url origin >nul 2>&1
if errorlevel 1 git remote add origin %REPO_URL%
git config core.fileMode false
git config user.name >nul 2>&1
if errorlevel 1 git config user.name "luuhainam-hht"
git config user.email >nul 2>&1
if errorlevel 1 git config user.email "luuhainam-hht@users.noreply.github.com"

if exist ".git\index.lock" (
  call :ghi "Bo qua lan nay: dang co thao tac git khac - file .git\index.lock"
  exit /b 0
)

git fetch -q origin %BRANCH% >>"%LOG%" 2>&1
if errorlevel 1 (
  call :ghi "LOI: khong tai duoc tu GitHub - mat mang hoac chua dang nhap. Chay cap-nhat-github.bat 1 lan de dang nhap."
  exit /b 1
)
git rev-parse --verify -q HEAD >nul 2>&1
if errorlevel 1 (
  call :ghi "Bo qua: kho chua co lich su - chay cap-nhat-github.bat 1 lan truoc"
  exit /b 1
)

rem --- Chốt an toàn .env ---
git ls-files --error-unmatch .env >nul 2>&1
if not errorlevel 1 (
  call :ghi "DUNG: .env dang bi git theo doi - chay: git rm --cached .env"
  exit /b 1
)
findstr /x /c:".env" ".gitignore" >nul 2>&1
if errorlevel 1 echo .env>>".gitignore"

git add -A
git diff --cached --name-only | findstr /x /c:".env" >nul
if not errorlevel 1 (
  git reset -q
  call :ghi "DUNG: phat hien .env trong danh sach commit - da huy"
  exit /b 1
)

git diff --cached --quiet
if errorlevel 1 (
  rem --- Có thay đổi: chạy test trước khi commit ---
  if not exist "node_modules" (
    git reset -q
    call :ghi "Bo qua: chua co node_modules nen khong chay duoc test - chay npm install 1 lan"
    exit /b 1
  )
  call npm test >"%TEMP%\hcc-tu-dong-test.log" 2>&1
  if errorlevel 1 (
    git reset -q
    call :ghi "DUNG: co test that bai - KHONG day. Chi tiet: %TEMP%\hcc-tu-dong-test.log"
    exit /b 1
  )
  set "SOFILE=0"
  for /f %%n in ('git diff --cached --name-only ^| find /c /v ""') do set "SOFILE=%%n"
  git commit -q -m "Tu dong cap nhat %date% %time:~0,5% (!SOFILE! file)"
  if errorlevel 1 (
    git reset -q
    call :ghi "LOI: commit that bai"
    exit /b 1
  )
  call :ghi "Da commit !SOFILE! file thay doi"
)

rem --- GitHub có commit mới hơn: ghép vào trước khi đẩy ---
set "BEHIND=0"
for /f %%n in ('git rev-list --count HEAD..origin/%BRANCH% 2^>nul') do set "BEHIND=%%n"
if not "!BEHIND!"=="0" (
  git pull -q --rebase origin %BRANCH% >>"%LOG%" 2>&1
  if errorlevel 1 (
    git rebase --abort >nul 2>&1
    call :ghi "DUNG: GitHub co !BEHIND! commit moi bi trung doan voi may - can ghep tay"
    exit /b 1
  )
)

set "AHEAD=0"
for /f %%n in ('git rev-list --count origin/%BRANCH%..HEAD 2^>nul') do set "AHEAD=%%n"
if "!AHEAD!"=="0" (
  call :ghi "Khong co gi moi"
  exit /b 0
)
git push -q origin HEAD:%BRANCH% >>"%LOG%" 2>&1
if errorlevel 1 (
  call :ghi "LOI: day len GitHub that bai - se thu lai o lan chay sau"
  exit /b 1
)
call :ghi "DA DAY !AHEAD! commit len GitHub - Render se tu deploy"
exit /b 0

:ghi
echo [%date% %time:~0,8%] %~1>>"%LOG%"
exit /b 0
