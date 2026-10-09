// =====================================================================================
// Tich hop chatbot Mindtek (https://bot.mindtek.ai) song song voi Tro ly AI noi bo (chatbot.js).
// Tu dong duoc chatbot.js nap - KHONG can them the <script> nao vao tung trang.
//
// Cau hinh hoan toan trong Admin -> tab "Cau hinh Tham so" (khong sua code, khong deploy lai):
//   MINDTEK_BOT_ID : Bot ID tren bot.mindtek.ai (dan Bot ID hoac nguyen doan ma nhung)
//   CHATBOT_MODE   : internal | mindtek | both
//     - internal : chi Tro ly noi bo (nhu truoc day)
//     - mindtek  : an Tro ly noi bo, chi hien nut chat Mindtek
//     - both     : giu Tro ly noi bo (so lieu hang doi/Wi-Fi/DVC that) + thanh "Hoi Tro ly chuyen sau"
//                  trong khung chat de mo bot Mindtek (1 nut chat duy nhat, khong 2 bong bong chong nhau)
// Thieu Bot ID -> may chu tu tra mode 'internal' -> trang chay y nhu cu.
// Xem docs/CHATBOT-MINDTEK.md.
// =====================================================================================
(function () {
  if (window.__hccMindtekLoaded) return;
  window.__hccMindtekLoaded = true;

  const BRAND_COLOR = '#2563eb';

  function loadEmbed(cfg, hideButton) {
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = `${cfg.mindtekOrigin}/embed.js`;
      s.async = true;
      s.setAttribute('data-bot-id', cfg.mindtekBotId);
      s.setAttribute('data-position', 'bottom-right');
      s.setAttribute('data-theme', 'light');
      s.setAttribute('data-show-welcome', 'true');
      s.setAttribute('data-bubble-color', BRAND_COLOR);
      if (hideButton) s.setAttribute('data-hide-button', 'true');
      s.onload = () => resolve(!!window.myChat);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });
  }

  function openMindtek() {
    if (window.myChat && typeof window.myChat.open === 'function') window.myChat.open();
  }

  function closeInternalPanel() {
    const panel = document.getElementById('chatbotPanel');
    const closeBtn = document.getElementById('chatbotClose');
    if (panel && !panel.classList.contains('hidden') && closeBtn) closeBtn.click();
  }

  // Che do 'both': chen 1 thanh co dinh ngay duoi tieu de khung chat noi bo.
  function addSwitchBar() {
    const panel = document.getElementById('chatbotPanel');
    const header = panel && panel.querySelector('.chatbot-panel-header');
    if (!header || document.getElementById('mindtekSwitch')) return;
    const bar = document.createElement('button');
    bar.type = 'button';
    bar.id = 'mindtekSwitch';
    bar.className = 'mindtek-switch';
    bar.innerHTML = '<span class="mindtek-switch-icon">✨</span><span>Hỏi Trợ lý AI chuyên sâu</span><span class="mindtek-switch-arrow">→</span>';
    bar.addEventListener('click', () => { closeInternalPanel(); openMindtek(); });
    header.insertAdjacentElement('afterend', bar);
  }

  // Che do 'mindtek': an Tro ly noi bo, cac trang dang goi window.ChatbotWidget (VD Hoi dap) chuyen
  // sang mo bot Mindtek. Rieng link quet QR Bo sung ho so (?reentry=) VAN can Tro ly noi bo (goi API
  // hang doi that) nen giu lai widget noi bo tren trang do.
  function switchToMindtekOnly() {
    const hasReentry = new URLSearchParams(window.location.search).has('reentry');
    if (hasReentry) return false;
    document.body.classList.add('mindtek-only');
    window.ChatbotWidget = { open: openMindtek, ask: openMindtek };
    return true;
  }

  async function init() {
    let cfg;
    try {
      const res = await fetch('/api/chatbot/config', { cache: 'no-store' });
      if (!res.ok) return;
      cfg = await res.json();
    } catch (e) { return; } // mat mang -> giu nguyen Tro ly noi bo
    if (!cfg || !cfg.mindtekBotId || cfg.mode === 'internal') return;

    if (cfg.mode === 'mindtek') {
      const mindtekOnly = switchToMindtekOnly();
      const ok = await loadEmbed(cfg, false);
      // Mindtek khong tai duoc (bi chan mang/sai Bot ID) -> hien lai Tro ly noi bo, khong de trang trong.
      if (!ok && mindtekOnly) document.body.classList.remove('mindtek-only');
      return;
    }

    // mode 'both'
    const ok = await loadEmbed(cfg, true);
    if (ok) addSwitchBar();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
