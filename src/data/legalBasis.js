// ============================================================================
// CAN CU PHAP LY CUA 14 THU TUC TREN KIOSK (11/2026)
// Hien o: the thu tuc (Trang chu), trang Doi chieu giay to (kiosk-checklist.html) va du lieu cho
// Tro ly AI - de nguoi dan biet thong tin dang "doi chieu theo thong tu / nghi dinh nao, tai thoi
// diem nao".
//
// LEGAL_CHECKED_AT: ngay doi chieu gan nhat. Khi co van ban moi: sua o day + doi ngay doi chieu.
// Nguon da doi chieu ngay 14/11/2026 (bao chi phap luat, cong thong tin co quan nha nuoc):
//   - Nghi dinh 18/2026/ND-CP (ban hanh 14/01/2026, hieu luc 15/01/2026) sua Nghi dinh 123/2015.
//   - Luat Ho tich so 03/2026/QH16 (thong qua 23/4/2026) co hieu luc tu 01/3/2027.
//   - Nghi dinh 151/2025/ND-CP: Chu tich UBND cap xa cap GCN lan dau (khoan 1 Dieu 5), cho phep
//     chuyen muc dich su dung dat voi ca nhan (diem m khoan 1 Dieu 5), tu 01/7/2025.
//   - QD 61/2024/QD-UBND va QD 105/2026/QD-UBND (TP Ha Noi) ve tach thua.
//   - Nghi dinh 168/2025/ND-CP (dang ky doanh nghiep, gom ho kinh doanh), sua doi boi Nghi dinh
//     296/2026/ND-CP (23/7/2026); Nghi dinh 125/2025/ND-CP: dang ky ho kinh doanh chuyen ve cap xa.
// Day la thong tin THAM KHAO; van ban goc va huong dan cua can bo tai quay la can cu cuoi cung.
// ============================================================================

const LEGAL_CHECKED_AT = '14/11/2026';

const HO_TICH = [
  { doc: 'Luật Hộ tịch số 60/2014/QH13', note: 'đang áp dụng' },
  { doc: 'Nghị định 123/2015/NĐ-CP', note: 'quy định chi tiết Luật Hộ tịch; sửa đổi bởi Nghị định 07/2025/NĐ-CP và Nghị định 18/2026/NĐ-CP (hiệu lực 15/01/2026)' },
  { doc: 'Thông tư 04/2020/TT-BTP', note: 'hướng dẫn thi hành Luật Hộ tịch và Nghị định 123/2015/NĐ-CP' },
  { doc: 'Nghị định 120/2025/NĐ-CP', note: 'phân định thẩm quyền chính quyền địa phương 2 cấp lĩnh vực tư pháp (từ 01/7/2025)' }
];
const HO_TICH_UPCOMING = 'Luật Hộ tịch số 03/2026/QH16 có hiệu lực từ 01/3/2027 — thủ tục có thể thay đổi từ ngày này.';
const LE_PHI_HN = { doc: 'Nghị quyết 06/2020/NQ-HĐND TP Hà Nội', note: 'mức phí, lệ phí' };

const DAT_DAI = [
  { doc: 'Luật Đất đai số 31/2024/QH15', note: 'hiệu lực 01/8/2024' },
  { doc: 'Nghị định 101/2024/NĐ-CP', note: 'đăng ký đất đai, cấp Giấy chứng nhận' },
  { doc: 'Nghị định 151/2025/NĐ-CP', note: 'phân định thẩm quyền chính quyền địa phương 2 cấp lĩnh vực đất đai (từ 01/7/2025)' }
];

const KINH_DOANH = [
  { doc: 'Nghị định 168/2025/NĐ-CP', note: 'đăng ký doanh nghiệp, gồm đăng ký hộ kinh doanh (hiệu lực 01/7/2025)' },
  { doc: 'Nghị định 296/2026/NĐ-CP', note: 'sửa đổi Nghị định 168/2025/NĐ-CP (hiệu lực 23/7/2026)' },
  { doc: 'Nghị định 125/2025/NĐ-CP', note: 'UBND cấp xã đăng ký hộ kinh doanh (từ 01/7/2025)' },
  { doc: 'Nghị quyết 78/2026/NQ-HĐND TP Hà Nội', note: 'lệ phí đăng ký kinh doanh (hiệu lực 25/7/2026)' }
];

const LEGAL_BASIS = {
  KHAISINH: {
    short: 'Luật Hộ tịch 2014; NĐ 123/2015/NĐ-CP',
    docs: [{ doc: 'Điều 15–16 Luật Hộ tịch 2014', note: 'thời hạn 60 ngày và thủ tục đăng ký khai sinh' }, ...HO_TICH, LE_PHI_HN],
    upcoming: HO_TICH_UPCOMING
  },
  KETHON: {
    short: 'Luật Hộ tịch 2014; Luật HN&GĐ 2014',
    docs: [
      { doc: 'Luật Hôn nhân và gia đình số 52/2014/QH13', note: 'điều kiện kết hôn' },
      ...HO_TICH,
      { doc: 'Nghị quyết 66.7/2025/NQ-CP và Quyết định 1833/QĐ-BTP', note: 'bỏ yêu cầu Giấy xác nhận tình trạng hôn nhân khi kết hôn trong nước (từ 01/01/2026)' },
      { doc: 'Quyết định 3673/QĐ-BTP', note: 'công bố thủ tục hành chính cấp xã' }
    ],
    upcoming: HO_TICH_UPCOMING
  },
  KHAITU: {
    short: 'Luật Hộ tịch 2014; NĐ 123/2015/NĐ-CP',
    docs: [{ doc: 'Điều 32–34 Luật Hộ tịch 2014', note: 'thẩm quyền, thời hạn 15 ngày, thủ tục đăng ký khai tử' }, ...HO_TICH, LE_PHI_HN],
    upcoming: HO_TICH_UPCOMING
  },
  XNTTHN: {
    short: 'NĐ 123/2015/NĐ-CP (Điều 21–23)',
    docs: [{ doc: 'Điều 21–23 Nghị định 123/2015/NĐ-CP', note: 'cấp Giấy xác nhận tình trạng hôn nhân' }, ...HO_TICH, LE_PHI_HN],
    upcoming: HO_TICH_UPCOMING
  },
  CAICHINH_HT: {
    short: 'Luật Hộ tịch 2014; NĐ 123/2015/NĐ-CP',
    docs: [...HO_TICH, LE_PHI_HN],
    upcoming: HO_TICH_UPCOMING
  },
  TRICHLUC_HT: {
    short: 'NĐ 123/2015/NĐ-CP; TT 281/2016/TT-BTC',
    docs: [...HO_TICH, { doc: 'Thông tư 281/2016/TT-BTC', note: 'phí cấp bản sao trích lục hộ tịch' }],
    upcoming: HO_TICH_UPCOMING
  },
  SANGTEN: {
    short: 'Luật Đất đai 2024; NĐ 101/2024/NĐ-CP',
    docs: [{ doc: 'Điều 133 Luật Đất đai 2024', note: 'đăng ký biến động (chuyển nhượng, tặng cho, thừa kế...)' }, ...DAT_DAI, LE_PHI_HN]
  },
  CAPMOI_GCN: {
    short: 'Luật Đất đai 2024; NĐ 151/2025/NĐ-CP',
    docs: [...DAT_DAI, { doc: 'Khoản 1 Điều 5 Nghị định 151/2025/NĐ-CP', note: 'Chủ tịch UBND cấp xã cấp Giấy chứng nhận lần đầu' }, LE_PHI_HN]
  },
  TACHTHUA: {
    short: 'Luật Đất đai 2024 (Điều 220); QĐ 61/2024/QĐ-UBND',
    docs: [
      { doc: 'Điều 220 Luật Đất đai 2024', note: 'điều kiện tách thửa, hợp thửa' },
      ...DAT_DAI,
      { doc: 'Quyết định 61/2024/QĐ-UBND TP Hà Nội', note: 'diện tích, kích thước tối thiểu được tách thửa (hiệu lực 07/10/2024)' },
      { doc: 'Quyết định 105/2026/QĐ-UBND TP Hà Nội', note: 'trình tự thủ tục đất đai tại Hà Nội (áp dụng từ 25/7/2026)' }
    ]
  },
  CHUYENMDSDD: {
    short: 'Luật Đất đai 2024 (Điều 121, 123); NĐ 151/2025/NĐ-CP',
    docs: [
      { doc: 'Điều 121, 123 Luật Đất đai 2024', note: 'chuyển mục đích sử dụng đất phải được cho phép' },
      ...DAT_DAI,
      { doc: 'Nghị định 102/2024/NĐ-CP', note: 'quy định chi tiết thi hành Luật Đất đai' },
      { doc: 'Điểm m khoản 1 Điều 5 Nghị định 151/2025/NĐ-CP', note: 'Chủ tịch UBND cấp xã cho phép chuyển mục đích đối với cá nhân' }
    ]
  },
  DKKD_HKD: {
    short: 'NĐ 168/2025/NĐ-CP (Điều 99)',
    docs: [{ doc: 'Điều 99 Nghị định 168/2025/NĐ-CP', note: 'hồ sơ, trình tự đăng ký hộ kinh doanh' }, ...KINH_DOANH, { doc: 'Thông tư 68/2025/TT-BTC', note: 'biểu mẫu' }]
  },
  THAYDOI_DKKD: { short: 'NĐ 168/2025/NĐ-CP', docs: [...KINH_DOANH] },
  TAMNGUNG_KD: { short: 'NĐ 168/2025/NĐ-CP', docs: [...KINH_DOANH] },
  GIAITHE_HKD: {
    short: 'NĐ 168/2025/NĐ-CP',
    docs: [...KINH_DOANH],
    upcoming: 'Tên gọi theo văn bản: "Chấm dứt hoạt động hộ kinh doanh".'
  }
};

function getLegalBasis(code) {
  const b = code && LEGAL_BASIS[String(code).toUpperCase()];
  if (!b) return null;
  return { ...b, checkedAt: LEGAL_CHECKED_AT };
}

// Mot dong ngan cho Tro ly AI / the thu tuc.
function legalSummary(code) {
  const b = getLegalBasis(code);
  if (!b) return null;
  return `${b.docs.map((d) => d.doc).join('; ')} (đối chiếu ngày ${LEGAL_CHECKED_AT})`;
}

module.exports = { LEGAL_CHECKED_AT, LEGAL_BASIS, getLegalBasis, legalSummary };
