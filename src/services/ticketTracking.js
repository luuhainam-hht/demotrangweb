// Tinh thong tin theo doi ve cho cong dan (khong can ten): so nguoi truoc minh + thoi gian cho
// uoc tinh. Tach khoi route de test duoc ma khong can DB.

// Thoi gian xu ly moi nguoi: uu tien trung binh THAT trong ngay cua quay (>= 1 phut de tranh
// uoc tinh 0 khi moi co vai ve xu ly rat nhanh); chua co du lieu thi dung SLA cua thu tuc.
function estimateWaitMinutes({ aheadCount, activeCount, avgSeconds, slaMinutes }) {
  const perTicketMinutes = avgSeconds && avgSeconds > 0
    ? Math.max(1, avgSeconds / 60)
    : Math.max(1, Number(slaMinutes) || 10);
  const peopleBefore = aheadCount + (activeCount > 0 ? 1 : 0);
  if (peopleBefore === 0) return 0;
  return Math.max(1, Math.round(peopleBefore * perTicketMinutes));
}

// Ve dang cho bo sung ho so (SUPP_PENDING): doi ma giay to con thieu (missing_doc_codes) thanh
// ten day du theo danh muc required_docs cua thu tuc de trang theo doi hien cho cong dan doc duoc.
function resolveMissingDocs(info) {
  const codes = Array.isArray(info.missing_doc_codes) ? info.missing_doc_codes : [];
  const catalog = Array.isArray(info.required_docs) ? info.required_docs : [];
  return codes.map((code) => {
    const doc = catalog.find((d) => d && d.code === code);
    return { code, name: doc ? doc.name : code };
  });
}

// Chi tra ve cac truong can cho cong dan - khong tra citizen_name/phone/reentry token.
function toPublicTracking(info) {
  const isQueued = info.status === 'QUEUED';
  const isSuppPending = info.status === 'SUPP_PENDING';
  return {
    ticketNumber: info.ticket_number,
    status: info.status,
    counterName: info.counter_name || null,
    serviceName: info.service_name,
    isPriority: !!Number(info.is_priority),
    aheadCount: isQueued ? info.aheadCount : null,
    estimatedWaitMinutes: isQueued ? estimateWaitMinutes({
      aheadCount: info.aheadCount, activeCount: info.activeCount,
      avgSeconds: info.avgSeconds, slaMinutes: info.sla_minutes
    }) : null,
    // So lan da bi goi ma vang mat (co che 3-Strike): cong dan biet minh con bao nhieu luot.
    retryCount: Number(info.retry_count) || 0,
    // Cho bo sung: ke ten giay to con thieu + cho phep bam "Toi da bo sung xong" ngay tren dien
    // thoai (UC-11 «extend» UC-09) - token Re-entry KHONG tra ve, thao tac di qua id ve (UUID).
    missingDocs: isSuppPending ? resolveMissingDocs(info) : null,
    canReenter: isSuppPending
  };
}

module.exports = { estimateWaitMinutes, toPublicTracking, resolveMissingDocs };
