// =====================================================================================
// VIDEO LUC CHO - Trang chu Kiosk (11/2026)
// Sau IDLE_VIDEO_MINUTES phut (mac dinh 5) khong ai cham / bam / go phim tren Trang chu, man hinh
// phat video YouTube do Admin dan trong Cau hinh Tham so (IDLE_VIDEO_YOUTUBE). Cham vao bat ky
// dau tren man hinh -> tat video, ve dau Trang chu.
//  - Video phat KHONG tieng (muted): trinh duyet chan tu phat co tieng khi chua ai cham man hinh,
//    va o noi cong cong cung khong nen phat tieng lien tuc.
//  - Chua cau hinh video / mat mang -> hien man hinh cho tinh "Cham de bat dau" thay vi man den.
//  - Lop phu trong suot nam TREN iframe YouTube: neu khong, cham vao video se bam vao trinh phat
//    YouTube (mo trang YouTube) thay vi tat video.
// =====================================================================================
(function () {
  const DEFAULT_MINUTES = 5;
  let idleMs = DEFAULT_MINUTES * 60 * 1000;
  let cfg = { videoId: null, playlistId: null };
  let timer = null;
  let overlay = null;
  // ?idle=test : bat sau 5 giay de ky thuat vien kiem tra man hinh cho ngay tai Kiosk.
  const testMode = new URLSearchParams(window.location.search).get('idle') === 'test';
  if (testMode) idleMs = 5000;

  function embedUrl() {
    const p = new URLSearchParams({
      autoplay: '1', mute: '1', controls: '0', rel: '0', playsinline: '1',
      modestbranding: '1', iv_load_policy: '3', disablekb: '1', fs: '0', loop: '1'
    });
    if (cfg.videoId) {
      // loop=1 cua YouTube chi chay khi co playlist=<chinh video do> (hoac list=<danh sach>).
      if (cfg.playlistId) p.set('list', cfg.playlistId); else p.set('playlist', cfg.videoId);
      return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(cfg.videoId)}?${p}`;
    }
    p.set('list', cfg.playlistId);
    return `https://www.youtube-nocookie.com/embed/videoseries?${p}`;
  }

  function show() {
    if (overlay) return;
    // Dang go do (VD o tim kiem / o nhap ma) thi khong che man hinh.
    const a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.value) { schedule(); return; }

    overlay = document.createElement('div');
    overlay.className = 'idle-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Màn hình chờ - chạm để bắt đầu');
    const hasVideo = (cfg.videoId || cfg.playlistId) && navigator.onLine;
    overlay.innerHTML = `
      ${hasVideo ? `<iframe class="idle-video" src="${embedUrl()}" title="Video giới thiệu" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" tabindex="-1"></iframe>` : `
      <div class="idle-still">
        <img src="assets/quoc-huy.png" alt="" class="idle-emblem" />
        <div class="idle-unit"></div>
        <div class="idle-name">CẨM NANG SỐ HỖ TRỢ THÔNG TIN HÀNH CHÍNH CÔNG</div>
        <div class="idle-sub">Tra cứu thủ tục · Chuẩn bị hồ sơ · Lấy số thứ tự · Nhập mã chờ</div>
      </div>`}
      <div class="idle-tap-layer" aria-hidden="true"></div>
      <div class="idle-cta"><span class="idle-cta-dot"></span>Chạm vào màn hình để bắt đầu tra cứu</div>`;
    const unit = overlay.querySelector('.idle-unit');
    const headerUnit = document.querySelector('.gov-unit');
    if (unit && headerUnit) unit.textContent = headerUnit.textContent;
    document.body.appendChild(overlay);
    document.documentElement.classList.add('idle-active');
  }

  function hide() {
    if (!overlay) return;
    overlay.remove();            // xoa iframe = dung video, khong ton bang thong
    overlay = null;
    document.documentElement.classList.remove('idle-active');
    window.scrollTo(0, 0);
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(show, idleMs);
  }

  function onActivity(e) {
    if (overlay) {
      // Cham dau tien chi de tat video - khong de "lot" xuong bam nham vao nut ben duoi.
      if (e && e.cancelable && e.type !== 'keydown') e.preventDefault();
      hide();
    }
    schedule();
  }

  ['pointerdown', 'touchstart', 'mousedown', 'keydown', 'wheel'].forEach((evt) => {
    document.addEventListener(evt, onActivity, { capture: true, passive: evt === 'wheel' });
  });
  // Cuon trang / di chuot cung tinh la dang dung (nhung khong tu tat video vi chuot rung nhe).
  ['scroll', 'mousemove'].forEach((evt) => window.addEventListener(evt, () => { if (!overlay) schedule(); }, { passive: true }));

  fetch('/api/kiosk/idle-video', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data) return;
      cfg = { videoId: data.videoId || null, playlistId: data.playlistId || null };
      if (Number(data.minutes) > 0 && !testMode) idleMs = Number(data.minutes) * 60 * 1000;
      schedule();
    })
    .catch(() => {});
  schedule();

  window.IdleVideo = { show, hide };
})();
