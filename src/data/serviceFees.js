// ============================================================================
// LE PHI CUA 14 THU TUC TREN KIOSK - AP DUNG TAI THANH PHO HA NOI
// MOT NGUON DUY NHAT: migration (src/migrations/runMigrations.js -> updateServiceFees) ghi
// cac gia tri nay vao bang `services` moi lan server khoi dong, nen sua o day la CSDL Neon,
// the thu tuc o Trang chu, trang Doi chieu giay to va Tro ly AI cung doi theo.
//
//   amount : so tien CO DINH nho nhat phai nop (dong). 0 = mien phi. Dung cho tinh toan/bao cao.
//   label  : chu ngan hien tren the thu tuc (Trang chu). Thu tuc dat dai KHONG co mot con so
//            co dinh (tinh theo gia tri dat) nen label la chu, khong phai so.
//   note   : giai thich day du cho nguoi dan + can cu phap ly - hien o trang Doi chieu giay to
//            va dua cho Tro ly AI.
//   status : VERIFIED = da doi chieu nguon chinh thuc va khop; PARTIAL = con phu thuoc truong
//            hop cu the hoac nguon chua thong nhat (ghi ro trong note).
//
// NGUON DA DOI CHIEU NGAY 08/10/2026:
//   - Cong Dich vu cong quoc gia (dichvucong.gov.vn), muc "Phi, le phi" cua tung thu tuc.
//   - Nghi quyet 06/2020/NQ-HDND TP Ha Noi (phi, le phi thuoc tham quyen HDND TP): le phi ho
//     tich, le phi cap Giay chung nhan QSDD, phi tham dinh ho so cap GCN.
//   - Nghi quyet 78/2026/NQ-HDND TP Ha Noi (15/7/2026, hieu luc 25/7/2026): le phi dang ky kinh
//     doanh - thay muc ho kinh doanh cua NQ 06/2020; nop truc tuyen = 0 dong.
//   - Thong tu 281/2016/TT-BTC: phi cap ban sao trich luc ho tich 8.000 d/ban.
//   - Thong tu 117/2026/TT-BTC (hieu luc 15/8/2026 - 28/02/2027): mien phi khai thac CSDL ho
//     tich, giam 10% le phi truoc ba nha dat cho cong dan co VNeID muc 2 (du dieu kien).
// Khi HDND TP ban hanh muc moi: sua so o day + cap nhat FEES_CHECKED_AT, khong sua rai rac.
// ============================================================================

const FEES_CHECKED_AT = '08/10/2026';

const FEE_SOURCES = {
  DVC: {
    title: 'Cổng Dịch vụ công quốc gia – mục "Phí, lệ phí" của từng thủ tục',
    url: 'https://dichvucong.gov.vn'
  },
  NQ06_2020: {
    title: 'Nghị quyết 06/2020/NQ-HĐND TP Hà Nội – phí, lệ phí thuộc thẩm quyền HĐND Thành phố',
    url: 'https://thuvienphapluat.vn/van-ban/Thue-Phi-Le-Phi/Nghi-quyet-06-2020-NQ-HDND-thu-phi-le-phi-thuoc-tham-quyen-quyet-dinh-Hoi-dong-Ha-Noi-447524.aspx'
  },
  NQ78_2026: {
    title: 'Nghị quyết 78/2026/NQ-HĐND TP Hà Nội – lệ phí đăng ký kinh doanh (hiệu lực 25/7/2026)',
    url: 'https://luatvietnam.vn/tin-van-ban-moi/tu-25-7-2026-ha-noi-ap-dung-le-phi-0-dong-voi-mot-so-thu-tuc-dang-ky-kinh-doanh-online-186-110817-article.html'
  },
  TT281_2016: {
    title: 'Thông tư 281/2016/TT-BTC – phí cấp bản sao trích lục hộ tịch 8.000 đồng/bản',
    url: 'https://thuvienphapluat.vn/hoi-dap-phap-luat/muc-phi-cua-ban-sao-trich-luc-giay-to-ho-tich-2026-la-bao-nhieu-138089691.html'
  },
  TT117_2026: {
    title: 'Thông tư 117/2026/TT-BTC – miễn, giảm phí, lệ phí cho công dân có VNeID mức 2 (15/8/2026 – 28/02/2027)',
    url: 'https://xaydungchinhsach.chinhphu.vn/toan-van-thong-tu-117-2026-tt-btc-quy-dinh-mien-giam-mot-so-khoan-phi-le-phi-de-trien-khai-nghi-quyet-ve-phat-trien-cong-dan-so-119260828175124756.htm'
  }
};

const MIEN_UU_TIEN = 'Miễn lệ phí cho người thuộc gia đình có công với cách mạng, hộ nghèo, người khuyết tật.';

const SERVICE_FEES = {
  // ---------------- HO TICH (UBND cap xa) ----------------
  KHAISINH: {
    amount: 0,
    label: 'Miễn phí (đúng hạn)',
    note: 'Miễn lệ phí nếu đăng ký trong 60 ngày kể từ ngày sinh. Đăng ký quá hạn: 5.000 đ/việc. ' + MIEN_UU_TIEN +
      ' Xin thêm bản sao trích lục khai sinh: 8.000 đ/bản.',
    status: 'VERIFIED',
    sources: ['DVC', 'NQ06_2020', 'TT281_2016']
  },
  KETHON: {
    amount: 0,
    label: 'Miễn phí',
    note: 'Miễn lệ phí đăng ký kết hôn của công dân Việt Nam cư trú trong nước. Xin thêm bản sao trích lục kết hôn: 8.000 đ/bản.',
    status: 'VERIFIED',
    sources: ['DVC', 'NQ06_2020', 'TT281_2016']
  },
  KHAITU: {
    amount: 0,
    label: 'Miễn phí (đúng hạn)',
    note: 'Miễn lệ phí nếu đăng ký khai tử đúng hạn. Đăng ký quá hạn: 5.000 đ/việc. ' + MIEN_UU_TIEN +
      ' Xin thêm bản sao trích lục khai tử: 8.000 đ/bản.',
    status: 'VERIFIED',
    sources: ['DVC', 'NQ06_2020', 'TT281_2016']
  },
  XNTTHN: {
    amount: 3000,
    label: '3.000 đ',
    note: 'Lệ phí cấp Giấy xác nhận tình trạng hôn nhân tại Hà Nội: 3.000 đ/việc (Nghị quyết 06/2020/NQ-HĐND). ' + MIEN_UU_TIEN +
      ' Cổng Dịch vụ công quốc gia ghi "Miễn phí" nhưng chú thích mức cụ thể do HĐND tỉnh quyết định — nếu cán bộ thông báo khác, làm theo hướng dẫn tại quầy.',
    status: 'PARTIAL',
    sources: ['NQ06_2020', 'DVC']
  },
  CAICHINH_HT: {
    amount: 5000,
    label: '5.000 – 25.000 đ',
    note: 'Thay đổi, cải chính hộ tịch cho người chưa đủ 14 tuổi: 5.000 đ/việc; cho người từ đủ 14 tuổi trở lên: 25.000 đ/việc (mức này trước đây thu ở cấp huyện; từ 01/7/2025 thủ tục do UBND cấp xã giải quyết — hỏi cán bộ để biết mức đang áp dụng). ' + MIEN_UU_TIEN,
    status: 'PARTIAL',
    sources: ['NQ06_2020', 'DVC']
  },
  TRICHLUC_HT: {
    amount: 8000,
    label: '8.000 đ/bản',
    note: '8.000 đ cho mỗi bản sao trích lục hộ tịch. Từ 15/8/2026 đến hết 28/02/2027: miễn phí nếu bạn có tài khoản VNeID mức 2 và đủ điều kiện theo Thông tư 117/2026/TT-BTC.',
    status: 'VERIFIED',
    sources: ['DVC', 'TT281_2016', 'TT117_2026']
  },

  // ---------------- DAT DAI (tinh theo gia tri dat - KHONG co mot con so co dinh) ----------------
  SANGTEN: {
    amount: 28000,
    label: 'Theo giá chuyển nhượng',
    note: 'Các khoản chính: thuế thu nhập cá nhân 2% giá chuyển nhượng; lệ phí trước bạ 0,5%; phí thẩm định hồ sơ 0,15% giá chuyển nhượng, tối đa 5.000.000 đ/hồ sơ; lệ phí chứng nhận đăng ký biến động 28.000 đ (phường) hoặc 14.000 đ (khu vực khác). Giá tính không thấp hơn giá đất do UBND Thành phố quy định. Chưa gồm phí công chứng hợp đồng. Từ 15/8/2026 đến hết 28/02/2027, người có VNeID mức 2 kê khai điện tử được giảm 10% lệ phí trước bạ (tối đa 5 lần mức lương cơ sở).',
    status: 'VERIFIED',
    sources: ['NQ06_2020', 'TT117_2026']
  },
  CAPMOI_GCN: {
    amount: 10000,
    label: '10.000 – 100.000 đ',
    note: 'Lệ phí cấp Giấy chứng nhận lần đầu cho hộ gia đình, cá nhân: tại phường 25.000 đ (chỉ có đất) hoặc 100.000 đ (có nhà, tài sản gắn liền); khu vực khác 10.000 đ hoặc 50.000 đ. Miễn lệ phí cho hộ gia đình, cá nhân ở nông thôn và hộ nghèo. Tùy nguồn gốc đất có thể phải nộp thêm tiền sử dụng đất, lệ phí trước bạ 0,5% — cơ quan thuế thông báo số tiền cụ thể.',
    status: 'VERIFIED',
    sources: ['NQ06_2020']
  },
  TACHTHUA: {
    amount: 0,
    label: 'Theo hồ sơ',
    note: 'Cổng Dịch vụ công quốc gia (thủ tục "(Hà Nội) Tách thửa hoặc hợp thửa đất") ghi phí, lệ phí theo Luật Phí và lệ phí và quy định của HĐND Thành phố, thời hạn 12 ngày làm việc. Thường gồm lệ phí cấp Giấy chứng nhận cho các thửa mới theo biểu của Nghị quyết 06/2020/NQ-HĐND và chi phí đo đạc, trích đo thửa đất do đơn vị đo đạc thu theo hợp đồng — không có một con số chung, hỏi cán bộ địa chính để ước tính.',
    status: 'PARTIAL',
    sources: ['DVC', 'NQ06_2020']
  },
  CHUYENMDSDD: {
    amount: 0,
    label: 'Theo giá đất',
    note: 'Khoản lớn nhất là tiền sử dụng đất, tính theo diện tích và bảng giá đất của Thành phố — cơ quan thuế ra thông báo số tiền. Ngoài ra có lệ phí chứng nhận đăng ký biến động 28.000 đ (phường) hoặc 14.000 đ (khu vực khác) và lệ phí trước bạ nếu phát sinh. Không có mức cố định — hỏi cán bộ địa chính để ước tính trước.',
    status: 'PARTIAL',
    sources: ['NQ06_2020']
  },

  // ---------------- HO KINH DOANH (Nghi quyet 78/2026/NQ-HDND, tu 25/7/2026) ----------------
  DKKD_HKD: {
    amount: 100000,
    label: '100.000 đ · online 0 đ',
    note: 'Lệ phí cấp mới Giấy chứng nhận đăng ký hộ kinh doanh: 100.000 đ/lần khi nộp hồ sơ giấy; nộp trực tuyến: 0 đ (Nghị quyết 78/2026/NQ-HĐND TP Hà Nội, hiệu lực từ 25/7/2026). Lệ phí không được hoàn lại nếu hồ sơ không được cấp đăng ký.',
    status: 'VERIFIED',
    sources: ['NQ78_2026', 'DVC']
  },
  THAYDOI_DKKD: {
    amount: 100000,
    label: '100.000 đ · online 0 đ',
    note: 'Đăng ký thay đổi nội dung hộ kinh doanh: 100.000 đ/lần khi nộp hồ sơ giấy; nộp trực tuyến: 0 đ (Nghị quyết 78/2026/NQ-HĐND TP Hà Nội). Không thu lệ phí khi chỉ điều chỉnh địa chỉ do thay đổi địa giới hành chính, tên đường, phố hoặc số nhà.',
    status: 'VERIFIED',
    sources: ['NQ78_2026', 'DVC']
  },
  TAMNGUNG_KD: {
    amount: 0,
    label: 'Miễn phí',
    note: 'Thông báo tạm ngừng kinh doanh của hộ kinh doanh không thu lệ phí: biểu mức thu của Nghị quyết 78/2026/NQ-HĐND chỉ thu khi cấp mới, thay đổi nội dung, cấp lại Giấy chứng nhận.',
    status: 'PARTIAL',
    sources: ['NQ78_2026']
  },
  GIAITHE_HKD: {
    amount: 0,
    label: 'Miễn phí',
    note: 'Chấm dứt hoạt động hộ kinh doanh không thu lệ phí: biểu mức thu của Nghị quyết 78/2026/NQ-HĐND không có khoản này.',
    status: 'PARTIAL',
    sources: ['NQ78_2026', 'DVC']
  }
};

function getServiceFee(code) {
  if (!code) return null;
  return SERVICE_FEES[String(code).toUpperCase()] || null;
}

// Chu ngan gon dung chung cho the thu tuc / chatbot khi CSDL chua co fee_label (DB cu).
function formatFeeAmount(amount) {
  const n = Number(amount) || 0;
  return n > 0 ? `${n.toLocaleString('vi-VN')} đ` : 'Miễn phí';
}

module.exports = { FEES_CHECKED_AT, FEE_SOURCES, SERVICE_FEES, getServiceFee, formatFeeAmount };
