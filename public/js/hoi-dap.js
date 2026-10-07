// Trang Hoi dap (hoi-dap.html): ngan hang cau hoi thuong gap, nhom theo chu de, co o tim kiem.
// Du lieu lay tu GET /api/kiosk/faq (nguon goc: src/data/faqKnowledge.js) - KHONG chep lai noi
// dung o frontend de tranh 2 ban lech nhau.
//
// CSP (src/server.js) chan onclick= inline -> moi su kien gan bang addEventListener, hoac qua
// data-action + js/actionDelegate.js voi cac nut render dong.
(function () {
  const listEl = document.getElementById('faqList');
  const topicRow = document.getElementById('topicRow');
  const countEl = document.getElementById('faqResultCount');
  const form = document.getElementById('faqSearchForm');
  const input = document.getElementById('faqSearchInput');

  let topics = [];
  let activeTopic = 'ALL';

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function linkLabel(href) {
    switch (href) {
      case 'huong-dan-dien-mau.html': return 'Xem hướng dẫn điền giấy tờ';
      case 'nop-ho-so-truc-tuyen.html': return 'Xem hướng dẫn nộp hồ sơ online';
      case 'ket-noi-wifi.html': return 'Xem hướng dẫn Wi-Fi chữ to';
      case 'theo-doi.html': return 'Mở trang theo dõi số thứ tự';
      case 'index.html': return 'Về Trang chủ để tra cứu thủ tục';
      default: return 'Xem thêm';
    }
  }

  // 1 cau hoi + cau tra loi. `open` dung cho ket qua tim kiem (mo san de nguoi dung khong phai
  // bam them 1 lan nua moi doc duoc).
  function renderQa(faq, open) {
    const details = (faq.details || []).map((d) => `<li>${esc(d)}</li>`).join('');
    const sources = (faq.sources || []).map((s) =>
      `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a></li>`).join('');
    return `
      <details class="qa"${open ? ' open' : ''} id="faq-${esc(faq.id)}">
        <summary>${esc(faq.q)}</summary>
        <div class="qa-body">
          <p class="qa-short">${esc(faq.short)}</p>
          ${details ? `<ul class="qa-details">${details}</ul>` : ''}
          ${faq.note ? `<div class="qa-note"><b>Lưu ý:</b> ${esc(faq.note)}</div>` : ''}
          ${faq.link ? `<a class="btn btn-outline qa-link" href="${esc(faq.link)}">${esc(linkLabel(faq.link))}</a>` : ''}
          <div class="qa-meta">
            <span class="badge-status ${esc(faq.status)}">${esc(faq.statusLabel || faq.status)}</span>
            ${sources ? `<ul class="qa-sources">${sources}</ul>`
    : '<p class="text-muted" style="margin:8px 0 0;">Căn cứ: quy định vận hành của chính hệ thống này.</p>'}
          </div>
        </div>
      </details>`;
  }

  function renderTopics() {
    const all = [{ id: 'ALL', icon: '', name: 'Tất cả' }].concat(topics);
    topicRow.innerHTML = all.map((t) =>
      `<button type="button" class="topic-chip" data-topic="${esc(t.id)}" aria-pressed="${t.id === activeTopic}">
         <span aria-hidden="true">${esc(t.icon)}</span> ${esc(t.name)}
       </button>`).join('');
    topicRow.querySelectorAll('.topic-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTopic = btn.dataset.topic;
        input.value = '';
        renderAll();
        const block = document.getElementById('topic-' + activeTopic);
        if (block) block.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function renderAll() {
    countEl.classList.add('hidden');
    const shown = activeTopic === 'ALL' ? topics : topics.filter((t) => t.id === activeTopic);
    listEl.innerHTML = shown.map((t) => `
      <section class="topic-block" id="topic-${esc(t.id)}">
        <div class="topic-head">
          <span class="ico" aria-hidden="true">${esc(t.icon)}</span>
          <div>
            <h2>${esc(t.name)}</h2>
            <p>${esc(t.desc)} — ${t.faqs.length} câu hỏi</p>
          </div>
        </div>
        ${t.faqs.map((f) => renderQa(f, false)).join('')}
      </section>`).join('');
    topicRow.querySelectorAll('.topic-chip').forEach((b) => {
      b.setAttribute('aria-pressed', b.dataset.topic === activeTopic ? 'true' : 'false');
    });
  }

  function allFaqs() {
    return topics.reduce((acc, t) => acc.concat(t.faqs.map((f) => ({ ...f, topicName: t.name }))), []);
  }

  async function runSearch(keyword) {
    const kw = String(keyword || '').trim();
    if (!kw) { renderAll(); return; }
    let ids = [];
    try {
      const data = await ApiClient.get('/api/kiosk/faq/search?q=' + encodeURIComponent(kw));
      ids = (data.results || []).map((r) => r.id);
    } catch (err) {
      // Mat mang / server ngu day: van tim duoc trong du lieu da tai ve, khong de trang trong tron.
      const needle = kw.toLowerCase();
      ids = allFaqs().filter((f) => (f.q + ' ' + f.short).toLowerCase().includes(needle)).map((f) => f.id);
    }
    const byId = {};
    allFaqs().forEach((f) => { byId[f.id] = f; });
    const found = ids.map((id) => byId[id]).filter(Boolean);

    countEl.classList.remove('hidden');
    if (found.length === 0) {
      countEl.textContent = 'Không tìm thấy câu hỏi nào khớp với "' + kw + '".';
      listEl.innerHTML = `
        <div class="card faq-empty">
          <p class="big-text">Chưa có câu hỏi sẵn nào khớp với điều bạn tìm.</p>
          <p class="text-muted">Bạn thử gõ ngắn hơn (VD chỉ gõ "sang tên" hoặc "khai sinh"),
             hoặc hỏi thẳng Trợ lý AI bằng lời của bạn.</p>
          <button type="button" class="btn btn-primary btn-lg mt-16" data-action="faqAskAssistant">Hỏi Trợ lý AI</button>
        </div>`;
      return;
    }
    countEl.textContent = 'Tìm thấy ' + found.length + ' câu hỏi phù hợp.';
    listEl.innerHTML = '<section class="topic-block">'
      + found.map((f) => renderQa(f, found.length <= 3)).join('')
      + '</section>';
  }

  // Nut "Hoi Tro ly AI": chuyen thang cau vua go sang khung chat de nguoi dan khong phai go lai.
  window.faqAskAssistant = function faqAskAssistant() {
    const kw = (input.value || '').trim();
    if (!window.ChatbotWidget) return;
    if (kw) window.ChatbotWidget.ask(kw);
    else window.ChatbotWidget.open();
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    runSearch(input.value);
  });
  // Xoa het chu trong o tim kiem thi quay ve danh sach day du.
  input.addEventListener('input', () => { if (!input.value.trim()) renderAll(); });

  (async function init() {
    listEl.innerHTML = '<div class="card skeleton-card" style="height:160px;"></div>';
    try {
      const data = await ApiClient.get('/api/kiosk/faq');
      topics = data.topics || [];
      const accessed = document.getElementById('faqAccessed');
      if (accessed && data.accessed) {
        accessed.textContent = 'Nội dung được đối chiếu nguồn ngày ' + data.accessed
          + '. Cán bộ Trung tâm nên rà soát lại định kỳ vì quy định có thể thay đổi.';
      }
      renderTopics();

      // Cho phep mo thang 1 cau hoi qua duong dan hoi-dap.html?q=... hoac #faq-HT-04
      const params = new URLSearchParams(window.location.search);
      const q = params.get('q');
      if (q) { input.value = q; await runSearch(q); }
      else {
        renderAll();
        if (window.location.hash.startsWith('#faq-')) {
          const target = document.getElementById(window.location.hash.slice(1));
          if (target) { target.open = true; target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        }
      }
    } catch (err) {
      listEl.innerHTML = '<div class="card faq-empty"><p class="big-text">Không tải được danh sách câu hỏi.</p>'
        + '<p class="text-muted">Vui lòng tải lại trang, hoặc hỏi trực tiếp cán bộ hỗ trợ tại Trung tâm.</p></div>';
    }
  })();
})();
