@echo off
rem =====================================================================================
rem  GHÉP BẢN MỚI TỪ GITHUB VÀO THƯ MỤC TRÊN MÁY - an toàn, không mất sửa đổi của anh.
rem  Được gọi bởi cap-nhat-github.bat và tu-dong-github\cap-nhat-ngam.bat (thư mục hiện tại
rem  phải là thư mục dự án, đã "git fetch" xong).   Cách gọi:  call dong-bo-voi-github.bat main
rem  Trả về errorlevel 0 = đã ghép xong (hoặc không cần ghép), 1 = có xung đột thật, đã dừng.
rem
rem  Vì sao không dùng "git pull --rebase": file trên máy được chép tay / ghi từ bên ngoài nên
rem  git coi là "chưa theo dõi" dù nội dung GIỐNG HỆT bản GitHub -> git pull từ chối với lỗi
rem  "untracked working tree files would be overwritten". Script này so nội dung từng file:
rem    - file trên máy đã giống bản GitHub          -> bỏ qua
rem    - file trên máy chưa sửa (giống bản cũ)      -> lấy bản GitHub về
rem    - file bị sửa ở CẢ máy lẫn GitHub, khác nhau -> XUNG ĐỘT, dừng lại, không đụng gì
rem =====================================================================================
setlocal EnableExtensions EnableDelayedExpansion
set "BR=%~1"
if "%BR%"=="" set "BR=main"
git config core.quotePath false

set "AHEAD=0"
set "BEHIND=0"
for /f %%n in ('git rev-list --count origin/%BR%..HEAD 2^>nul') do set "AHEAD=%%n"
for /f %%n in ('git rev-list --count HEAD..origin/%BR% 2^>nul') do set "BEHIND=%%n"
if "!BEHIND!"=="0" exit /b 0

if not "!AHEAD!"=="0" (
  rem Máy có commit chưa đẩy: dùng rebase thông thường.
  git pull -q --rebase --autostash origin %BR%
  if errorlevel 1 (
    git rebase --abort >nul 2>&1
    echo  [XUNG ĐỘT] Commit trên máy và trên GitHub sửa cùng một đoạn - cần ghép tay.
    exit /b 1
  )
  exit /b 0
)

set "DS=%TEMP%\hcc-github-thay-doi.txt"
git diff --name-only --no-renames HEAD origin/%BR% > "%DS%"

rem --- Lượt 1: tìm xung đột thật ---
set "XUNG=0"
for /f "usebackq delims=" %%F in ("%DS%") do (
  call :bam "%%F"
  if not "!L!"=="!O!" if not "!L!"=="!H!" (
    echo  [XUNG ĐỘT] %%F - bị sửa ở cả máy này và GitHub
    set "XUNG=1"
  )
)
if "!XUNG!"=="1" exit /b 1

rem --- Lượt 2: lấy bản GitHub cho các file trên máy chưa sửa ---
for /f "usebackq delims=" %%F in ("%DS%") do (
  call :bam "%%F"
  if not "!L!"=="!O!" if "!L!"=="!H!" (
    if defined O (
      git checkout -q origin/%BR% -- "%%F"
    ) else (
      if exist "!P!" del /f /q "!P!"
    )
  )
)
git reset -q origin/%BR%
echo  Đã ghép !BEHIND! cập nhật mới từ GitHub vào thư mục này.
exit /b 0

rem Tính mã nội dung của 1 file: L = trên máy, H = bản cũ (HEAD), O = bản GitHub. Rỗng = không có.
:bam
set "L="
set "H="
set "O="
set "P=%~1"
set "P=!P:/=\!"
if exist "!P!" for /f %%h in ('git hash-object "%~1"') do set "L=%%h"
for /f %%h in ('git rev-parse -q --verify "HEAD:%~1" 2^>nul') do set "H=%%h"
for /f %%h in ('git rev-parse -q --verify "origin/%BR%:%~1" 2^>nul') do set "O=%%h"
exit /b 0
