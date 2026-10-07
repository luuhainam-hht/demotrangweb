// =====================================================================================
// Du bao luong cong dan theo gio + so quay can mo (huong phat trien dai han trong bao cao).
//
// Co so ly thuyet: mo hinh hang doi nhieu kenh phuc vu M/M/c (muc 1.8.1 bao cao) - cong
// thuc Erlang C cho xac suat phai cho va thoi gian cho trung binh Wq:
//   a   = lambda / mu                 (tai luong, don vi Erlang)
//   C   = xac suat 1 cong dan den noi phai xep hang (Erlang C)
//   Wq  = C / (c*mu - lambda)         (thoi gian cho trung binh)
// So quay can mo = so c nho nhat sao cho Wq <= nguong AWT cua Trung tam (AWT_ALERT_MINUTES).
//
// Du lieu dau vao: so ve THAT cua cung thu-trong-tuan, cung khung gio trong N tuan gan nhat
// (trung binh cong). Ham thuan, khong doc DB -> test duoc doc lap.
// =====================================================================================

// Xac suat phai cho (Erlang C). Tinh lap de tranh tran so voi giai thua lon.
function erlangC(servers, offeredLoad) {
  const c = servers;
  const a = offeredLoad;
  if (c <= 0) return 1;
  if (a <= 0) return 0;
  if (a >= c) return 1; // he thong qua tai: hang doi tang vo han
  // Erlang B truy hoi: B(0)=1, B(k) = a*B(k-1) / (k + a*B(k-1))
  let b = 1;
  for (let k = 1; k <= c; k += 1) b = (a * b) / (k + a * b);
  // Erlang C tu Erlang B
  return (c * b) / (c - a * (1 - b));
}

// Thoi gian cho trung binh (phut) voi c quay, lambda ve/gio, AHT phut/ve.
function expectedWaitMinutes(servers, lambdaPerHour, ahtMinutes) {
  if (lambdaPerHour <= 0) return 0;
  const mu = 60 / ahtMinutes; // so ve 1 quay xu ly duoc trong 1 gio
  const a = lambdaPerHour / mu;
  if (a >= servers) return Infinity;
  const pw = erlangC(servers, a);
  return (pw / (servers * mu - lambdaPerHour)) * 60;
}

// So quay toi thieu de thoi gian cho trung binh <= targetWaitMinutes.
function requiredCounters(lambdaPerHour, ahtMinutes, targetWaitMinutes, maxCounters = 30) {
  if (!(lambdaPerHour > 0)) return 0;
  const aht = Math.max(0.5, Number(ahtMinutes) || 10);
  for (let c = 1; c <= maxCounters; c += 1) {
    if (expectedWaitMinutes(c, lambdaPerHour, aht) <= targetWaitMinutes) return c;
  }
  return maxCounters;
}

// rows: [{ field_id, field_name, hour, total }] - tong so ve cua thu dang du bao trong N tuan.
// aht: { [field_id]: phut } thoi gian xu ly trung binh that; fallbackAht dung khi chua co.
function buildForecast({ rows, weeks, ahtByField = {}, fallbackAht = 15, targetWaitMinutes = 15 }) {
  const w = Math.max(1, Number(weeks) || 1);
  const hours = new Map();
  const fields = new Map();
  for (const r of rows) {
    const hour = Number(r.hour);
    const expected = Number(r.total) / w;
    if (!hours.has(hour)) hours.set(hour, []);
    fields.set(Number(r.field_id), r.field_name);
    hours.get(hour).push({ fieldId: Number(r.field_id), fieldName: r.field_name, expected });
  }

  const result = [...hours.keys()].sort((a, b) => a - b).map((hour) => {
    const byField = hours.get(hour).map((f) => {
      const aht = Number(ahtByField[f.fieldId]) || fallbackAht;
      return {
        fieldId: f.fieldId,
        fieldName: f.fieldName,
        expected: Math.round(f.expected * 10) / 10,
        ahtMinutes: Math.round(aht * 10) / 10,
        countersNeeded: requiredCounters(f.expected, aht, targetWaitMinutes)
      };
    }).sort((a, b) => a.fieldName.localeCompare(b.fieldName));
    const expected = byField.reduce((s, f) => s + f.expected, 0);
    return {
      hour,
      expected: Math.round(expected * 10) / 10,
      totalCounters: byField.reduce((s, f) => s + f.countersNeeded, 0),
      byField
    };
  });

  const peak = result.reduce((best, h) => (!best || h.expected > best.expected ? h : best), null);
  return {
    weeks: w,
    targetWaitMinutes,
    hours: result,
    peak: peak ? { hour: peak.hour, expected: peak.expected, totalCounters: peak.totalCounters } : null,
    expectedTotal: Math.round(result.reduce((s, h) => s + h.expected, 0)),
    fields: [...fields.entries()].map(([id, name]) => ({ id, name }))
  };
}

module.exports = { erlangC, expectedWaitMinutes, requiredCounters, buildForecast };
