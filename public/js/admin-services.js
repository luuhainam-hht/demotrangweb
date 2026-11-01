// =============================== TAB: THU TUC (UC-60 / UC-61) ===============================
// Quan ly danh muc thu tuc: sua ten/SLA/le phi, cai giay to (Bat buoc/Khong bat buoc), an/hien.
// KHONG co nut xoa - chi an/hien (ve cu va bao cao van tro toi thu tuc). Thu tuc moi mac dinh AN.
// Chong ghi de: moi lan luu gui kem `version`; 409 -> tai lai danh sach.
let manageServices = [];
let manageFields = [];

function escSvc(v) {
  return String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function formatVnd(n) {
  const v = Number(n) || 0;
  return v === 0 ? 'Miễn phí / chưa thu' : `${v.toLocaleString('vi-VN')} đ`;
}

async function loadServicesTab() {
  try {
    manageServices = await ApiClient.get('/api/admin/services/manage');
    const seen = new Map();
    manageServices.forEach((s) => { if (!seen.has(s.field_id)) seen.set(s.field_id, s.field_name); });
    manageFields = Array.from(seen, ([id, name]) => ({ id, name }));
    // Lay day du danh sach linh vuc (ke ca linh vuc moi tao chua co thu tuc nao) - truoc day chi
    // suy ra tu thu tuc da co nen linh vuc moi khong bao gio hien trong o "Linh vuc".
    try {
      const allFields = await ApiClient.get('/api/admin/fields/manage');
      if (Array.isArray(allFields) && allFields.length) manageFields = allFields.map((f) => ({ id: f.id, name: f.name }));
    } catch (e) { /* giu danh sach suy ra o tren */ }
    document.getElementById('newSvcField').innerHTML = manageFields.map((f) => `<option value="${f.id}">${escSvc(f.name)}</option>`).join('');
    renderServicesTab();
  } catch (err) { showToast(err.message, 'error'); }
}

function renderServicesTab() {
  document.getElementById('serviceManageList').innerHTML = manageServices.map((s) => {
    const docs = s.required_docs || [];
    const must = docs.filter((d) => d.mandatory).length;
    return `
      <div class="counter-row">
        <div style="flex:1;min-width:0;">
          <b>${escSvc(s.name)}</b> <span class="text-muted">(${escSvc(s.code)})</span>
          <span class="badge ${s.is_active ? 'badge-green' : 'badge-gray'}">${s.is_active ? 'Đang hiện trên Kiosk' : 'Đang ẩn'}</span>
          <div class="text-muted" style="font-size:0.9rem;">
            ${escSvc(s.field_name)} • SLA ${Number(s.sla_minutes)} phút • Lệ phí: ${escSvc(s.fee_label || formatVnd(s.fee_amount))}
            • ${docs.length} giấy tờ (${must} bắt buộc)
          </div>
        </div>
        <div class="flex gap-8" style="flex-wrap:wrap;">
          <button class="btn btn-outline action-chip" ${actionAttr('editServiceDocs', s.id)}>Giấy tờ</button>
          <button class="btn btn-outline action-chip" ${actionAttr('editServiceInfo', s.id)}>Sửa / Lệ phí</button>
          <button class="btn ${s.is_active ? 'btn-danger' : 'btn-success'} action-chip" ${actionAttr('toggleServiceActive', s.id, !s.is_active)}>${s.is_active ? 'Ẩn' : 'Hiện'}</button>
        </div>
      </div>`;
  }).join('') || '<p class="text-muted">Chưa có thủ tục nào.</p>';
}

function findManaged(id) { return manageServices.find((s) => s.id === Number(id)); }

function editServiceDocs(id) {
  const s = findManaged(id);
  if (!s) return;
  openServiceDocsEditor(s, () => loadServicesTab());
}

async function toggleServiceActive(id, makeActive) {
  const s = findManaged(id);
  if (!s) return;
  const verb = makeActive ? 'hiện' : 'ẩn';
  const ok = await ConfirmDialog.confirm(`Bạn chắc chắn muốn ${verb} thủ tục "${s.name}" trên Kiosk?`, { danger: !makeActive, okLabel: makeActive ? 'Cho hiện' : 'Ẩn thủ tục' });
  if (!ok) return;
  try {
    await ApiClient.post(`/api/admin/services/${s.id}/active`, { isActive: makeActive, version: s.version });
    showToast(makeActive ? 'Đã cho hiện thủ tục.' : 'Đã ẩn thủ tục.', 'success');
  } catch (err) { showToast(err.message, 'error'); }
  loadServicesTab();
}

// ---- Sua thong tin / le phi (dung 1 form dung chung cho Them moi va Sua) ----
function openServiceForm(service) {
  const f = document.getElementById('svcForm');
  document.getElementById('svcFormTitle').textContent = service ? `Sửa thủ tục: ${service.name}` : 'Thêm thủ tục mới (mặc định ẩn)';
  document.getElementById('svcFormId').value = service ? service.id : '';
  document.getElementById('svcFormCodeWrap').classList.toggle('hidden', !!service);
  document.getElementById('svcFormFieldWrap').classList.toggle('hidden', !!service);
  document.getElementById('svcFormCode').value = '';
  document.getElementById('svcFormName').value = service ? service.name : '';
  document.getElementById('svcFormAlias').value = service ? (service.short_alias || '') : '';
  document.getElementById('svcFormSla').value = service ? service.sla_minutes : 15;
  document.getElementById('svcFormFeeAmount').value = service ? Number(service.fee_amount) : 0;
  document.getElementById('svcFormFeeLabel').value = service ? (service.fee_label || '') : '';
  document.getElementById('svcFormFeeNote').value = service ? (service.fee_note || '') : '';
  document.getElementById('svcFormReason').value = '';
  f.classList.remove('hidden');
  f.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function newServiceForm() { openServiceForm(null); }
function editServiceInfo(id) { const s = findManaged(id); if (s) openServiceForm(s); }
function closeServiceForm() { document.getElementById('svcForm').classList.add('hidden'); }

async function submitServiceForm() {
  const id = document.getElementById('svcFormId').value;
  const info = {
    name: document.getElementById('svcFormName').value,
    shortAlias: document.getElementById('svcFormAlias').value,
    slaMinutes: document.getElementById('svcFormSla').value,
    feeAmount: document.getElementById('svcFormFeeAmount').value,
    feeLabel: document.getElementById('svcFormFeeLabel').value,
    feeNote: document.getElementById('svcFormFeeNote').value
  };
  const reason = document.getElementById('svcFormReason').value.trim() || undefined;
  try {
    if (id) {
      const s = findManaged(id);
      await ApiClient.put(`/api/admin/services/${id}`, { ...info, version: s.version, reason });
      showToast('Đã lưu thông tin và lệ phí thủ tục.', 'success');
    } else {
      await ApiClient.post('/api/admin/services', {
        ...info,
        code: document.getElementById('svcFormCode').value,
        fieldId: document.getElementById('newSvcField').value
      });
      showToast('Đã thêm thủ tục (đang ẩn). Hãy cài giấy tờ rồi bấm Hiện.', 'success');
    }
    closeServiceForm();
  } catch (err) { showToast(err.message, 'error'); }
  loadServicesTab();
}
