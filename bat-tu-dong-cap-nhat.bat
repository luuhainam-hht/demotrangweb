@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
title Bat tu dong cap nhat GitHub
rem =====================================================================================
rem  BẬT TỰ ĐỘNG ĐẨY CODE LÊN https://github.com/luuhainam-hht/demotrangweb
rem  Tạo 1 lịch trong Windows Task Scheduler: cứ N phút chạy ngầm tu-dong-github\cap-nhat-ngam.bat.
rem  Tắt bằng tat-tu-dong-cap-nhat.bat. Nhật ký: tu-dong-github.log
rem =====================================================================================
set "TASK=HCC - Tu dong cap nhat GitHub"

echo.
echo ============ BẬT TỰ ĐỘNG CẬP NHẬT LÊN GITHUB ============
echo  Kho: https://github.com/luuhainam-hht/demotrangweb
echo  Thư mục: %CD%
echo.
echo  Cứ mỗi N phút, máy tự kiểm tra: có thay đổi + test đạt thì tự đẩy lên GitHub,
echo  Render tự deploy bản mới. File .env không bao giờ bị đưa lên.
echo  Chỉ chạy khi anh đã đăng nhập Windows và ổ chứa thư mục này đang cắm.
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo  [LỖI] Máy chưa cài Git. Tải tại https://git-scm.com/download/win rồi chạy lại.
  goto ket_thuc
)

set "PHUT="
set /p "PHUT=Bao nhiêu phút kiểm tra 1 lần? (Enter = 15): "
if "%PHUT%"=="" set "PHUT=15"
echo %PHUT%| findstr /r "^[1-9][0-9]*$" >nul
if errorlevel 1 (
  echo  [LỖI] Phải nhập số phút, ví dụ 15.
  goto ket_thuc
)

echo.
echo  BƯỚC 1/2: Chạy đẩy thủ công 1 lần để nối kho và ĐĂNG NHẬP GitHub.
echo  Nếu trình duyệt mở trang đăng nhập GitHub, hãy đăng nhập tài khoản luuhainam-hht.
echo  Máy sẽ nhớ đăng nhập để các lần chạy ngầm sau tự đẩy được.
echo.
pause
call "%~dp0cap-nhat-github.bat"

echo.
echo  BƯỚC 2/2: Tạo lịch chạy ngầm mỗi %PHUT% phút...
schtasks /Create /F /SC MINUTE /MO %PHUT% /TN "%TASK%" /TR "wscript.exe \"%~dp0tu-dong-github\chay-an.vbs\"" >nul
if errorlevel 1 (
  echo  [LỖI] Không tạo được lịch. Thử chuột phải file này, chọn "Run as administrator".
  goto ket_thuc
)
schtasks /Run /TN "%TASK%" >nul 2>&1
echo.
echo  ĐÃ BẬT. Tên lịch: "%TASK%" - chạy mỗi %PHUT% phút.
echo  Xem kết quả từng lần chạy trong file: %CD%\tu-dong-github.log
echo  Muốn tắt: bấm đúp tat-tu-dong-cap-nhat.bat

:ket_thuc
echo.
pause
