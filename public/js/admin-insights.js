// =====================================================================================
// Nang cap 10/2026 - cac khoi moi cua Admin Control Tower:
//   Tab Giam sat: Thiet bi dau cuoi + Tinh trang he thong/dong bo Docker <-> Neon.
//   Tab Bao cao : Du bao luong cong dan (Erlang C), Thu tuc vuot SLA, Muc do hai long.
// Ham global (khong type=module) giong cac file admin-*.js khac; admin.js goi qua switchTab().
// =====================================================================================
function esc(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const DEVICE_LABEL = { KIOSK: '🖥️ Kiosk', LED_BOARD: '📺 Bảng LED', PA_SPEAKER: '🔊 Loa PA' };
const DEVICE_BADGE = { ONLINE: 'badge-green', DEGRADED: 'badge-yellow', OFFLINE: 'badge-red' };
const DEVICE_TEXT = { ONLINE: 'Trực tuyến', DEGRADED: 'Chưa bật loa', OFFLINE: 'Mất tín hiệu' };

function formatSilent(sec) {
  if (sec < 60) return `${sec} giây trước`;
  if (sec < 3600) return `${Math.round(sec / 60)} phút trước`;
  return `${Math.round(sec / 3600)} giờ trước`;
}

async function loadMonitorExtras() {
  try {
    const [devices, sys] = await Promise.all([
      ApiClient.get('/api/admin/devices'),
      ApiClient.get('/api/admin/system/status')
    ]);
    document.getElementById('deviceList').innerHTML = devices.length ? devices.map((d) => `
      <div class="status-line-item">
        <span>${DEVICE_LABEL[d.device_type] || esc(d.device_type)} <b>${esc(d.device_code)}</b></span>
        <span><span class="badge ${DEVICE_BADGE[d.status] || 'badge-gray'}">${DEVICE_TEXT[d.status] || esc(d.status)}</span>
          <span class="text-muted" style="font-size:0.8rem;">${formatSilent(Number(d.silent_seconds) || 0)}</span></span>
      </div>`).join('') : '<p class="text-muted">Chưa có thiết bị nào gửi tín hiệu.</p>';

    const db = sys.database;
    const bus = sys.realtimeBus;
    const kindText = { NEON: 'Neon (đám mây)', LOCAL: 'PostgreSQL trong Docker / máy tại chỗ', REMOTE: 'PostgreSQL từ xa' }[db.kind] || db.kind;
    const subs = (sys.replication.subscriptions || []).map((s) => `
      <div class="status-line-item"><span>↘️ Bản sao từ Neon: <b>${esc(s.subname)}</b></span>
        <span class="badge ${s.subenabled ? 'badge-green' : 'badge-gray'}">${s.subenabled ? 'đang đồng bộ' : 'tạm dừng'}</span></div>
      <div class="status-line-item"><span class="text-muted">Nhận dữ liệu gần nhất</span><span>${s.last_msg_receipt_time ? new Date(s.last_msg_receipt_time).toLocaleString('vi-VN') : '—'}</span></div>`).join('');
    const slots = (sys.replication.publisherSlots || []).map((s) => `
      <div class="status-line-item"><span>↗️ Đang cấp dữ liệu cho bản sao: <b>${esc(s.slot_name)}</b></span>
        <span class="badge ${s.active ? 'badge-green' : 'badge-yellow'}">${s.active ? 'kết nối' : 'chờ'} • trễ ${esc(s.lag || '0')}</span></div>`).join('');
    document.getElementById('systemStatus').innerHTML = `
      <div class="status-line-item"><span>Cơ sở dữ liệu</span><span><span class="badge ${db.ok ? 'badge-green' : 'badge-red'}">${db.ok ? 'OK' : 'LỖI'}</span> ${esc(kindText)}</span></div>
      <div class="status-line-item"><span>Độ trễ truy vấn</span><span>${db.latencyMs} ms</span></div>
      <div class="status-line-item"><span>Phiên bản / dung lượng</span><span>PostgreSQL ${esc((db.serverVersion || '').split(' ')[0])} • ${esc(db.size || '—')}</span></div>
      <div class="status-line-item"><span>Realtime giữa các bản chạy</span><span><span class="badge ${bus.connected ? 'badge-green' : bus.enabled ? 'badge-yellow' : 'badge-gray'}">${bus.connected ? 'đang kết nối' : bus.enabled ? 'đang nối lại' : 'tắt'}</span> nhận ${bus.received} • gửi ${bus.published}</span></div>
      <div class="status-line-item"><span>Bản chạy này</span><span>${esc(bus.instanceId)} • ${sys.websocketClients} màn hình</span></div>
      ${subs}${slots}
      ${!subs && !slots ? '<p class="text-muted" style="font-size:0.85rem;margin:8px 0 0;">Chưa bật sao chép realtime Docker ↔ Neon (xem docs/DOCKER-NEON-SYNC.md).</p>' : ''}`;
  } catch (err) { /* khong lam hong tab Giam sat neu khoi phu loi */ console.error(err); }
}

// ------------------------------- Bao cao -------------------------------
let lastSla = [];
let lastSatisfaction = null;

async function loadForecast() {
  const dateInput = document.getElementById('forecastDate');
  if (!dateInput.value) dateInput.value = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const weeks = document.getElementById('forecastWeeks').value;
  try {
    const f = await ApiClient.get(`/api/admin/analytics/forecast?date=${encodeURIComponent(dateInput.value)}&weeks=${encodeURIComponent(weeks)}`);
    const summary = document.getElementById('forecastSummary');
    if (!f.hours.length) {
      summary.textContent = `Chưa có dữ liệu ${f.weekday} trong ${f.weeks} tuần trước ${f.date} để dự báo.`;
      document.getElementById('forecastChart').innerHTML = '';
      document.querySelector('#forecastTable thead').innerHTML = '';
      document.querySelector('#forecastTable tbody').innerHTML = '';
      return;
    }
    summary.innerHTML = `${esc(f.weekday)} ${esc(f.date.split('-').reverse().join('/'))}: dự kiến <b>~${f.expectedTotal}</b> lượt công dân `
      + `(trung bình ${f.weeks} tuần cùng thứ). Giờ cao điểm <b>${f.peak.hour}h</b> (~${f.peak.expected} lượt) cần mở <b>${f.peak.totalCounters}</b> quầy `
      + `để thời gian chờ trung bình ≤ ${f.targetWaitMinutes} phút.`;
    const max = Math.max(1, ...f.hours.map((h) => h.expected));
    document.getElementById('forecastChart').innerHTML = f.hours.map((h) => `
      <div class="peak-bar-col" title="${h.hour}h: ~${h.expected} lượt, cần ${h.totalCounters} quầy">
        <div class="peak-bar-count">${h.expected}</div>
        <div class="peak-bar forecast-bar ${f.peak && h.hour === f.peak.hour ? 'peak' : ''}" style="height:${Math.max(4, (h.expected / max) * 110)}px;"></div>
        <div class="peak-bar-sub">${h.totalCounters}Q</div>
        <div class="peak-bar-label">${h.hour}h</div>
      </div>`).join('');
    const fields = f.fields.slice().sort((a, b) => a.name.localeCompare(b.name));
    document.querySelector('#forecastTable thead').innerHTML = `<tr><th>Giờ</th>${fields.map((x) => `<th>${esc(x.name)}<br><span style="text-transform:none;font-weight:400;">lượt • quầy</span></th>`).join('')}<th>Tổng quầy</th></tr>`;
    document.querySelector('#forecastTable tbody').innerHTML = f.hours.map((h) => `
      <tr><td><b>${h.hour}:00</b></td>${fields.map((x) => {
        const cell = h.byField.find((b) => b.fieldId === x.id);
        return `<td>${cell ? `${cell.expected} • <b>${cell.countersNeeded}</b>` : '—'}</td>`;
      }).join('')}<td><b>${h.totalCounters}</b></td></tr>`).join('');
  } catch (err) { showToast(err.message, 'error'); }
}

async function loadInsights() {
  loadForecast();
  try {
    const [sla, sat] = await Promise.all([
      ApiClient.get('/api/admin/analytics/sla-breaches?days=30'),
      ApiClient.get('/api/admin/analytics/satisfaction?days=30')
    ]);
    lastSla = sla;
    lastSatisfaction = sat;
    document.querySelector('#slaTable tbody').innerHTML = sla.map((r) => `
      <tr><td>${esc(r.serviceName)}<div class="text-muted" style="font-size:0.78rem;">${esc(r.fieldName)}</div></td>
        <td>${r.slaMinutes}p</td><td>${r.completed}</td>
        <td><span class="badge ${r.latePercent >= 30 ? 'badge-red' : r.latePercent >= 10 ? 'badge-yellow' : 'badge-green'}">${r.latePercent}%</span></td>
        <td>${r.avgHandlingMinutes ?? '-'} / ${r.p90HandlingMinutes ?? '-'}</td></tr>`).join('')
      || '<tr><td colspan="5" class="text-muted text-center">Chưa có dữ liệu</td></tr>';

    document.getElementById('satisfactionSummary').innerHTML = `
      <div class="kpi-mini"><div class="val">${sat.avgRating ?? '—'}</div><div class="lbl">Điểm TB / 5</div></div>
      <div class="kpi-mini"><div class="val">${sat.csatPercent ?? '—'}${sat.csatPercent !== null ? '%' : ''}</div><div class="lbl">Hài lòng (4–5 điểm)</div></div>
      <div class="kpi-mini"><div class="val">${sat.responses}</div><div class="lbl">Lượt đánh giá (${sat.responseRatePercent}%)</div></div>`;
    const maxDist = Math.max(1, ...Object.values(sat.distribution));
    document.getElementById('satisfactionDist').innerHTML = [5, 4, 3, 2, 1].map((k) => `
      <div class="dist-row"><span style="width:52px;">${k} ★</span>
        <div class="bar" style="width:${(sat.distribution[k] / maxDist) * 70}%;"></div><span>${sat.distribution[k]}</span></div>`).join('');
    document.querySelector('#satisfactionOfficer tbody').innerHTML = sat.byOfficer.map((o) => `
      <tr><td>${esc(o.fullName)}</td><td>${o.responses}</td><td><b>${o.avgRating}</b></td></tr>`).join('')
      || '<tr><td colspan="3" class="text-muted text-center">Chưa có dữ liệu</td></tr>';
    document.getElementById('satisfactionComments').innerHTML = sat.recentComments.map((c) => `
      <div class="comment-item"><b>${'★'.repeat(c.rating)}</b> <span class="text-muted">${esc(c.ticket_number)} • ${esc(c.counter_code || '')} • ${new Date(c.created_at).toLocaleString('vi-VN')}</span><br>${esc(c.comment)}</div>`).join('')
      || '<p class="text-muted">Chưa có góp ý.</p>';
  } catch (err) { showToast(err.message, 'error'); }
}

function downloadCsv(filename, rows) {
  // BOM UTF-8 de Excel mo dung tieng Viet.
  const csv = '﻿' + rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function exportSlaCsv() {
  downloadCsv('thu-tuc-vuot-sla.csv', [['Mã', 'Thủ tục', 'Lĩnh vực', 'SLA (phút)', 'Hoàn tất', 'Số trễ', 'Trễ (%)', 'TB (phút)', 'P90 (phút)'],
    ...lastSla.map((r) => [r.code, r.serviceName, r.fieldName, r.slaMinutes, r.completed, r.lateCount, r.latePercent, r.avgHandlingMinutes, r.p90HandlingMinutes])]);
}
function exportSatisfactionCsv() {
  if (!lastSatisfaction) return;
  const s = lastSatisfaction;
  downloadCsv('muc-do-hai-long.csv', [
    ['Chỉ số', 'Giá trị'], ['Số ngày', s.days], ['Lượt đánh giá', s.responses], ['Tỷ lệ phản hồi (%)', s.responseRatePercent],
    ['Điểm TB', s.avgRating], ['CSAT (%)', s.csatPercent], [], ['Cán bộ', 'Lượt', 'Điểm TB'],
    ...s.byOfficer.map((o) => [o.fullName, o.responses, o.avgRating]), [], ['Thủ tục', 'Lượt', 'Điểm TB'],
    ...s.byService.map((o) => [o.serviceName, o.responses, o.avgRating])
  ]);
}
