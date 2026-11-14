let ttsConfig = { voice: 'vi-VN', speed: 1.0, volume: 0.85, audioGapSeconds: 1.5 };
let audioEnabled = false;
const announcementQueue = [];
let isSpeaking = false;

document.getElementById('ledClock').textContent = new Date().toLocaleString('vi-VN');
setInterval(() => { document.getElementById('ledClock').textContent = new Date().toLocaleString('vi-VN'); }, 1000);

function enableAudio() {
  audioEnabled = true;
  document.getElementById('enableAudioBtn').style.display = 'none';
  if (window.DeviceHeartbeat) window.DeviceHeartbeat.setStatus('ONLINE');
  // "Mo khoa" am thanh trong luc nguoi dung vua bam nut (chinh sach autoplay cua trinh duyet):
  // ca the <audio> (giong doc may chu) lan Web Speech (giong du phong tren may).
  try { paAudio.muted = true; paAudio.play().catch(() => {}).finally(() => { paAudio.pause(); paAudio.muted = false; }); } catch (e) { /* bo qua */ }
  if (window.speechSynthesis) {
    try { window.speechSynthesis.speak(new SpeechSynthesisUtterance(' ')); } catch (e) { /* bo qua */ }
  }
  processQueue();
}

// -----------------------------------------------------------------------------------
// SUA LOI "DOC TIENG ANH": truoc day chi dung Web Speech API. Tren Chrome/Windows thuong khong
// co giong tieng Viet (hoac danh sach giong chua tai xong luc goi getVoices()) -> trinh duyet
// lang le dung giong tieng Anh mac dinh. Gio uu tien:
//   1) MP3 tieng Viet do may chu tong hop (/api/display/tts) - dong nhat tren moi may;
//   2) giong tieng Viet cai tren may (vd Microsoft An / HoaiMy) neu may chu loi;
//   3) KHONG BAO GIO doc bang giong tieng Anh - thieu ca 2 thi bao DEGRADED cho can bo biet.
// -----------------------------------------------------------------------------------
const paAudio = new Audio();
paAudio.preload = 'auto';

// File WAV rong (im lang) dung cho lan mo khoa dau tien.
paAudio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

function normalizeVolume(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0.85;
  return n > 1 ? Math.min(n / 100, 1) : n; // cau hinh luu 0-100 hoac 0-1
}

// "A-105" -> "A 105": tranh doc dau gach ngang thanh "trừ"/"gạch".
function toSpeechText(text) {
  return String(text).replace(/([A-Za-z])\s*-\s*(\d)/g, '$1 $2');
}

// Dich vu TTS gioi han ~200 ky tu/lan: cat theo dau phay/cham de doc tu nhien.
function splitChunks(text, max = 180) {
  const parts = text.split(/(?<=[,.;:!?])\s+/);
  const chunks = [];
  let cur = '';
  parts.forEach((p) => {
    if ((cur + ' ' + p).trim().length > max && cur) { chunks.push(cur.trim()); cur = p; } else { cur = `${cur} ${p}`; }
  });
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.flatMap((c) => (c.length <= max ? [c] : c.match(new RegExp(`.{1,${max}}(\\s|$)`, 'g')).map((x) => x.trim())));
}

function playServerChunk(chunk) {
  return new Promise((resolve, reject) => {
    paAudio.onended = () => resolve();
    paAudio.onerror = () => reject(new Error('server-tts'));
    paAudio.src = `/api/display/tts?text=${encodeURIComponent(chunk)}`;
    paAudio.playbackRate = ttsConfig.speed || 1.0;
    paAudio.volume = normalizeVolume(ttsConfig.volume);
    const p = paAudio.play();
    if (p && p.catch) p.catch(reject);
  });
}

async function speakViaServer(text) {
  for (const chunk of splitChunks(text)) {
    await playServerChunk(chunk); // eslint-disable-line no-await-in-loop
  }
}

// getVoices() tra mang rong o lan goi dau tren Chrome - phai cho su kien voiceschanged.
function loadVoices(timeoutMs = 2000) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) return resolve([]);
    const now = window.speechSynthesis.getVoices();
    if (now.length) return resolve(now);
    const done = () => resolve(window.speechSynthesis.getVoices());
    window.speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, timeoutMs);
  });
}

async function pickVietnameseVoice() {
  const voices = await loadVoices();
  const vi = voices.filter((v) => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('vi'));
  // Uu tien giong "Natural/Online" (Edge) nghe tu nhien hon giong offline.
  return vi.find((v) => /natural|online/i.test(v.name)) || vi[0] || null;
}

async function speakViaBrowser(text) {
  const voice = await pickVietnameseVoice();
  if (!voice) throw new Error('no-vi-voice'); // KHONG roi ve giong tieng Anh
  return new Promise((resolve, reject) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.voice = voice;
    utter.lang = voice.lang;
    utter.rate = ttsConfig.speed || 1.0;
    utter.volume = normalizeVolume(ttsConfig.volume);
    utter.onend = () => resolve();
    utter.onerror = (e) => reject(e.error || e);
    window.speechSynthesis.speak(utter);
  });
}

async function speakVietnamese(rawText) {
  const text = toSpeechText(rawText);
  try {
    await speakViaServer(text);
    return;
  } catch (e) {
    console.warn('[PA] Giong doc may chu loi, chuyen sang giong tieng Viet tren may:', e && e.message);
  }
  try {
    await speakViaBrowser(text);
  } catch (e) {
    console.error('[PA] Khong co giong tieng Viet nao kha dung - bo qua ban tin (khong doc bang tieng Anh).', e);
    if (window.DeviceHeartbeat) window.DeviceHeartbeat.setStatus('DEGRADED');
  }
}

// Smart PA/TTS Dispatcher: phat lan luot qua hang doi am thanh don kenh (Audio FIFO),
// giu khoang lang audio_gap giua 2 ban tin de tranh chong lan.
function enqueueAnnouncement(text) {
  announcementQueue.push(text);
  processQueue();
}

async function processQueue() {
  if (!audioEnabled || isSpeaking || announcementQueue.length === 0) return;
  const text = announcementQueue.shift();
  isSpeaking = true;
  try {
    await speakVietnamese(text);
  } finally {
    isSpeaking = false;
    setTimeout(processQueue, (ttsConfig.audioGapSeconds || 1.5) * 1000);
  }
}

async function loadTtsConfig() {
  try { ttsConfig = await ApiClient.get('/api/display/tts-config'); } catch (e) { /* dung mac dinh */ }
}

async function refreshBoard() {
  try {
    const counters = await ApiClient.get('/api/display/counters');
    renderBoard(counters);
  } catch (err) { console.error(err); }
}

const STATE_LABEL = {
  BUSY: 'Đang thực hiện tại quầy', IDLE: 'Đang trống', AWAY: 'Người ở quầy đi vắng', BREAK: 'Giờ nghỉ'
};
function escHtml(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// May chu cu (chua co board_state) -> tu suy ra theo cung quy tac voi src/services/boardState.js.
function fallbackState(c) {
  if (c.ticket_number && (c.ticket_status === 'CALLING' || c.ticket_status === 'PROCESSING')) return 'BUSY';
  if (c.status === 'PAUSED') return 'AWAY';
  if (c.status === 'CLOSED') return 'BREAK';
  return 'IDLE';
}

function renderBoard(counters) {
  const grid = document.getElementById('ledGrid');
  grid.innerHTML = counters.map((c) => {
    const state = c.board_state || fallbackState(c);
    const calling = c.ticket_status === 'CALLING';
    const busy = state === 'BUSY';
    // So thu tu ("A-105") rat ngan nen de co chu cuc dai; cac trang thai bang CHU dai hon nhieu nen
    // dung class rieng de ha co chu (tranh tran ra ngoai the).
    const big = busy ? c.ticket_number
      : state === 'IDLE' ? 'SẴN SÀNG' : state === 'AWAY' ? 'TẠM VẮNG' : 'NGHỈ';
    const sub = c.board_text || (busy ? (calling ? 'Đang gọi số' : 'Đang phục vụ') : '');
    return `
      <div class="led-card st-${state}${calling ? ' calling' : ''}">
        <div class="state-band">${STATE_LABEL[state]}</div>
        <div class="counter-name">${escHtml(c.name)}</div>
        <div class="ticket-num${busy ? '' : ' ticket-num-text'}">${escHtml(big)}</div>
        <div class="status-line">${escHtml(sub)}</div>
      </div>`;
  }).join('');
}

if (window.speechSynthesis) loadVoices(); // nap san danh sach giong du phong

// Bang LED dang chay nhung loa PA chua bat (chua ai bam nut) -> bao DEGRADED len Dashboard de
// can bo dieu phoi biet ma ra bat, thay vi phat hien khi cong dan phan nan khong nghe goi so.
if (window.DeviceHeartbeat && !audioEnabled) window.DeviceHeartbeat.setStatus('DEGRADED');

loadTtsConfig();
refreshBoard();
setInterval(refreshBoard, 15000); // du phong neu mat ket noi WebSocket tam thoi

const ws = createWsClient();
ws.on('CALL_NEXT', (payload) => {
  refreshBoard();
  if (payload && payload.announcement) enqueueAnnouncement(payload.announcement);
});
ws.on('*', () => refreshBoard());
