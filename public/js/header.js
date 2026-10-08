// Header dung chung, tu gan vao dau <body> - chi can nhung 1 dong <script src="js/header.js">
// vao moi trang, khong phai lap lai markup logo/nav o tung file HTML.
//
// Thay doi 2026-09:
//  - Tren dien thoai, 6 lien ket dieu huong gio gom vao 1 nut "Menu" (truoc day bi bop lai
//    con 0.8rem, rat kho bam - chinh la nhom nguoi dung ma he thong phuc vu nhieu nhat).
(function () {
  // login.html KHONG dung header nay (tu quan ly rieng, xem public/login.html).
  const PUBLIC_PAGES = ['', 'index.html', 'kiosk-checklist.html', 'huong-dan.html', 'huong-dan-dien-mau.html', 'hoi-dap.html', 'theo-doi.html', 'ket-noi-wifi.html', 'nop-ho-so-truc-tuyen.html', 'display.html', '404.html'];
  const currentPage = window.location.pathname.split('/').pop();
  const isPublicPage = PUBLIC_PAGES.includes(currentPage);

  // QUAN TRONG: header cong khai (Trang chu/Kiosk/Huong dan/Bang LED) KHONG duoc chua bat ky
  // lien ket nao toi /login.html hay khu vuc Quay/Admin - nguoi dan tra cuu khong duoc thay
  // hoac tiep can luong "goi so"/dang nhap noi bo. Khu vuc can bo hoan toan tach rieng.
  const navItems = isPublicPage
    ? [
        { href: 'index.html', label: 'Trang chủ', match: ['', 'index.html'] },
        { href: 'hoi-dap.html', label: 'Hỏi đáp', match: ['hoi-dap.html'] },
        { href: 'huong-dan-dien-mau.html', label: 'Cách điền giấy tờ', match: ['huong-dan-dien-mau.html'] },
        { href: 'nop-ho-so-truc-tuyen.html', label: 'Nộp hồ sơ online', match: ['nop-ho-so-truc-tuyen.html'] },
        { href: 'ket-noi-wifi.html', label: 'Wi-Fi', match: ['ket-noi-wifi.html'] },
        { href: 'huong-dan.html', label: 'Hướng dẫn', match: ['huong-dan.html'] }
      ]
    : [
        { href: 'index.html', label: 'Trang chủ', match: [] }
      ];

  const navHtml = navItems.map((item) => {
    const active = item.match.includes(currentPage);
    return `<a href="${item.href}" class="site-nav-link${active ? ' active' : ''}"${active ? ' aria-current="page"' : ''}>${item.label}</a>`;
  }).join('');

  // data-show-header-clock="true" tren <body> (thay cho bien global truoc day - CSP script-src
  // bat lai o server.js chan inline <script> nen khong the dat bien global truoc khi nhung
  // header.js nua) de hien dong ho thoi gian thuc canh cac lien ket dieu huong - dung cho man
  // hinh Kiosk cong khai.
  const showClock = document.body.dataset.showHeaderClock === 'true';
  const clockHtml = showClock ? `<span id="site-clock" class="site-clock"></span>` : '';

  const headerHtml = `
    <header class="site-header">
      <a href="index.html" class="site-brand">
        <img src="assets/logoKiosk-trimmed-transparent.png" alt="KIOSK - Digital Numbers &amp; Transformation" class="site-logo" />
      </a>
      <button type="button" class="site-nav-toggle" id="site-nav-toggle" aria-expanded="false" aria-controls="site-nav">
        <span aria-hidden="true">☰</span> Menu
      </button>
      <nav class="site-nav" id="site-nav" aria-label="Điều hướng chính">${clockHtml}${navHtml}</nav>
    </header>
  `;

  document.body.insertAdjacentHTML('afterbegin', headerHtml);

  if (showClock) {
    const tick = () => { document.getElementById('site-clock').textContent = new Date().toLocaleString('vi-VN'); };
    tick();
    setInterval(tick, 1000);
  }

  // Menu thu gon tren dien thoai. Dung thuoc tinh `hidden` (khong phai class) de trinh doc man
  // hinh cung hieu la dang an; CSS chi phu trach phan hien thi o be ngang <= 860px.
  const toggle = document.getElementById('site-nav-toggle');
  const nav = document.getElementById('site-nav');
  const MOBILE_QUERY = window.matchMedia('(max-width: 860px)');

  function applyNavMode() {
    if (MOBILE_QUERY.matches) {
      nav.hidden = toggle.getAttribute('aria-expanded') !== 'true';
    } else {
      nav.hidden = false;                       // man hinh rong: luon hien day du
      toggle.setAttribute('aria-expanded', 'false');
    }
  }
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
    applyNavMode();
  });
  // Bam ra ngoai hoac nhan Esc thi dong menu (nguoi dung hay bi "ket" trong menu mo).
  document.addEventListener('click', (e) => {
    if (!MOBILE_QUERY.matches) return;
    if (nav.hidden) return;
    if (nav.contains(e.target) || toggle.contains(e.target)) return;
    toggle.setAttribute('aria-expanded', 'false');
    applyNavMode();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !nav.hidden && MOBILE_QUERY.matches) {
      toggle.setAttribute('aria-expanded', 'false');
      applyNavMode();
      toggle.focus();
    }
  });
  if (MOBILE_QUERY.addEventListener) MOBILE_QUERY.addEventListener('change', applyNavMode);
  else MOBILE_QUERY.addListener(applyNavMode);   // Safari cu
  applyNavMode();

  // Banner "Trung tam dang dong cua" (chi trang co <body data-show-hours-banner="true">: Trang chu,
  // Kiosk). Lay trang thai tu GET /api/kiosk/hours (xem src/services/kioskHours.js). Dung chung
  // 1 loi goi qua window.KioskHours de kiosk-checklist.js khong phai goi lai. Loi mang -> khong
  // hien gi (khong bao gio chan nguoi dan chi vi khong doc duoc gio mo cua).
  window.KioskHours = {
    _promise: null,
    load() {
      if (!this._promise) {
        this._promise = fetch('/api/kiosk/hours').then((r) => r.json()).catch(() => null);
      }
      return this._promise;
    }
  };
  if (document.body.dataset.showHoursBanner === 'true') {
    window.KioskHours.load().then((hours) => {
      if (!hours || hours.open) return;
      const banner = document.createElement('div');
      banner.className = 'hours-banner';
      banner.setAttribute('role', 'status');
      banner.innerHTML = '<span class="hours-banner-icon">🕒</span><div></div>';
      banner.querySelector('div').textContent = hours.message;
      const header = document.querySelector('.site-header');
      if (header) header.insertAdjacentElement('afterend', banner);
    });
  }

  // ===== Nang cap 10/2026: che do mat mang tam thoi (xem public/sw.js) =====
  // Chi trang cong khai dang ky Service Worker; Bang LED (display.html) can du lieu song nen bo qua.
  if (isPublicPage && currentPage !== 'display.html' && 'serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
  // Thanh bao mat mang: nguoi dan biet vi sao bam "Lay so" khong duoc, thay vi tuong may hong.
  const offlineBar = document.createElement('div');
  offlineBar.className = 'offline-banner';
  offlineBar.setAttribute('role', 'alert');
  offlineBar.hidden = true;
  offlineBar.innerHTML = '<span aria-hidden="true">📡</span> Máy đang mất kết nối mạng — tạm thời chưa lấy số được. Thông tin giấy tờ, hỏi đáp vẫn xem được. Hệ thống sẽ tự kết nối lại.';
  document.body.appendChild(offlineBar);
  const syncOffline = () => { offlineBar.hidden = navigator.onLine; };
  window.addEventListener('online', syncOffline);
  window.addEventListener('offline', syncOffline);
  syncOffline();
})();
