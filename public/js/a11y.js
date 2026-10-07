// ============================================================================
// Lop tro nang dung chung cho MOI trang (nap trong <head> de ap dung truoc khi ve giao dien,
// tranh hien tuong chu nhay co khi tai trang).
//
// 3 tinh nang, deu do NGUOI DUNG tu bat:
//   1. Co chu: Vua / To / Rat to  -> dat html[data-font-level], CSS doi bien --a11y-zoom.
//   2. Tuong phan cao             -> dat html[data-contrast="high"].
//   3. Doc to noi dung trang      -> Web Speech API (speechSynthesis), giong vi-VN neu may co.
// Trang thai luu trong localStorage nen GIU NGUYEN khi chuyen sang trang khac va khi quay lai
// lan sau - nguoi lon tuoi khong phai chinh lai tu dau moi lan vao.
//
// CSP (xem src/server.js) chan tuyet doi <script> inline va onclick="..." -> moi su kien o day
// deu gan bang addEventListener.
// ============================================================================
(function () {
  'use strict';

  var FONT_KEY = 'a11y_font_level';     // 'normal' | 'large' | 'xlarge'
  var CONTRAST_KEY = 'a11y_contrast';   // 'normal' | 'high'
  var LEVELS = ['normal', 'large', 'xlarge'];
  var root = document.documentElement;
  // Phai khai bao TRUOC applyFont()/applyContrast() o duoi: hai ham do goi syncButtons() ngay
  // trong luc nap file, luc do neu btnRefs chua duoc gan gia tri (hoisting) thi nem loi va
  // toan bo lop tro nang khong chay.
  var btnRefs = { font: {}, contrast: null, read: null };

  function read(key, fallback) {
    try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* trinh duyet chan localStorage -> van dung duoc trong phien nay */ }
  }

  // ---- 1. Ap dung ngay lap tuc (chay trong <head>, truoc khi <body> duoc ve) ----
  var fontLevel = read(FONT_KEY, 'normal');
  if (LEVELS.indexOf(fontLevel) === -1) fontLevel = 'normal';
  var contrast = read(CONTRAST_KEY, 'normal') === 'high' ? 'high' : 'normal';

  function applyFont(level) {
    fontLevel = level;
    if (level === 'normal') root.removeAttribute('data-font-level');
    else root.setAttribute('data-font-level', level);
    save(FONT_KEY, level);
    syncButtons();
  }
  function applyContrast(mode) {
    contrast = mode;
    if (mode === 'high') root.setAttribute('data-contrast', 'high');
    else root.removeAttribute('data-contrast');
    save(CONTRAST_KEY, mode);
    syncButtons();
  }
  applyFont(fontLevel);
  applyContrast(contrast);

  // ---- 2. Doc to noi dung trang (Web Speech API) ----
  // Doc theo TUNG DOAN thay vi nem ca trang vao 1 luot: vua to sang duoc dung doan dang doc,
  // vua tranh loi cat ngang cua Chrome khi chuoi qua dai (~32k ky tu).
  var speech = {
    supported: typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined',
    playing: false,
    nodes: [],
    index: 0,
    current: null
  };

  function collectReadableNodes() {
    var scope = document.querySelector('[data-a11y-read-scope]') || findMain();
    if (!scope) return [];
    var picked = [];
    var nodes = scope.querySelectorAll('h1, h2, h3, h4, p, li, dd, .field-label, .field-how, .big-step-body p, .dvc-step .simple');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.closest('.a11y-bar, .site-header, .chatbot-widget, [data-a11y-skip], [hidden], .hidden')) continue;
      var text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length < 2) continue;
      picked.push({ el: el, text: text });
    }
    return picked;
  }

  function pickVoice() {
    var voices = window.speechSynthesis.getVoices() || [];
    for (var i = 0; i < voices.length; i++) {
      if ((voices[i].lang || '').toLowerCase().indexOf('vi') === 0) return voices[i];
    }
    return null;
  }

  function clearHighlight() {
    if (speech.current && speech.current.el) speech.current.el.classList.remove('a11y-reading');
    speech.current = null;
  }

  function speakNext() {
    if (!speech.playing) return;
    if (speech.index >= speech.nodes.length) { stopReading(); return; }
    var item = speech.nodes[speech.index++];
    clearHighlight();
    speech.current = item;
    item.el.classList.add('a11y-reading');
    try { item.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { item.el.scrollIntoView(); }

    var u = new SpeechSynthesisUtterance(item.text);
    u.lang = 'vi-VN';
    var v = pickVoice();
    if (v) u.voice = v;
    u.rate = 0.92;   // cham hon mac dinh mot chut cho de nghe
    u.onend = speakNext;
    u.onerror = speakNext;
    window.speechSynthesis.speak(u);
  }

  function startReading() {
    speech.nodes = collectReadableNodes();
    if (speech.nodes.length === 0) {
      announce('Trang này chưa có nội dung để đọc.');
      return;
    }
    speech.index = 0;
    speech.playing = true;
    window.speechSynthesis.cancel();
    syncButtons();
    speakNext();
  }

  function stopReading() {
    speech.playing = false;
    speech.index = 0;
    clearHighlight();
    if (speech.supported) window.speechSynthesis.cancel();
    syncButtons();
  }

  // Doi trang / tat trinh duyet thi dung doc, tranh tieng noi "ma" o trang sau.
  window.addEventListener('beforeunload', function () { if (speech.supported) window.speechSynthesis.cancel(); });

  // ---- 3. Thanh dieu khien ----
  function findMain() {
    return document.querySelector('main, .container, .kiosk-wrap, .guide-wrap, .track-wrap, .notfound-wrap, .display-wrap');
  }

  function announce(message) {
    var live = document.getElementById('a11y-live');
    if (live) live.textContent = message;
  }

  function syncButtons() {
    for (var key in btnRefs.font) {
      if (!Object.prototype.hasOwnProperty.call(btnRefs.font, key)) continue;
      btnRefs.font[key].setAttribute('aria-pressed', key === fontLevel ? 'true' : 'false');
    }
    if (btnRefs.contrast) btnRefs.contrast.setAttribute('aria-pressed', contrast === 'high' ? 'true' : 'false');
    if (btnRefs.read) {
      btnRefs.read.setAttribute('aria-pressed', speech.playing ? 'true' : 'false');
      btnRefs.read.innerHTML = speech.playing ? '⏹ Dừng đọc' : '🔊 Đọc to trang này';
    }
  }

  function buildBar() {
    // Trang khong co nguoi thao tac (Bang LED) hoac trang dang nhap noi bo thi khong can thanh nay.
    if (document.body.dataset.a11yBar === 'false') return;

    var bar = document.createElement('div');
    bar.className = 'a11y-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Thanh công cụ trợ năng');

    // Tren dien thoai, 5 nut xep thanh 3 hang chiem gan 1/6 man hinh ngay khi vua vao trang.
    // Nen o be ngang nho, ca cum duoc thu vao sau 1 nut "Tro nang" - bam moi mo ra.
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'a11y-bar-toggle';
    toggle.id = 'a11y-bar-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'a11y-controls');
    toggle.innerHTML = '<span aria-hidden="true">♿</span> Trợ năng: cỡ chữ, tương phản, đọc to';
    bar.appendChild(toggle);

    var label = document.createElement('div');
    label.className = 'a11y-bar-label';
    label.innerHTML = '<span aria-hidden="true">♿</span><span class="a11y-label-text">Trợ năng</span>';

    var controls = document.createElement('div');
    controls.className = 'a11y-controls';
    controls.id = 'a11y-controls';
    controls.appendChild(label);
    bar.appendChild(controls);

    // --- Nhom co chu ---
    var fontGroup = document.createElement('div');
    fontGroup.className = 'a11y-group';
    fontGroup.setAttribute('role', 'group');
    fontGroup.setAttribute('aria-label', 'Cỡ chữ');
    var fontLabel = document.createElement('span');
    fontLabel.className = 'a11y-group-label';
    fontLabel.textContent = 'Cỡ chữ:';
    fontGroup.appendChild(fontLabel);

    var fontOptions = [
      { level: 'normal', text: 'Vừa', size: '0.9rem' },
      { level: 'large', text: 'To', size: '1.05rem' },
      { level: 'xlarge', text: 'Rất to', size: '1.2rem' }
    ];
    fontOptions.forEach(function (opt) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'a11y-btn';
      b.style.fontSize = opt.size;
      b.textContent = 'A ' + opt.text;
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('title', 'Cỡ chữ ' + opt.text);
      b.addEventListener('click', function () {
        applyFont(opt.level);
        announce('Đã đổi cỡ chữ sang mức ' + opt.text);
      });
      btnRefs.font[opt.level] = b;
      fontGroup.appendChild(b);
    });
    controls.appendChild(fontGroup);

    controls.appendChild(makeSep());

    // --- Tuong phan cao ---
    var contrastBtn = document.createElement('button');
    contrastBtn.type = 'button';
    contrastBtn.className = 'a11y-btn';
    contrastBtn.innerHTML = '◐ Tương phản cao';
    contrastBtn.setAttribute('aria-pressed', 'false');
    contrastBtn.addEventListener('click', function () {
      var next = contrast === 'high' ? 'normal' : 'high';
      applyContrast(next);
      announce(next === 'high' ? 'Đã bật chế độ tương phản cao' : 'Đã tắt chế độ tương phản cao');
    });
    btnRefs.contrast = contrastBtn;
    controls.appendChild(contrastBtn);

    // --- Doc to ---
    if (speech.supported) {
      controls.appendChild(makeSep());
      var readBtn = document.createElement('button');
      readBtn.type = 'button';
      readBtn.className = 'a11y-btn';
      readBtn.innerHTML = '🔊 Đọc to trang này';
      readBtn.setAttribute('aria-pressed', 'false');
      readBtn.addEventListener('click', function () {
        if (speech.playing) { stopReading(); announce('Đã dừng đọc.'); }
        else { startReading(); announce('Bắt đầu đọc nội dung trang.'); }
      });
      btnRefs.read = readBtn;
      controls.appendChild(readBtn);
    }

    var spacer = document.createElement('div');
    spacer.className = 'a11y-spacer';
    controls.appendChild(spacer);

    // Vung thong bao cho trinh doc man hinh (khong hien thi bang mat)
    var live = document.createElement('div');
    live.id = 'a11y-live';
    live.setAttribute('aria-live', 'polite');
    live.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;';
    bar.appendChild(live);

    // Lien ket bo qua dieu huong (chi hien khi di chuyen bang phim Tab)
    var main = findMain();
    var skip = document.createElement('a');
    skip.className = 'skip-link';
    skip.textContent = 'Bỏ qua, tới nội dung chính';
    if (main) {
      if (!main.id) main.id = 'a11y-main-content';
      main.setAttribute('tabindex', '-1');
      skip.href = '#' + main.id;
    } else {
      skip.href = '#';
    }

    document.body.insertAdjacentElement('afterbegin', bar);
    document.body.insertAdjacentElement('afterbegin', skip);

    // Thu gon / mo rong theo be ngang man hinh. Dung thuoc tinh `hidden` de trinh doc man hinh
    // cung hieu dung trang thai, khong chi an bang CSS.
    var narrow = window.matchMedia('(max-width: 860px)');
    function applyBarMode() {
      if (narrow.matches) controls.hidden = toggle.getAttribute('aria-expanded') !== 'true';
      else { controls.hidden = false; toggle.setAttribute('aria-expanded', 'false'); }
    }
    toggle.addEventListener('click', function () {
      toggle.setAttribute('aria-expanded', toggle.getAttribute('aria-expanded') === 'true' ? 'false' : 'true');
      applyBarMode();
    });
    if (narrow.addEventListener) narrow.addEventListener('change', applyBarMode);
    else narrow.addListener(applyBarMode);
    applyBarMode();

    syncButtons();
  }

  function makeSep() {
    var s = document.createElement('div');
    s.className = 'a11y-sep';
    s.setAttribute('aria-hidden', 'true');
    return s;
  }

  // header.js chen header vao dau <body> trong luc phan tich trang; thanh tro nang duoc chen
  // sau do (o DOMContentLoaded) nen luon nam TREN header - dung thu tu doc man hinh.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildBar);
  else buildBar();

  window.A11y = {
    setFontLevel: applyFont,
    setContrast: applyContrast,
    startReading: startReading,
    stopReading: stopReading,
    get fontLevel() { return fontLevel; },
    get contrast() { return contrast; }
  };
})();
