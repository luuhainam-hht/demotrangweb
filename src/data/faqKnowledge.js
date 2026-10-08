// ============================================================================
// KHO TRI THUC HOI - DAP cho nguoi dan (dung chung cho: trang hoi-dap.html, chatbot rule-based
// va du lieu can cu cua AI). MOT NGUON DUY NHAT - sua o day la ca 3 noi cung doi.
//
// QUY TAC NOI DUNG (giong src/data/dvcGuide.js va src/data/wifiGuide.js):
//   - Moi cau tra loi deu co `status` va (neu la quy dinh phap luat) `sources` tro toi SOURCES.
//       SYSTEM     = quy dinh VAN HANH cua chinh he thong nay (khong phai phap luat) - can cu la
//                    ma nguon/cau hinh cua he thong, Admin doi duoc.
//       VERIFIED   = da doc duoc nguon dan o duoi va noi dung khop.
//       PARTIAL    = nguon chi xac nhan mot phan / con phu thuoc dia phuong (ghi ro trong `note`).
//       UNVERIFIED = CHUA doi chieu duoc nguon - chi de nguoi dan biet ma hoi can bo, TUYET DOI
//                    khong duoc trinh bay nhu quy dinh chinh thuc.
//   - KHONG suy dien: khong tu che so tien, so ngay, ten van ban.
//   - Muc tien/le phi THAY DOI THEO TINH/THANH (HDND tinh quyet dinh). Con so dang ap dung tai
//     HA NOI nam o src/data/serviceFees.js (doi chieu 08/10/2026) - cac cau hoi ve tien o day
//     dan lai dung so do kem nguon H1..H4, khong tu che so.
//
// CANH BAO CHO CAN BO TRUNG TAM:
//   Cac trang nguon duoc doc qua cong cu tom tat noi dung, phan lon la bao/trang luat (nguon thu
//   cap) vi Cong Dich vu cong quoc gia chan truy cap tu dong. Truoc khi dung chinh thuc, can bo
//   PHAI mo lai tung URL va doi chieu voi van ban goc + quy dinh cua tinh minh.
// Ngay doc nguon: 22/09/2026.
// ============================================================================

const ACCESSED = '22/09/2026';

const FEES_ACCESSED = '08/10/2026';

const SOURCES = {
  H1: {
    title: 'Nghị quyết 06/2020/NQ-HĐND TP Hà Nội – lệ phí hộ tịch, lệ phí cấp Giấy chứng nhận quyền sử dụng đất, phí thẩm định hồ sơ',
    url: 'https://thuvienphapluat.vn/van-ban/Thue-Phi-Le-Phi/Nghi-quyet-06-2020-NQ-HDND-thu-phi-le-phi-thuoc-tham-quyen-quyet-dinh-Hoi-dong-Ha-Noi-447524.aspx',
    accessed: FEES_ACCESSED
  },
  H2: {
    title: 'LuatVietnam – Từ 25/7/2026 Hà Nội áp dụng lệ phí 0 đồng với đăng ký hộ kinh doanh trực tuyến (Nghị quyết 78/2026/NQ-HĐND)',
    url: 'https://luatvietnam.vn/tin-van-ban-moi/tu-25-7-2026-ha-noi-ap-dung-le-phi-0-dong-voi-mot-so-thu-tuc-dang-ky-kinh-doanh-online-186-110817-article.html',
    accessed: FEES_ACCESSED
  },
  H3: {
    title: 'Thư viện pháp luật – Mức phí bản sao trích lục hộ tịch 2026: 8.000 đồng/bản (Thông tư 281/2016/TT-BTC)',
    url: 'https://thuvienphapluat.vn/hoi-dap-phap-luat/muc-phi-cua-ban-sao-trich-luc-giay-to-ho-tich-2026-la-bao-nhieu-138089691.html',
    accessed: FEES_ACCESSED
  },
  H4: {
    title: 'Báo Chính phủ – Toàn văn Thông tư 117/2026/TT-BTC miễn, giảm phí, lệ phí cho công dân số (15/8/2026 – 28/02/2027)',
    url: 'https://xaydungchinhsach.chinhphu.vn/toan-van-thong-tu-117-2026-tt-btc-quy-dinh-mien-giam-mot-so-khoan-phi-le-phi-de-trien-khai-nghi-quyet-ve-phat-trien-cong-dan-so-119260828175124756.htm',
    accessed: FEES_ACCESSED
  },
  K1: {
    title: 'VietNamNet – Từ 1/7, người dân có thể làm thủ tục hành chính ở bất cứ đâu trong tỉnh, thành (mô hình chính quyền 2 cấp, Nghị định 118/2025/NĐ-CP về cơ chế một cửa)',
    url: 'https://vietnamnet.vn/tu-1-7-nguoi-dan-co-the-lam-thu-tuc-hanh-chinh-o-bat-cu-dau-trong-tinh-thanh-2411625.html',
    accessed: ACCESSED
  },
  K2: {
    title: 'Thư viện pháp luật – Quyền khai sinh, ai có trách nhiệm đăng ký khai sinh (trích Điều 15 Luật Hộ tịch 2014: 60 ngày)',
    url: 'https://thuvienphapluat.vn/phap-luat/quyen-khai-sinh-ai-co-trach-nhiem-dang-ky-khai-sinh-dang-ky-khai-sinh-nhu-the-nao-1034.html',
    accessed: ACCESSED
  },
  K3: {
    title: 'Thư viện pháp luật – Từ 1/1/2026 đăng ký kết hôn giữa hai công dân Việt Nam không phải nộp Giấy xác nhận tình trạng hôn nhân (dẫn Nghị quyết 66.7/2025/NQ-CP, Quyết định 1833/QĐ-BTP)',
    url: 'https://thuvienphapluat.vn/phap-luat/khi-dang-ky-ket-hon-giua-hai-nguoi-viet-nam-tu-112026-co-can-xin-giay-xac-nhan-tinh-trang-hon-nhan--242239.html',
    accessed: ACCESSED
  },
  K4: {
    title: 'Thư viện pháp luật – Thủ tục đăng ký kết hôn cấp xã mới nhất 2026 theo Quyết định 3673/QĐ-BTP',
    url: 'https://thuvienphapluat.vn/chinh-sach-phap-luat-moi/vn/ho-tro-phap-luat/tu-van-phap-luat/105545/thu-tuc-dang-ky-ket-hon-cap-xa-moi-nhat-2026-theo-quyet-dinh-3673-qd-btp',
    accessed: ACCESSED
  },
  K5: {
    title: 'Báo Chính phủ – Sửa một số quy định về lệ phí đăng ký hộ tịch (Thông tư 179/2015/TT-BTC: miễn lệ phí khai sinh/khai tử đúng hạn, kết hôn của công dân Việt Nam cư trú trong nước; HĐND tỉnh quyết định mức thu)',
    url: 'https://baochinhphu.vn/sua-mot-so-quy-dinh-ve-le-phi-dang-ky-ho-tich-102194243.htm',
    accessed: ACCESSED
  },
  K6: {
    title: 'Thư viện pháp luật – Từ 01/3/2027 được đăng ký khai sinh, kết hôn ở bất kỳ đâu (Luật Hộ tịch 2026, Điều 8)',
    url: 'https://thuvienphapluat.vn/ma-so-thue/phap-luat-thue/chinh-thuc-tu-ngay-0132027-duoc-dang-ky-khai-sinh-ket-hon-o-bat-ky-dau-224994.html',
    accessed: ACCESSED
  },
  K7: {
    title: 'LuatVietnam – Hướng dẫn thủ tục sang tên Sổ đỏ năm 2026 (thời hạn không quá 10 ngày làm việc; thuế TNCN 2%, lệ phí trước bạ 0,5%)',
    url: 'https://luatvietnam.vn/dat-dai-nha-o/thu-tuc-sang-ten-so-do-567-23816-article.html',
    accessed: ACCESSED
  },
  K8: {
    title: 'Thư viện pháp luật – Hướng dẫn thủ tục đăng ký hộ kinh doanh năm 2026 (Nghị định 168/2025/NĐ-CP Điều 99: nộp tại cơ quan đăng ký kinh doanh cấp xã, 3 ngày làm việc)',
    url: 'https://thuvienphapluat.vn/phap-luat-doanh-nghiep/bai-viet/huong-dan-thu-tuc-dang-ky-ho-kinh-doanh-nam-2026-18449.html',
    accessed: ACCESSED
  },
  K9: {
    title: 'LuatVietnam – Thủ tục liên thông đăng ký khai sinh, cấp căn cước online cho trẻ dưới 6 tuổi từ 01/9/2026',
    url: 'https://luatvietnam.vn/hanh-chinh/thu-tuc-lien-thong-dang-ky-khai-sinh-cap-can-cuoc-online-cho-tre-duoi-6-tuoi-tu-01-9-2026-570-111995-article.html',
    accessed: ACCESSED
  },
  K10: {
    title: 'VNeID (Bộ Công an) – Hướng dẫn đăng ký, kích hoạt tài khoản định danh điện tử',
    url: 'https://vneid.gov.vn/huongdan/huong-dan-dang-ky-tai-khoan-vneid.html',
    accessed: ACCESSED
  },
  K11: {
    title: 'Cổng Dịch vụ công quốc gia – trang chủ (nộp hồ sơ, tra cứu hồ sơ, phản ánh kiến nghị)',
    url: 'https://dichvucong.gov.vn/',
    accessed: ACCESSED
  }
};

const STATUS_LABELS = {
  SYSTEM: 'Quy định vận hành của hệ thống này',
  VERIFIED: 'Đã đối chiếu nguồn',
  PARTIAL: 'Nguồn chỉ xác nhận một phần / tùy địa phương',
  UNVERIFIED: 'Chưa xác thực – hãy hỏi cán bộ'
};

// Nhom chu de hien tren trang Hoi dap + dung de chatbot goi y cau hoi lien quan.
const TOPICS = [
  { id: 'HETHONG', icon: '🎫', name: 'Lấy số & dùng hệ thống', desc: 'Cách lấy số thứ tự, theo dõi số, vắng mặt, mất phiếu.' },
  { id: 'GIAYTO', icon: '🪪', name: 'Giấy tờ tùy thân & ủy quyền', desc: 'Căn cước, VNeID, bản sao, chứng thực, nhờ người khác đi thay.' },
  { id: 'HOTICH', icon: '👶', name: 'Hộ tịch', desc: 'Khai sinh, kết hôn, khai tử, xác nhận độc thân, trích lục.' },
  { id: 'DATDAI', icon: '🏠', name: 'Đất đai – nhà ở', desc: 'Sang tên, cấp mới sổ đỏ, tách thửa, chuyển mục đích sử dụng.' },
  { id: 'KINHDOANH', icon: '🏪', name: 'Hộ kinh doanh', desc: 'Đăng ký, thay đổi, tạm ngừng, giải thể hộ kinh doanh.' },
  { id: 'TRUCTUYEN', icon: '💻', name: 'Nộp hồ sơ qua mạng', desc: 'Cổng dịch vụ công, VNeID, nộp phí, nhận kết quả tại nhà.' },
  { id: 'HOTRO', icon: '🤝', name: 'Hỗ trợ tại Trung tâm', desc: 'Người cao tuổi, người khuyết tật, hỏi đáp, phản ánh.' }
];

// ============================================================================
// NGAN HANG CAU HOI - DAP
//   q        : cau hoi hien tren trang Hoi dap
//   aliases  : cac cach hoi khac (de khop khi nguoi dan go vao chatbot / o tim kiem)
//   short    : cau tra loi NGAN (1-3 cau) - cai duoc doc to va hien dau tien
//   details  : cac y chi tiet, moi y 1 dong (nguoi lon tuoi doc tung dong de hon doc 1 doan dai)
//   link     : trang trong he thong di sau (neu co)
// ============================================================================
const FAQS = [
  // ---------------------------- LAY SO & DUNG HE THONG ----------------------------
  {
    id: 'HT-01', topic: 'HETHONG', status: 'SYSTEM',
    q: 'Lấy số thứ tự có phải nhập họ tên hay số điện thoại không?',
    aliases: ['lấy số có cần nhập tên không', 'có phải khai số điện thoại không', 'lấy số cần gì'],
    short: 'Không. Bạn chỉ chọn thủ tục, tích đủ giấy tờ rồi bấm "Xác nhận & Lấy số thứ tự".',
    details: [
      'Số thứ tự chính là "tên" của bạn tại Trung tâm, nên hệ thống không hỏi họ tên hay số điện thoại.',
      'Cách này vừa nhanh hơn, vừa không thu thập thông tin cá nhân của bạn.',
      'Khi đến quầy, cán bộ đối chiếu danh tính bằng thẻ căn cước của bạn.'
    ],
    link: 'index.html'
  },
  {
    id: 'HT-02', topic: 'HETHONG', status: 'SYSTEM',
    q: 'Tôi vắng mặt khi được gọi số thì có mất lượt không?',
    aliases: ['gọi số mà không có mặt', 'đi vệ sinh lỡ lượt', 'bị gọi mà chưa tới', 'mất lượt'],
    short: 'Không mất ngay. Số của bạn được chuyển xuống cuối hàng và gọi lại; vắng 3 lần liên tiếp thì số mới bị hủy.',
    details: [
      'Mỗi lần gọi, hệ thống chờ bạn trong khoảng thời gian do Trung tâm cấu hình (mặc định 45 giây).',
      'Hết thời gian chờ mà bạn chưa tới, số được đẩy xuống cuối hàng đợi và quầy gọi người tiếp theo.',
      'Sau 3 lần vắng mặt liên tiếp, số bị hủy và bạn phải lấy số mới.',
      'Nếu bạn cần rời đi một lát, hãy báo nhân viên hỗ trợ trước.'
    ]
  },
  {
    id: 'HT-03', topic: 'HETHONG', status: 'SYSTEM',
    q: 'Làm sao theo dõi số thứ tự khi đang ngồi chờ hoặc ra ngoài?',
    aliases: ['theo dõi số trên điện thoại', 'còn bao nhiêu người nữa tới lượt tôi', 'xem số từ xa', 'quét mã trên phiếu'],
    short: 'Dùng điện thoại quét mã QR in trên phiếu số. Trang theo dõi hiện số người chờ phía trước và thời gian chờ ước tính.',
    details: [
      'Trang theo dõi tự cập nhật vài giây một lần, bạn không phải bấm gì thêm.',
      'Không cần nhập tên hay số điện thoại, chỉ cần giữ trang đó mở.',
      'Khi sắp đến lượt, hãy quay lại khu vực quầy, nghe loa và nhìn Bảng LED.'
    ],
    link: 'theo-doi.html'
  },
  {
    id: 'HT-04', topic: 'HETHONG', status: 'SYSTEM',
    q: 'Tôi làm mất phiếu số thứ tự thì phải làm sao?',
    aliases: ['mất phiếu', 'rơi mất số', 'quên số của tôi'],
    short: 'Nếu điện thoại còn mở trang theo dõi thì bạn vẫn xem được số. Nếu không, hãy báo ngay nhân viên hỗ trợ tại Trung tâm.',
    details: [
      'Hệ thống không tra được số theo họ tên vì lúc lấy số không thu thập họ tên.',
      'Nhân viên hỗ trợ có thể tra theo thủ tục và thời điểm bạn lấy số.',
      'Mẹo: ngay sau khi lấy số, hãy quét mã QR trên phiếu để lưu trang theo dõi vào điện thoại.'
    ]
  },
  {
    id: 'HT-05', topic: 'HETHONG', status: 'SYSTEM',
    q: 'Cán bộ yêu cầu bổ sung giấy tờ, tôi quay lại có phải lấy số mới từ đầu không?',
    aliases: ['bổ sung hồ sơ', 're-entry', 'quét mã bổ sung', 'thiếu giấy tờ phải về lấy'],
    short: 'Không. Cán bộ cấp cho bạn một mã QR "Bổ sung hồ sơ"; khi quay lại, bạn quét mã đó để được xếp vào hàng ưu tiên.',
    details: [
      'Giữ kỹ mã QR bổ sung hồ sơ, đừng làm mất.',
      'Về chuẩn bị đủ giấy tờ còn thiếu rồi quay lại bất kỳ lúc nào trong giờ làm việc.',
      'Bấm "Quét mã Bổ sung hồ sơ" ở màn hình chính, quét hoặc nhập mã, hệ thống xếp bạn vào lượt kế tiếp.'
    ]
  },
  {
    id: 'HT-06', topic: 'HETHONG', status: 'SYSTEM',
    q: 'Cuối giờ làm việc mà chưa tới lượt tôi thì sao?',
    aliases: ['hết giờ chưa tới lượt', 'số hết hạn cuối ngày', 'quá giờ làm việc'],
    short: 'Đến giờ đóng cửa, các số chưa được phục vụ sẽ hết hạn. Bạn cần lấy số mới vào ngày làm việc kế tiếp.',
    details: [
      'Vì vậy nên đến sớm với các thủ tục mất nhiều thời gian như đất đai.',
      'Trước khi hết giờ, cán bộ thường thông báo để người dân biết.',
      'Ngoài giờ làm việc, hệ thống không cấp số mới nhưng bạn vẫn xem được hướng dẫn và cách điền giấy tờ trên các trang này.'
    ]
  },
  {
    id: 'HT-07', topic: 'HETHONG', status: 'SYSTEM',
    q: 'Vì sao người đến sau tôi lại được gọi trước?',
    aliases: ['sao người khác được gọi trước', 'chen ngang', 'ưu tiên'],
    short: 'Mỗi lĩnh vực có hàng đợi riêng, và một số trường hợp được ưu tiên theo quy định (người già, người khuyết tật, phụ nữ có thai...).',
    details: [
      'Ví dụ: số lĩnh vực Hộ tịch và số lĩnh vực Đất đai chờ ở hai hàng khác nhau, không so sánh trực tiếp được.',
      'Mọi trường hợp chèn ưu tiên đều bắt buộc ghi rõ lý do và được lưu nhật ký để giám sát.',
      'Nếu bạn thấy bất thường, hãy hỏi cán bộ điều phối tại Trung tâm.'
    ]
  },
  {
    id: 'HT-08', topic: 'HETHONG', status: 'SYSTEM',
    q: 'Thời gian chờ ước tính trên phiếu có chính xác không?',
    aliases: ['bao lâu tới lượt', 'chờ bao lâu', 'thời gian chờ ước tính'],
    short: 'Đó là ước tính dựa trên số người đang chờ và thời gian xử lý trung bình, không phải cam kết chắc chắn.',
    details: [
      'Hồ sơ phức tạp hoặc người trước bạn thiếu giấy tờ có thể làm thời gian chờ dài hơn.',
      'Con số này được cập nhật liên tục trên trang theo dõi.'
    ]
  },

  // ---------------------------- GIAY TO TUY THAN & UY QUYEN ----------------------------
  {
    id: 'GT-01', topic: 'GIAYTO', status: 'SYSTEM',
    q: 'Tôi cần mang bản chính hay bản sao giấy tờ?',
    aliases: ['bản chính hay bản sao', 'photo có được không', 'cần công chứng không'],
    short: 'Danh sách giấy tờ của từng thủ tục trên màn hình ghi rõ giấy nào cần bản chính. Nguyên tắc chung: mang theo bản chính để cán bộ đối chiếu.',
    details: [
      'Nhiều thủ tục chỉ cần nộp bản sao nhưng vẫn phải xuất trình bản chính để đối chiếu.',
      'Nếu nộp bản sao chứng thực thì thường không phải mang bản chính, nhưng hãy mang theo cho chắc.',
      'Hãy bấm vào tên thủ tục trên Trang chủ để xem danh sách giấy tờ đầy đủ.'
    ],
    link: 'index.html'
  },
  {
    id: 'GT-02', topic: 'GIAYTO', status: 'PARTIAL', sources: ['K1'],
    q: 'Tôi có thể nhờ con cháu hoặc người khác đi làm thủ tục thay được không?',
    aliases: ['nhờ người đi thay', 'ủy quyền', 'con đi làm giúp bố mẹ', 'người nhà làm thay'],
    short: 'Nhiều thủ tục cho phép ủy quyền bằng văn bản, nhưng một số thủ tục bắt buộc chính bạn phải có mặt — ví dụ đăng ký kết hôn.',
    details: [
      'Nếu được ủy quyền, người đi thay thường phải mang: giấy ủy quyền (có chứng thực), căn cước của mình và giấy tờ của người ủy quyền.',
      'Đăng ký kết hôn bắt buộc cả hai bên cùng có mặt để ký, không ủy quyền được.',
      'Việc ủy quyền với từng thủ tục cụ thể khác nhau — hãy hỏi cán bộ hoặc gọi trước cho Trung tâm để khỏi phải đi lại nhiều lần.'
    ],
    note: 'Quy định ủy quyền khác nhau theo từng thủ tục; nguồn đã đọc không liệt kê đầy đủ nên phần này cần cán bộ xác nhận.'
  },
  {
    id: 'GT-03', topic: 'GIAYTO', status: 'VERIFIED', sources: ['K10'],
    q: 'VNeID là gì và tôi cần tài khoản mức mấy?',
    aliases: ['vneid', 'định danh điện tử', 'tài khoản mức 2', 'app vneid'],
    short: 'VNeID là ứng dụng định danh điện tử của Bộ Công an. Muốn nộp hồ sơ qua mạng, bạn nên có tài khoản mức 2.',
    details: [
      'Mức 1: tự đăng ký ngay trên ứng dụng VNeID bằng điện thoại.',
      'Mức 2: phải đến trực tiếp cơ quan Công an, mang theo thẻ căn cước; cán bộ lấy khuôn mặt và vân tay.',
      'Nhiều dịch vụ công yêu cầu mức 2; tài khoản mức 1 có nộp được hay không thì tùy thủ tục — hãy hỏi cán bộ.',
      'Sau khi được duyệt, bạn nhận tin nhắn rồi kích hoạt tài khoản trong ứng dụng.'
    ],
    link: 'nop-ho-so-truc-tuyen.html'
  },
  {
    id: 'GT-04', topic: 'GIAYTO', status: 'UNVERIFIED',
    q: 'Thẻ căn cước của tôi hết hạn thì có làm thủ tục được không?',
    aliases: ['căn cước hết hạn', 'cccd hết hạn', 'chứng minh thư cũ'],
    short: 'Giấy tờ tùy thân hết hạn thường không dùng để đối chiếu được. Hãy làm lại thẻ căn cước trước, hoặc hỏi cán bộ về cách xử lý.',
    details: [
      'Tôi chưa đối chiếu được quy định cụ thể cho trường hợp này nên không dám khẳng định.',
      'Hãy hỏi trực tiếp cán bộ tại quầy hoặc cơ quan Công an nơi bạn cư trú.'
    ],
    note: 'Chưa đối chiếu được nguồn chính thức về việc chấp nhận giấy tờ hết hạn.'
  },
  {
    id: 'GT-05', topic: 'GIAYTO', status: 'PARTIAL', sources: ['K1'],
    q: 'Tôi không còn sổ hộ khẩu giấy thì chứng minh nơi cư trú bằng cách nào?',
    aliases: ['sổ hộ khẩu', 'bỏ hộ khẩu giấy', 'chứng minh nơi ở', 'giấy xác nhận cư trú'],
    short: 'Sổ hộ khẩu giấy đã bỏ. Thông tin cư trú được tra trên cơ sở dữ liệu dân cư; nếu hệ thống chưa có, bạn xin giấy xác nhận thông tin về cư trú tại Công an cấp xã.',
    details: [
      'Bạn có thể xuất trình thông tin cư trú trên ứng dụng VNeID.',
      'Một số nơi vẫn hỏi giấy xác nhận cư trú khi dữ liệu chưa đồng bộ.',
      'Nếu cán bộ cần thêm giấy tờ, hãy hỏi rõ tên giấy tờ đó để xin đúng nơi.'
    ],
    note: 'Cách chứng minh cư trú có thể khác nhau theo địa phương và mức độ đồng bộ dữ liệu.'
  },
  {
    id: 'GT-06', topic: 'GIAYTO', status: 'SYSTEM',
    q: 'Tôi không biết điền tờ khai, ai giúp tôi?',
    aliases: ['không biết viết tờ khai', 'điền giúp', 'hướng dẫn điền', 'viết đơn'],
    short: 'Vào mục "Cách điền giấy tờ" — hệ thống hướng dẫn từng ô, có ví dụ mẫu và các lỗi hay mắc. Bạn cũng có thể nhờ cán bộ ở bàn hướng dẫn.',
    details: [
      'Quy tắc chung: dùng bút mực xanh hoặc đen, viết họ tên đúng như trên thẻ căn cước.',
      'Ô nào không có thông tin thì gạch ngang, không bỏ trống.',
      'Không tẩy xóa; viết sai thì xin tờ mới.',
      'Cuối tờ khai phải ký và ghi rõ họ tên.'
    ],
    link: 'huong-dan-dien-mau.html'
  },
  {
    id: 'GT-07', topic: 'GIAYTO', status: 'UNVERIFIED',
    q: 'Chứng thực bản sao giấy tờ ở đâu, mất bao lâu?',
    aliases: ['chứng thực', 'sao y bản chính', 'công chứng giấy tờ'],
    short: 'Chứng thực bản sao thường làm tại UBND cấp xã hoặc tổ chức hành nghề công chứng, và thường trả kết quả trong ngày.',
    details: [
      'Bạn mang bản chính và bản photo tới để cán bộ đối chiếu.',
      'Tôi chưa đối chiếu được mức lệ phí và thời hạn chính xác nên hãy hỏi cán bộ trực tiếp.'
    ],
    note: 'Chưa đối chiếu được nguồn cho lệ phí và thời hạn chứng thực.'
  },

  // ---------------------------- HO TICH ----------------------------
  {
    id: 'HTI-01', topic: 'HOTICH', status: 'VERIFIED', sources: ['K2'],
    q: 'Sinh con xong bao lâu thì phải đi đăng ký khai sinh?',
    aliases: ['bao lâu phải làm khai sinh', 'hạn làm giấy khai sinh', 'khai sinh muộn', 'quá hạn khai sinh'],
    short: 'Trong vòng 60 ngày kể từ ngày sinh, cha hoặc mẹ có trách nhiệm đăng ký khai sinh cho con (Điều 15 Luật Hộ tịch 2014).',
    details: [
      'Chỉ cần một trong hai người là cha hoặc mẹ đi đăng ký, không bắt buộc cả hai cùng đến.',
      'Nếu cha mẹ không thể đi, thì ông bà, người thân khác hoặc người đang nuôi dưỡng trẻ đi đăng ký.',
      'Đăng ký đúng hạn thì được miễn lệ phí; đăng ký quá hạn vẫn làm được nhưng có thể bị xử phạt hành chính.'
    ]
  },
  {
    id: 'HTI-02', topic: 'HOTICH', status: 'VERIFIED', sources: ['K2'],
    q: 'Làm giấy khai sinh cần mang những gì?',
    aliases: ['giấy tờ khai sinh', 'hồ sơ khai sinh', 'khai sinh cần gì'],
    short: 'Tờ khai đăng ký khai sinh, Giấy chứng sinh do bệnh viện cấp, và thẻ căn cước của người đi đăng ký.',
    details: [
      'Nếu không có Giấy chứng sinh thì cần văn bản của người làm chứng, hoặc giấy cam đoan về việc sinh theo quy định.',
      'Nên mang thêm giấy chứng nhận kết hôn của cha mẹ (nếu có) để ghi đúng phần thông tin cha.',
      'Tờ khai có sẵn tại Trung tâm; bạn xem cách điền từng ô trong mục "Cách điền giấy tờ".'
    ],
    link: 'huong-dan-dien-mau.html'
  },
  {
    id: 'HTI-03', topic: 'HOTICH', status: 'VERIFIED', sources: ['K9'],
    q: 'Có thể làm khai sinh cho con qua mạng không?',
    aliases: ['khai sinh online', 'đăng ký khai sinh trực tuyến', 'liên thông khai sinh'],
    short: 'Có. Từ 01/9/2026 có thủ tục liên thông trực tuyến: đăng ký khai sinh, đăng ký thường trú, cấp thẻ bảo hiểm y tế và cấp căn cước cho trẻ dưới 6 tuổi.',
    details: [
      'Bạn nộp trên Cổng Dịch vụ công quốc gia hoặc ứng dụng VNeID; hệ thống tự điền sẵn các thông tin đã có.',
      'Cán bộ hộ tịch cấp xã xử lý phần khai sinh trong vòng 24 giờ kể từ khi nhận đủ hồ sơ.',
      'Nếu thiếu giấy tờ, bạn có 7 ngày làm việc để bổ sung.',
      'Đăng ký thường trú mất khoảng 2–5 ngày làm việc, thẻ bảo hiểm y tế tối đa 2 ngày làm việc.',
      'Trẻ dưới 6 tuổi KHÔNG bắt buộc làm thẻ căn cước; chỉ làm khi cha mẹ yêu cầu (không quá 5 ngày làm việc).'
    ],
    link: 'nop-ho-so-truc-tuyen.html'
  },
  {
    id: 'HTI-04', topic: 'HOTICH', status: 'PARTIAL', sources: ['K3', 'K4'],
    q: 'Đăng ký kết hôn có còn phải xin Giấy xác nhận tình trạng hôn nhân không?',
    aliases: ['giấy xác nhận độc thân để kết hôn', 'xác nhận tình trạng hôn nhân', 'kết hôn cần giấy gì'],
    short: 'Theo nguồn đã đọc, từ 01/01/2026 hai công dân Việt Nam đăng ký kết hôn KHÔNG phải nộp Giấy xác nhận tình trạng hôn nhân nữa — cán bộ tra trên cơ sở dữ liệu hộ tịch.',
    details: [
      'Nguồn dẫn Nghị quyết 66.7/2025/NQ-CP và Quyết định 1833/QĐ-BTP, áp dụng từ 01/01/2026.',
      'Hồ sơ còn lại: tờ khai đăng ký kết hôn và giấy tờ tùy thân còn giá trị của hai bên.',
      'Nếu dữ liệu hộ tịch chưa có thông tin của bạn, cán bộ vẫn có thể yêu cầu giấy tờ chứng minh — hãy hỏi trước khi đi.',
      'Danh sách giấy tờ hiển thị trên màn hình Kiosk là cấu hình của Trung tâm; nếu còn ghi "Giấy xác nhận tình trạng hôn nhân" thì hãy hỏi cán bộ xem có còn bắt buộc không.'
    ],
    note: 'Đây là nguồn thứ cấp (trang luật), chưa đối chiếu văn bản gốc. Cán bộ Trung tâm cần xác nhận với Sở Tư pháp trước khi bỏ giấy tờ này khỏi danh sách.'
  },
  {
    id: 'HTI-05', topic: 'HOTICH', status: 'VERIFIED', sources: ['K4'],
    q: 'Đăng ký kết hôn có bắt buộc cả hai người cùng đến không?',
    aliases: ['một mình đi đăng ký kết hôn được không', 'vợ chồng cùng đi', 'ủy quyền kết hôn'],
    short: 'Có. Cả hai bên nam nữ phải cùng có mặt, xuất trình giấy tờ tùy thân, xác nhận tự nguyện và ký vào Giấy chứng nhận kết hôn.',
    details: [
      'Không được ủy quyền cho người khác ký thay.',
      'Mỗi bên được nhận một bản chính Giấy chứng nhận kết hôn.',
      'Nếu cần xác minh thêm, thời hạn giải quyết không quá 5 ngày làm việc.'
    ]
  },
  {
    id: 'HTI-06', topic: 'HOTICH', status: 'VERIFIED', sources: ['K5', 'H1', 'H3'],
    q: 'Làm khai sinh, khai tử, kết hôn có mất lệ phí không?',
    aliases: ['lệ phí khai sinh', 'lệ phí kết hôn', 'lệ phí hộ tịch', 'có tốn tiền không'],
    short: 'Đăng ký khai sinh và khai tử ĐÚNG HẠN, đăng ký kết hôn của công dân Việt Nam cư trú trong nước được miễn lệ phí. Bản sao trích lục thì mất 8.000 đ/bản.',
    details: [
      'Tại Hà Nội, đăng ký khai sinh hoặc khai tử QUÁ HẠN: 5.000 đ/việc; cấp Giấy xác nhận tình trạng hôn nhân: 3.000 đ/việc (Nghị quyết 06/2020/NQ-HĐND).',
      'Người thuộc hộ nghèo, người khuyết tật, người thuộc gia đình có công với cách mạng được miễn lệ phí hộ tịch.',
      'Bản sao trích lục (khai sinh, kết hôn, khai tử…): 8.000 đ/bản; từ 15/8/2026 đến hết 28/02/2027 được miễn nếu có VNeID mức 2 và đủ điều kiện.',
      'Ở tỉnh, thành khác mức thu có thể khác — xem bảng niêm yết lệ phí tại Trung tâm.'
    ],
    note: 'Mức thu đối chiếu ngày 08/10/2026 theo Nghị quyết 06/2020/NQ-HĐND TP Hà Nội và Cổng Dịch vụ công quốc gia.'
  },
  {
    id: 'HTI-07', topic: 'HOTICH', status: 'VERIFIED', sources: ['K2', 'K6'],
    q: 'Tôi phải đăng ký hộ tịch ở nơi nào, có phải về đúng quê không?',
    aliases: ['đăng ký khai sinh ở đâu', 'làm hộ tịch ở đâu', 'khác xã có làm được không', 'trái tuyến'],
    short: 'Hiện nay đăng ký hộ tịch nộp tại UBND cấp xã nơi cha hoặc mẹ (hoặc người yêu cầu) cư trú. Từ 01/3/2027, theo Luật Hộ tịch 2026, bạn được đăng ký ở bất kỳ xã nào, không phụ thuộc nơi cư trú.',
    details: [
      'Trường hợp có yếu tố nước ngoài thì thẩm quyền thuộc cấp cao hơn, không giải quyết ở cấp xã.',
      'Từ 01/3/2027, Điều 8 Luật Hộ tịch 2026 cho phép UBND cấp xã đăng ký hộ tịch không phụ thuộc nơi cư trú của người yêu cầu.',
      'Trước mốc đó, nếu bạn ở xa nơi cư trú, hãy hỏi cán bộ về phương án nộp trực tuyến.'
    ]
  },
  {
    id: 'HTI-08', topic: 'HOTICH', status: 'UNVERIFIED',
    q: 'Đăng ký khai tử trong bao lâu và cần giấy gì?',
    aliases: ['khai tử', 'giấy báo tử', 'người thân mất làm thủ tục gì'],
    short: 'Hồ sơ gồm tờ khai đăng ký khai tử và Giấy báo tử (hoặc giấy tờ thay thế), kèm giấy tờ tùy thân của người đi khai. Đăng ký đúng hạn được miễn lệ phí.',
    details: [
      'Người thân thích của người đã mất có trách nhiệm đi đăng ký khai tử.',
      'Tôi chưa đối chiếu lại được thời hạn chính xác theo quy định hiện hành nên không nêu số ngày cụ thể.',
      'Hãy hỏi cán bộ hộ tịch để biết thời hạn và tránh bị coi là đăng ký quá hạn.'
    ],
    note: 'Chưa đối chiếu được nguồn cho thời hạn đăng ký khai tử theo quy định đang áp dụng năm 2026.'
  },
  {
    id: 'HTI-09', topic: 'HOTICH', status: 'VERIFIED', sources: ['H3', 'H4'],
    q: 'Tôi cần bản sao giấy khai sinh cũ, xin ở đâu?',
    aliases: ['trích lục khai sinh', 'bản sao giấy khai sinh', 'mất giấy khai sinh', 'trích lục hộ tịch'],
    short: 'Bạn xin cấp bản sao trích lục hộ tịch tại nơi đã đăng ký trước đây, hoặc nơi đang lưu trữ sổ hộ tịch. Phí: 8.000 đ cho mỗi bản sao.',
    details: [
      'Mang theo giấy tờ tùy thân và thông tin sự kiện đã đăng ký (số, quyển, ngày đăng ký nếu còn nhớ) để tra nhanh hơn.',
      'Phí 8.000 đ/bản theo Thông tư 281/2016/TT-BTC (Cổng Dịch vụ công quốc gia ghi đúng mức này).',
      'Từ 15/8/2026 đến hết 28/02/2027: miễn phí nếu bạn có tài khoản VNeID mức 2 và đủ điều kiện (Thông tư 117/2026/TT-BTC).',
      'Thủ tục cấp bản sao trích lục hộ tịch cũng nộp trực tuyến được trên Cổng Dịch vụ công quốc gia.'
    ],
    link: 'nop-ho-so-truc-tuyen.html'
  },
  {
    id: 'HTI-10', topic: 'HOTICH', status: 'UNVERIFIED',
    q: 'Giấy khai sinh của tôi bị sai tên, sai ngày sinh thì sửa thế nào?',
    aliases: ['cải chính hộ tịch', 'sai thông tin khai sinh', 'sửa giấy khai sinh', 'đổi tên'],
    short: 'Đây là thủ tục cải chính hộ tịch. Bạn cần tờ khai cải chính, giấy tờ chứng minh nội dung cần sửa là đúng, và giấy tờ tùy thân.',
    details: [
      'Giấy tờ chứng minh có thể là học bạ, hồ sơ gốc, giấy tờ của cha mẹ... tùy nội dung cần sửa.',
      'Thẩm quyền giải quyết phụ thuộc vào độ tuổi và nội dung cải chính nên tôi chưa dám khẳng định.',
      'Hãy mang toàn bộ giấy tờ liên quan đến Trung tâm để cán bộ hộ tịch xem và hướng dẫn cụ thể.'
    ],
    note: 'Chưa đối chiếu được nguồn cho thẩm quyền và thời hạn cải chính hộ tịch theo mô hình chính quyền 2 cấp.'
  },

  // ---------------------------- DAT DAI ----------------------------
  {
    id: 'DD-01', topic: 'DATDAI', status: 'VERIFIED', sources: ['K7'],
    q: 'Sang tên sổ đỏ mất bao lâu?',
    aliases: ['bao lâu xong sổ đỏ', 'thời gian sang tên', 'sang tên bao nhiêu ngày'],
    short: 'Theo nguồn đã đọc, thời hạn thực hiện thủ tục sang tên là không quá 10 ngày làm việc.',
    details: [
      'Thời hạn này KHÔNG tính ngày nghỉ, ngày lễ.',
      'Cũng không tính thời gian bạn đi thực hiện nghĩa vụ tài chính (nộp thuế, lệ phí).',
      'Thực tế có thể lâu hơn nếu hồ sơ phải xác minh thêm — hãy hỏi cán bộ ngày hẹn trả kết quả ghi trên giấy biên nhận.'
    ]
  },
  {
    id: 'DD-02', topic: 'DATDAI', status: 'VERIFIED', sources: ['K7', 'H1', 'H4'],
    q: 'Sang tên sổ đỏ phải nộp những khoản tiền gì?',
    aliases: ['thuế sang tên', 'lệ phí trước bạ', 'chi phí sang tên đất', 'thuế 2%'],
    short: 'Các khoản chính: thuế thu nhập cá nhân 2% và lệ phí trước bạ 0,5%, cộng thêm phí thẩm định hồ sơ, lệ phí cấp giấy và phí công chứng hợp đồng.',
    details: [
      'Thuế thu nhập cá nhân 2% tính trên giá chuyển nhượng, bên bán thường là người nộp (hai bên có thể thỏa thuận khác).',
      'Lệ phí trước bạ 0,5% tính trên giá trị đất theo quy định.',
      'Tại Hà Nội: phí thẩm định hồ sơ 0,15% giá chuyển nhượng, tối đa 5.000.000 đ/hồ sơ; lệ phí chứng nhận đăng ký biến động 28.000 đ (phường) hoặc 14.000 đ (khu vực khác) — Nghị quyết 06/2020/NQ-HĐND.',
      'Từ 15/8/2026 đến hết 28/02/2027: người có VNeID mức 2 kê khai điện tử được giảm 10% lệ phí trước bạ nhà đất (tối đa 5 lần lương cơ sở).',
      'Kể cả khi thuộc diện được miễn thuế, bạn VẪN phải nộp tờ khai thuế — đây là bắt buộc.'
    ]
  },
  {
    id: 'DD-03', topic: 'DATDAI', status: 'VERIFIED', sources: ['K7'],
    q: 'Hồ sơ sang tên sổ đỏ gồm những gì?',
    aliases: ['giấy tờ sang tên', 'mua bán đất cần giấy gì', 'chuyển nhượng quyền sử dụng đất'],
    short: 'Giấy chứng nhận quyền sử dụng đất bản chính, hợp đồng chuyển nhượng/tặng cho đã công chứng, tờ khai thuế, giấy tờ tùy thân và giấy tờ về tình trạng hôn nhân của các bên.',
    details: [
      'Hợp đồng phải được công chứng hoặc chứng thực trước khi nộp hồ sơ.',
      'Nộp tại Trung tâm Phục vụ hành chính công hoặc Văn phòng đăng ký đất đai / chi nhánh.',
      'Nên mang thêm bản photo tất cả giấy tờ để nộp kèm.'
    ]
  },
  {
    id: 'DD-04', topic: 'DATDAI', status: 'PARTIAL', sources: ['K7'],
    q: 'Mua bán đất xong bao lâu phải đi sang tên, để lâu có bị phạt không?',
    aliases: ['bao lâu phải sang tên', 'chậm sang tên', 'phạt sang tên muộn', 'đăng ký biến động'],
    short: 'Bạn phải đăng ký biến động (sang tên) trong thời hạn luật định sau khi công chứng hợp đồng; để quá hạn có thể bị xử phạt hành chính.',
    details: [
      'Nguồn đã đọc nhấn mạnh có các mốc thời gian phải nhớ sau khi sang tên để tránh bị phạt.',
      'Tôi chưa đối chiếu được chính xác số ngày theo quy định đang áp dụng, nên không nêu con số.',
      'Hãy hỏi cán bộ địa chính hoặc Văn phòng đăng ký đất đai ngay khi công chứng xong hợp đồng.'
    ],
    note: 'Nguồn nêu có mốc thời hạn nhưng phần tóm tắt đọc được không ghi rõ số ngày; cần tra Luật Đất đai 2024 và nghị định hướng dẫn.'
  },
  {
    id: 'DD-05', topic: 'DATDAI', status: 'UNVERIFIED',
    q: 'Tách thửa đất cần điều kiện gì?',
    aliases: ['tách thửa', 'chia đất cho con', 'tách sổ'],
    short: 'Tách thửa phải đáp ứng diện tích tối thiểu và điều kiện do Ủy ban nhân dân cấp tỉnh quy định — mỗi tỉnh một khác.',
    details: [
      'Thửa đất phải có Giấy chứng nhận, không tranh chấp, không bị kê biên, còn trong thời hạn sử dụng.',
      'Diện tích, kích thước tối thiểu sau khi tách do tỉnh quy định nên tôi không nêu con số chung được.',
      'Hãy hỏi cán bộ địa chính về quy định hiện hành của tỉnh bạn trước khi làm hợp đồng.'
    ],
    note: 'Điều kiện tách thửa do từng tỉnh quy định; chưa đối chiếu được quy định cụ thể.'
  },
  {
    id: 'DD-06', topic: 'DATDAI', status: 'UNVERIFIED',
    q: 'Chuyển đất nông nghiệp sang đất ở (thổ cư) thế nào?',
    aliases: ['chuyển mục đích sử dụng đất', 'lên thổ cư', 'chuyển đất vườn sang đất ở'],
    short: 'Bạn phải xin phép cơ quan có thẩm quyền và việc chuyển mục đích phải phù hợp quy hoạch sử dụng đất của địa phương. Khoản tiền sử dụng đất phải nộp thường rất lớn.',
    details: [
      'Hồ sơ gồm đơn xin chuyển mục đích, Giấy chứng nhận bản chính và giấy tờ tùy thân.',
      'Cơ quan thuế sẽ tính tiền sử dụng đất phải nộp dựa trên bảng giá đất.',
      'Tôi chưa đối chiếu được thời hạn giải quyết và cách tính tiền theo quy định đang áp dụng — hãy hỏi cán bộ địa chính.'
    ],
    note: 'Chưa đối chiếu được nguồn cho trình tự, thời hạn và cách tính tiền sử dụng đất năm 2026.'
  },

  // ---------------------------- HO KINH DOANH ----------------------------
  {
    id: 'KD-01', topic: 'KINHDOANH', status: 'VERIFIED', sources: ['K8'],
    q: 'Đăng ký hộ kinh doanh nộp ở đâu, bao lâu có giấy phép?',
    aliases: ['mở quán cần giấy tờ gì', 'đăng ký kinh doanh ở đâu', 'giấy phép kinh doanh bao lâu'],
    short: 'Nộp tại cơ quan đăng ký kinh doanh cấp xã nơi đặt trụ sở hộ kinh doanh. Trong 3 ngày làm việc kể từ khi nhận đủ hồ sơ hợp lệ, cơ quan cấp Giấy chứng nhận.',
    details: [
      'Căn cứ: Nghị định 168/2025/NĐ-CP (Điều 99); biểu mẫu theo Thông tư 68/2025/TT-BTC.',
      'Hồ sơ gồm: Giấy đề nghị đăng ký hộ kinh doanh (mẫu số 1) và bản sao văn bản ủy quyền (nếu hộ gia đình có nhiều thành viên), có công chứng hoặc chứng thực. Số lượng: 1 bộ.',
      'Cũng nộp được qua mạng trên Hệ thống thông tin đăng ký hộ kinh doanh (cần chữ ký số).',
      'Nếu hồ sơ chưa hợp lệ, cơ quan phải thông báo bằng văn bản nêu rõ lý do và yêu cầu sửa đổi.'
    ]
  },
  {
    id: 'KD-02', topic: 'KINHDOANH', status: 'VERIFIED', sources: ['H2', 'K8'],
    q: 'Lệ phí đăng ký hộ kinh doanh là bao nhiêu?',
    aliases: ['phí đăng ký kinh doanh', 'lệ phí hộ kinh doanh bao nhiêu tiền'],
    short: 'Tại Hà Nội: 100.000 đ/lần khi nộp hồ sơ giấy, 0 đ khi nộp trực tuyến — áp dụng cho cấp mới, thay đổi nội dung và cấp lại Giấy chứng nhận đăng ký hộ kinh doanh.',
    details: [
      'Căn cứ: Nghị quyết 78/2026/NQ-HĐND TP Hà Nội, hiệu lực từ 25/7/2026.',
      'Tạm ngừng hoặc chấm dứt hoạt động hộ kinh doanh không thu lệ phí.',
      'Không thu lệ phí khi chỉ điều chỉnh địa chỉ do thay đổi địa giới hành chính, tên đường, số nhà.',
      'Lệ phí không được hoàn lại nếu hồ sơ không được cấp đăng ký.'
    ],
    note: 'Đối chiếu ngày 08/10/2026. Ở tỉnh, thành khác mức thu có thể khác.'
  },
  {
    id: 'KD-03', topic: 'KINHDOANH', status: 'UNVERIFIED',
    q: 'Tôi muốn đổi địa chỉ, ngành nghề của hộ kinh doanh thì làm thế nào?',
    aliases: ['thay đổi đăng ký kinh doanh', 'đổi địa chỉ hộ kinh doanh', 'thêm ngành nghề'],
    short: 'Bạn nộp thông báo thay đổi nội dung đăng ký hộ kinh doanh kèm Giấy chứng nhận đã cấp, tại cơ quan đăng ký kinh doanh cấp xã.',
    details: [
      'Mang theo giấy tờ tùy thân của chủ hộ kinh doanh và Giấy chứng nhận đăng ký hộ kinh doanh bản chính.',
      'Tôi chưa đối chiếu được thời hạn phải thông báo và thời hạn giải quyết — hãy hỏi cán bộ.'
    ],
    note: 'Chưa đối chiếu nguồn cho thủ tục thay đổi nội dung đăng ký hộ kinh doanh theo Nghị định 168/2025.'
  },
  {
    id: 'KD-04', topic: 'KINHDOANH', status: 'UNVERIFIED',
    q: 'Tạm ngừng hoặc nghỉ hẳn kinh doanh có phải báo không?',
    aliases: ['tạm ngừng kinh doanh', 'giải thể hộ kinh doanh', 'đóng cửa quán', 'nghỉ bán'],
    short: 'Có. Bạn phải thông báo cho cơ quan đăng ký kinh doanh cấp xã (và cơ quan thuế) trước khi tạm ngừng hoặc chấm dứt hoạt động.',
    details: [
      'Giải thể hộ kinh doanh thường phải nộp lại Giấy chứng nhận đăng ký hộ kinh doanh bản chính.',
      'Phải hoàn tất nghĩa vụ thuế trước khi chấm dứt hoạt động.',
      'Tôi chưa đối chiếu được thời hạn phải thông báo trước bao nhiêu ngày — hãy hỏi cán bộ hoặc cơ quan thuế.'
    ],
    note: 'Chưa đối chiếu nguồn cho thời hạn thông báo tạm ngừng/giải thể hộ kinh doanh.'
  },

  // ---------------------------- NOP HO SO QUA MANG ----------------------------
  {
    id: 'TT-01', topic: 'TRUCTUYEN', status: 'VERIFIED', sources: ['K1'],
    q: 'Tôi có phải về đúng nơi cư trú để nộp hồ sơ không?',
    aliases: ['nộp hồ sơ ở đâu', 'làm thủ tục khác xã', 'phải về quê làm giấy tờ', 'trung tâm phục vụ hành chính công'],
    short: 'Từ 01/7/2025, bạn nộp hồ sơ được ở bất kỳ Trung tâm Phục vụ hành chính công nào trong phạm vi cấp tỉnh, không phụ thuộc nơi cư trú.',
    details: [
      'Chính quyền địa phương nay có 2 cấp: cấp tỉnh và cấp xã; Trung tâm Phục vụ hành chính công cấp xã thay cho bộ phận một cửa trước đây.',
      'Trung tâm cấp xã tiếp nhận cả thủ tục thuộc thẩm quyền cấp xã và cấp tỉnh.',
      'Căn cứ: Nghị định 118/2025/NĐ-CP về thực hiện thủ tục hành chính theo cơ chế một cửa.',
      'Lưu ý: quy định này áp dụng trong phạm vi một tỉnh, thành phố; riêng đăng ký hộ tịch thì đến 01/3/2027 mới bỏ hẳn ràng buộc nơi cư trú.'
    ]
  },
  {
    id: 'TT-02', topic: 'TRUCTUYEN', status: 'VERIFIED', sources: ['K10', 'K11'],
    q: 'Nộp hồ sơ qua mạng bắt đầu từ đâu?',
    aliases: ['nộp online thế nào', 'cổng dịch vụ công', 'dichvucong.gov.vn', 'nộp hồ sơ tại nhà'],
    short: 'Vào Cổng Dịch vụ công quốc gia (dichvucong.gov.vn), đăng nhập bằng tài khoản VNeID, tìm đúng thủ tục rồi làm theo từng bước.',
    details: [
      'Chuẩn bị trước: điện thoại đã cài VNeID, ảnh chụp hoặc bản scan các giấy tờ, và tài khoản ngân hàng nếu phải nộp phí.',
      'Chụp giấy tờ trên nền phẳng, đủ sáng, thấy rõ cả 4 góc.',
      'Sau khi nộp, bạn nhận mã hồ sơ — hãy chụp lại màn hình để tra cứu tiến độ sau này.',
      'Trang "Nộp hồ sơ online" của hệ thống này hướng dẫn từng bước, chữ to, có ghi rõ mục nào đã đối chiếu nguồn.'
    ],
    link: 'nop-ho-so-truc-tuyen.html'
  },
  {
    id: 'TT-03', topic: 'TRUCTUYEN', status: 'UNVERIFIED',
    q: 'Nộp qua mạng thì nhận kết quả bằng cách nào?',
    aliases: ['nhận kết quả ở đâu', 'trả kết quả tại nhà', 'bưu điện trả kết quả'],
    short: 'Tùy thủ tục: có loại trả bản điện tử ngay trên cổng, có loại phải đến Trung tâm nhận bản giấy, có loại gửi qua bưu điện (bạn trả cước).',
    details: [
      'Khi nộp, bạn thường được chọn hình thức nhận kết quả.',
      'Nếu chọn nhận qua bưu điện, hãy ghi địa chỉ và số điện thoại thật chính xác.',
      'Tôi chưa đối chiếu được quy định chung về việc thủ tục nào bắt buộc nhận trực tiếp — hãy hỏi cán bộ.'
    ],
    note: 'Hình thức trả kết quả khác nhau theo từng thủ tục và địa phương; chưa đối chiếu được nguồn chung.'
  },
  {
    id: 'TT-04', topic: 'TRUCTUYEN', status: 'UNVERIFIED',
    q: 'Nộp qua mạng có rẻ hơn nộp trực tiếp không?',
    aliases: ['miễn phí nộp online', 'giảm lệ phí trực tuyến', 'nộp online có được giảm tiền'],
    short: 'Nhiều địa phương có chính sách giảm hoặc miễn phí, lệ phí khi nộp trực tuyến, nhưng không phải thủ tục nào cũng vậy.',
    details: [
      'Mức giảm do Hội đồng nhân dân cấp tỉnh quyết định nên khác nhau giữa các tỉnh.',
      'Màn hình thanh toán trên Cổng Dịch vụ công sẽ hiện số tiền phải nộp trước khi bạn bấm xác nhận — hãy đọc kỹ.',
      'Tôi chưa đối chiếu được danh sách thủ tục được miễn giảm nên không khẳng định cho trường hợp của bạn.'
    ],
    note: 'Chính sách miễn giảm phí khi nộp trực tuyến do từng tỉnh quyết định; chưa đối chiếu được nguồn.'
  },
  {
    id: 'TT-05', topic: 'TRUCTUYEN', status: 'VERIFIED', sources: ['K11'],
    q: 'Làm sao biết hồ sơ của tôi đã xử lý tới đâu?',
    aliases: ['tra cứu hồ sơ', 'hồ sơ tới đâu rồi', 'kiểm tra tiến độ'],
    short: 'Dùng mã hồ sơ để tra cứu trên Cổng Dịch vụ công quốc gia, mục "Tra cứu hồ sơ".',
    details: [
      'Mã hồ sơ nằm trong giấy biên nhận (nộp trực tiếp) hoặc hiện trên màn hình sau khi nộp trực tuyến.',
      'Nếu quá ngày hẹn mà chưa có kết quả, hãy liên hệ Trung tâm nơi nộp hoặc gửi phản ánh, kiến nghị trên chính cổng này.'
    ]
  },
  {
    id: 'TT-06', topic: 'TRUCTUYEN', status: 'UNVERIFIED',
    q: 'Tôi không có điện thoại thông minh, không dùng được mạng thì sao?',
    aliases: ['không có smartphone', 'không biết dùng máy tính', 'già rồi không dùng được mạng'],
    short: 'Bạn hoàn toàn có thể đến nộp trực tiếp tại Trung tâm như trước. Nộp trực tuyến là lựa chọn thêm, không bắt buộc.',
    details: [
      'Tại Trung tâm có cán bộ hướng dẫn và có thể hỗ trợ bạn nộp trực tuyến ngay tại chỗ.',
      'Bạn cũng có thể nhờ con cháu nộp giúp trên tài khoản VNeID của chính bạn, nhưng phải tự giữ mật khẩu.',
      'Nếu đi lại khó khăn, hãy hỏi Trung tâm về dịch vụ tiếp nhận hồ sơ qua bưu điện.'
    ],
    note: 'Việc Trung tâm có hỗ trợ nộp hộ/qua bưu điện hay không tùy từng nơi.'
  },

  // ---------------------------- HO TRO TAI TRUNG TAM ----------------------------
  {
    id: 'HO-01', topic: 'HOTRO', status: 'SYSTEM',
    q: 'Người cao tuổi, người khuyết tật, phụ nữ mang thai có được ưu tiên không?',
    aliases: ['ưu tiên người già', 'người khuyết tật', 'phụ nữ mang thai', 'ưu tiên'],
    short: 'Có. Hãy báo nhân viên hỗ trợ ngay khi đến; trường hợp ưu tiên được chèn vào lượt gọi kế tiếp.',
    details: [
      'Mọi trường hợp ưu tiên đều phải ghi rõ lý do và được lưu nhật ký, nên bạn cứ yên tâm đề nghị.',
      'Nếu bạn đi cùng người thân, người thân có thể ngồi chờ cùng và hỗ trợ khi đến lượt.'
    ]
  },
  {
    id: 'HO-02', topic: 'HOTRO', status: 'SYSTEM',
    q: 'Trung tâm làm việc mấy giờ?',
    aliases: ['giờ làm việc', 'mấy giờ mở cửa', 'thứ bảy có làm không', 'giờ đóng cửa'],
    short: 'Giờ làm việc hiển thị ngay trên Trang chủ và trong câu trả lời của Trợ lý AI, lấy theo cấu hình thực tế của Trung tâm.',
    details: [
      'Ngoài giờ làm việc, hệ thống không cấp số thứ tự mới và sẽ báo rõ ngày giờ mở cửa kế tiếp.',
      'Các trang hướng dẫn, cách điền giấy tờ và hỏi đáp vẫn xem được 24/7.',
      'Hãy hỏi Trợ lý AI "mấy giờ mở cửa" để nhận đúng giờ đang được cấu hình.'
    ]
  },
  {
    id: 'HO-03', topic: 'HOTRO', status: 'SYSTEM',
    q: 'Màn hình chữ nhỏ quá, tôi nhìn không rõ thì làm sao?',
    aliases: ['chữ nhỏ quá', 'phóng to chữ', 'nhìn không rõ', 'tăng cỡ chữ', 'khó đọc'],
    short: 'Bạn phóng to trang ngay trên trình duyệt: trên máy tính bấm giữ phím Ctrl rồi bấm phím + (dấu cộng); trên điện thoại đặt hai ngón tay lên màn hình rồi kéo ra xa nhau.',
    details: [
      'Muốn trở lại cỡ chữ ban đầu trên máy tính: bấm Ctrl và phím số 0.',
      'Tại máy Kiosk của Trung tâm, cán bộ hướng dẫn có thể đọc giúp hoặc thao tác cùng bạn.',
      'Trợ lý AI ở góc dưới bên phải trả lời ngắn gọn, bạn có thể hỏi thay vì đọc cả trang.'
    ]
  },
  {
    id: 'HO-04', topic: 'HOTRO', status: 'SYSTEM',
    q: 'Tôi muốn phản ánh, góp ý hoặc khiếu nại thì gửi ở đâu?',
    aliases: ['khiếu nại', 'phản ánh', 'góp ý', 'cán bộ gây khó dễ', 'tố cáo'],
    short: 'Bạn phản ánh trực tiếp với cán bộ phụ trách tại Trung tâm, hoặc gửi phản ánh, kiến nghị trên Cổng Dịch vụ công quốc gia.',
    details: [
      'Khi phản ánh, hãy nêu rõ: ngày giờ, thủ tục, quầy số mấy và nội dung sự việc.',
      'Nếu còn giữ mã hồ sơ hoặc số thứ tự, hãy cung cấp kèm để tra cứu nhanh hơn.',
      'Mọi thao tác xử lý hồ sơ trên hệ thống đều được lưu nhật ký, phục vụ việc kiểm tra khi có phản ánh.'
    ]
  },
  {
    id: 'HO-05', topic: 'HOTRO', status: 'SYSTEM',
    q: 'Wi-Fi của Trung tâm kết nối thế nào?',
    aliases: ['wifi', 'mạng wifi', 'mật khẩu wifi', 'kết nối internet'],
    short: 'Mở ứng dụng Máy ảnh trên điện thoại, quét mã QR Wi-Fi ở trang "Wi-Fi", rồi chạm vào thông báo hiện ra. Không cần gõ mật khẩu.',
    details: [
      'Máy cũ không quét được mã thì có hướng dẫn nhập tay riêng cho Android và iPhone.',
      'Trang Wi-Fi để chữ to, có hình minh họa cho từng bước.'
    ],
    link: 'ket-noi-wifi.html'
  },
  {
    id: 'HO-06', topic: 'HOTRO', status: 'SYSTEM',
    q: 'Thông tin trên trang này có phải là văn bản pháp luật chính thức không?',
    aliases: ['có chính xác không', 'tin được không', 'căn cứ pháp lý', 'nguồn ở đâu'],
    short: 'Không. Đây là thông tin tham khảo để bạn chuẩn bị trước, không thay thế văn bản pháp luật hay hướng dẫn của cán bộ.',
    details: [
      'Mỗi câu trả lời đều ghi rõ mức độ xác thực: đã đối chiếu nguồn, chỉ xác nhận một phần, hay chưa xác thực.',
      'Những mục "chưa xác thực" được ghi thẳng như vậy thay vì đoán bừa — bạn hãy hỏi cán bộ với các mục đó.',
      'Mức tiền và thời hạn có thể thay đổi theo quy định của từng tỉnh, thành và theo thời điểm.',
      'Khi có mâu thuẫn, hãy làm theo hướng dẫn của cán bộ tại quầy.'
    ]
  }
];

// ============================================================================
// THONG TIN MO RONG THEO TUNG THU TUC (khop theo cot `services.code` trong CSDL).
// Bo sung cho du lieu co san trong DB (ten, giay to, le phi, SLA phut) nhung thu ma nguoi dan
// hay hoi nhat va DB chua co: nop o dau, bao lau xong, nop online duoc khong, can cu phap ly,
// loi hay mac. De o file tinh (khong phai cot DB moi) de KHONG phai migration CSDL dang chay.
//
// `slaNote` la thoi han GIAI QUYET HO SO theo quy dinh (ngay), khac han `sla_minutes` trong DB
// (so phut phuc vu tai quay) - hai con so nay rat de bi nham, nen tach ten ro rang.
// ============================================================================
const SERVICE_EXTRA = {
  KHAISINH: {
    where: 'UBND cấp xã nơi cha hoặc mẹ cư trú (nộp qua Trung tâm Phục vụ hành chính công).',
    slaNote: 'Thường trả kết quả ngay trong ngày làm việc nếu hồ sơ đầy đủ. Nộp trực tuyến liên thông: cán bộ hộ tịch xử lý trong 24 giờ.',
    online: 'Có – nộp được trên Cổng Dịch vụ công quốc gia hoặc ứng dụng VNeID (thủ tục liên thông cho trẻ dưới 6 tuổi từ 01/9/2026).',
    legal: 'Luật Hộ tịch 2014 (Điều 15: đăng ký trong 60 ngày kể từ ngày sinh).',
    tips: [
      'Đăng ký trong vòng 60 ngày kể từ ngày sinh để được miễn lệ phí và tránh bị xử phạt.',
      'Chỉ cần cha HOẶC mẹ đi, không bắt buộc cả hai.',
      'Mang theo giấy chứng nhận kết hôn của cha mẹ (nếu có) để ghi đủ phần thông tin cha.'
    ],
    faqIds: ['HTI-01', 'HTI-02', 'HTI-03', 'HTI-06'],
    sources: ['K2', 'K9'], status: 'VERIFIED'
  },
  KETHON: {
    where: 'UBND cấp xã nơi một trong hai bên cư trú.',
    slaNote: 'Thường trao Giấy chứng nhận kết hôn ngay trong ngày; trường hợp phải xác minh thì không quá 5 ngày làm việc.',
    online: 'Nộp hồ sơ trực tuyến được, nhưng hai bên vẫn phải đến ký trực tiếp.',
    legal: 'Quyết định 3673/QĐ-BTP (thủ tục cấp xã 2026); Nghị quyết 66.7/2025/NQ-CP và Quyết định 1833/QĐ-BTP (bỏ Giấy xác nhận tình trạng hôn nhân từ 01/01/2026).',
    tips: [
      'Cả hai bên PHẢI cùng có mặt để ký, không ủy quyền được.',
      'Theo nguồn đã đọc, từ 01/01/2026 không phải nộp Giấy xác nhận tình trạng hôn nhân nữa — hãy hỏi cán bộ để xác nhận trước khi đi xin giấy này.',
      'Mỗi bên nhận một bản chính Giấy chứng nhận kết hôn.'
    ],
    warnings: ['Danh sách giấy tờ hiện cấu hình trong hệ thống vẫn còn "Giấy xác nhận tình trạng hôn nhân" — cán bộ Trung tâm cần rà lại theo quy định mới.'],
    faqIds: ['HTI-04', 'HTI-05', 'HTI-06'],
    sources: ['K3', 'K4'], status: 'PARTIAL'
  },
  KHAITU: {
    where: 'UBND cấp xã nơi người chết cư trú cuối cùng (nộp qua Trung tâm Phục vụ hành chính công).',
    slaNote: 'Thường giải quyết ngay trong ngày làm việc nếu hồ sơ đầy đủ.',
    online: 'Nộp trực tuyến được trên Cổng Dịch vụ công quốc gia (tùy địa phương triển khai).',
    legal: 'Luật Hộ tịch 2014.',
    tips: [
      'Đăng ký khai tử đúng hạn được miễn lệ phí.',
      'Giấy báo tử do cơ sở y tế nơi người đó mất cấp; nếu mất tại nhà thì do UBND cấp xã cấp.'
    ],
    faqIds: ['HTI-08', 'HTI-06'],
    sources: ['K5'], status: 'PARTIAL'
  },
  XNTTHN: {
    where: 'UBND cấp xã nơi cư trú.',
    slaNote: 'Thường trả trong ngày hoặc theo giấy hẹn của cán bộ hộ tịch.',
    online: 'Tùy địa phương; hãy hỏi cán bộ trước khi đi.',
    legal: 'Luật Hộ tịch 2014 và văn bản hướng dẫn.',
    tips: [
      'Giấy này thường dùng cho: vay vốn, mua bán nhà đất, kết hôn với người nước ngoài, xuất khẩu lao động.',
      'Từ 01/01/2026, đăng ký kết hôn giữa hai công dân Việt Nam trong nước không còn yêu cầu giấy này — đừng đi xin nếu chỉ để kết hôn trong nước.'
    ],
    faqIds: ['HTI-04'],
    sources: ['K3'], status: 'PARTIAL'
  },
  TRICHLUC_HT: {
    where: 'Nơi đã đăng ký sự kiện hộ tịch trước đây, hoặc cơ quan đang lưu trữ sổ hộ tịch.',
    slaNote: 'Thường trả trong ngày làm việc nếu tra được sổ gốc.',
    online: 'Có – đây là một trong các thủ tục hộ tịch đã có hướng dẫn nộp trên Cổng Dịch vụ công quốc gia.',
    legal: 'Luật Hộ tịch 2014; mức lệ phí do HĐND cấp tỉnh quy định.',
    tips: [
      'Nhớ được số, quyển, ngày đăng ký cũ thì tra nhanh hơn rất nhiều.',
      'Thủ tục này CÓ thu lệ phí (khác với đăng ký khai sinh/khai tử đúng hạn được miễn).'
    ],
    faqIds: ['HTI-09', 'HTI-06'],
    sources: ['K5'], status: 'PARTIAL'
  },
  CAICHINH_HT: {
    where: 'Cơ quan đã đăng ký hộ tịch trước đây hoặc cơ quan có thẩm quyền theo quy định.',
    slaNote: 'Chưa đối chiếu được thời hạn theo quy định đang áp dụng — hãy hỏi cán bộ hộ tịch.',
    online: 'Chưa xác thực – hãy hỏi cán bộ.',
    legal: 'Luật Hộ tịch 2014.',
    tips: [
      'Phải có giấy tờ chứng minh nội dung cần cải chính là đúng (học bạ, hồ sơ gốc, giấy tờ của cha mẹ...).',
      'Mang tất cả giấy tờ liên quan để cán bộ xem một lần, tránh phải đi lại nhiều lần.'
    ],
    faqIds: ['HTI-10'],
    sources: [], status: 'UNVERIFIED'
  },
  SANGTEN: {
    where: 'Trung tâm Phục vụ hành chính công hoặc Văn phòng đăng ký đất đai / chi nhánh.',
    slaNote: 'Không quá 10 ngày làm việc, không tính ngày nghỉ lễ và thời gian bạn đi nộp thuế, lệ phí.',
    online: 'Một phần – nhiều địa phương cho nộp hồ sơ trực tuyến, nhưng bản chính Giấy chứng nhận vẫn phải nộp trực tiếp.',
    legal: 'Luật Đất đai 2024 và các nghị định, thông tư hướng dẫn.',
    tips: [
      'Hợp đồng chuyển nhượng/tặng cho phải công chứng hoặc chứng thực TRƯỚC khi nộp hồ sơ.',
      'Các khoản phải nộp: thuế thu nhập cá nhân 2%, lệ phí trước bạ 0,5%, phí thẩm định hồ sơ, lệ phí cấp giấy.',
      'Kể cả khi được miễn thuế, vẫn bắt buộc nộp tờ khai thuế.',
      'Đây là thủ tục mất nhiều thời gian tại quầy — nên đến sớm trong ngày.'
    ],
    faqIds: ['DD-01', 'DD-02', 'DD-03', 'DD-04'],
    sources: ['K7'], status: 'VERIFIED'
  },
  CAPMOI_GCN: {
    where: 'Trung tâm Phục vụ hành chính công hoặc Văn phòng đăng ký đất đai.',
    slaNote: 'Chưa đối chiếu được thời hạn theo quy định đang áp dụng — hãy hỏi ngày hẹn ghi trên giấy biên nhận.',
    online: 'Chưa xác thực – hãy hỏi cán bộ.',
    legal: 'Luật Đất đai 2024 và các nghị định, thông tư hướng dẫn.',
    tips: [
      'Giấy tờ nguồn gốc đất là phần hay thiếu nhất — hãy chuẩn bị kỹ trước khi đến.',
      'Hồ sơ có thể phải qua bước xác minh, đo đạc nên thời gian thực tế dài hơn các thủ tục khác.'
    ],
    faqIds: ['DD-03'],
    sources: [], status: 'UNVERIFIED'
  },
  TACHTHUA: {
    where: 'Trung tâm Phục vụ hành chính công hoặc Văn phòng đăng ký đất đai.',
    slaNote: 'Chưa đối chiếu được thời hạn theo quy định đang áp dụng — hãy hỏi cán bộ.',
    online: 'Chưa xác thực – hãy hỏi cán bộ.',
    legal: 'Luật Đất đai 2024; điều kiện tách thửa cụ thể do UBND cấp tỉnh quy định.',
    tips: [
      'Điều kiện diện tích tối thiểu KHÁC NHAU giữa các tỉnh — hỏi cán bộ địa chính trước khi ký hợp đồng.',
      'Thửa đất phải có Giấy chứng nhận, không tranh chấp, còn trong thời hạn sử dụng.'
    ],
    faqIds: ['DD-05'],
    sources: [], status: 'UNVERIFIED'
  },
  CHUYENMDSDD: {
    where: 'Trung tâm Phục vụ hành chính công hoặc Văn phòng đăng ký đất đai.',
    slaNote: 'Chưa đối chiếu được thời hạn theo quy định đang áp dụng — hãy hỏi cán bộ.',
    online: 'Chưa xác thực – hãy hỏi cán bộ.',
    legal: 'Luật Đất đai 2024; phải phù hợp quy hoạch, kế hoạch sử dụng đất của địa phương.',
    tips: [
      'Tiền sử dụng đất phải nộp thường rất lớn — hãy hỏi cơ quan thuế ước tính trước khi làm.',
      'Việc chuyển mục đích phải phù hợp quy hoạch; không phải thửa đất nào cũng chuyển được.'
    ],
    faqIds: ['DD-06'],
    sources: [], status: 'UNVERIFIED'
  },
  DKKD_HKD: {
    where: 'Cơ quan đăng ký kinh doanh cấp xã nơi đặt trụ sở hộ kinh doanh.',
    slaNote: '3 ngày làm việc kể từ ngày nhận đủ hồ sơ hợp lệ.',
    online: 'Có – nộp trên Hệ thống thông tin đăng ký hộ kinh doanh (cần chữ ký số).',
    legal: 'Nghị định 168/2025/NĐ-CP (Điều 99); biểu mẫu theo Thông tư 68/2025/TT-BTC.',
    tips: [
      'Hồ sơ 1 bộ: Giấy đề nghị đăng ký hộ kinh doanh (mẫu số 1); nếu hộ gia đình nhiều thành viên thì thêm bản sao văn bản ủy quyền có công chứng/chứng thực.',
      'Hồ sơ không hợp lệ sẽ được thông báo bằng văn bản nêu rõ lý do — hãy giữ văn bản đó để sửa cho đúng.',
      'Sau khi có giấy chứng nhận, nhớ làm thủ tục về thuế theo hướng dẫn của cơ quan thuế.'
    ],
    faqIds: ['KD-01', 'KD-02'],
    sources: ['K8'], status: 'VERIFIED'
  },
  THAYDOI_DKKD: {
    where: 'Cơ quan đăng ký kinh doanh cấp xã nơi đặt trụ sở.',
    slaNote: 'Chưa đối chiếu được thời hạn — hãy hỏi cán bộ.',
    online: 'Chưa xác thực – hãy hỏi cán bộ.',
    legal: 'Nghị định 168/2025/NĐ-CP.',
    tips: ['Mang theo Giấy chứng nhận đăng ký hộ kinh doanh bản chính đang dùng.'],
    faqIds: ['KD-03'],
    sources: [], status: 'UNVERIFIED'
  },
  TAMNGUNG_KD: {
    where: 'Cơ quan đăng ký kinh doanh cấp xã nơi đặt trụ sở.',
    slaNote: 'Chưa đối chiếu được thời hạn — hãy hỏi cán bộ.',
    online: 'Chưa xác thực – hãy hỏi cán bộ.',
    legal: 'Nghị định 168/2025/NĐ-CP.',
    tips: ['Nhớ thông báo cả với cơ quan thuế, không chỉ cơ quan đăng ký kinh doanh.'],
    faqIds: ['KD-04'],
    sources: [], status: 'UNVERIFIED'
  },
  GIAITHE_HKD: {
    where: 'Cơ quan đăng ký kinh doanh cấp xã nơi đặt trụ sở.',
    slaNote: 'Chưa đối chiếu được thời hạn — hãy hỏi cán bộ.',
    online: 'Chưa xác thực – hãy hỏi cán bộ.',
    legal: 'Nghị định 168/2025/NĐ-CP.',
    tips: [
      'Phải hoàn tất nghĩa vụ thuế trước khi chấm dứt hoạt động.',
      'Thường phải nộp lại Giấy chứng nhận đăng ký hộ kinh doanh bản chính.'
    ],
    faqIds: ['KD-04'],
    sources: [], status: 'UNVERIFIED'
  }
};

// ============================================================================
// TIM KIEM & DINH DANG
// Nguoi dan go tieng Viet co dau lan khong dau, viet tat, sai chinh ta -> bo dau + ha chu
// thuong roi cham theo 2 lop:
//   1. Khop CUM TU (cau hoi goc / cac cach hoi khac trong `aliases`) - diem cao, tin cay nhat.
//   2. Khop TU KHOA con lai - diem thap, dung de xep hang cac ket qua goi y.
// Nguong `MIN_CONFIDENT_SCORE` quyet dinh chatbot co dam tra loi thang hay chi goi y.
// ============================================================================
function unaccentVi(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function normalize(str) {
  return unaccentVi(String(str || '')).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Tu qua pho bien, xuat hien o hau het cau hoi -> khong mang thong tin phan biet.
const STOP_WORDS = new Set([
  'toi', 'cua', 'thi', 'la', 'co', 'khong', 'duoc', 'nao', 'gi', 'the', 'cho', 'va', 'o', 'tai',
  'can', 'phai', 'lam', 'mot', 'nhu', 'khi', 'sao', 'bao', 'nhieu', 'minh', 'ban', 'em', 'anh',
  'chi', 'voi', 'de', 'ra', 'vao', 've', 'nay', 'do', 'bi', 'se', 'muon', 'hoi', 'xin', 'a',
  'thu', 'tuc', 'ho', 'so', 'nguoi', 'dan', 'nhung', 'cac', 'con', 'no', 'ma', 'hay', 'nen'
]);

// Diem toi thieu de DAM tra loi thang (duoi nguong nay chi dung lam goi y).
const MIN_CONFIDENT_SCORE = 50;
// Tu nguong nay tro len coi nhu khop chac chan (thuong la khop nguyen cum cau hoi) - duoc uu
// tien TRUOC ca viec nhan dien ten thu tuc, vi cau hoi dang hoi ve quy dinh chu khong phai
// hoi danh muc giay to (VD "khai sinh bao lau phai di dang ky").
const STRONG_SCORE = 100;

function faqPhrases(faq) {
  return [faq.q].concat(faq.aliases || []);
}

// Tach lam 2 vung: TIEU DE (cau hoi + cac cach hoi khac) va NOI DUNG (cau tra loi).
// Trung tu o tieu de dang tin hon nhieu so voi trung tu lot trong doan tra loi dai.
function faqTitleHay(faq) {
  return normalize([faq.q, (faq.aliases || []).join(' ')].join(' ')).split(' ');
}
function faqBodyHay(faq) {
  return normalize([faq.short, (faq.details || []).join(' ')].join(' ')).split(' ');
}

// Khop theo TU nguyen ven, KHONG dung includes() tren ca chuoi: tieng Viet khong dau co rat
// nhieu tu ngan nam long trong tu dai ("ong" nam trong "khong", "an" nam trong "can"), dung
// includes() se khop bua - da tung lam cau "Ong troi hom nay co nang khong nhi?" bi nhan nham
// thanh cau hoi ve co chu. Cho phep sai lech duoi/tren 1 chut bang quy tac tien to voi tu dai
// (>= 5 ky tu) de van khop duoc "dang ky" / "dangky", "truc tuyen" / "tructuyen".
function wordsContain(words, token) {
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    if (w === token) return true;
    if (token.length >= 5 && w.length >= 5 && (w.startsWith(token) || token.startsWith(w))) return true;
  }
  return false;
}

function scoreFaq(faq, normalizedQuery, queryTokens) {
  let score = 0;

  // Lop 1: ca cum cau hoi xuat hien nguyen ven trong cau nguoi dung go.
  for (const phrase of faqPhrases(faq)) {
    const p = normalize(phrase);
    if (p.length >= 6 && normalizedQuery.includes(p)) score = Math.max(score, STRONG_SCORE + p.length);
  }

  // Lop 2: dem tu khoa trung, phan biet tieu de / noi dung.
  const titleHay = faqTitleHay(faq);
  const bodyHay = faqBodyHay(faq);
  let titleHits = 0;
  let anyHits = 0;
  let hasStrongToken = false;   // co it nhat 1 tu >= 4 ky tu trung tieu de
  for (const token of queryTokens) {
    if (wordsContain(titleHay, token)) {
      titleHits += 1;
      anyHits += 1;
      // Tieng Viet khong dau co rat nhieu am tiet 3 chu cai dung chung khap noi ("ket", "qua",
      // "ten", "nop"...). Mot tu 3 chu cai gan nhu khong phan biet duoc cau hoi nao voi cau hoi
      // nao, nen tinh diem thap han so voi tu dai.
      if (token.length >= 4) { hasStrongToken = true; score += 18 + Math.min(token.length, 8); }
      else score += 10 + token.length;
    } else if (wordsContain(bodyHay, token)) { anyHits += 1; score += 6; }
  }
  if (anyHits === 0) return 0;

  // Cau hoi ngan ("wifi", "mat phieu") chi co 1-2 tu co nghia: neu TAT CA deu trung tieu de thi
  // do gan nhu chac chan la cau hoi do, dung de nguong diem tuyet dieu kien. Nhung chi cong
  // thuong khi co du "tin hieu that": 1 tu dai, hoac it nhat 2 tu trung tieu de - neu khong,
  // cau "ban ten gi" chi trung moi tu "ten" cung du diem de tra loi bua.
  const coverage = titleHits / queryTokens.length;
  const enoughSignal = hasStrongToken || titleHits >= 2;
  if (enoughSignal) {
    if (coverage >= 0.8) score += 30;
    else if (coverage >= 0.6) score += 12;
  }
  return score;
}

function tokenize(normalizedQuery) {
  // Loc trung: mot tu lap lai trong cau ("ket qua bong da toi qua") truoc day duoc cong diem
  // 2 lan, du de day mot cau hoi chang lien quan vuot nguong tra loi.
  const seen = new Set();
  const out = [];
  for (const t of normalizedQuery.split(' ')) {
    if (t.length < 3 || STOP_WORDS.has(t) || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

// Tra ve danh sach FAQ phu hop nhat, kem diem - dung cho o tim kiem trang Hoi dap va cho
// phan "cau hoi lien quan" cua chatbot.
function searchFaqs(rawQuery, limit = 5) {
  const q = normalize(rawQuery);
  if (!q) return [];
  const tokens = tokenize(q);
  if (tokens.length === 0) return [];
  return FAQS
    .map((faq) => ({ faq, score: scoreFaq(faq, q, tokens) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Chi tra ve khi DU TIN CAY - tranh viec chatbot tra loi lac de chi vi trung 1 tu chung chung.
function bestFaq(rawQuery) {
  const results = searchFaqs(rawQuery, 1);
  if (results.length === 0) return null;
  return results[0].score >= MIN_CONFIDENT_SCORE ? results[0].faq : null;
}

// Khop chac chan (nguyen cum): duoc quyen tra loi TRUOC ca bo nhan dien ten thu tuc.
function strongFaq(rawQuery) {
  const results = searchFaqs(rawQuery, 1);
  if (results.length === 0) return null;
  return results[0].score >= STRONG_SCORE ? results[0].faq : null;
}

function findFaqById(id) {
  return FAQS.find((f) => f.id === id) || null;
}

function sourceLine(faq) {
  if (!faq.sources || faq.sources.length === 0) return null;
  const titles = faq.sources.map((k) => (SOURCES[k] ? SOURCES[k].url : k));
  return 'Nguồn tham khảo: ' + titles.join(' | ');
}

// Van ban cho khung chat: cau ngan truoc, tung y xuong dong, cuoi cung la muc do xac thuc.
// Duong dan dang [chu](trang.html) duoc public/js/chatbot.js bien thanh lien ket bam duoc.
function faqToChatText(faq) {
  const lines = [faq.short];
  if (faq.details && faq.details.length) {
    lines.push('');
    faq.details.forEach((d) => lines.push('- ' + d));
  }
  if (faq.status === 'UNVERIFIED') {
    lines.push('');
    lines.push('⚠️ Nội dung này TÔI CHƯA XÁC THỰC được bằng nguồn chính thức — hãy hỏi cán bộ tại quầy để chắc chắn.');
  } else if (faq.status === 'PARTIAL') {
    lines.push('');
    lines.push('⚠️ Lưu ý: ' + (faq.note || 'nguồn chỉ xác nhận một phần, hoặc quy định khác nhau theo từng tỉnh.'));
  }
  if (faq.link) {
    const label = faq.link === 'huong-dan-dien-mau.html' ? 'Xem hướng dẫn điền giấy tờ'
      : faq.link === 'nop-ho-so-truc-tuyen.html' ? 'Xem hướng dẫn nộp hồ sơ online'
        : faq.link === 'ket-noi-wifi.html' ? 'Xem hướng dẫn Wi-Fi chữ to'
          : faq.link === 'theo-doi.html' ? 'Mở trang theo dõi số'
            : 'Xem thêm';
    lines.push('[' + label + '](' + faq.link + ')');
  }
  lines.push('[Xem thêm câu hỏi thường gặp](hoi-dap.html)');
  return lines.join('\n');
}

// Du lieu cho trang hoi-dap.html: nhom theo chu de, kem nhan muc xac thuc + nguon.
function listForPublic() {
  return TOPICS.map((topic) => ({
    ...topic,
    faqs: FAQS.filter((f) => f.topic === topic.id).map((f) => ({
      id: f.id,
      q: f.q,
      short: f.short,
      details: f.details || [],
      status: f.status,
      statusLabel: STATUS_LABELS[f.status] || f.status,
      note: f.note || null,
      link: f.link || null,
      sources: (f.sources || []).map((k) => SOURCES[k]).filter(Boolean)
    }))
  }));
}

// Van ban rut gon lam "du lieu can cu" cho AI (chatbotService.js). Chi dua CAU HOI + CAU TRA LOI
// NGAN + muc xac thuc: du de AI tra loi dung huong ma khong lam ngu canh phinh to qua muc.
function buildAiGuideText() {
  return FAQS.map((f) => {
    const flag = f.status === 'UNVERIFIED' ? ' [CHUA XAC THUC - phai noi ro voi nguoi dan]'
      : f.status === 'PARTIAL' ? ' [CHI XAC NHAN MOT PHAN / tuy tinh thanh]' : '';
    return `- Hỏi: ${f.q}\n  Đáp: ${f.short}${flag}`;
  }).join('\n');
}

function buildServiceExtraText() {
  return Object.keys(SERVICE_EXTRA).map((code) => {
    const e = SERVICE_EXTRA[code];
    return `- [${code}] Nơi nộp: ${e.where} | Thời hạn giải quyết: ${e.slaNote} | Nộp trực tuyến: ${e.online} | Căn cứ: ${e.legal}`;
  }).join('\n');
}

function getServiceExtra(code) {
  if (!code) return null;
  const extra = SERVICE_EXTRA[String(code).toUpperCase()];
  if (!extra) return null;
  return {
    ...extra,
    statusLabel: STATUS_LABELS[extra.status] || extra.status,
    sources: (extra.sources || []).map((k) => SOURCES[k]).filter(Boolean),
    relatedFaqs: (extra.faqIds || []).map(findFaqById).filter(Boolean).map((f) => ({ id: f.id, q: f.q, short: f.short }))
  };
}

module.exports = {
  ACCESSED,
  SOURCES,
  STATUS_LABELS,
  TOPICS,
  FAQS,
  SERVICE_EXTRA,
  MIN_CONFIDENT_SCORE,
  STRONG_SCORE,
  normalize,
  searchFaqs,
  bestFaq,
  strongFaq,
  findFaqById,
  faqToChatText,
  sourceLine,
  listForPublic,
  buildAiGuideText,
  buildServiceExtraText,
  getServiceExtra
};
