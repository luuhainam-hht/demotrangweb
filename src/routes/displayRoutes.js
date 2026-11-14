const express = require('express');
const { pool } = require('../config/db');
const configService = require('../config/configService');

const router = express.Router();

// Bang hien thi LED: STT dang goi / dang xu ly tai tung quay
router.get('/counters', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT c.id AS counter_id, c.code, c.name, c.status,
      t.ticket_number, t.status AS ticket_status
    FROM active_counters c
    LEFT JOIN tickets t ON t.id = c.active_ticket_id
    ORDER BY c.code ASC
  `);
  res.json(rows);
});

// Cau hinh Loa PA / TTS (giong doc, toc do, am luong, khoang lang)
router.get('/tts-config', async (req, res) => {
  const cfg = await configService.getAll();
  res.json({
    voice: cfg.TTS_VOICE.config_value,
    speed: Number(cfg.TTS_SPEED.config_value),
    volume: Number(cfg.TTS_VOLUME.config_value),
    audioGapSeconds: Number(cfg.AUDIO_GAP_SECONDS.config_value)
  });
});

// -----------------------------------------------------------------------------------
// Giong doc TIENG VIET cho Loa PA (sua loi "doc tieng Anh" tren Bang LED).
// Nguyen nhan: Web Speech API dung giong cai san tren may. Chrome/Windows thuong KHONG co giong
// tieng Viet -> trinh duyet roi ve giong mac dinh tieng Anh, doc "Moi so A-101..." theo kieu Anh.
// Giai phap: may chu tong hop am thanh MP3 tieng Viet (Google Translate TTS, tl=vi) roi tra ve
// cung origin -> display.js phat bang <audio>, khong phu thuoc giong cai tren may.
// Cache trong RAM vi ban tin lap lai nhieu (cung so/quay goi lai khi khach vang mat).
// -----------------------------------------------------------------------------------
const TTS_MAX_CHARS = 200;          // gioi han cua dich vu TTS cho 1 lan goi
const TTS_CACHE_LIMIT = 200;        // so ban tin MP3 giu trong RAM
const ttsCache = new Map();

async function synthesizeVietnamese(text) {
  if (ttsCache.has(text)) {
    const buf = ttsCache.get(text);
    ttsCache.delete(text); ttsCache.set(text, buf); // LRU: day len cuoi
    return buf;
  }
  const url = 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=vi&q='
    + encodeURIComponent(text);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://translate.google.com/' }
    });
    if (!resp.ok) throw new Error(`TTS upstream ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length === 0) throw new Error('TTS upstream rong');
    ttsCache.set(text, buf);
    if (ttsCache.size > TTS_CACHE_LIMIT) ttsCache.delete(ttsCache.keys().next().value);
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

router.get('/tts', async (req, res) => {
  const text = String(req.query.text || '').replace(/\s+/g, ' ').trim();
  if (!text) return res.status(400).json({ error: 'Thieu noi dung can doc.' });
  if (text.length > TTS_MAX_CHARS) return res.status(400).json({ error: `Toi da ${TTS_MAX_CHARS} ky tu moi doan.` });
  try {
    const audio = await synthesizeVietnamese(text);
    res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' });
    return res.send(audio);
  } catch (err) {
    // 503: display.js tu chuyen sang giong tieng Viet cai tren may (neu co).
    return res.status(503).json({ error: 'Khong tong hop duoc giong doc tieng Viet.' });
  }
});

// Nang cap 10/2026: heartbeat thiet bi dau cuoi (Bang LED / Kiosk) - xem deviceService.js.
// Cong khai (man hinh treo tuong khong dang nhap) nhung rang buoc ma thiet bi + gioi han tan suat.
router.post('/heartbeat', async (req, res) => {
  try {
    const deviceService = require('../services/deviceService');
    res.json(await deviceService.heartbeat(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
