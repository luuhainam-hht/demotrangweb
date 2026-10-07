const WebSocket = require('ws');
const pgBus = require('../realtime/pgBus');

// WebSocket Hub dung chung 1 port voi HTTP server (theo yeu cau cau hinh WEBSOCKET_PORT tich hop).
// Broadcast cac su kien realtime toi tat ca module: Kiosk, Counter, Display/TTS, Admin.
let wss = null;

const EVENTS = {
  TICKET_CREATED: 'TICKET_CREATED',
  CALL_NEXT: 'CALL_NEXT',
  TIMEOUT_NO_SHOW: 'TIMEOUT_NO_SHOW',
  TICKET_PROCESSING: 'TICKET_PROCESSING',
  TICKET_SUPP_PENDING: 'TICKET_SUPP_PENDING',
  TICKET_COMPLETED: 'TICKET_COMPLETED',
  TICKET_CANCELLED: 'TICKET_CANCELLED',
  COUNTER_STATUS_CHANGED: 'COUNTER_STATUS_CHANGED',
  QUEUE_REBALANCED: 'QUEUE_REBALANCED',
  TICKET_REENTRY: 'TICKET_REENTRY',
  PRIORITY_INJECTED: 'PRIORITY_INJECTED',
  CONFIG_UPDATED: 'CONFIG_UPDATED',
  EOD_PURGE: 'EOD_PURGE',
  DEVICE_HEALTH_CHANGED: 'DEVICE_HEALTH_CHANGED',
  FEEDBACK_RECEIVED: 'FEEDBACK_RECEIVED'
};

// Ham xu ly bo sung khi nhan su kien tu BAN CHAY KHAC (VD nap lai cache cau hinh) - server.js
// dang ky qua onRemote(). Tach rieng de wsHub khong phu thuoc nguoc vao configService.
const remoteHooks = [];
function onRemote(fn) { remoteHooks.push(fn); }

function init(server) {
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.send(JSON.stringify({ type: 'HELLO', payload: { message: 'Ket noi WebSocket thanh cong' } }));
  });

  // Heartbeat: don dep ket noi chet moi 30s
  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  // Nhan su kien tu cac ban chay khac (Render <-> Docker...) qua Postgres LISTEN/NOTIFY va day
  // tiep cho trinh duyet dang noi vao ban nay. Xem src/realtime/pgBus.js.
  pgBus.start((type, payload) => {
    sendLocal(type, payload, true);
    remoteHooks.forEach((fn) => { try { fn(type, payload); } catch (e) { console.error('[wsHub] remote hook:', e.message); } });
  });

  return wss;
}

function sendLocal(type, payload, fromRemote = false) {
  if (!wss) return;
  const message = JSON.stringify({ type, payload, ts: new Date().toISOString(), remote: fromRemote || undefined });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  });
}

function broadcast(type, payload) {
  if (!wss) return; // chua init (unit test) -> no-op nhu truoc
  sendLocal(type, payload);
  pgBus.publish(type, payload);
}

function clientCount() { return wss ? wss.clients.size : 0; }

module.exports = { init, broadcast, onRemote, clientCount, EVENTS };
