function renderCategoryCards(services, opts) {
  opts = opts || {};
  const grid = document.getElementById('categoryGrid');
  if (!services.length) {
    grid.innerHTML = `<div class="empty-search" style="grid-column: 1 / -1;">Không tìm thấy thủ tục phù hợp. Vui lòng thử từ khóa khác hoặc hỏi Trợ lý AI.</div>`;
    return;
  }
  grid.innerHTML = services.map((s) => {
    // fee_label: chu ngan do src/data/serviceFees.js ghi vao CSDL (VD thu tuc dat dai "Theo giá đất").
    const fee = s.fee_label || (Number(s.fee_amount) > 0 ? Number(s.fee_amount).toLocaleString('vi-VN') + ' đ' : 'Miễn phí');
    return `
    <a href="kiosk-checklist.html?serviceId=${encodeURIComponent(s.id)}" class="card-link category-card svc-card">
      <div class="card">
        <span class="svc-field">${escHtml(s.field_name)}</span>
        <h3>${escHtml(s.name)}</h3>
        <div class="svc-facts">
          <span>⏱ Tiếp nhận ~${Number(s.sla_minutes) || '-'} phút</span>
          <span class="svc-fee">${escHtml(fee)}</span>
        </div>
        <div class="meta">Xem giấy tờ cần chuẩn bị →</div>
      </div>
    </a>`;
  }).join('');

  if (opts.title) {
    document.getElementById('categoryEyebrow').textContent = 'Kết quả tra cứu';
    document.getElementById('categoryTitle').textContent = opts.title;
    document.getElementById('categorySub').textContent = `Tìm thấy ${services.length} thủ tục phù hợp.`;
  }
}

function renderCategorySkeleton() {
  document.getElementById('categoryGrid').innerHTML = Array.from({ length: 8 })
    .map(() => '<div class="skeleton-card" style="height:170px;"></div>').join('');
}

async function loadPopularServices() {
  renderCategorySkeleton();
  try {
    const services = await fetch('/api/kiosk/services').then((r) => r.json());
    renderCategoryCards(services.slice(0, 8));
    document.getElementById('statServices').textContent = services.length;
  } catch (e) { /* bo qua, giu placeholder */ }
}

async function performSearch(keyword) {
  renderCategorySkeleton();
  try {
    const services = await fetch(`/api/kiosk/services?q=${encodeURIComponent(keyword)}`).then((r) => r.json());
    renderCategoryCards(services, { title: `Kết quả cho "${keyword}"` });
    document.getElementById('categoryGrid').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) { /* bo qua */ }
}

document.getElementById('searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const keyword = document.getElementById('searchInput').value.trim();
  if (keyword) performSearch(keyword); else loadPopularServices();
});

// Nut "Tim nhanh" duoi o tim kiem: dien san tu khoa roi tra cuu luon (nguoi lon tuoi khoi phai go).
document.querySelectorAll('#heroQuick [data-q]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.getElementById('searchInput').value = btn.dataset.q;
    performSearch(btn.dataset.q);
  });
});

SearchSuggest.attach(document.getElementById('searchInput'), document.getElementById('searchForm'), {
  onSelect: (service) => { window.location.href = `kiosk-checklist.html?serviceId=${service.id}`; }
});

fetch('/api/kiosk/counters/status')
  .then((r) => r.json())
  .then((counters) => {
    const open = counters.filter((c) => c.status === 'OPEN').length;
    const waiting = counters.reduce((sum, c) => sum + Number(c.waiting_count || 0), 0);
    document.getElementById('statOpenCounters').textContent = open;
    document.getElementById('statWaiting').textContent = waiting;
  })
  .catch(() => {});

// ---- Khoi "Thac mac thuong gap" tren Trang chu ----
// Lay 6 cau hoi tieu bieu, moi chu de 1-2 cau, tu chinh kho tri thuc (/api/kiosk/faq) de khong
// phai chep lai noi dung cau hoi o frontend - sua trong src/data/faqKnowledge.js la trang chu doi theo.
const FAQ_HIGHLIGHT_IDS = ['HT-02', 'HT-04', 'TT-01', 'HTI-01', 'DD-01', 'HO-04'];

function escHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function loadFaqHighlights() {
  const row = document.getElementById('faqQuickRow');
  if (!row) return;
  row.innerHTML = Array.from({ length: 6 })
    .map(() => '<div class="skeleton-card" style="height:64px;"></div>').join('');
  try {
    const data = await fetch('/api/kiosk/faq').then((r) => r.json());
    const all = (data.topics || []).reduce((acc, t) => acc.concat(t.faqs), []);
    const byId = {};
    all.forEach((f) => { byId[f.id] = f; });
    const picked = FAQ_HIGHLIGHT_IDS.map((id) => byId[id]).filter(Boolean);
    const list = picked.length ? picked : all.slice(0, 6);
    row.innerHTML = list.map((f) => `
      <a class="faq-quick" href="hoi-dap.html#faq-${escHtml(f.id)}">
        <span class="q-ico" aria-hidden="true">?</span>
        <span>${escHtml(f.q)}</span>
      </a>`).join('');
  } catch (e) {
    // Khong tai duoc thi an han khoi nay di, khong de lai khung xam trong tren Trang chu.
    row.innerHTML = '';
  }
}

loadPopularServices();
loadFaqHighlights();
