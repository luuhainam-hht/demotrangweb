// =====================================================================================
// TRANG THAI HIEN THI TREN BANG GOI SO (display.html) - 4 mau (11/2026)
//   BUSY  (DO)         : Dang thuc hien tai quay - quay dang goi / dang phuc vu 1 so
//   IDLE  (XANH LA)    : Dang trong - quay mo, can bo co mat, chua co ai
//   AWAY  (VANG)       : Nguoi o quay di vang - can bo bam "Tam dung" (PAUSED)
//   BREAK (XANH DUONG) : Gio nghi - ngoai khung gio lam viec / nghi trua, hoac quay dong
// Thu tu uu tien: dang co so tai quay luon la BUSY (ke ca lan sang gio nghi, nguoi dan van
// dang duoc phuc vu); sau do moi xet lich lam viec, roi den trang thai quay.
// Ham thuan (khong doc DB) de test duoc.
// =====================================================================================

const BOARD_STATES = {
  BUSY: { label: 'Đang thực hiện tại quầy', color: 'red' },
  IDLE: { label: 'Đang trống', color: 'green' },
  AWAY: { label: 'Người ở quầy đi vắng', color: 'yellow' },
  BREAK: { label: 'Giờ nghỉ', color: 'blue' }
};

// counter: { status: OPEN|PAUSED|CLOSED, ticket_number, ticket_status }
// schedule: { inWorkingHours: boolean, onBreak?: boolean } (tu kioskHours.evaluate)
function computeBoardState(counter, schedule) {
  const c = counter || {};
  const s = schedule || { inWorkingHours: true };
  if (c.ticket_number && (c.ticket_status === 'CALLING' || c.ticket_status === 'PROCESSING')) {
    return { state: 'BUSY', text: c.ticket_status === 'CALLING' ? 'Đang gọi số' : 'Đang phục vụ' };
  }
  if (!s.inWorkingHours) {
    return { state: 'BREAK', text: s.onBreak ? 'Nghỉ trưa' : 'Ngoài giờ làm việc' };
  }
  if (c.status === 'PAUSED') return { state: 'AWAY', text: 'Cán bộ tạm vắng' };
  if (c.status === 'CLOSED') return { state: 'BREAK', text: 'Quầy nghỉ' };
  return { state: 'IDLE', text: 'Mời công dân đến quầy' };
}

module.exports = { BOARD_STATES, computeBoardState };
