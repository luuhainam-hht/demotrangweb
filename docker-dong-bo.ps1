# =====================================================================================
#  MENU QUAN LY DOCKER + DONG BO CSDL NEON - He thong Mot Cua Thong Minh
#  Chay bang cach bam dup file docker-dong-bo.bat (khong can go lenh).
#  Yeu cau: da cai Docker Desktop va dang mo Docker Desktop.
# =====================================================================================
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location -Path $PSScriptRoot

function Pause-Menu { Write-Host ''; Read-Host 'Bấm Enter để quay lại menu' | Out-Null }
function Sync([string]$args1) {
  docker compose run --rm sync node scripts/db-sync.js $args1.Split(' ')
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host 'Chưa cài Docker Desktop. Tải tại https://www.docker.com/products/docker-desktop/ rồi chạy lại.' -ForegroundColor Red
  Read-Host 'Bấm Enter để thoát' | Out-Null; exit 1
}
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Docker Desktop chưa chạy. Hãy mở Docker Desktop, đợi biểu tượng cá voi chuyển xanh rồi chạy lại.' -ForegroundColor Red
  Read-Host 'Bấm Enter để thoát' | Out-Null; exit 1
}
if (-not (Test-Path '.env')) {
  Copy-Item '.env.example' '.env'
  Write-Host 'Đã tạo file .env từ .env.example - hãy dán chuỗi kết nối Neon vào DATABASE_URL rồi chạy lại.' -ForegroundColor Yellow
  notepad .env; exit 0
}

while ($true) {
  Clear-Host
  Write-Host '=================================================================' -ForegroundColor Cyan
  Write-Host '   HỆ THỐNG MỘT CỬA THÔNG MINH - DOCKER & ĐỒNG BỘ NEON' -ForegroundColor Cyan
  Write-Host '=================================================================' -ForegroundColor Cyan
  Write-Host ' 1. Khởi động / cập nhật hệ thống (build + chạy)'
  Write-Host ' 2. Xem trạng thái các container'
  Write-Host ' 3. So sánh dữ liệu Neon <-> Docker (trạng thái đồng bộ)'
  Write-Host ' 4. Kéo dữ liệu Neon -> Docker (ghi đè Docker, có sao lưu trước)'
  Write-Host ' 5. Đẩy dữ liệu Docker -> Neon (GHI ĐÈ Neon, có sao lưu trước)'
  Write-Host ' 6. Bật sao chép REALTIME Neon -> Docker'
  Write-Host ' 7. Tắt sao chép realtime'
  Write-Host ' 8. Sao lưu ngay (cả Neon và Docker) vào thư mục backups'
  Write-Host ' 9. Xem nhật ký đồng bộ trực tiếp (Ctrl+C để thoát)'
  Write-Host '10. Mở trang web (http://localhost:3000)'
  Write-Host '11. Mở giao diện xem CSDL Adminer (http://localhost:8080)'
  Write-Host '12. Dừng hệ thống'
  Write-Host ' 0. Thoát'
  $c = Read-Host 'Chọn'
  switch ($c) {
    '1'  { docker compose up -d --build; docker compose ps; Pause-Menu }
    '2'  { docker compose ps; Pause-Menu }
    '3'  { Sync 'status'; Pause-Menu }
    '4'  { Sync 'pull'; Pause-Menu }
    '5'  {
      Write-Host 'CẢNH BÁO: toàn bộ dữ liệu trên Neon (web Render đang dùng) sẽ bị thay bằng dữ liệu Docker.' -ForegroundColor Red
      $ok = Read-Host 'Gõ DONG Y để tiếp tục'
      if ($ok -eq 'DONG Y') { Sync 'push --yes' } else { Write-Host 'Đã hủy.' }
      Pause-Menu }
    '6'  { Sync 'replica:setup'; Pause-Menu }
    '7'  { Sync 'replica:stop'; Pause-Menu }
    '8'  { Sync 'backup both'; Get-ChildItem backups -Filter *.dump | Sort-Object LastWriteTime -Descending | Select-Object -First 4 Name, Length, LastWriteTime | Format-Table; Pause-Menu }
    '9'  { docker compose logs -f --tail 50 sync }
    '10' { Start-Process 'http://localhost:3000' }
    '11' { docker compose --profile tools up -d adminer; Start-Process 'http://localhost:8080'; Pause-Menu }
    '12' { docker compose down; Pause-Menu }
    '0'  { exit 0 }
    default { }
  }
}
