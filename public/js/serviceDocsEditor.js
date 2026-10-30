// UC-61 "Cai giay to cho thu tuc" - man hinh sua danh sach giay to (Bat buoc / Khong bat buoc / Ghi chu).
// Dung chung cho tab "Thu tuc" cua Admin va man hinh Can bo Quay (counter.html).
// Dung PUT /api/services/:id/docs (quyen theo vai tro/linh vuc duoc kiem tra o may chu).
// Chong ghi de: gui kem `version`; 409 -> thong bao tai lai, khong am tham de len.
// Phu thuoc (nap truoc): apiClient.js, toast.js, actionDelegate.js. CSP cam inline handler -> data-action.
(function () {
  const MAX_DOCS = 30;
  let state = null; // { service, docs: [{code,name,mandatory,note}], onSaved }

  function esc(v) {
    return String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function ensureModal() {
    if (document.getElementById('sdeOverlay')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="modal-overlay hidden" id="sdeOverlay">
        <div class="modal-box" style="max-width:760px;width:96%;max-height:92vh;overflow:auto;">
          <h2 id="sdeTitle" style="margin-top:0;">Cài giấy tờ cho thủ tục</h2>
          <p class="text-muted" style="margin-top:0;">
            <b>Bắt buộc</b>: thiếu thì Kiosk không cấp số. <b>Không bắt buộc</b>: thiếu vẫn cấp số, chỉ nhắc người dân.
          </p>
          <div id="sdeRows"></div>
          <button class="btn btn-outline action-chip" data-action="sdeAdd">+ Thêm giấy tờ</button>
          <div class="field" style="margin-top:14px;">
            <label>Lý do thay đổi (ghi vào nhật ký)</label>
            <input id="sdeReason" maxlength="255" placeholder="VD: Cập nhật theo quy định mới" />
          </div>
          <p id="sdeError" class="hidden" style="color:var(--color-danger);font-weight:600;"></p>
          <div class="flex gap-12 mt-16">
            <button class="btn btn-outline" data-action="sdeClose">Hủy</button>
            <button class="btn btn-primary" style="flex:1" id="sdeSaveBtn" data-action="sdeSave">Lưu giấy tờ</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap.firstElementChild);
  }

  // Doc gia tri dang nhap tren man hinh vao state (truoc khi ve lai hoac luu).
  function syncFromDom() {
    if (!state) return;
    state.docs = Array.from(document.querySelectorAll('#sdeRows .sde-row')).map((row) => ({
      code: row.querySelector('.sde-code').value.trim().toUpperCase(),
      name: row.querySelector('.sde-name').value.trim(),
      mandatory: row.querySelector('.sde-mandatory').value === '1',
      note: row.querySelector('.sde-note').value.trim()
    }));
  }

  function render() {
    document.getElementById('sdeRows').innerHTML = state.docs.map((d, i) => `
      <div class="sde-row" style="border:1px solid var(--color-border);border-radius:10px;padding:10px;margin-bottom:8px;">
        <div class="flex gap-8" style="flex-wrap:wrap;">
          <input class="sde-name" style="flex:2;min-width:200px;" maxlength="255" placeholder="Tên giấy tờ" value="${esc(d.name)}" />
          <input class="sde-code" style="flex:1;min-width:120px;" maxlength="30" placeholder="MÃ_GIẤY_TỜ" value="${esc(d.code)}" />
          <select class="sde-mandatory" style="min-width:150px;">
            <option value="1" ${d.mandatory ? 'selected' : ''}>Bắt buộc</option>
            <option value="0" ${d.mandatory ? '' : 'selected'}>Không bắt buộc</option>
          </select>
        </div>
        <div class="flex gap-8" style="margin-top:6px;flex-wrap:wrap;">
          <input class="sde-note" style="flex:1;min-width:200px;" maxlength="255" placeholder="Ghi chú cho người dân (không bắt buộc)" value="${esc(d.note || '')}" />
          <button class="btn btn-outline action-chip" ${window.actionAttr('sdeMove', i, -1)} ${i === 0 ? 'disabled' : ''} title="Lên">↑</button>
          <button class="btn btn-outline action-chip" ${window.actionAttr('sdeMove', i, 1)} ${i === state.docs.length - 1 ? 'disabled' : ''} title="Xuống">↓</button>
          <button class="btn btn-danger action-chip" ${window.actionAttr('sdeRemove', i)}>Xóa</button>
        </div>
      </div>`).join('') || '<p class="text-muted">Chưa có giấy tờ nào.</p>';
  }

  function showError(msg) {
    const el = document.getElementById('sdeError');
    el.textContent = msg || '';
    el.classList.toggle('hidden', !msg);
  }

  // service: { id, name, required_docs, version }. onSaved(updatedService) goi sau khi luu thanh cong.
  window.openServiceDocsEditor = function openServiceDocsEditor(service, onSaved) {
    ensureModal();
    state = {
      service,
      onSaved,
      docs: (service.required_docs || []).map((d) => ({
        code: d.code, name: d.name, mandatory: !!d.mandatory, note: d.note || ''
      }))
    };
    document.getElementById('sdeTitle').textContent = `Giấy tờ: ${service.name}`;
    document.getElementById('sdeReason').value = '';
    showError('');
    render();
    document.getElementById('sdeOverlay').classList.remove('hidden');
  };

  window.sdeClose = function sdeClose() {
    const el = document.getElementById('sdeOverlay');
    if (el) el.classList.add('hidden');
    state = null;
  };

  window.sdeAdd = function sdeAdd() {
    syncFromDom();
    if (state.docs.length >= MAX_DOCS) return showError(`Tối đa ${MAX_DOCS} giấy tờ.`);
    state.docs.push({ code: '', name: '', mandatory: true, note: '' });
    render();
  };

  window.sdeRemove = function sdeRemove(i) { syncFromDom(); state.docs.splice(i, 1); render(); };

  window.sdeMove = function sdeMove(i, delta) {
    syncFromDom();
    const j = i + delta;
    if (j < 0 || j >= state.docs.length) return;
    [state.docs[i], state.docs[j]] = [state.docs[j], state.docs[i]];
    render();
  };

  // Tu sinh ma tu ten neu de trong (VD "Căn cước công dân" -> CAN_CUOC_CONG_DAN), tranh trung ma.
  function autoCode(name, used) {
    const base = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'D')
      .toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'GIAY_TO';
    let code = /^[A-Z]/.test(base) ? base : `G_${base}`;
    let n = 2;
    while (used.has(code)) { code = `${code.slice(0, 26)}_${n}`; n += 1; }
    return code;
  }

  window.sdeSave = async function sdeSave() {
    syncFromDom();
    const used = new Set(state.docs.filter((d) => d.code).map((d) => d.code));
    state.docs.forEach((d) => { if (!d.code && d.name) { d.code = autoCode(d.name, used); used.add(d.code); } });
    const btn = document.getElementById('sdeSaveBtn');
    btn.disabled = true;
    showError('');
    try {
      const docs = state.docs.map((d) => {
        const out = { code: d.code, name: d.name, mandatory: d.mandatory };
        if (d.note) out.note = d.note;
        return out;
      });
      const updated = await ApiClient.put(`/api/services/${state.service.id}/docs`, {
        docs, version: state.service.version, reason: document.getElementById('sdeReason').value.trim() || undefined
      });
      const cb = state.onSaved;
      window.sdeClose();
      showToast('Đã lưu danh sách giấy tờ.', 'success');
      if (cb) cb(updated);
    } catch (err) {
      showError(err.message || 'Không lưu được.');
    } finally { btn.disabled = false; }
  };
})();
