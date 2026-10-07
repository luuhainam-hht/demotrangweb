// Nang cap 10/2026: thiet bi dau cuoi tu bao "con song" cho Admin Control Tower (bang device_health).
//   - Bang LED (display.html): LUON gui. Ma thiet bi lay tu ?device=LED-SANH-01 (nho lai trong may),
//     khong co thi tu sinh LED-XXXX. Trang thai DEGRADED khi loa PA chua duoc bat.
//   - May Kiosk: CHI gui khi da duoc gan ma 1 lan bang ?device=KIOSK-01 tren may do. Dien thoai cua
//     nguoi dan mo trang cong khai se KHONG gui gi (khong co ma).
(function () {
  const page = window.location.pathname.split('/').pop();
  const isDisplay = page === 'display.html';
  const type = isDisplay ? 'LED_BOARD' : 'KIOSK';
  const storageKey = isDisplay ? 'hcc_led_device' : 'hcc_kiosk_device';
  const fromUrl = new URLSearchParams(window.location.search).get('device');

  let code = null;
  try {
    if (fromUrl) localStorage.setItem(storageKey, fromUrl.trim().toUpperCase());
    code = localStorage.getItem(storageKey);
    if (!code && isDisplay) {
      code = `LED-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      localStorage.setItem(storageKey, code);
    }
  } catch (e) { code = fromUrl ? fromUrl.trim().toUpperCase() : null; }
  if (!code) return;

  let status = 'ONLINE';
  async function beat() {
    try {
      await fetch('/api/display/heartbeat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceType: type, deviceCode: code, status })
      });
    } catch (e) { /* mat mang: Dashboard se tu bao OFFLINE */ }
  }

  window.DeviceHeartbeat = {
    code,
    setStatus(next) { if (next !== status) { status = next; beat(); } }
  };
  beat();
  setInterval(beat, 45000);
})();
