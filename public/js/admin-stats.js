// =============================== TAB: THONG KE THEO THOI GIAN ===============================
// 11/2026 - chi SUPER_ADMIN va MANAGER (nhom quyen REPORTS, xem src/middleware/auth.js).
// Chon khoang ngay + kieu gom (khung gio / ngay / tuan / thang) + linh vuc -> bang so lieu, bieu do
// cot (hoan tat / khac), the tong hop va nut Tai CSV. API: GET /api/admin/analytics/time-series.
let statsLast = null;
let statsFieldsLoaded = false;

function statsEsc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
// Ngay theo gio Viet Nam (khong phu thuoc mui gio may dang mo trang quan tri).
function statsTodayVN() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function statsShift(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Nut chon nhanh: dien khoang ngay + kieu gom hop ly roi tai luon.
function statsPreset(name) {
  const today = statsTodayVN();
  const [y, m] = today.split('-');
  const map = {
    today: [today, today, 'hour'],
    d7: [statsShift(today, -6), today, 'day'],
    d30: [statsShift(today, -29), today, 'day'],
    month: [`${y}-${m}-01`, today, 'day'],
    quarter: [statsShift(today, -89), today, 'week'],
    year: [`${y}-01-01`, today, 'month']
  };
  const p = map[name] || map.d30;
  document.getElementById('statsFrom').value = p[0];
  document.getElementById('statsTo').value = p[1];
  document.getElementById('statsGroup').value = p[2];
  document.querySelectorAll('.stats-preset').forEach((b) => b.classList.toggle('active', b.dataset.preset === name));
  loadStats();
}

async function loadStatsTab() {
  if (!statsFieldsLoaded) {
    try {
      const fields = await ApiClient.get('/api/admin/fields');
      document.getElementById('statsField').innerHTML = '<option value="">Tất cả lĩnh vực</option>'
        + fields.map((f) => `<option value="${f.id}">${statsEsc(f.name)}</option>`).join('');
      statsFieldsLoaded = true;
    } catch (e) { /* van xem duoc "Tat ca linh vuc" */ }
  }
  if (!document.getElementById('statsFrom').value) return statsPreset('d30');
  loadStats();
}

async function loadStats() {
  const from = document.getElementById('statsFrom').value;
  const to = document.getElementById('statsTo').value;
  const group = document.getElementById('statsGroup').value;
  const fieldId = document.getElementById('statsField').value;
  if (!from || !to) return showToast('Vui lòng chọn Từ ngày và Đến ngày.', 'error');
  const qs = new URLSearchParams({ from, to, group });
  if (fieldId) qs.set('fieldId', fieldId);
  document.getElementById('statsTableBody').innerHTML = '<tr><td colspan="10" class="text-muted text-center">Đang tải...</td></tr>';
  try {
    statsLast = await ApiClient.get(`/api/admin/analytics/time-series?${qs}`);
    renderStats(statsLast);
  } catch (err) {
    document.getElementById('statsTableBody').innerHTML = `<tr><td colspan="10" class="text-muted text-center">${statsEsc(err.message)}</td></tr>`;
    showToast(err.message, 'error');
  }
}

const statsFmt = (v, suffix = '') => (v === null || v === undefined ? '–' : `${Number(v).toLocaleString('vi-VN')}${suffix}`);

function renderStats(data) {
  const s = data.summary;
  const tiles = [
    ['Tổng số vé', statsFmt(s.total)],
    ['Hoàn tất', `${statsFmt(s.completed)} <small>(${statsFmt(s.completionRate, '%')})</small>`],
    ['Yêu cầu bổ sung', statsFmt(s.suppRequested)],
    ['Huỷ / vắng / hết hạn', statsFmt(s.cancelled)],
    ['Chờ TB (AWT)', statsFmt(s.awtMinutes, ' phút')],
    ['Xử lý TB (AHT)', statsFmt(s.ahtMinutes, ' phút')],
    ['Đúng SLA', statsFmt(s.onTimeRate, '%')],
    ['Hài lòng TB', s.avgRating === null ? '–' : `${s.avgRating}★ <small>(${s.ratingCount} lượt)</small>`]
  ];
  document.getElementById('statsSummary').innerHTML = tiles.map(([l, v]) => `<div class="kpi-mini"><div class="val">${v}</div><div class="lbl">${l}</div></div>`).join('');

  // Bieu do cot chong: phan dam = hoan tat, phan nhat = con lai. Nhieu ky (VD 90 ngay) -> cot hep, cuon ngang.
  const max = Math.max(1, ...data.rows.map((r) => r.total));
  const shortLabel = (r) => (data.group === 'day' ? r.label.slice(0, 5) : data.group === 'hour' ? `${r.key}h` : data.group === 'month' ? r.label.replace('Tháng ', 'T') : r.label.replace('Tuần ', '').split('–')[0]);
  document.getElementById('statsChart').innerHTML = data.rows.map((r) => {
    const h = Math.round((r.total / max) * 150);
    const hc = r.total ? Math.round((r.completed / r.total) * h) : 0;
    return `<div class="stats-col" title="${statsEsc(r.label)}: ${r.total} vé, ${r.completed} hoàn tất">
      <div class="peak-bar-count">${r.total || ''}</div>
      <div class="stats-bar" style="height:${Math.max(r.total ? 4 : 1, h)}px;"><div class="stats-bar-done" style="height:${hc}px;"></div></div>
      <div class="peak-bar-label">${statsEsc(shortLabel(r))}</div>
    </div>`;
  }).join('');

  document.getElementById('statsTableBody').innerHTML = data.rows.map((r) => `
    <tr class="${r.total ? '' : 'stats-empty'}">
      <td>${statsEsc(r.label)}</td><td><b>${r.total}</b></td><td>${r.completed}</td><td>${statsFmt(r.completionRate, '%')}</td>
      <td>${r.suppRequested}</td><td>${r.cancelled}</td><td>${r.priority}</td>
      <td>${statsFmt(r.awtMinutes)}</td><td>${statsFmt(r.ahtMinutes)}</td><td>${statsFmt(r.onTimeRate, '%')}</td>
    </tr>`).join('');
  document.getElementById('statsTableFoot').innerHTML = `
    <tr><td>Tổng cộng</td><td>${s.total}</td><td>${s.completed}</td><td>${statsFmt(s.completionRate, '%')}</td>
      <td>${s.suppRequested}</td><td>${s.cancelled}</td><td>${s.priority}</td>
      <td>${statsFmt(s.awtMinutes)}</td><td>${statsFmt(s.ahtMinutes)}</td><td>${statsFmt(s.onTimeRate, '%')}</td></tr>`;
  const groupName = { hour: 'khung giờ', day: 'ngày', week: 'tuần', month: 'tháng' }[data.group];
  document.getElementById('statsCaption').textContent = `Từ ${data.from.split('-').reverse().join('/')} đến ${data.to.split('-').reverse().join('/')} · gom theo ${groupName} · giờ Việt Nam`;
}

function exportStatsCsv() {
  if (!statsLast) return showToast('Chưa có dữ liệu để tải.', 'error');
  const head = ['Kỳ', 'Tổng vé', 'Hoàn tất', 'Tỷ lệ hoàn tất (%)', 'Yêu cầu bổ sung', 'Huỷ/vắng/hết hạn', 'Ưu tiên', 'Chờ TB (phút)', 'Xử lý TB (phút)', 'Đúng SLA (%)', 'Hài lòng TB', 'Lượt đánh giá'];
  const line = (label, r) => [label, r.total, r.completed, r.completionRate, r.suppRequested, r.cancelled, r.priority, r.awtMinutes, r.ahtMinutes, r.onTimeRate, r.avgRating, r.ratingCount];
  downloadCsv(`thong-ke-${statsLast.group}-${statsLast.from}_${statsLast.to}.csv`,
    [head, ...statsLast.rows.map((r) => line(r.label, r)), line('Tổng cộng', statsLast.summary)]);
}
