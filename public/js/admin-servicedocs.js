// =============================== TAB: THU TUC & GIAY TO ===============================
// Tach rieng khoi admin.js (xem ghi chu trong admin-monitor.js). Tab danh cho SUPER_ADMIN/
// MANAGER/SUPERVISOR (quyen SERVICE_DOCS):
//   - Khung tren: danh muc thu tuc - them moi, sua thong tin, an/hien tren Kiosk.
//   - Khung duoi: cai giay to tung thu tuc (bo soan dung chung js/serviceDocsEditor.js).
let serviceDocsEditorInstance = null;
let serviceCatalog = [];
let serviceFields = [];
let editingServiceId = null;

function svcEsc(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function svcFeeText(s) {
  if (s.fee_label) return s.fee_label;
  return Number(s.fee_amount) > 0 ? `${Number(s.fee_amount).toLocaleString('vi-VN')} đ` : 'Miễn phí';
}

function loadServiceDocsTab() {
  loadServiceCatalog();
  if (!serviceDocsEditorInstance) {
    serviceDocsEditorInstance = ServiceDocsEditor.mount(document.getElementById('serviceDocsEditor'), {
      listUrl: '/api/admin/services',
      saveUrl: (id) => `/api/admin/services/${id}/required-docs`
    });
  } else if (!serviceDocsEditorInstance.isDirty()) {
    serviceDocsEditorInstance.reload();
  }
}

async function loadServiceCatalog() {
  const box = document.getElementById('serviceCatalogList');
  try {
    [serviceCatalog, serviceFields] = await Promise.all([
      ApiClient.get('/api/admin/services/catalog'),
      serviceFields.length ? Promise.resolve(serviceFields) : ApiClient.get('/api/admin/fields')
    ]);
  } catch (err) {
    box.innerHTML = `<div class="empty-state">${svcEsc(err.message)}</div>`;
    return;
  }
  if (serviceCatalog.length === 0) { box.innerHTML = '<div class="empty-state">Chưa có thủ tục nào.</div>'; return; }
  box.innerHTML = serviceCatalog.map((s) => {
    const docs = s.required_docs || [];
    const mandatory = docs.filter((d) => d.mandatory).length;
    const hidden = Number(s.is_active) === 0;
    return `
      <div class="counter-row svc-row ${hidden ? 'svc-hidden' : ''}">
        <div class="svc-info">
          <div><b>${svcEsc(s.name)}</b> ${hidden ? '<span class="badge badge-gray">Đang ẩn</span>' : '<span class="badge badge-green">Đang hiện</span>'}</div>
          <div class="text-muted svc-meta">${svcEsc(s.field_name)} (số ${svcEsc(s.ticket_prefix)}) • ${svcEsc(svcFeeText(s))} • ~${Number(s.sla_minutes)} phút • ${docs.length} giấy tờ (${mandatory} bắt buộc) • mã ${svcEsc(s.code)}</div>
        </div>
        <div class="flex gap-8 svc-actions">
          <button class="btn btn-outline action-chip" ${actionAttr('openServiceDocsFor', s.id)}>Giấy tờ</button>
          <button class="btn btn-outline action-chip" ${actionAttr('openServiceForm', s.id)}>Sửa</button>
          <button class="btn ${hidden ? 'btn-success' : 'btn-warning'} action-chip" ${actionAttr('toggleServiceActive', s.id, hidden)}>${hidden ? 'Hiện' : 'Ẩn'}</button>
        </div>
      </div>`;
  }).join('');
}

function openServiceForm(serviceId) {
  editingServiceId = serviceId || null;
  const s = editingServiceId ? serviceCatalog.find((x) => x.id === editingServiceId) : null;
  document.getElementById('serviceFormTitle').textContent = s ? `Sửa thủ tục: ${s.name}` : 'Thêm thủ tục mới';
  document.getElementById('svcField').innerHTML = serviceFields
    .map((f) => `<option value="${f.id}">${svcEsc(f.name)} (số ${svcEsc(f.ticket_prefix)})</option>`).join('');
  document.getElementById('svcField').value = s ? String(s.field_id) : String((serviceFields[0] || {}).id || '');
  document.getElementById('svcName').value = s ? s.name : '';
  document.getElementById('svcAlias').value = s ? (s.short_alias || '') : '';
  document.getElementById('svcSla').value = s ? s.sla_minutes : 20;
  document.getElementById('svcFee').value = s ? Number(s.fee_amount) : 0;
  document.getElementById('svcFeeLabel').value = s ? (s.fee_label || '') : '';
  document.getElementById('svcFeeNote').value = s ? (s.fee_note || '') : '';
  document.getElementById('svcCode').value = '';
  const feeLocked = !!(s && s.fee_managed_by_file);
  ['svcFee', 'svcFeeLabel', 'svcFeeNote'].forEach((id) => { document.getElementById(id).disabled = feeLocked; });
  document.getElementById('svcFeeLockedNote').classList.toggle('hidden', !feeLocked);
  document.getElementById('svcCodeWrap').classList.toggle('hidden', !!s);
  document.getElementById('svcActiveWrap').classList.toggle('hidden', !!s);
  document.getElementById('svcActive').checked = false;
  document.getElementById('serviceFormModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('svcName').focus(), 50);
}

function closeServiceForm() { document.getElementById('serviceFormModal').classList.add('hidden'); }

async function submitServiceForm() {
  const btn = document.getElementById('svcSubmitBtn');
  const s = editingServiceId ? serviceCatalog.find((x) => x.id === editingServiceId) : null;
  const body = {
    fieldId: Number(document.getElementById('svcField').value),
    name: document.getElementById('svcName').value,
    shortAlias: document.getElementById('svcAlias').value,
    slaMinutes: Number(document.getElementById('svcSla').value)
  };
  if (!body.name.trim()) return showToast('Vui lòng nhập tên thủ tục.', 'error');
  if (!(s && s.fee_managed_by_file)) {
    body.feeAmount = Number(document.getElementById('svcFee').value || 0);
    body.feeLabel = document.getElementById('svcFeeLabel').value;
    body.feeNote = document.getElementById('svcFeeNote').value;
  }
  if (!s) {
    const code = document.getElementById('svcCode').value.trim();
    if (code) body.code = code;
    body.isActive = document.getElementById('svcActive').checked;
  }
  btn.disabled = true;
  try {
    const saved = s
      ? await ApiClient.put(`/api/admin/services/${s.id}`, body)
      : await ApiClient.post('/api/admin/services', body);
    closeServiceForm();
    showToast(s ? `Đã cập nhật "${saved.name}".` : `Đã thêm thủ tục "${saved.name}". Hãy cài giấy tờ cho thủ tục này.`, 'success');
    await loadServiceCatalog();
    if (!s) openServiceDocsFor(saved.id);
    else if (serviceDocsEditorInstance && !serviceDocsEditorInstance.isDirty()) serviceDocsEditorInstance.reload();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function toggleServiceActive(serviceId, makeActive) {
  const s = serviceCatalog.find((x) => x.id === serviceId);
  if (!s) return;
  if (makeActive && (s.required_docs || []).length === 0
    && !(await ConfirmDialog.confirm(`"${s.name}" chưa có giấy tờ nào. Vẫn hiện trên Kiosk?`, { okLabel: 'Vẫn hiện' }))) return;
  if (!makeActive && !(await ConfirmDialog.confirm(`Ẩn "${s.name}"? Kiosk sẽ ngừng cấp số cho thủ tục này (vé đã lấy vẫn được phục vụ bình thường).`, { okLabel: 'Ẩn thủ tục', danger: true }))) return;
  try {
    await ApiClient.post(`/api/admin/services/${serviceId}/active`, { active: makeActive });
    showToast(makeActive ? `Đã hiện "${s.name}" trên Kiosk.` : `Đã ẩn "${s.name}".`, 'success');
    loadServiceCatalog();
    if (serviceDocsEditorInstance && !serviceDocsEditorInstance.isDirty()) serviceDocsEditorInstance.reload();
  } catch (err) { showToast(err.message, 'error'); }
}

async function openServiceDocsFor(serviceId) {
  if (!serviceDocsEditorInstance) loadServiceDocsTab();
  const ok = await serviceDocsEditorInstance.selectById(serviceId);
  if (ok) document.getElementById('serviceDocsCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function onServiceDocsUpdated(serviceId, updatedAt) {
  if (serviceDocsEditorInstance) serviceDocsEditorInstance.onRemoteUpdate(serviceId, updatedAt);
  const tab = document.querySelector('.tab-btn.active');
  if (tab && tab.dataset.tab === 'docs') loadServiceCatalog();
}
