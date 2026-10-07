// Kiem tra kho tri thuc Hoi - Dap (src/data/faqKnowledge.js) - noi dung nay duoc dung o CA 3 noi:
// trang hoi-dap.html, chatbot rule-based va du lieu can cu cua AI, nen mot loi noi dung se lan ra
// khap he thong.
//
// Nguyen tac quan trong nhat duoc chan o day: KHONG duoc danh dau la "da doi chieu nguon"
// (VERIFIED/PARTIAL) neu khong thuc su co nguon - vi day la thong tin phap ly, nguoi dan doc xong
// se di lam theo. Thieu nguon thi phai la UNVERIFIED va noi thang la chua xac thuc.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const faq = require('../src/data/faqKnowledge');

const STATUSES = ['SYSTEM', 'VERIFIED', 'PARTIAL', 'UNVERIFIED'];

test('faqKnowledge: moi nguon co URL https hop le, tieu de va ngay doc', () => {
  const keys = Object.keys(faq.SOURCES);
  assert.ok(keys.length > 0, 'phai co it nhat 1 nguon');
  for (const key of keys) {
    const s = faq.SOURCES[key];
    assert.match(s.url, /^https:\/\//, `${key}: URL phai la https`);
    assert.ok(s.title && s.title.length > 10, `${key}: thieu tieu de nguon`);
    assert.ok(s.accessed, `${key}: thieu ngay doc nguon`);
  }
});

test('faqKnowledge: moi cau hoi co ma duy nhat, thuoc mot chu de co that', () => {
  const seen = new Set();
  const topicIds = faq.TOPICS.map((t) => t.id);
  for (const f of faq.FAQS) {
    assert.ok(!seen.has(f.id), `trung ma cau hoi: ${f.id}`);
    seen.add(f.id);
    assert.ok(topicIds.includes(f.topic), `${f.id}: chu de "${f.topic}" khong ton tai`);
    assert.ok(f.q && f.q.length > 8, `${f.id}: thieu noi dung cau hoi`);
    assert.ok(f.short && f.short.length > 10, `${f.id}: thieu cau tra loi ngan`);
  }
});

test('faqKnowledge: khong duoc ghi "da doi chieu nguon" neu khong co nguon', () => {
  for (const f of faq.FAQS) {
    assert.ok(STATUSES.includes(f.status), `${f.id}: muc xac thuc khong hop le`);
    for (const k of f.sources || []) {
      assert.ok(faq.SOURCES[k], `${f.id}: nguon ${k} khong co trong SOURCES`);
    }
    if (f.status === 'VERIFIED' || f.status === 'PARTIAL') {
      assert.ok((f.sources || []).length > 0, `${f.id}: danh dau ${f.status} nhung khong dan nguon nao`);
    }
    if (f.status === 'PARTIAL') {
      assert.ok(f.note, `${f.id}: PARTIAL phai ghi ro phan nao chua chac (truong note)`);
    }
  }
});

test('faqKnowledge: cau tra loi chua xac thuc PHAI noi ro voi nguoi dan', () => {
  const unverified = faq.FAQS.filter((f) => f.status === 'UNVERIFIED');
  assert.ok(unverified.length > 0, 'ky vong con mot so noi dung chua doi chieu duoc');
  for (const f of unverified) {
    const text = faq.faqToChatText(f);
    assert.match(text, /CHƯA XÁC THỰC/, `${f.id}: khong canh bao chua xac thuc trong cau tra loi`);
  }
});

test('faqKnowledge: tim dung cau hoi ke ca khi go khong dau, sai chinh ta', () => {
  const cases = [
    ['mat phieu so thu tu', 'HT-04'],
    ['sang ten so do bao lau', 'DD-01'],
    ['le phi khai sinh', 'HTI-06'],
    ['nop ho so o dau', 'TT-01'],
    ['uy quyen cho con di lam thay', 'GT-02'],
    ['CHỮ NHỎ QUÁ tôi nhìn không rõ', 'HO-03']
  ];
  for (const [q, expectedId] of cases) {
    const found = faq.bestFaq(q);
    assert.ok(found, `khong tim thay cau tra loi cho: ${q}`);
    assert.equal(found.id, expectedId, `cau "${q}" khop nham sang ${found.id}`);
  }
});

test('faqKnowledge: KHONG tra loi bua cho cau hoi ngoai pham vi', () => {
  // Tung co loi that: khop chuoi con lam "ong" trong "Ong troi" khop voi "khong" -> tra loi lac de.
  for (const q of ['Ông trời hôm nay có nắng không nhỉ?', 'ket qua bong da toi qua', 'ban ten gi']) {
    assert.equal(faq.bestFaq(q), null, `khong duoc tra loi cau ngoai pham vi: ${q}`);
  }
});

test('faqKnowledge: moi thu tuc trong seed CSDL deu co thong tin mo rong', () => {
  // Doc thang ma thu tuc tu db/schema.sql de khi ai do them thu tuc moi ma quen bo sung phan
  // "nop o dau / bao lau / nop online / can cu phap ly" thi test nay bao ngay.
  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  const block = schema.slice(schema.indexOf('INSERT INTO services'));
  const codes = [...block.slice(0, block.indexOf('ON CONFLICT')).matchAll(/'([A-Z_]+)',\s+'/g)].map((m) => m[1]);
  assert.ok(codes.length >= 10, 'khong doc duoc danh sach ma thu tuc tu schema.sql');
  for (const code of codes) {
    const extra = faq.getServiceExtra(code);
    assert.ok(extra, `thu tuc ${code} chua co thong tin mo rong trong SERVICE_EXTRA`);
    assert.ok(extra.where && extra.slaNote && extra.online && extra.legal, `thu tuc ${code} thieu truong bat buoc`);
    assert.ok(STATUSES.includes(extra.status), `thu tuc ${code}: muc xac thuc khong hop le`);
    for (const id of extra.faqIds || []) {
      assert.ok(faq.findFaqById(id), `thu tuc ${code} tro toi cau hoi khong ton tai: ${id}`);
    }
  }
});

test('faqKnowledge: du lieu cho trang cong khai co day du nhan xac thuc va nguon', () => {
  const topics = faq.listForPublic();
  assert.equal(topics.length, faq.TOPICS.length);
  const total = topics.reduce((n, t) => n + t.faqs.length, 0);
  assert.equal(total, faq.FAQS.length, 'co cau hoi bi rot khi dua ra trang cong khai');
  for (const t of topics) {
    for (const f of t.faqs) {
      assert.ok(f.statusLabel, `${f.id}: thieu nhan muc xac thuc`);
      for (const s of f.sources) assert.match(s.url, /^https:\/\//);
    }
  }
});

test('faqKnowledge: van ban can cu gui cho AI phai danh dau ro muc chua xac thuc', () => {
  const text = faq.buildAiGuideText();
  assert.match(text, /CHUA XAC THUC/, 'thieu canh bao cho AI ve cac muc chua xac thuc');
  assert.match(text, /CHI XAC NHAN MOT PHAN/, 'thieu canh bao cho AI ve cac muc chi dung mot phan');
  assert.ok(faq.buildServiceExtraText().includes('Nơi nộp'), 'thieu thong tin noi nop trong can cu gui AI');
});
