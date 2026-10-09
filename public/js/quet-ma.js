// Trang "Quet ma quay lai hang doi" tai Kiosk (UC-09 - Hinh 2.7 so do bao cao: "Cong dan quet ma QR
// Re-entry tai Kiosk"). Truoc day ma QR tren phieu quay lai chi dung duoc bang DIEN THOAI (mo
// index.html?reentry=<token>, widget Tro ly AI xu ly) - cong dan khong co dien thoai thi khong co
// cach nao quay lai. Trang nay cho 3 cach:
//   1. Camera cua may Kiosk/dien thoai: BarcodeDetector cua trinh duyet (Chrome/Edge/Android), khong
//      co thi dung thu vien jsQR (vendor/jsQR.min.js) doc tung khung hinh.
//   2. May quet ma USB (sung quet): hoat dong nhu ban phim, go nguyen URL/ma roi Enter -> o nhap an
//      luon duoc giu focus de nhan.
//   3. Nhap tay: So thu tu + Ma quay lai 8 ky tu in duoi QR tren phieu (khi camera/may quet hong).
// Ca 3 deu goi POST /api/kiosk/reentry-scan; ket qua hien so, quay, so nguoi phia truoc + QR theo doi.
(function () {
  // Trinh duyet chi cho rung sau khi nguoi dung da cham vao trang (neu khong se bao loi o console).
  function canVibrate() {
    const active = navigator.userActivation ? navigator.userActivation.hasBeenActive : true;
    return !!(active && navigator.vibrate);
  }
  const $ = (id) => document.getElementById(id);
  let submitting = false;
  let stream = null;
  let detector = null;
  let scanTimer = null;
  let jsqrPromise = null;

  function showScreen(name) {
    ['scan', 'done', 'error'].forEach((s) => $(`screen-${s}`).classList.toggle('hidden', s !== name));
    if (name !== 'scan') stopCamera();
  }

  // Kiosk cong cong: khong thao tac 90s thi ve Trang chu (giong kiosk-checklist.html).
  const IDLE_RESET_MS = 90 * 1000;
  let idleTimer = null;
  function resetIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { stopCamera(); window.location.href = 'index.html'; }, IDLE_RESET_MS);
  }
  ['click', 'touchstart', 'keydown'].forEach((evt) => document.addEventListener(evt, resetIdleTimer, { passive: true }));
  resetIdleTimer();

  // ---------- Doc token tu noi dung quet duoc ----------
  // Chap nhan: URL bat ky co ?reentry=<token>, hoac chuoi token thuan (hex 32-64 ky tu).
  function extractToken(text) {
    const s = String(text || '').trim();
    const m = /[?&]reentry=([0-9a-fA-F]{16,})/.exec(s);
    if (m) return m[1];
    if (/^[0-9a-fA-F]{32,64}$/.test(s)) return s;
    return null;
  }

  // ---------- Goi API ----------
  async function submitReentry(payload) {
    if (submitting) return;
    submitting = true;
    $('manualSubmit').disabled = true;
    try {
      const result = await ApiClient.post('/api/kiosk/reentry-scan', payload);
      if (result.status === 'CLOSED') return showError('Ngoài giờ làm việc', result.message, result.opensAt);
      renderDone(result);
    } catch (err) {
      showError('Không xếp lại được', err.message || 'Mã không hợp lệ hoặc đã được sử dụng.');
    } finally {
      submitting = false;
      $('manualSubmit').disabled = false;
    }
  }

  function showError(title, message, opensAt) {
    $('errorTitle').textContent = title;
    $('errorMessage').textContent = message || '';
    $('errorOpensAt').textContent = opensAt ? `Mở cửa lại: ${opensAt.weekday}, ${opensAt.date} lúc ${opensAt.time}` : '';
    showScreen('error');
    if (canVibrate()) { try { navigator.vibrate([60, 40, 60]); } catch (e) { /* bo qua */ } }
  }

  async function renderDone(result) {
    const ticket = result.ticket || {};
    const tracking = result.tracking || {};
    $('doneNumber').textContent = ticket.ticket_number || '—';
    $('doneCounter').textContent = result.counterName ? `Vui lòng đến ${result.counterName}` : '';
    $('doneWait').textContent = typeof tracking.aheadCount === 'number'
      ? (tracking.aheadCount === 0 ? 'Bạn là người tiếp theo — vui lòng ở gần quầy.'
        : `Phía trước còn ${tracking.aheadCount} người • Chờ khoảng ${tracking.estimatedWaitMinutes} phút (ước tính)`)
      : '';
    $('doneMessage').textContent = result.message || '';
    const trackUrl = `${window.location.origin}/theo-doi.html?t=${encodeURIComponent(ticket.id || '')}`;
    $('doneTrackLink').href = trackUrl;
    $('doneQr').innerHTML = '';
    showScreen('done');
    try {
      await QrLoader.load();
      // eslint-disable-next-line no-new
      new QRCode($('doneQr'), { text: trackUrl, width: 150, height: 150 });
    } catch (e) { /* khong co thu vien QR: van con lien ket */ }
  }

  // ---------- Cach 2: may quet ma USB (keyboard wedge) ----------
  const scannerInput = $('scannerInput');
  function handleScannerValue() {
    const raw = scannerInput.value.trim();
    scannerInput.value = '';
    if (!raw) return;
    const token = extractToken(raw);
    if (!token) return showToast('Mã vừa quét không phải mã quay lại của Trung tâm.', 'error');
    submitReentry({ token });
  }
  scannerInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleScannerValue(); } });
  // May quet thuong go rat nhanh roi Enter; neu may khong gui Enter thi sau 300ms khong go them cung xu ly.
  let scannerDebounce = null;
  scannerInput.addEventListener('input', () => {
    clearTimeout(scannerDebounce);
    scannerDebounce = setTimeout(() => { if (extractToken(scannerInput.value)) handleScannerValue(); }, 300);
  });
  // Giu focus o o nhan may quet khi nguoi dung khong dang go o nhap tay.
  function refocusScanner() {
    const a = document.activeElement;
    if (!a || a === document.body || a === scannerInput) scannerInput.focus({ preventScroll: true });
  }
  setInterval(refocusScanner, 2000);
  refocusScanner();

  // ---------- Cach 3: nhap tay ----------
  $('manualForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const ticketNumber = $('manualNumber').value.trim();
    const code = $('manualCode').value.trim();
    if (!ticketNumber || code.replace(/[^0-9a-fA-F]/g, '').length < 8) {
      return showToast('Vui lòng nhập Số thứ tự và đủ 8 ký tự Mã quay lại in trên phiếu.', 'error');
    }
    submitReentry({ ticketNumber, code });
  });

  // ---------- Cach 1: camera ----------
  function loadJsQr() {
    if (window.jsQR) return Promise.resolve();
    if (!jsqrPromise) {
      jsqrPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'vendor/jsQR.min.js';
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Khong tai duoc thu vien doc QR'));
        document.head.appendChild(s);
      });
    }
    return jsqrPromise;
  }

  async function startCamera() {
    const overlay = $('scanOverlay');
    const text = $('scanOverlayText');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      text.textContent = 'Thiết bị này không có camera hoặc trình duyệt không hỗ trợ. Hãy dùng máy quét hoặc nhập tay.';
      overlay.querySelector('button').classList.add('hidden');
      return;
    }
    try {
      text.textContent = 'Đang bật camera…';
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    } catch (err) {
      text.textContent = 'Không bật được camera (chưa cho phép hoặc đang được ứng dụng khác dùng). Hãy dùng máy quét hoặc nhập tay.';
      return;
    }
    const video = $('scanVideo');
    video.srcObject = stream;
    try { await video.play(); } catch (e) { /* autoplay bi chan: nguoi dung da bam nut nen thuong khong xay ra */ }
    overlay.classList.add('hidden');

    if ('BarcodeDetector' in window) {
      try { detector = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { detector = null; }
    }
    if (!detector) {
      try { await loadJsQr(); } catch (e) {
        $('scanHint').textContent = 'Trình duyệt này không đọc được QR qua camera. Hãy dùng máy quét hoặc nhập tay.';
        return;
      }
    }
    scanTimer = setInterval(scanFrame, 250);
  }
  window.startCamera = startCamera;

  async function scanFrame() {
    const video = $('scanVideo');
    if (!video.videoWidth || submitting) return;
    let value = null;
    try {
      if (detector) {
        const codes = await detector.detect(video);
        if (codes && codes.length) value = codes[0].rawValue;
      } else if (window.jsQR) {
        const canvas = $('scanCanvas');
        const w = Math.min(640, video.videoWidth);
        const h = Math.round(video.videoHeight * (w / video.videoWidth));
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, w, h);
        const img = ctx.getImageData(0, 0, w, h);
        const code = window.jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
        if (code && code.data) value = code.data;
      }
    } catch (e) { /* khung hinh loi: bo qua */ }
    if (!value) return;
    const token = extractToken(value);
    if (!token) { $('scanHint').textContent = 'Mã vừa quét không phải mã quay lại của Trung tâm. Hãy quét mã QR trên phiếu quay lại.'; return; }
    clearInterval(scanTimer); scanTimer = null;
    if (canVibrate()) { try { navigator.vibrate(40); } catch (e) { /* bo qua */ } }
    submitReentry({ token });
  }

  function stopCamera() {
    if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  }
  window.addEventListener('pagehide', stopCamera);

  window.backToScan = function backToScan() {
    $('scanOverlay').classList.remove('hidden');
    $('scanOverlayText').textContent = 'Camera chưa bật';
    showScreen('scan');
    refocusScanner();
  };

  // ---------- Vao trang bang lien ket tren QR (quet bang dien thoai) ----------
  const tokenFromUrl = extractToken(window.location.search);
  if (tokenFromUrl) {
    // Xoa token khoi thanh dia chi de bam "Tai lai" khong gui lai lan nua.
    try { window.history.replaceState({}, '', window.location.pathname); } catch (e) { /* bo qua */ }
    submitReentry({ token: tokenFromUrl });
  } else if (!/Mobi|Android/i.test(navigator.userAgent)) {
    // May Kiosk (khong phai dien thoai): thu bat camera ngay; bi chan thi con nut "Bat camera".
    startCamera();
  }
})();
