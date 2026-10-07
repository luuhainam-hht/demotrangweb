@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
title He thong Mot Cua Thong Minh - Docker va dong bo Neon
rem =====================================================================================
rem  MENU QUAN LY DOCKER + DONG BO CSDL NEON - He thong Mot Cua Thong Minh
rem  Bam dup file nay de chay (khong can go lenh, khong can PowerShell).
rem  Yeu cau: da cai Docker Desktop va Docker Desktop dang mo.
rem  Chi tiet: docs\DOCKER-NEON-SYNC.md
rem =====================================================================================

where docker >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [LOI] Chua cai Docker Desktop.
  echo  Tai tai: https://www.docker.com/products/docker-desktop/  roi chay lai file nay.
  echo.
  pause
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo.
  echo  [LOI] Docker Desktop chua chay.
  echo  Hay mo Docker Desktop, doi bieu tuong ca voi chuyen sang trang thai chay, roi mo lai file nay.
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo.
  echo  Da tao file .env tu .env.example.
  echo  Hay dan chuoi ket noi Neon vao dong DATABASE_URL, luu file, roi chay lai.
  echo.
  notepad ".env"
  exit /b 0
)

:menu
cls
echo =================================================================
echo    HỆ THỐNG MỘT CỬA THÔNG MINH - DOCKER VÀ ĐỒNG BỘ NEON
echo =================================================================
echo   1. Khởi động / cập nhật hệ thống (build + chạy)
echo   2. Xem trạng thái các container
echo   3. So sánh dữ liệu Neon và Docker (trạng thái đồng bộ)
echo   4. Kéo dữ liệu Neon về Docker (ghi đè Docker, có sao lưu trước)
echo   5. Đẩy dữ liệu Docker lên Neon (GHI ĐÈ Neon, có sao lưu trước)
echo   6. Bật sao chép REALTIME Neon về Docker
echo   7. Tắt sao chép realtime
echo   8. Sao lưu ngay cả Neon và Docker vào thư mục backups
echo   9. Xem nhật ký đồng bộ trực tiếp (Ctrl+C để thoát)
echo  10. Mở trang web  http://localhost:3000
echo  11. Mở giao diện xem CSDL Adminer  http://localhost:8080
echo  12. Dừng hệ thống
echo   0. Thoát
echo =================================================================
set "c="
set /p "c=Chọn số rồi bấm Enter: "

if "%c%"=="1"  goto khoi_dong
if "%c%"=="2"  goto trang_thai
if "%c%"=="3"  goto so_sanh
if "%c%"=="4"  goto keo_ve
if "%c%"=="5"  goto day_len
if "%c%"=="6"  goto bat_realtime
if "%c%"=="7"  goto tat_realtime
if "%c%"=="8"  goto sao_luu
if "%c%"=="9"  goto nhat_ky
if "%c%"=="10" goto mo_web
if "%c%"=="11" goto adminer
if "%c%"=="12" goto dung
if "%c%"=="0"  exit /b 0
goto menu

:khoi_dong
docker compose up -d --build
docker compose ps
goto tam_dung

:trang_thai
docker compose ps
goto tam_dung

:so_sanh
docker compose run --rm sync node scripts/db-sync.js status
goto tam_dung

:keo_ve
docker compose run --rm sync node scripts/db-sync.js pull
goto tam_dung

:day_len
echo.
echo  CẢNH BÁO: toàn bộ dữ liệu trên Neon (web Render đang dùng) sẽ bị thay bằng dữ liệu Docker.
echo  Neon sẽ được tự động sao lưu vào thư mục backups trước khi ghi đè.
set "ok="
set /p "ok=Gõ DONG Y để tiếp tục: "
if /i "%ok%"=="DONG Y" (
  docker compose run --rm sync node scripts/db-sync.js push --yes
) else (
  echo  Đã hủy, không thay đổi gì.
)
goto tam_dung

:bat_realtime
docker compose run --rm sync node scripts/db-sync.js replica:setup
goto tam_dung

:tat_realtime
docker compose run --rm sync node scripts/db-sync.js replica:stop
goto tam_dung

:sao_luu
docker compose run --rm sync node scripts/db-sync.js backup both
echo.
echo  Các bản sao lưu mới nhất:
dir /b /o-d "backups\*.dump" 2>nul
goto tam_dung

:nhat_ky
docker compose logs -f --tail 50 sync
goto menu

:mo_web
start "" "http://localhost:3000"
goto menu

:adminer
docker compose --profile tools up -d adminer
start "" "http://localhost:8080"
goto tam_dung

:dung
docker compose down
goto tam_dung

:tam_dung
echo.
pause
goto menu
