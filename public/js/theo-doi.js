// Trang cong dan tu theo doi ve (mo bang ma QR tren phieu STT), khong can ten/SDT/dang nhap.
// Doc ?t=<ticketId>, goi GET /api/kiosk/tickets/:id/status moi 8 giay.
const POLL_MS = 8000;

const STATUS_TEXT = {
  QUEUED: 'Đang chờ đến lượt',
  CALLING: 'ĐẾN LƯỢT BẠN! Mời đến quầy',
  PROCESSING: 'Đang được phục vụ tại quầy',
  SUPP_PENDING: 'Cần bổ sung hồ sơ — xem hướng dẫn của cán bộ',
  COMPLETED: 'Đã hoàn tất — cảm ơn bạn',
  CANCELLED: 'Số đã bị hủy (vắng mặt quá số lần cho phép). Vui lòng lấy số mới.',
  EXPIRED_EOD: 'Số đã hết hạn do kết thúc ngày làm việc. Vui lòng lấy số mới vào ngày làm việc kế tiếp.'
};

const ticketId = new URLSearchParams(window.location.search).get('t');

function setText(id, text) { document.getElementById(id).textContent = text || ''; }

// Trinh duyet chi cho rung sau khi nguoi dung da cham vao trang (neu khong se bao loi o console).
function canVibrate() {
  const active = navigator.userActivation ? navigator.userActivation.hasBeenActive : true;
  return !!(active && navigator.vibrate);
}
let lastStatus = null;
const baseTitle = document.title;

function render(info) {
  const card = document.getElementById('trackCard');
  card.classList.toggle('calling', info.status === 'CALLING');
  card.classList.toggle('supp', info.status === 'SUPP_PENDING');
  card.classList.toggle('bad', info.status === 'CANCELLED' || info.status === 'EXPIRED_EOD');

  setText('trackNumber', info.ticketNumber);
  setText('trackStatus', STATUS_TEXT[info.status] || info.status);
  setText('trackCounter', info.counterName && ['QUEUED', 'CALLING', 'PROCESSING'].includes(info.status) ? `Quầy phụ trách: ${info.counterName}` : '');
  setText('trackService', `Thủ tục: ${info.serviceName}`);
  // Co che 3-Strike (UC-50): cho cong dan biet da bi goi hut may lan de khong mat so.
  setText('trackRetry', info.retryCount > 0 && ['QUEUED', 'CALLING'].includes(info.status)
    ? `Bạn đã vắng mặt ${info.retryCount} lần khi được gọi — vắng mặt 3 lần, số sẽ bị hủy.` : '');

  if (info.status === 'QUEUED') {
    setText('trackWait', info.aheadCount === 0
      ? 'Bạn là người tiếp theo — vui lòng ở gần quầy.'
      : `Phía trước còn ${info.aheadCount} người • Chờ khoảng ${info.estimatedWaitMinutes} phút (ước tính)`);
  } else {
    setText('trackWait', '');
  }
  setText('trackUpdated', `Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN')}`);

  // Den luot: rung dien thoai + doi tieu de tab de nguoi dang xem trang khac/khoa man hinh biet.
  if (info.status === 'CALLING' && lastStatus !== 'CALLING') {
    if (canVibrate()) { try { navigator.vibrate([300, 150, 300, 150, 500]); } catch (e) { /* bo qua */ } }
  }
  document.title = info.status === 'CALLING' ? `ĐẾN LƯỢT ${info.ticketNumber} — ${baseTitle}` : baseTitle;
  lastStatus = info.status;

  renderSupplement(info);
  document.getElementById('endCard').hidden = !(info.status === 'CANCELLED' || info.status === 'EXPIRED_EOD');
  renderFeedback(info);
}

// ===== Dot 2 (10/2026): cho bo sung ho so (SUPP_PENDING) =====
// Ke ten giay to con thieu + noi lay phoi to khai; nut "Toi da bo sung xong" goi
// POST /api/kiosk/tickets/:id/reentry (dinh danh bang id ve, khong can token) -> ve quay lai hang
// doi o vi tri uu tien y het quet QR tai Kiosk (UC-09).
let reentering = false;
function renderSupplement(info) {
  const card = document.getElementById('suppCard');
  if (info.status !== 'SUPP_PENDING') { card.hidden = true; return; }
  if (!card.hidden) return; // dang hien, khong ve lai (giu thong bao loi neu co)
  const list = document.getElementById('suppMissingList');
  list.innerHTML = '';
  (info.missingDocs || []).forEach((d) => {
    const li = document.createElement('li'); li.textContent = d.name || d.code; list.appendChild(li);
  });
  if (!(info.missingDocs || []).length) {
    const li = document.createElement('li'); li.textContent = 'Theo hướng dẫn của cán bộ tại quầy.'; list.appendChild(li);
  }
  const loc = document.getElementById('suppLocation');
  const ft = info.formTemplate;
  if (ft && (ft.shelf_name || ft.form_name)) {
    loc.innerHTML = '';
    const b = document.createElement('b'); b.textContent = 'Vị trí lấy phôi tờ khai: ';
    loc.appendChild(b);
    loc.appendChild(document.createTextNode([ft.shelf_name, ft.tray_number, ft.desk_area].filter(Boolean).join(' → ')));
    if (ft.form_name) {
      const p = document.createElement('div'); p.className = 'mt-16';
      const b2 = document.createElement('b'); b2.textContent = 'Tờ khai: '; p.appendChild(b2); p.appendChild(document.createTextNode(ft.form_name));
      loc.appendChild(p);
    }
    if (info.hasFillGuide && info.serviceId) {
      const a = document.createElement('a'); a.className = 'btn btn-outline btn-block mt-16';
      a.href = `huong-dan-dien-mau.html?serviceId=${encodeURIComponent(info.serviceId)}`; a.textContent = 'Xem cách điền tờ khai này';
      loc.appendChild(a);
    }
    loc.hidden = false;
  } else {
    loc.hidden = true;
  }
  document.getElementById('suppError').hidden = true;
  card.hidden = false;
}

document.getElementById('suppReenterBtn').addEventListener('click', async () => {
  if (reentering) return;
  reentering = true;
  const btn = document.getElementById('suppReenterBtn');
  const errEl = document.getElementById('suppError');
  btn.disabled = true; btn.textContent = 'Đang xếp lại...';
  try {
    const result = await ApiClient.post(`/api/kiosk/tickets/${encodeURIComponent(ticketId)}/reentry`, {});
    if (result.status === 'CLOSED') {
      errEl.textContent = result.message || 'Ngoài giờ làm việc, chưa thể xếp lại hàng đợi.';
      errEl.hidden = false;
      return;
    }
    document.getElementById('suppCard').hidden = true;
    if (result.tracking) render(result.tracking); else refresh();
  } catch (err) {
    errEl.textContent = err.message; errEl.hidden = false;
  } finally {
    reentering = false;
    btn.disabled = false; btn.textContent = 'Tôi đã bổ sung xong — xếp lại vào hàng đợi';
  }
});

// ===== Nang cap 10/2026: danh gia muc do hai long sau khi hoan tat =====
const RATINGS = [
  { v: 1, icon: '😠', label: 'Rất tệ' }, { v: 2, icon: '🙁', label: 'Chưa tốt' }, { v: 3, icon: '😐', label: 'Bình thường' },
  { v: 4, icon: '🙂', label: 'Hài lòng' }, { v: 5, icon: '😍', label: 'Rất hài lòng' }
];
let selectedRating = null;
let feedbackSent = false;

function renderFeedback(info) {
  const card = document.getElementById('feedbackCard');
  const done = document.getElementById('feedbackDone');
  if (info.status !== 'COMPLETED' || !info.feedback) { card.hidden = true; return; }
  if (info.feedback.rated || feedbackSent) {
    card.hidden = true; done.hidden = false;
    if (timer) { clearInterval(timer); timer = null; } // ve da xong + da danh gia: thoi theo doi
    return;
  }
  if (!card.hidden) return; // dang hien form, khong ve lai (giu lua chon cua nguoi dung)
  card.hidden = false;
  const row = document.getElementById('ratingRow');
  row.innerHTML = '';
  RATINGS.forEach((r) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'rating-btn'; b.setAttribute('role', 'radio');
    b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', r.label);
    b.innerHTML = `<span aria-hidden="true">${r.icon}</span><small>${r.label}</small>`;
    b.addEventListener('click', () => {
      selectedRating = r.v;
      row.querySelectorAll('.rating-btn').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      document.getElementById('feedbackSubmit').disabled = false;
    });
    row.appendChild(b);
  });
}

document.getElementById('feedbackSubmit').addEventListener('click', async () => {
  if (!selectedRating) return;
  const btn = document.getElementById('feedbackSubmit');
  btn.disabled = true; btn.textContent = 'Đang gửi...';
  try {
    await ApiClient.post(`/api/kiosk/tickets/${encodeURIComponent(ticketId)}/feedback`, {
      rating: selectedRating, comment: document.getElementById('feedbackComment').value
    });
    feedbackSent = true;
    document.getElementById('feedbackCard').hidden = true;
    document.getElementById('feedbackDone').hidden = false;
  } catch (err) {
    btn.disabled = false; btn.textContent = 'Gửi đánh giá';
    alertInline(err.message);
  }
});

function alertInline(msg) {
  let el = document.getElementById('feedbackError');
  if (!el) {
    el = document.createElement('p'); el.id = 'feedbackError'; el.style.color = 'var(--color-danger)'; el.style.fontWeight = '600';
    document.getElementById('feedbackCard').appendChild(el);
  }
  el.textContent = msg;
}

// Loi tam thoi (mat mang, server thuc day) khong duoc dung theo doi ngay: chi bo cuoc sau 5 lan
// that bai lien tiep (VD ve khong ton tai).
let failures = 0;
async function refresh() {
  try {
    render(await ApiClient.get(`/api/kiosk/tickets/${encodeURIComponent(ticketId)}/status`));
    failures = 0;
  } catch (err) {
    failures += 1;
    setText('trackStatus', failures >= 5
      ? 'Không tìm thấy số thứ tự này. Vui lòng quét lại mã QR trên phiếu.'
      : 'Đang kết nối lại...');
    if (failures >= 5) clearInterval(timer);
  }
}

let timer = null;
if (!ticketId) {
  setText('trackStatus', 'Thiếu mã theo dõi. Vui lòng quét lại mã QR trên phiếu số thứ tự.');
} else {
  refresh();
  timer = setInterval(refresh, POLL_MS);
}
