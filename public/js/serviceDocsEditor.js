// Bo soan danh sach giay to cho tung thu tuc - dung chung cho admin.html (tab "Giay to thu tuc")
// va counter.html (nut "Giay to thu tuc" tren thanh tren). Khong dung onclick inline (CSP chan) -
// gan su kien bang addEventListener ngay tren cac phan tu tao ra.
//
//   ServiceDocsEditor.mount(containerEl, {
//     listUrl: '/api/admin/services',                      // GET -> danh sach thu tuc duoc phep sua
//     saveUrl: (id) => `/api/admin/services/${id}/required-docs`,  // PUT { docs, expectedUpdatedAt }
//     scopeNote: 'Chi hien thu tuc thuoc linh vuc quay ban phu trach.'  // tuy chon
//   })
// Tra ve { reload(), isDirty() }.
const ServiceDocsEditor = (() => {
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (v === true) node.setAttribute(k, '');
      else if (v !== false && v !== null && v !== undefined) node.setAttribute(k, v);
    });
    [].concat(children).forEach((c) => { if (c) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return node;
  }

  async function ask(message, okLabel, danger) {
    if (typeof ConfirmDialog !== 'undefined') return ConfirmDialog.confirm(message, { okLabel, danger });
    return window.confirm(message);
  }

  function toast(msg, type) {
    if (typeof showToast === 'function') showToast(msg, type);
  }

  function cloneDocs(docs) {
    return (docs || []).map((d) => ({ code: d.code, name: d.name, mandatory: d.mandatory !== false, note: d.note || '', isNew: false }));
  }

  function serialize(docs) {
    return JSON.stringify(docs.map((d) => ({ code: d.code || '', name: (d.name || '').trim(), mandatory: !!d.mandatory, note: (d.note || '').trim() })));
  }

  function mount(container, options) {
    let services = [];
    let current = null;        // thu tuc dang chon
    let docs = [];             // ban dang sua
    let savedSnapshot = '[]';  // de biet co thay doi chua luu
    let saving = false;

    container.innerHTML = '';
    container.classList.add('sde');

    const select = el('select', { class: 'sde-select', 'aria-label': 'Chọn thủ tục' });
    const summary = el('div', { class: 'sde-summary text-muted' });
    const rowsBox = el('div', { class: 'sde-rows' });
    const addBtn = el('button', { class: 'btn btn-outline', type: 'button', text: '+ Thêm giấy tờ' });
    const resetBtn = el('button', { class: 'btn btn-outline', type: 'button', text: 'Hoàn tác' });
    const saveBtn = el('button', { class: 'btn btn-primary', type: 'button', text: 'Lưu thay đổi' });

    container.appendChild(el('div', { class: 'sde-head' }, [
      el('label', { class: 'sde-label', text: 'Thủ tục' }), select
    ]));
    if (options.scopeNote) container.appendChild(el('p', { class: 'text-muted sde-scope', text: options.scopeNote }));
    container.appendChild(el('div', { class: 'sde-legend text-muted' }, [
      el('span', { class: 'badge badge-red', text: 'Bắt buộc' }), ' thiếu thì Kiosk không cấp số.  ',
      el('span', { class: 'badge badge-gray', text: 'Không bắt buộc' }), ' chỉ hiển thị cho công dân biết, không chặn cấp số.'
    ]));
    container.appendChild(summary);
    container.appendChild(rowsBox);
    container.appendChild(el('div', { class: 'sde-actions' }, [addBtn, el('span', { class: 'sde-spacer' }), resetBtn, saveBtn]));

    function isDirty() { return current !== null && serialize(docs) !== savedSnapshot; }

    function updateSummary() {
      const m = docs.filter((d) => d.mandatory).length;
      const o = docs.length - m;
      summary.textContent = current
        ? `${docs.length} giấy tờ: ${m} bắt buộc, ${o} không bắt buộc${isDirty() ? ' — có thay đổi chưa lưu' : ''}`
        : '';
      saveBtn.disabled = saving || !isDirty();
      resetBtn.disabled = saving || !isDirty();
    }

    function renderRows() {
      rowsBox.innerHTML = '';
      if (!current) {
        rowsBox.appendChild(el('div', { class: 'empty-state', text: 'Không có thủ tục nào để cài đặt.' }));
        updateSummary();
        return;
      }
      if (docs.length === 0) {
        rowsBox.appendChild(el('div', { class: 'empty-state', text: 'Thủ tục chưa có giấy tờ nào. Bấm "+ Thêm giấy tờ".' }));
      }
      docs.forEach((d, i) => {
        const nameInput = el('input', { class: 'sde-name', value: d.name, maxlength: '255', placeholder: 'Tên giấy tờ, VD: CCCD bản chính', 'aria-label': `Tên giấy tờ ${i + 1}` });
        nameInput.addEventListener('input', () => { d.name = nameInput.value; updateSummary(); });

        const noteInput = el('input', { class: 'sde-note', value: d.note, maxlength: '500', placeholder: 'Ghi chú cho công dân (không bắt buộc nhập)', 'aria-label': `Ghi chú giấy tờ ${i + 1}` });
        noteInput.addEventListener('input', () => { d.note = noteInput.value; updateSummary(); });

        const mandatoryBtn = el('button', {
          type: 'button',
          class: `btn sde-toggle ${d.mandatory ? 'is-mandatory' : 'is-optional'}`,
          'aria-pressed': d.mandatory ? 'true' : 'false',
          title: 'Bấm để đổi Bắt buộc / Không bắt buộc',
          text: d.mandatory ? 'Bắt buộc' : 'Không bắt buộc'
        });
        mandatoryBtn.addEventListener('click', () => { d.mandatory = !d.mandatory; renderRows(); });

        const codeCell = d.isNew
          ? el('input', { class: 'sde-code', value: d.code, maxlength: '40', placeholder: 'Mã (để trống = tự sinh)', 'aria-label': `Mã giấy tờ ${i + 1}` })
          : el('code', { class: 'sde-code-fixed', title: 'Mã giấy tờ đã dùng ở hướng dẫn và hồ sơ cũ nên không đổi', text: d.code });
        if (d.isNew) codeCell.addEventListener('input', () => { d.code = codeCell.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''); codeCell.value = d.code; updateSummary(); });

        const up = el('button', { type: 'button', class: 'btn btn-outline sde-icon', title: 'Đưa lên', 'aria-label': 'Đưa lên', text: '↑', disabled: i === 0 });
        up.addEventListener('click', () => { [docs[i - 1], docs[i]] = [docs[i], docs[i - 1]]; renderRows(); });
        const down = el('button', { type: 'button', class: 'btn btn-outline sde-icon', title: 'Đưa xuống', 'aria-label': 'Đưa xuống', text: '↓', disabled: i === docs.length - 1 });
        down.addEventListener('click', () => { [docs[i + 1], docs[i]] = [docs[i], docs[i + 1]]; renderRows(); });
        const del = el('button', { type: 'button', class: 'btn btn-outline sde-icon sde-del', title: 'Xóa giấy tờ', 'aria-label': 'Xóa giấy tờ', text: '✕' });
        del.addEventListener('click', () => { docs.splice(i, 1); renderRows(); });

        rowsBox.appendChild(el('div', { class: `sde-row ${d.mandatory ? '' : 'sde-row-optional'}` }, [
          el('span', { class: 'sde-index', text: String(i + 1) }),
          el('div', { class: 'sde-main' }, [nameInput, noteInput, codeCell]),
          mandatoryBtn,
          el('div', { class: 'sde-order' }, [up, down, del])
        ]));
      });
      updateSummary();
    }

    function selectService(id) {
      current = services.find((s) => s.id === id) || null;
      docs = cloneDocs(current ? current.required_docs : []);
      savedSnapshot = serialize(docs);
      renderRows();
    }

    function fillSelect(keepId) {
      select.innerHTML = '';
      const groups = {};
      services.forEach((s) => { (groups[s.field_name || 'Khác'] = groups[s.field_name || 'Khác'] || []).push(s); });
      Object.keys(groups).forEach((g) => {
        const og = el('optgroup', { label: g });
        groups[g].forEach((s) => og.appendChild(el('option', { value: String(s.id), text: Number(s.is_active) === 0 ? `${s.name} (đang ẩn)` : s.name })));
        select.appendChild(og);
      });
      const target = services.find((s) => s.id === keepId) ? keepId : (services[0] && services[0].id);
      if (target) select.value = String(target);
      selectService(target);
    }

    let lastSelected = null;
    select.addEventListener('focus', () => { lastSelected = select.value; });
    select.addEventListener('change', async () => {
      if (isDirty() && !(await ask('Thủ tục này có thay đổi chưa lưu. Bỏ các thay đổi đó?', 'Bỏ thay đổi', true))) {
        select.value = lastSelected || String(current.id);
        return;
      }
      lastSelected = select.value;
      selectService(Number(select.value));
    });

    addBtn.addEventListener('click', () => {
      if (!current) return;
      docs.push({ code: '', name: '', mandatory: true, note: '', isNew: true });
      renderRows();
      const inputs = rowsBox.querySelectorAll('.sde-name');
      if (inputs.length) inputs[inputs.length - 1].focus();
    });

    // Hoan tac = bo thay doi va tai lai ban moi nhat tu may chu (ke ca khi nguoi khac vua sua).
    resetBtn.addEventListener('click', () => { if (current) { docs = cloneDocs(current.required_docs); savedSnapshot = serialize(docs); } reload(); });

    saveBtn.addEventListener('click', async () => {
      if (!current || saving) return;
      const emptyIdx = docs.findIndex((d) => !(d.name || '').trim());
      if (emptyIdx >= 0) { toast(`Giấy tờ thứ ${emptyIdx + 1} chưa có tên.`, 'error'); return; }
      const seen = new Set();
      const dupIdx = docs.findIndex((d) => { const k = d.name.trim().replace(/\s+/g, ' ').toLowerCase(); if (seen.has(k)) return true; seen.add(k); return false; });
      if (dupIdx >= 0) { toast(`Giấy tờ thứ ${dupIdx + 1} bị trùng tên với giấy tờ khác.`, 'error'); return; }
      if (docs.length > 0 && !docs.some((d) => d.mandatory)
        && !(await ask('Thủ tục này sẽ không còn giấy tờ BẮT BUỘC nào, Kiosk sẽ cấp số mà không cần đối chiếu. Vẫn lưu?', 'Vẫn lưu', true))) return;
      if (docs.length === 0
        && !(await ask('Xóa hết giấy tờ của thủ tục này? Công dân sẽ không thấy checklist nào.', 'Xóa hết', true))) return;

      saving = true; updateSummary();
      try {
        const payload = docs.map((d) => {
          const out = { name: d.name.trim(), mandatory: !!d.mandatory };
          if (d.code) out.code = d.code;
          if ((d.note || '').trim()) out.note = d.note.trim();
          return out;
        });
        const result = await ApiClient.put(options.saveUrl(current.id), { docs: payload, expectedUpdatedAt: current.updated_at });
        current.required_docs = result.requiredDocs;
        current.updated_at = result.updatedAt;
        selectService(current.id);
        toast(`Đã lưu giấy tờ cho "${current.name}".`, 'success');
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        saving = false; updateSummary();
      }
    });

    async function reload(preferId) {
      const keepId = preferId || (current ? current.id : null);
      try {
        services = await ApiClient.get(options.listUrl);
      } catch (err) {
        rowsBox.innerHTML = '';
        rowsBox.appendChild(el('div', { class: 'empty-state', text: err.message }));
        return;
      }
      fillSelect(keepId);
    }

    // Khi nguoi khac vua luu (su kien SERVICE_DOCS_UPDATED): neu dang khong sua do thi tai lai
    // ngay de thay ban moi nhat; dang sua do thi giu nguyen, luc luu server se bao xung dot (409).
    async function onRemoteUpdate(serviceId, updatedAt) {
      // Su kien do CHINH minh vua luu (den truoc/ngay sau khi nhan ket qua PUT) -> bo qua.
      if (saving) return;
      if (current && current.id === serviceId && updatedAt && current.updated_at
        && new Date(updatedAt).getTime() === new Date(current.updated_at).getTime()) return;
      if (current && current.id === serviceId && isDirty()) {
        toast('Thủ tục đang sửa vừa được người khác cập nhật. Hãy bấm "Hoàn tác" để tải bản mới rồi sửa lại.', 'error');
        return;
      }
      await reload();
    }

    reload();
    // Chon 1 thu tuc tu ben ngoai (VD vua tao thu tuc moi o danh muc -> chuyen sang cai giay to).
    async function selectById(id) {
      if (isDirty() && !(await ask('Thủ tục đang sửa có thay đổi chưa lưu. Bỏ các thay đổi đó?', 'Bỏ thay đổi', true))) return false;
      if (current) { docs = cloneDocs(current.required_docs); savedSnapshot = serialize(docs); }
      await reload(id);
      return true;
    }

    return { reload, isDirty, onRemoteUpdate, selectById };
  }

  return { mount };
})();
