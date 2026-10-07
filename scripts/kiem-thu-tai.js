#!/usr/bin/env node
// =====================================================================================
// KIEM THU TAI (han che "Chua kiem thu tai" - muc 6.17 bao cao). Khong can cai them thu vien.
//
//   node scripts/kiem-thu-tai.js                                   -> http://localhost:3000, 50 ket noi, 20 giay
//   node scripts/kiem-thu-tai.js --url http://localhost:3000 --c 100 --d 30 --ws 200
//   node scripts/kiem-thu-tai.js --tickets 50     -> tao them 50 ve that (CHI dung tren CSDL thu nghiem!)
//
// Mo phong dong thoi: cong dan tra cuu thu tuc / giay to / hoi dap / theo doi ve tren dien thoai
// (cac API cong khai, chi doc) + N man hinh giu ket noi WebSocket (Bang LED, quay, Dashboard).
// Ket qua: so yeu cau/giay, do tre p50/p95/p99, ty le loi. Luu y rate-limit lay so (30 ve/10 phut/IP).
// =====================================================================================
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const BASE = String(opt('--url', 'http://localhost:3000')).replace(/\/$/, '');
const CONC = Number(opt('--c', 50));
const DURATION = Number(opt('--d', 20));
const WS_COUNT = Number(opt('--ws', 0));
const TICKETS = Number(opt('--tickets', 0));

function pct(sorted, p) { return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0; }

async function main() {
  const health = await fetch(`${BASE}/api/health`).then((r) => r.ok).catch(() => false);
  if (!health) { console.error(`Khong ket noi duoc ${BASE}/api/health - server da chay chua?`); process.exit(1); }

  const services = await fetch(`${BASE}/api/kiosk/services`).then((r) => r.json());
  const ids = services.map((s) => s.id);
  const pickId = () => ids[Math.floor(Math.random() * ids.length)];
  const scenarios = [
    () => '/api/kiosk/services',
    () => `/api/kiosk/services/${pickId()}/checklist`,
    () => `/api/kiosk/services/${pickId()}/form-guide`,
    () => '/api/kiosk/faq',
    () => `/api/kiosk/faq/search?q=${encodeURIComponent(['khai sinh', 'so do', 'ho kinh doanh', 'uy quyen'][Math.floor(Math.random() * 4)])}`,
    () => '/api/kiosk/hours',
    () => '/api/kiosk/counters/status',
    () => '/api/display/counters',
    () => '/index.html'
  ];

  // WebSocket: mo phong man hinh dang mo (Bang LED/quay/Dashboard).
  const sockets = [];
  if (WS_COUNT > 0) {
    let WebSocket;
    try { WebSocket = require('ws'); } catch (e) { console.error('Thieu thu vien ws (npm install).'); process.exit(1); }
    const wsUrl = BASE.replace(/^http/, 'ws');
    await Promise.all(Array.from({ length: WS_COUNT }, () => new Promise((resolve) => {
      const s = new WebSocket(wsUrl); sockets.push(s);
      s.on('open', resolve); s.on('error', resolve);
    })));
    console.log(`Da mo ${sockets.filter((s) => s.readyState === 1).length}/${WS_COUNT} ket noi WebSocket.`);
  }

  if (TICKETS > 0) {
    console.log(`Tao ${TICKETS} ve that...`);
    let ok = 0;
    for (let i = 0; i < TICKETS; i += 1) {
      const id = pickId();
      const cl = await fetch(`${BASE}/api/kiosk/services/${id}/checklist`).then((r) => r.json());
      const r = await fetch(`${BASE}/api/kiosk/tickets`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: id, confirmedDocCodes: (cl.requiredDocs || []).map((d) => d.code) })
      });
      if (r.status === 201) ok += 1;
    }
    console.log(`  -> ${ok}/${TICKETS} ve tao thanh cong (con lai do ngoai gio / rate-limit / khong co quay mo).`);
  }

  const latencies = [];
  let errors = 0;
  const statusCount = {};
  const until = Date.now() + DURATION * 1000;
  console.log(`Kiem thu tai ${BASE}: ${CONC} ket noi dong thoi trong ${DURATION} giay...`);
  const worker = async () => {
    while (Date.now() < until) {
      const path = scenarios[Math.floor(Math.random() * scenarios.length)]();
      const t0 = performance.now();
      try {
        const r = await fetch(BASE + path);
        await r.arrayBuffer();
        statusCount[r.status] = (statusCount[r.status] || 0) + 1;
        if (r.status >= 500) errors += 1;
      } catch (e) { errors += 1; statusCount.ERR = (statusCount.ERR || 0) + 1; }
      latencies.push(performance.now() - t0);
    }
  };
  const started = Date.now();
  await Promise.all(Array.from({ length: CONC }, worker));
  const secs = (Date.now() - started) / 1000;
  latencies.sort((a, b) => a - b);

  const wsAlive = sockets.filter((s) => s.readyState === 1).length;
  sockets.forEach((s) => s.terminate());
  const result = {
    url: BASE, concurrency: CONC, seconds: Number(secs.toFixed(1)), requests: latencies.length,
    rps: Number((latencies.length / secs).toFixed(1)),
    latencyMs: { p50: Number(pct(latencies, 50).toFixed(1)), p95: Number(pct(latencies, 95).toFixed(1)), p99: Number(pct(latencies, 99).toFixed(1)), max: Number((latencies[latencies.length - 1] || 0).toFixed(1)) },
    errorRatePercent: Number(((errors / Math.max(1, latencies.length)) * 100).toFixed(2)),
    status: statusCount,
    websocket: WS_COUNT ? { opened: WS_COUNT, aliveAtEnd: wsAlive } : undefined
  };
  console.log(JSON.stringify(result, null, 2));
  if (result.errorRatePercent > 1) process.exitCode = 2;
}

main().catch((err) => { console.error(err); process.exit(1); });
