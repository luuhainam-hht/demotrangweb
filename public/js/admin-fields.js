// =============================== TAB: LINH VUC (nang cap 11/2026) ===============================
// Danh sach doc cac linh vuc chuyen mon: them moi, sua ten / chu cai dau so, xoa (chi khi chua co
// quay/thu tuc nao dung). Sau khi them, lĩnh vực moi xuat hien ngay o dropdown tab Dieu phoi
// (doi linh vuc quay, them quay moi) va tab Thu tuc (them thu tuc).
let fieldsCache = [];

function escField(v) {
  return String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadFieldsTab() {
  try {
    fieldsCache = await ApiClient.get('/api/admin/fields/manage');
    renderFieldsTab();
  } catch (err) { showToast(err.message, 'error'); }
}

function fieldItemHtml(f) {
  const prefix = String(f.ticket_prefix || '').trim();
  const inUse = (f.counter_count || 0) > 0 || (f.service_count || 0) > 0;
  return `
    <li class="field-item" id="field-item-${f.id}">
      <div class="field-prefix" title="Chữ cái đầu số thứ tự">${escField(prefix)}</div>
      <div class="field-body">
        <div class="field-name">${escField(f.name)}</div>
        <div class="field-meta">
          <span class="field-code">${escField(f.code)}</span>
          <span>Số thứ tự: <b>${escField(prefix)}-101</b>…</span>
          <span>${f.counter_count || 0} quầy</span>
          <span>${f.active_service_count || 0}/${f.service_count || 0} thủ tục đang hiện</span>
        </div>
      </div>
      <div class="field-actions">
        <button class="btn btn-outline action-chip" ${actionAttr('editFieldItem', f.id)}>Sửa</button>
        <button class="btn btn-danger action-chip" ${inUse ? 'disabled title="Đang có quầy hoặc thủ tục thuộc lĩnh vực này"' : ''} ${actionAttr('deleteFieldItem', f.id)}>Xóa</button>
      </div>
    </li>`;
}

function renderFieldsTab() {
  const list = document.getElementById('fieldList');
  document.getElementById('fieldCount').textContent = `${fieldsCache.length} lĩnh vực`;
  list.innerHTML = fieldsCache.length
    ? fieldsCache.map(fieldItemHtml).join('')
    : '<li class="text-muted" style="padding:16px;">Chưa có lĩnh vực nào.</li>';
}

function toggleNewFieldBox(show) {
  const box = document.getElementById('newFieldBox');
  const shouldShow = show !== undefined ? show : box.classList.contains('hidden');
  box.classList.toggle('hidden', !shouldShow);
  if (shouldShow) {
    ['newFieldName', 'newFieldCode', 'newFieldPrefix'].forEach((id) => { document.getElementById(id).value = ''; });
    const used = new Set(fieldsCache.map((f) => String(f.ticket_prefix).trim().toUpperCase()));
    const next = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].find((l) => !used.has(l)) || '';
    document.getElementById('newFieldPrefix').placeholder = next ? `Tự động: ${next}` : 'A-Z';
    document.getElementById('newFieldName').focus();
  }
}

// Goi y ma linh vuc tu ten (bo dau, viet hoa, lay tu dau) khi nguoi dung chua tu nhap.
function suggestFieldCode() {
  const codeInput = document.getElementById('newFieldCode');
  if (codeInput.dataset.touched === '1') return;
  const name = document.getElementById('newFieldName').value;
  const first = name.split(/[-–]/)[0] || '';
  codeInput.value = first.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
}

async function submitCreateField() {
  const name = document.getElementById('newFieldName').value.trim();
  const code = document.getElementById('newFieldCode').value.trim();
  const ticketPrefix = document.getElementById('newFieldPrefix').value.trim();
  if (!name) return showToast('Vui lòng nhập tên lĩnh vực.', 'error');
  try {
    const created = await ApiClient.post('/api/admin/fields', { name, code, ticketPrefix });
    showToast(`Đã thêm lĩnh vực "${created.name}" (số thứ tự ${String(created.ticket_prefix).trim()}-xxx).`, 'success');
    document.getElementById('newFieldCode').dataset.touched = '';
    toggleNewFieldBox(false);
    loadFieldsTab();
  } catch (err) { showToast(err.message, 'error'); }
}

function editFieldItem(fieldId) {
  const f = fieldsCache.find((x) => x.id === fieldId);
  if (!f) return;
  document.getElementById(`field-item-${fieldId}`).innerHTML = `
    <div class="field-prefix">${escField(String(f.ticket_prefix).trim())}</div>
    <div class="field-body field-edit">
      <input id="editFieldName-${fieldId}" value="${escField(f.name)}" maxlength="120" placeholder="Tên lĩnh vực" />
      <input id="editFieldPrefix-${fieldId}" value="${escField(String(f.ticket_prefix).trim())}" maxlength="1" style="max-width:90px;text-transform:uppercase;" title="Chữ cái đầu số thứ tự" />
    </div>
    <div class="field-actions">
      <button class="btn btn-primary action-chip" ${actionAttr('saveFieldItem', fieldId)}>Lưu</button>
      <button class="btn btn-outline action-chip" ${actionAttr('renderFieldsTab')}>Hủy</button>
    </div>`;
  document.getElementById(`editFieldName-${fieldId}`).focus();
}

async function saveFieldItem(fieldId) {
  const name = document.getElementById(`editFieldName-${fieldId}`).value.trim();
  const ticketPrefix = document.getElementById(`editFieldPrefix-${fieldId}`).value.trim();
  if (!name) return showToast('Vui lòng nhập tên lĩnh vực.', 'error');
  try {
    await ApiClient.put(`/api/admin/fields/${fieldId}`, { name, ticketPrefix });
    showToast('Đã cập nhật lĩnh vực.', 'success');
    loadFieldsTab();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteFieldItem(fieldId) {
  const f = fieldsCache.find((x) => x.id === fieldId);
  const ok = await ConfirmDialog.confirm(`Xóa lĩnh vực "${f ? f.name : ''}"? Chỉ xóa được khi chưa có quầy hoặc thủ tục nào thuộc lĩnh vực này.`, { danger: true, okLabel: 'Xóa lĩnh vực' });
  if (!ok) return;
  try {
    await ApiClient.delete(`/api/admin/fields/${fieldId}`, { reason: 'Xoa linh vuc tu Admin Dashboard' });
    showToast('Đã xóa lĩnh vực.', 'success');
    loadFieldsTab();
  } catch (err) { showToast(err.message, 'error'); }
}

// Danh dau o "Ma" da duoc nguoi dung tu sua -> khong ghi de bang goi y tu ten nua.
document.addEventListener('input', (e) => {
  if (e.target.id === 'newFieldName') suggestFieldCode();
  if (e.target.id === 'newFieldCode') e.target.dataset.touched = e.target.value ? '1' : '';
  if (e.target.id === 'newFieldPrefix' || (e.target.id || '').startsWith('editFieldPrefix-')) {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1);
  }
});
