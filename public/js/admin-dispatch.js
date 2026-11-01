// =============================== TAB: DISPATCH ===============================
// Tach rieng khoi admin.js (xem ghi chu trong admin-monitor.js). loadMonitor() duoc goi tu
// changeCounterStatus() ben duoi - dinh nghia trong admin-monitor.js, phai nap TRUOC file nay
// (xem thu tu <script> trong admin.html).
let dispatchFieldsCache = [];

let dispatchOfficersCache = [];

const TICKET_STATUS_LABELS = {
  QUEUED: 'Đang chờ', CALLING: 'Đang gọi', PROCESSING: 'Đang xử lý',
  SUPP_PENDING: 'Chờ bổ sung', CANCELLED: 'Đã hủy'
};

async function loadDispatch() {
  try {
    // /api/kiosk/services tra ve TAT CA thu tuc dang hoat dong trong he thong (khong gioi han
    // so luong) - dropdown VIP Injection ben duoi vi vay luon liet ke day du tat ca thu tuc.
    const [counters, fields, services, reasons, officers, actionableTickets] = await Promise.all([
      ApiClient.get('/api/admin/counters'),
      ApiClient.get('/api/admin/fields'),
      ApiClient.get('/api/kiosk/services'),
      ApiClient.get('/api/admin/priority-reasons'),
      ApiClient.get('/api/admin/officers'),
      ApiClient.get('/api/admin/tickets/actionable')
    ]);
    dispatchFieldsCache = fields;
    dispatchOfficersCache = officers;

    renderDispatchCounters(counters, fields, officers);
    document.getElementById('newCounterField').innerHTML = fields.map((f) => `<option value="${f.id}">${f.name}</option>`).join('');

    const counterOptions = counters.map((c) => `<option value="${c.id}">${c.code} - ${c.name}</option>`).join('');
    document.getElementById('rebalFrom').innerHTML = counterOptions;
    document.getElementById('rebalTo').innerHTML = counterOptions;
    // Mac dinh "Sang quay" khac "Tu quay" (truoc day ca 2 cung la QUAY-01).
    if (counters.length > 1) document.getElementById('rebalTo').selectedIndex = 1;
    document.getElementById('vipCounter').innerHTML = '<option value="">Tự động (Least Queue Depth)</option>' + counterOptions;

    document.getElementById('vipService').innerHTML = services.map((s) => `<option value="${s.id}">${s.field_name} — ${s.name}</option>`).join('');
    document.getElementById('vipReason').innerHTML = reasons.map((r) => `<option value="${r.code}">${r.label}</option>`).join('');

    document.getElementById('skipTicketSelect').innerHTML = '<option value="">-- Chọn vé --</option>' + actionableTickets.map((t) => {
      const label = `${t.ticket_number} — ${t.counter_code || 'Chưa gán quầy'} (${TICKET_STATUS_LABELS[t.status] || t.status})`;
      return `<option value="${t.id}">${label}</option>`;
    }).join('');
  } catch (err) { showToast(err.message, 'error'); }
}

function counterRowHtml(c, fields, officers) {
  return `
    <div class="counter-row" id="counter-row-${c.id}">
      <div class="counter-row-top">
        <div>
          <b>${c.code} - ${c.name}</b>
          <span class="badge ${c.status === 'OPEN' ? 'badge-green' : c.status === 'PAUSED' ? 'badge-yellow' : 'badge-gray'}">${c.status}</span>
        </div>
        <div class="flex gap-8">
          <button class="btn btn-success action-chip" ${actionAttr('changeCounterStatus', c.id, 'OPEN')}>Mở</button>
          <button class="btn btn-warning action-chip" ${actionAttr('changeCounterStatus', c.id, 'PAUSED')}>Tạm dừng</button>
          <button class="btn btn-danger action-chip" ${actionAttr('changeCounterStatus', c.id, 'CLOSED')}>Đóng</button>
        </div>
      </div>
      <div class="counter-row-bottom">
        <select title="Lĩnh vực chuyên trách" ${actionAttr('changeCounterField', c.id, '$value')}>
          ${fields.map((f) => `<option value="${f.id}" ${Number(f.id) === Number(c.field_id) ? 'selected' : ''}>${f.name}</option>`).join('')}
        </select>
        <div class="flex gap-8">
          <button class="btn btn-outline action-chip" ${actionAttr('editCounter', c.id, c.code, c.name)}>Sửa</button>
          <button class="btn btn-danger action-chip" ${actionAttr('deleteCounter', c.id)}>Xóa</button>
        </div>
      </div>
      <div class="counter-row-bottom">
        <select ${actionAttr('changeCounterOfficer', c.id, '$value')}>
          <option value="">-- Chưa gán cán bộ --</option>
          ${officers.map((o) => `<option value="${o.id}" ${String(o.id) === String(c.officer_id) ? 'selected' : ''}>${o.full_name} (${o.username})${o.is_active ? '' : ' — đã khóa'}</option>`).join('')}
        </select>
        <span class="text-muted" style="font-size:0.85rem;">${c.officer_name ? `Đang phụ trách: ${c.officer_name}` : 'Chưa gán tài khoản Officer'}</span>
      </div>
    </div>`;
}

function renderDispatchCounters(counters, fields, officers) {
  document.getElementById('dispatchCounterList').innerHTML = counters.map((c) => counterRowHtml(c, fields, officers)).join('');
}

function editCounter(counterId, code, name) {
  document.getElementById(`counter-row-${counterId}`).innerHTML = `
    <div class="counter-row-top">
      <input id="editCode-${counterId}" value="${code}" style="max-width:130px;" placeholder="Mã quầy" />
      <input id="editName-${counterId}" value="${name}" style="max-width:200px;flex:1;" placeholder="Tên quầy" />
    </div>
    <div class="counter-row-bottom" style="justify-content:flex-end;">
      <button class="btn btn-primary action-chip" ${actionAttr('saveCounterEdit', counterId)}>Lưu</button>
      <button class="btn btn-outline action-chip" ${actionAttr('loadDispatch')}>Hủy</button>
    </div>`;
}

async function saveCounterEdit(counterId) {
  const code = document.getElementById(`editCode-${counterId}`).value.trim();
  const name = document.getElementById(`editName-${counterId}`).value.trim();
  if (!code || !name) return showToast('Vui lòng nhập đủ mã và tên quầy.', 'error');
  try { await ApiClient.put(`/api/admin/counters/${counterId}`, { code, name }); showToast('Đã cập nhật quầy.', 'success'); loadDispatch(); }
  catch (err) { showToast(err.message, 'error'); }
}

async function deleteCounter(counterId) {
  const ok = await ConfirmDialog.confirm('Xóa quầy này? Nếu còn vé đang chờ, hệ thống sẽ tự động chuyển các vé đó sang quầy khác đang mở cùng lĩnh vực (theo quầy đang ít tải nhất).', { danger: true, okLabel: 'Xóa quầy' });
  if (!ok) return;
  const reason = (await ConfirmDialog.prompt('Lý do xóa quầy (ghi Audit Log):', '')) || '';
  try {
    const result = await ApiClient.delete(`/api/admin/counters/${counterId}`, { reason });
    showToast(result.movedCount > 0 ? `Đã xóa quầy và chuyển ${result.movedCount} vé sang quầy khác.` : 'Đã xóa quầy.', 'success');
    loadDispatch();
  } catch (err) { showToast(err.message, 'error'); }
}

function toggleNewCounterBox(show) {
  const box = document.getElementById('newCounterBox');
  const shouldShow = show !== undefined ? show : box.classList.contains('hidden');
  box.classList.toggle('hidden', !shouldShow);
  if (shouldShow) {
    document.getElementById('newCounterCode').value = '';
    document.getElementById('newCounterName').value = '';
  }
}

async function submitCreateCounter() {
  const code = document.getElementById('newCounterCode').value.trim();
  const name = document.getElementById('newCounterName').value.trim();
  const fieldId = document.getElementById('newCounterField').value;
  if (!code || !name || !fieldId) return showToast('Vui lòng nhập đủ mã quầy, tên quầy và lĩnh vực.', 'error');
  try {
    await ApiClient.post('/api/admin/counters', { code, name, fieldId });
    showToast('Đã thêm quầy mới.', 'success');
    toggleNewCounterBox(false);
    loadDispatch();
  } catch (err) { showToast(err.message, 'error'); }
}

async function changeCounterStatus(counterId, status) {
  const reason = await ConfirmDialog.prompt(`Nhập lý do chuyển quầy sang trạng thái ${status}:`, '');
  if (reason === null) return;
  try {
    const result = await ApiClient.post(`/api/admin/counters/${counterId}/status`, { status, reason });
    showToast(result.movedCount > 0 ? `Đã cập nhật trạng thái quầy và chuyển ${result.movedCount} vé sang quầy khác.` : 'Đã cập nhật trạng thái quầy.', 'success');
    loadDispatch();
    loadMonitor();
  } catch (err) { showToast(err.message, 'error'); }
}
async function changeCounterField(counterId, fieldId) {
  if (!fieldId) return;
  const field = dispatchFieldsCache.find((f) => String(f.id) === String(fieldId));
  const ok = await ConfirmDialog.confirm(`Đổi lĩnh vực chuyên trách của quầy sang "${field ? field.name : fieldId}"?`, { okLabel: 'Đổi lĩnh vực' });
  if (!ok) return loadDispatch(); // tra dropdown ve gia tri cu
  try {
    await ApiClient.post(`/api/admin/counters/${counterId}/field`, { fieldId: Number(fieldId), reason: 'Doi linh vuc tu Admin Dashboard' });
    showToast(`Đã đổi lĩnh vực sang ${field ? field.name : 'lĩnh vực mới'}.`, 'success');
  } catch (err) { showToast(err.message, 'error'); }
  loadDispatch();
}
async function changeCounterOfficer(counterId, officerId) {
  const officer = dispatchOfficersCache.find((o) => String(o.id) === String(officerId));
  try {
    await ApiClient.post(`/api/admin/counters/${counterId}/officer`, { officerId: officerId || null, reason: 'Gan/Go can bo tu Admin Dashboard' });
    showToast(officerId ? `Đã gán ${officer ? officer.full_name : 'cán bộ'} phụ trách quầy.` : 'Đã gỡ cán bộ khỏi quầy.', 'success');
  } catch (err) { showToast(err.message, 'error'); }
  loadDispatch();
}
async function submitRebalance() {
  const fromCounterId = document.getElementById('rebalFrom').value;
  const toCounterId = document.getElementById('rebalTo').value;
  const percent = document.getElementById('rebalPercent').value;
  if (fromCounterId === toCounterId) return showToast('Quầy chuyển đi và quầy nhận phải khác nhau.', 'error');
  try {
    const result = await ApiClient.post('/api/admin/rebalance', { fromCounterId, toCounterId, percent });
    showToast(`Đã san tải ${result.movedCount} vé.`, 'success');
  } catch (err) { showToast(err.message, 'error'); }
}
async function submitPriorityInject() {
  try {
    const result = await ApiClient.post('/api/admin/priority-inject', {
      serviceId: document.getElementById('vipService').value,
      counterId: document.getElementById('vipCounter').value || null,
      priorityReasonCode: document.getElementById('vipReason').value
    });
    showToast(`Đã cấp vé ưu tiên ${result.ticket.ticket_number}.`, 'success');
    loadDispatch();
  } catch (err) { showToast(err.message, 'error'); }
}
async function submitEmergencySkip() {
  const ticketId = document.getElementById('skipTicketSelect').value;
  const reason = document.getElementById('skipReason').value.trim();
  if (!ticketId || !reason) return showToast('Vui lòng chọn vé và nhập lý do.', 'error');
  try {
    await ApiClient.post(`/api/admin/tickets/${ticketId}/emergency-skip`, { reason });
    showToast('Đã đẩy hồ sơ ra khỏi băng chuyền.', 'success');
    loadDispatch();
  } catch (err) { showToast(err.message, 'error'); }
}
async function submitRestore() {
  const ticketId = document.getElementById('skipTicketSelect').value;
  const reason = document.getElementById('skipReason').value.trim();
  if (!ticketId) return showToast('Vui lòng chọn vé.', 'error');
  try {
    await ApiClient.post(`/api/admin/tickets/${ticketId}/restore`, { reason });
    showToast('Đã khôi phục vé.', 'success');
    loadDispatch();
  } catch (err) { showToast(err.message, 'error'); }
}
