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

function render(info) {
  const card = document.getElementById('trackCard');
  card.classList.toggle('calling', info.status === 'CALLING');
  card.classList.toggle('bad', info.status === 'CANCELLED' || info.status === 'EXPIRED_EOD');

  setText('trackNumber', info.ticketNumber);
  setText('trackStatus', STATUS_TEXT[info.status] || info.status);
  setText('trackCounter', info.counterName && ['QUEUED', 'CALLING', 'PROCESSING'].includes(info.status) ? `Quầy phụ trách: ${info.counterName}` : '');
  setText('trackService', `Thủ tục: ${info.serviceName}`);

  if (info.status === 'QUEUED') {
    setText('trackWait', info.aheadCount === 0
      ? 'Bạn là người tiếp theo — vui lòng ở gần quầy.'
      : `Phía trước còn ${info.aheadCount} người • Chờ khoảng ${info.estimatedWaitMinutes} phút (ước tính)`);
  } else {
    setText('trackWait', '');
  }
  setText('trackUpdated', `Cập nhật lúc ${new Date().toLocaleTimeString('vi-VN')}`);
  renderFeedback(info);
}

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
