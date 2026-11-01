// Thay the cho onclick="..."/onchange="..." rai rac trong HTML tinh va trong chuoi template
// render dong (admin.js/counter.js/kiosk-checklist.js) - Content-Security-Policy script-src
// (bat lai o src/server.js) coi MOI inline event handler la 1 dang inline script va chan tuyet
// doi, du no chi goi 1 ham global don gian. Giai phap: 1 cap listener uy quyen (event
// delegation) duy nhat gan vao document, doc thuoc tinh data-action/data-args roi tu goi ham
// global tuong ung (cac ham nghiep vu van khai bao binh thuong qua <script src> khong-module,
// nen tu dong gan vao window nhu truoc).
(function () {
  function escapeAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Dung khi render HTML dong, VD:
  //   `<button ${actionAttr('changeCounterStatus', c.id, 'OPEN')}>Mo</button>`
  // Truyen chuoi '$value' lam 1 tham so de no duoc thay bang gia tri hien tai cua chinh
  // input/select luc su kien xay ra (thay cho "this.value" cua onchange kieu cu).
  window.actionAttr = function actionAttr(name, ...args) {
    return `data-action="${name}" data-args='${escapeAttr(JSON.stringify(args))}'`;
  };

  // SUA LOI 11/2026: truoc day ca 'click' lan 'change' deu goi ham -> bam vao <select> (moi chi
  // mo danh sach, chua chon gi) da goi ngay changeCounterField/changeCounterOfficer voi GIA TRI
  // CU, hien toast "Da gan can bo...", roi loadDispatch() ve lai danh sach lam dropdown dong
  // mat -> khong bao gio chon duoc muc khac. Quy tac moi: o nhap lieu (select/input/textarea)
  // chi phan ung voi 'change'; nut/lien ket chi phan ung voi 'click'.
  const FORM_TAGS = ['SELECT', 'INPUT', 'TEXTAREA'];

  function dispatch(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const isFormControl = FORM_TAGS.includes(el.tagName);
    if (isFormControl && e.type !== 'change') return;
    if (!isFormControl && e.type !== 'click') return;
    const fn = window[el.dataset.action];
    if (typeof fn !== 'function') {
      console.error(`[actionDelegate] Khong tim thay ham global: ${el.dataset.action}`);
      return;
    }
    const args = (el.dataset.args ? JSON.parse(el.dataset.args) : [])
      .map((a) => (a === '$value' ? el.value : a));
    fn(...args);
  }

  document.addEventListener('click', dispatch);
  document.addEventListener('change', dispatch);
})();
