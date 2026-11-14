const test = require('node:test');
const assert = require('node:assert/strict');
const { computeBoardState } = require('../src/services/boardState');

const WORK = { inWorkingHours: true };
const LUNCH = { inWorkingHours: false, onBreak: true };

test('Bang goi so: 4 trang thai mau', () => {
  assert.equal(computeBoardState({ status: 'OPEN', ticket_number: 'A-101', ticket_status: 'PROCESSING' }, WORK).state, 'BUSY');
  assert.equal(computeBoardState({ status: 'OPEN' }, WORK).state, 'IDLE');
  assert.equal(computeBoardState({ status: 'PAUSED' }, WORK).state, 'AWAY');
  assert.equal(computeBoardState({ status: 'CLOSED' }, WORK).state, 'BREAK');
  assert.equal(computeBoardState({ status: 'OPEN' }, LUNCH).state, 'BREAK');
  assert.equal(computeBoardState({ status: 'OPEN' }, LUNCH).text, 'Nghỉ trưa');
});

test('Bang goi so: dang phuc vu luc sang gio nghi van la BUSY (do)', () => {
  const r = computeBoardState({ status: 'OPEN', ticket_number: 'B-007', ticket_status: 'CALLING' }, LUNCH);
  assert.equal(r.state, 'BUSY');
  assert.equal(r.text, 'Đang gọi số');
});

test('Can cu phap ly: du 14 thu tuc, co ngay doi chieu', () => {
  const { LEGAL_BASIS, getLegalBasis } = require('../src/data/legalBasis');
  assert.equal(Object.keys(LEGAL_BASIS).length, 14);
  const b = getLegalBasis('khaisinh');
  assert.match(b.checkedAt, /^\d{2}\/\d{2}\/\d{4}$/);
  assert.ok(b.docs.some((d) => /123\/2015/.test(d.doc)));
});

test('YouTube: tach ma video / danh sach phat tu nhieu kieu lien ket', () => {
  const { parseYoutube } = require('../src/utils/youtube');
  assert.deepEqual(parseYoutube('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), { videoId: 'dQw4w9WgXcQ', playlistId: null });
  assert.equal(parseYoutube('https://youtu.be/dQw4w9WgXcQ?t=3').videoId, 'dQw4w9WgXcQ');
  assert.equal(parseYoutube('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>').videoId, 'dQw4w9WgXcQ');
  assert.equal(parseYoutube('https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG').playlistId, 'PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG');
  assert.equal(parseYoutube('https://evil.example.com/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(parseYoutube(''), null);
});
