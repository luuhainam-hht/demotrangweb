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
  // "Moi" mot lan de vuot qua chinh sach autoplay cua trinh duyet
  const unlock = new SpeechSynthesisUtterance(' ');
  window.speechSynthesis.speak(unlock);
  processQueue();
}

function pickVietnameseVoice() {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('vi')) || null;
}

// Smart PA/TTS Dispatcher: phat lan luot qua hang doi am thanh don kenh (Audio FIFO),
// giu khoang lang audio_gap giua 2 ban tin de tranh chong lan.
function enqueueAnnouncement(text) {
  announcementQueue.push(text);
  processQueue();
}

function processQueue() {
  if (!audioEnabled || isSpeaking || announcementQueue.length === 0) return;
  const text = announcementQueue.shift();
  isSpeaking = true;

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'vi-VN';
  utter.rate = ttsConfig.speed || 1.0;
  utter.volume = ttsConfig.volume ? ttsConfig.volume / 100 : 0.85;
  const voice = pickVietnameseVoice();
  if (voice) utter.voice = voice;

  utter.onend = () => {
    isSpeaking = false;
    setTimeout(processQueue, (ttsConfig.audioGapSeconds || 1.5) * 1000);
  };
  utter.onerror = () => { isSpeaking = false; setTimeout(processQueue, 500); };

  window.speechSynthesis.speak(utter);
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

function renderBoard(counters) {
  const grid = document.getElementById('ledGrid');
  grid.innerHTML = counters.map((c) => {
    const calling = c.ticket_status === 'CALLING';
    const label = c.ticket_number
      ? `${c.ticket_number}`
      : (c.status === 'OPEN' ? '— sẵn sàng —' : c.status === 'PAUSED' ? 'TẠM DỪNG' : 'ĐÓNG QUẦY');
    // So thu tu ("A-105") rat ngan nen de duoc co chu cuc dai cho de doc tu xa; con cac trang
    // thai bang CHU ("ĐÓNG QUẦY", "— sẵn sàng —") dai gap doi, de nguyen co do thi tran ra ngoai
    // the va bi cat mat o man hinh rong. Danh dau bang class rieng de CSS ha co chu xuong.
    const isText = !c.ticket_number;
    return `
      <div class="led-card ${calling ? 'calling' : ''}">
        <div class="counter-name">${c.name}</div>
        <div class="ticket-num${isText ? ' ticket-num-text' : ''}">${label}</div>
        <div class="status-line">${c.ticket_status ? (c.ticket_status === 'CALLING' ? 'Đang gọi' : c.ticket_status === 'PROCESSING' ? 'Đang phục vụ' : '') : ''}</div>
      </div>`;
  }).join('');
}

if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = () => {};

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
