/**
 * ThoiTietVN – Weather Forecast App
 * app.js – Core application logic
 * Sử dụng OpenWeatherMap API (Current Weather + 5-day Forecast)
 */

// ════════════════════════════════════════
//  CONSTANTS & STATE
// ════════════════════════════════════════
const STORAGE_KEY = 'owm_api_key';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';
const ICON_URL = 'https://openweathermap.org/img/wn';

const WIND_DIRS = ['Bắc', 'Đông Bắc', 'Đông', 'Đông Nam', 'Nam', 'Tây Nam', 'Tây', 'Tây Bắc'];

const state = {
  city: '',
  unit: 'metric',   // 'metric' (°C) | 'imperial' (°F)
  current: null,
  forecast: null,
  isLoading: false,
  lastQuery: '',
};

// ════════════════════════════════════════
//  CƠ SỞ DỮ LIỆU 63 TỈNH THÀNH VIỆT NAM & ĐỊA ĐIỂM NỔI TIẾNG
// ════════════════════════════════════════
const VIETNAM_LOCATIONS = [
  // ── MIỀN BẮC (25 tỉnh/thành) ──
  { id: 'hanoi', name: 'Hà Nội', region: 'Miền Bắc', lat: 21.0285, lon: 105.8542, keywords: ['hà nội', 'ha noi', 'hn', 'thành phố hà nội', 'tp hà nội', 'thủ đô hà nội', 'thủ đô'] },
  { id: 'haiphong', name: 'Hải Phòng', region: 'Miền Bắc', lat: 20.8449, lon: 106.6881, keywords: ['hải phòng', 'hai phong', 'hp', 'tp hải phòng', 'thành phố hải phòng'] },
  { id: 'quangninh', name: 'Quảng Ninh', region: 'Miền Bắc', lat: 20.9597, lon: 107.0436, keywords: ['quảng ninh', 'quang ninh', 'hạ long', 'ha long', 'tp hạ long', 'vịnh hạ long', 'tỉnh quảng ninh'] },
  { id: 'bacninh', name: 'Bắc Ninh', region: 'Miền Bắc', lat: 21.1861, lon: 106.0763, keywords: ['bắc ninh', 'bac ninh', 'tp bắc ninh', 'tỉnh bắc ninh'] },
  { id: 'bacgiang', name: 'Bắc Giang', region: 'Miền Bắc', lat: 21.2718, lon: 106.1947, keywords: ['bắc giang', 'bac giang', 'tp bắc giang', 'tỉnh bắc giang'] },
  { id: 'backan', name: 'Bắc Kạn', region: 'Miền Bắc', lat: 22.1477, lon: 105.8344, keywords: ['bắc kạn', 'bac kan', 'bắc cạn', 'bac can', 'tp bắc kạn', 'tỉnh bắc kạn'] },
  { id: 'caobang', name: 'Cao Bằng', region: 'Miền Bắc', lat: 22.6661, lon: 106.2622, keywords: ['cao bằng', 'cao bang', 'tp cao bằng', 'tỉnh cao bằng'] },
  { id: 'langson', name: 'Lạng Sơn', region: 'Miền Bắc', lat: 21.8454, lon: 106.7614, keywords: ['lạng sơn', 'lang son', 'tp lạng sơn', 'tỉnh lạng sơn'] },
  { id: 'hagiang', name: 'Hà Giang', region: 'Miền Bắc', lat: 22.8025, lon: 104.9784, keywords: ['hà giang', 'ha giang', 'tp hà giang', 'tỉnh hà giang', 'đồng văn', 'dong van'] },
  { id: 'tuyenquang', name: 'Tuyên Quang', region: 'Miền Bắc', lat: 21.8232, lon: 105.2142, keywords: ['tuyên quang', 'tuyen quang', 'tp tuyên quang', 'tỉnh tuyên quang'] },
  { id: 'yenbai', name: 'Yên Bái', region: 'Miền Bắc', lat: 21.7216, lon: 104.9114, keywords: ['yên bái', 'yen bai', 'tp yên bái', 'tỉnh yên bái', 'mù cang chải', 'mu cang chai'] },
  { id: 'laocai', name: 'Lào Cai', region: 'Miền Bắc', lat: 22.4809, lon: 103.9755, keywords: ['lào cai', 'lao cai', 'tp lào cai', 'sapa', 'sa pa', 'tỉnh lào cai'] },
  { id: 'laichau', name: 'Lai Châu', region: 'Miền Bắc', lat: 22.3861, lon: 103.4703, keywords: ['lai châu', 'lai chau', 'tp lai châu', 'tỉnh lai châu'] },
  { id: 'dienbien', name: 'Điện Biên', region: 'Miền Bắc', lat: 21.3856, lon: 103.0232, keywords: ['điện biên', 'dien bien', 'điện biên phủ', 'dien bien phu', 'tp điện biên phủ', 'tỉnh điện biên'] },
  { id: 'sonla', name: 'Sơn La', region: 'Miền Bắc', lat: 21.3272, lon: 103.9144, keywords: ['sơn la', 'son la', 'tp sơn la', 'mộc châu', 'moc chau', 'tỉnh sơn la'] },
  { id: 'hoabinh', name: 'Hòa Bình', region: 'Miền Bắc', lat: 20.8171, lon: 105.3376, keywords: ['hòa bình', 'hoa binh', 'tp hòa bình', 'mai châu', 'mai chau', 'tỉnh hòa bình'] },
  { id: 'phutho', name: 'Phú Thọ', region: 'Miền Bắc', lat: 21.3002, lon: 105.4012, keywords: ['phú thọ', 'phu tho', 'việt trì', 'viet tri', 'tp việt trì', 'tỉnh phú thọ'] },
  { id: 'vinhphuc', name: 'Vĩnh Phúc', region: 'Miền Bắc', lat: 21.3095, lon: 105.5973, keywords: ['vĩnh phúc', 'vinh phuc', 'vĩnh yên', 'vinh yen', 'tam đảo', 'tam dao', 'tỉnh vĩnh phúc'] },
  { id: 'thainguyen', name: 'Thái Nguyên', region: 'Miền Bắc', lat: 21.5943, lon: 105.8480, keywords: ['thái nguyên', 'thai nguyen', 'tp thái nguyên', 'tỉnh thái nguyên'] },
  { id: 'hungyen', name: 'Hưng Yên', region: 'Miền Bắc', lat: 20.6464, lon: 106.0511, keywords: ['hưng yên', 'hung yen', 'tp hưng yên', 'tỉnh hưng yên'] },
  { id: 'haiduong', name: 'Hải Dương', region: 'Miền Bắc', lat: 20.9373, lon: 106.3145, keywords: ['hải dương', 'hai duong', 'tp hải dương', 'tỉnh hải dương'] },
  { id: 'thaibinh', name: 'Thái Bình', region: 'Miền Bắc', lat: 20.4500, lon: 106.3400, keywords: ['thái bình', 'thai binh', 'tp thái bình', 'tỉnh thái bình'] },
  { id: 'hanam', name: 'Hà Nam', region: 'Miền Bắc', lat: 20.5410, lon: 105.9126, keywords: ['hà nam', 'ha nam', 'phủ lý', 'phu ly', 'tp phủ lý', 'tỉnh hà nam'] },
  { id: 'namdinh', name: 'Nam Định', region: 'Miền Bắc', lat: 20.4200, lon: 106.1683, keywords: ['nam định', 'nam dinh', 'tp nam định', 'tỉnh nam định'] },
  { id: 'ninhbinh', name: 'Ninh Bình', region: 'Miền Bắc', lat: 20.2506, lon: 105.9745, keywords: ['ninh bình', 'ninh binh', 'tp ninh bình', 'tràng an', 'trang an', 'tỉnh ninh bình'] },

  // ── MIỀN TRUNG & TÂY NGUYÊN (19 tỉnh/thành) ──
  { id: 'thanhhoa', name: 'Thanh Hóa', region: 'Miền Trung', lat: 19.8067, lon: 105.7852, keywords: ['thanh hóa', 'thanh hoa', 'tp thanh hóa', 'sầm sơn', 'sam son', 'tỉnh thanh hóa'] },
  { id: 'nghean', name: 'Nghệ An', region: 'Miền Trung', lat: 18.6796, lon: 105.6813, keywords: ['nghệ an', 'nghe an', 'vinh', 'tp vinh', 'thành phố vinh', 'tỉnh nghệ an', 'cửa lò', 'cua lo'] },
  { id: 'hatinh', name: 'Hà Tĩnh', region: 'Miền Trung', lat: 18.3560, lon: 105.8878, keywords: ['hà tĩnh', 'ha tinh', 'tp hà tĩnh', 'tỉnh hà tĩnh'] },
  { id: 'quangbinh', name: 'Quảng Bình', region: 'Miền Trung', lat: 17.4833, lon: 106.5996, keywords: ['quảng bình', 'quang binh', 'đồng hới', 'dong hoi', 'tp đồng hới', 'phong nha', 'tỉnh quảng bình'] },
  { id: 'quangtri', name: 'Quảng Trị', region: 'Miền Trung', lat: 16.8200, lon: 107.1000, keywords: ['quảng trị', 'quang tri', 'đông hà', 'dong ha', 'tp đông hà', 'tỉnh quảng trị'] },
  { id: 'thuathienhue', name: 'Thừa Thiên Huế', region: 'Miền Trung', lat: 16.4637, lon: 107.5909, keywords: ['thừa thiên huế', 'thua thien hue', 'huế', 'hue', 'tp huế', 'thành phố huế', 'tỉnh thừa thiên huế'] },
  { id: 'danang', name: 'Đà Nẵng', region: 'Miền Trung', lat: 16.0544, lon: 108.2022, keywords: ['đà nẵng', 'da nang', 'dn', 'tp đà nẵng', 'thành phố đà nẵng', 'bà nà', 'ba na'] },
  { id: 'quangnam', name: 'Quảng Nam', region: 'Miền Trung', lat: 15.5736, lon: 108.4736, keywords: ['quảng nam', 'quang nam', 'tam kỳ', 'tam ky', 'hội an', 'hoi an', 'tp hội an', 'tỉnh quảng nam'] },
  { id: 'quangngai', name: 'Quảng Ngãi', region: 'Miền Trung', lat: 15.1203, lon: 108.7922, keywords: ['quảng ngãi', 'quang ngai', 'tp quảng ngãi', 'tỉnh quảng ngãi', 'lý sơn', 'ly son'] },
  { id: 'binhdinh', name: 'Bình Định', region: 'Miền Trung', lat: 13.7765, lon: 109.2237, keywords: ['bình định', 'binh dinh', 'quy nhơn', 'quy nhon', 'tp quy nhơn', 'tỉnh bình định'] },
  { id: 'phuyen', name: 'Phú Yên', region: 'Miền Trung', lat: 13.0956, lon: 109.3028, keywords: ['phú yên', 'phu yen', 'tuy hòa', 'tuy hoa', 'tp tuy hòa', 'tỉnh phú yên'] },
  { id: 'khanhhoa', name: 'Khánh Hòa', region: 'Miền Trung', lat: 12.2388, lon: 109.1967, keywords: ['khánh hòa', 'khanh hoa', 'nha trang', 'tp nha trang', 'cam ranh', 'tp cam ranh', 'tỉnh khánh hòa'] },
  { id: 'ninhthuan', name: 'Ninh Thuận', region: 'Miền Trung', lat: 11.5676, lon: 108.9880, keywords: ['ninh thuận', 'ninh thuan', 'phan rang', 'phan rang tháp chàm', 'tp phan rang', 'tỉnh ninh thuận'] },
  { id: 'binhthuan', name: 'Bình Thuận', region: 'Miền Trung', lat: 10.9289, lon: 108.1003, keywords: ['bình thuận', 'binh thuan', 'phan thiết', 'phan thiet', 'mũi né', 'mui ne', 'tỉnh bình thuận'] },
  { id: 'kontum', name: 'Kon Tum', region: 'Tây Nguyên', lat: 14.3497, lon: 108.0005, keywords: ['kon tum', 'kontum', 'tp kon tum', 'tỉnh kon tum', 'măng đen', 'mang den'] },
  { id: 'gialai', name: 'Gia Lai', region: 'Tây Nguyên', lat: 13.9833, lon: 108.0000, keywords: ['gia lai', 'pleiku', 'tp pleiku', 'tỉnh gia lai'] },
  { id: 'daklak', name: 'Đắk Lắk', region: 'Tây Nguyên', lat: 12.6667, lon: 108.0500, keywords: ['đắk lắk', 'dak lak', 'đắc lắc', 'dac lac', 'buôn ma thuột', 'buon ma thuot', 'bmt', 'tp buôn ma thuột', 'tỉnh đắk lắk'] },
  { id: 'daknong', name: 'Đắk Nông', region: 'Tây Nguyên', lat: 12.0050, lon: 107.6907, keywords: ['đắk nông', 'dak nong', 'đắc nông', 'gia nghĩa', 'gia nghia', 'tp gia nghĩa', 'tỉnh đắk nông'] },
  { id: 'lamdong', name: 'Lâm Đồng', region: 'Tây Nguyên', lat: 11.9404, lon: 108.4583, keywords: ['lâm đồng', 'lam dong', 'đà lạt', 'da lat', 'tp đà lạt', 'bảo lộc', 'bao loc', 'tp bảo lộc', 'tỉnh lâm đồng'] },

  // ── MIỀN NAM (19 tỉnh/thành) ──
  { id: 'hcm', name: 'TP. Hồ Chí Minh', region: 'Miền Nam', lat: 10.8231, lon: 106.6297, keywords: ['hồ chí minh', 'ho chi minh', 'tp hồ chí minh', 'tp ho chi minh', 'thành phố hồ chí minh', 'sài gòn', 'sai gon', 'hcm', 'tphcm', 'sg', 'saigon'] },
  { id: 'cantho', name: 'Cần Thơ', region: 'Miền Nam', lat: 10.0452, lon: 105.7469, keywords: ['cần thơ', 'can tho', 'tp cần thơ', 'thành phố cần thơ', 'tây đô'] },
  { id: 'binhduong', name: 'Bình Dương', region: 'Miền Nam', lat: 10.9804, lon: 106.6519, keywords: ['bình dương', 'binh duong', 'thủ dầu một', 'thu dau mot', 'dĩ an', 'di an', 'thuận an', 'thuan an', 'tp thủ dầu một', 'tỉnh bình dương'] },
  { id: 'dongnai', name: 'Đồng Nai', region: 'Miền Nam', lat: 10.9574, lon: 106.8426, keywords: ['đồng nai', 'dong nai', 'biên hòa', 'bien hoa', 'tp biên hòa', 'long khánh', 'tỉnh đồng nai'] },
  { id: 'bariavungtau', name: 'Bà Rịa – Vũng Tàu', region: 'Miền Nam', lat: 10.4113, lon: 107.1362, keywords: ['bà rịa vũng tàu', 'ba ria vung tau', 'vũng tàu', 'vung tau', 'bà rịa', 'ba ria', 'brvt', 'tp vũng tàu', 'tỉnh bà rịa vũng tàu', 'bà rịa - vũng tàu'] },
  { id: 'binhphuoc', name: 'Bình Phước', region: 'Miền Nam', lat: 11.5353, lon: 106.8854, keywords: ['bình phước', 'binh phuoc', 'đồng xoài', 'dong xoai', 'tp đồng xoài', 'tỉnh bình phước'] },
  { id: 'tayninh', name: 'Tây Ninh', region: 'Miền Nam', lat: 11.3351, lon: 106.1099, keywords: ['tây ninh', 'tay ninh', 'tp tây ninh', 'núi bà đen', 'nui ba den', 'tỉnh tây ninh'] },
  { id: 'longan', name: 'Long An', region: 'Miền Nam', lat: 10.5353, lon: 106.4100, keywords: ['long an', 'tân an', 'tan an', 'tp tân an', 'tỉnh long an'] },
  { id: 'tiengiang', name: 'Tiền Giang', region: 'Miền Nam', lat: 10.3600, lon: 106.3600, keywords: ['tiền giang', 'tien giang', 'mỹ tho', 'my tho', 'tp mỹ tho', 'tỉnh tiền giang'] },
  { id: 'bentre', name: 'Bến Tre', region: 'Miền Nam', lat: 10.2333, lon: 106.3833, keywords: ['bến tre', 'ben tre', 'tp bến tre', 'tỉnh bến tre'] },
  { id: 'travinh', name: 'Trà Vinh', region: 'Miền Nam', lat: 9.9347, lon: 106.3453, keywords: ['trà vinh', 'tra vinh', 'tp trà vinh', 'tỉnh trà vinh'] },
  { id: 'vinhlong', name: 'Vĩnh Long', region: 'Miền Nam', lat: 10.2538, lon: 105.9722, keywords: ['vĩnh long', 'vinh long', 'tp vĩnh long', 'tỉnh vĩnh long'] },
  { id: 'dongthap', name: 'Đồng Tháp', region: 'Miền Nam', lat: 10.4667, lon: 105.6333, keywords: ['đồng tháp', 'dong thap', 'cao lãnh', 'cao lanh', 'sa đéc', 'sa dec', 'tp cao lãnh', 'tỉnh đồng tháp'] },
  { id: 'angiang', name: 'An Giang', region: 'Miền Nam', lat: 10.3785, lon: 105.4350, keywords: ['an giang', 'long xuyên', 'long xuyen', 'châu đốc', 'chau doc', 'tp long xuyên', 'tp châu đốc', 'tỉnh an giang'] },
  { id: 'kiengiang', name: 'Kiên Giang', region: 'Miền Nam', lat: 10.0125, lon: 105.0809, keywords: ['kiên giang', 'kien giang', 'rạch giá', 'rach gia', 'phú quốc', 'phu quốc', 'phu quoc', 'tp rạch giá', 'tp phú quốc', 'đảo phú quốc', 'tỉnh kiên giang', 'hà tiên', 'ha tien'] },
  { id: 'haugiang', name: 'Hậu Giang', region: 'Miền Nam', lat: 9.7792, lon: 105.4708, keywords: ['hậu giang', 'hau giang', 'vị thanh', 'vi thanh', 'tp vị thanh', 'tỉnh hậu giang'] },
  { id: 'soctrang', name: 'Sóc Trăng', region: 'Miền Nam', lat: 9.6026, lon: 105.9739, keywords: ['sóc trăng', 'soc trang', 'tp sóc trăng', 'tỉnh sóc trăng'] },
  { id: 'baclieu', name: 'Bạc Liêu', region: 'Miền Nam', lat: 9.2941, lon: 105.7279, keywords: ['bạc liêu', 'bac lieu', 'tp bạc liêu', 'tỉnh bạc liêu'] },
  { id: 'camau', name: 'Cà Mau', region: 'Miền Nam', lat: 9.1769, lon: 105.1500, keywords: ['cà mau', 'ca mau', 'tp cà mau', 'mũi cà mau', 'tỉnh cà mau'] },

  // ── ĐỊA ĐIỂM DU LỊCH NỔI TIẾNG (Tùy chọn tìm kiếm nhanh) ──
  { id: 'phuquoc_top', name: 'Phú Quốc', region: 'Miền Nam', lat: 10.2277, lon: 103.9594, keywords: ['phú quốc', 'phu quoc', 'đảo phú quốc', 'dao phu quoc'] },
  { id: 'sapa_top', name: 'Sa Pa – Lào Cai', region: 'Miền Bắc', lat: 22.3364, lon: 103.8438, keywords: ['sa pa', 'sapa', 'thị xã sapa', 'thi xa sapa'] },
  { id: 'hoian_top', name: 'Hội An', region: 'Miền Trung', lat: 15.8794, lon: 108.3350, keywords: ['hội an', 'hoi an', 'phố cổ hội an'] },
  { id: 'dalat_top', name: 'Đà Lạt', region: 'Tây Nguyên', lat: 11.9404, lon: 108.4583, keywords: ['đà lạt', 'da lat', 'thành phố đà lạt'] },
  { id: 'nhatrang_top', name: 'Nha Trang', region: 'Miền Trung', lat: 12.2388, lon: 109.1967, keywords: ['nha trang', 'vịnh nha trang'] },
  { id: 'vungtau_top', name: 'Vũng Tàu', region: 'Miền Nam', lat: 10.3460, lon: 107.0843, keywords: ['vũng tàu', 'vung tau', 'tp vũng tàu'] },
  { id: 'halong_top', name: 'Hạ Long', region: 'Miền Bắc', lat: 20.9599, lon: 107.0863, keywords: ['hạ long', 'ha long', 'vịnh hạ long', 'vinh ha long'] },
  { id: 'phanthiet_top', name: 'Phan Thiết', region: 'Miền Trung', lat: 10.9289, lon: 108.1003, keywords: ['phan thiết', 'phan thiet', 'mũi né', 'mui ne'] },
];

// ════════════════════════════════════════
//  VIETNAMESE NORMALIZATION & SMART MATCHING
// ════════════════════════════════════════
function normalizeVietnamese(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[-_./,\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanPrefix(normStr) {
  return normStr
    .replace(/^(tinh|thanh pho|tp|thx|thi xa|huyen|quan|tx)\s+/i, '')
    .trim();
}

function findVietnamLocation(query) {
  if (!query) return null;
  const normQuery = normalizeVietnamese(query);
  if (!normQuery) return null;
  const cleanQuery = cleanPrefix(normQuery);

  let bestMatch = null;
  let bestScore = -1;

  for (const loc of VIETNAM_LOCATIONS) {
    const normName = normalizeVietnamese(loc.name);
    const cleanName = cleanPrefix(normName);

    // 1. Khớp chính xác hoàn toàn (score: 100)
    if (cleanQuery === cleanName || normQuery === normName || normQuery === loc.id) {
      return loc;
    }

    if (loc.keywords) {
      for (const kw of loc.keywords) {
        const normKw = normalizeVietnamese(kw);
        const cleanKw = cleanPrefix(normKw);
        if (normQuery === normKw || cleanQuery === cleanKw || cleanQuery === normKw) {
          return loc;
        }
      }
    }

    // 2. Khớp tiền tố (startsWith) hoặc từ khóa con
    if (cleanQuery.length >= 2) {
      if (cleanName.startsWith(cleanQuery) || normName.startsWith(normQuery)) {
        const score = 80 - Math.abs(cleanName.length - cleanQuery.length);
        if (score > bestScore) {
          bestMatch = loc;
          bestScore = score;
        }
      }

      if (loc.keywords) {
        for (const kw of loc.keywords) {
          const normKw = normalizeVietnamese(kw);
          const cleanKw = cleanPrefix(normKw);
          if (cleanKw.startsWith(cleanQuery) || normKw.startsWith(normQuery)) {
            const score = 78 - Math.abs(cleanKw.length - cleanQuery.length);
            if (score > bestScore) {
              bestMatch = loc;
              bestScore = score;
            }
          } else if ((normKw.includes(cleanQuery) || cleanKw.includes(cleanQuery)) && cleanQuery.length >= 4) {
            const score = 65 - Math.abs(cleanKw.length - cleanQuery.length);
            if (score > bestScore) {
              bestMatch = loc;
              bestScore = score;
            }
          }
        }
      }
    }
  }

  return bestScore >= 50 ? bestMatch : null;
}

function filterVietnamLocations(query, maxResults = 7) {
  if (!query || query.trim().length === 0) return [];
  const normQuery = normalizeVietnamese(query);
  const cleanQuery = cleanPrefix(normQuery);

  const scored = [];

  for (const loc of VIETNAM_LOCATIONS) {
    const normName = normalizeVietnamese(loc.name);
    const cleanName = cleanPrefix(normName);

    let score = 0;

    if (cleanQuery === cleanName || normQuery === normName || normQuery === loc.id) {
      score = 100;
    } else if (cleanName.startsWith(cleanQuery) || normName.startsWith(normQuery)) {
      score = 90 - Math.abs(cleanName.length - cleanQuery.length);
    } else if (cleanName.includes(cleanQuery) || normName.includes(normQuery)) {
      score = 75 - Math.abs(cleanName.length - cleanQuery.length);
    }

    if (loc.keywords) {
      for (const kw of loc.keywords) {
        const normKw = normalizeVietnamese(kw);
        const cleanKw = cleanPrefix(normKw);
        if (normQuery === normKw || cleanQuery === cleanKw) {
          score = Math.max(score, 98);
        } else if (cleanKw.startsWith(cleanQuery) || normKw.startsWith(normQuery)) {
          score = Math.max(score, 85 - Math.abs(cleanKw.length - cleanQuery.length));
        } else if ((normKw.includes(cleanQuery) || cleanKw.includes(cleanQuery)) && cleanQuery.length >= 2) {
          score = Math.max(score, 68 - Math.abs(cleanKw.length - cleanQuery.length));
        }
      }
    }

    if (score > 40) {
      scored.push({ loc, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxResults).map(item => item.loc);
}

function findClosestVietnamLocation(lat, lon, maxKm = 35) {
  let closest = null;
  let minDist = Infinity;

  for (const loc of VIETNAM_LOCATIONS) {
    const dLat = (lat - loc.lat) * 111;
    const dLon = (lon - loc.lon) * 111 * Math.cos(lat * Math.PI / 180);
    const dist = Math.sqrt(dLat * dLat + dLon * dLon);

    if (dist < minDist) {
      minDist = dist;
      closest = { ...loc, distance: dist };
    }
  }

  return minDist <= maxKm ? closest : null;
}

// ════════════════════════════════════════
//  DOM REFERENCES
// ════════════════════════════════════════
const $ = id => document.getElementById(id);

const searchForm = $('searchForm');
const searchInput = $('searchInput');
const searchSuggestions = $('searchSuggestions');
const clearBtn = $('clearBtn');
const locationBtn = $('locationBtn');
const searchBtn = $('searchBtn');

const loadingState = $('loadingState');
const errorState = $('errorState');
const errorMsg = $('errorMsg');
const retryBtn = $('retryBtn');
const emptyState = $('emptyState');
const resultsSection = $('resultsSection');

// Current weather
const cityNameEl = $('cityName');
const countryNameEl = $('countryName');
const localTimeEl = $('localTime');
const weatherDescEl = $('weatherDesc');
const weatherIconEl = $('weatherIcon');
const currentTempEl = $('currentTemp');
const tempUnitEl = $('tempUnit');
const feelsLikeEl = $('feelsLike');
const humidityEl = $('humidity');
const windSpeedEl = $('windSpeed');
const pressureEl = $('pressure');
const visibilityEl = $('visibility');
const sunriseEl = $('sunrise');
const sunsetEl = $('sunset');
const tempMinMaxEl = $('tempMinMax');

// Forecast
const hourlyScrollEl = $('hourlyScroll');
const dailyGridEl = $('dailyGrid');

// Env indicators
const cloudinessEl = $('cloudiness');
const cloudBarEl = $('cloudBar');
const humidityEnvEl = $('humidityEnv');
const humidBarEl = $('humidBar');
const windValueEl = $('windValue');
const windDirEl = $('windDirection');
const feelsLikeEnvEl = $('feelsLikeEnv');
const feelsLevelEl = $('feelsLevel');

// Settings
const settingsBtn = $('settingsBtn');
const settingsModal = $('settingsModal');
const closeSettings = $('closeSettings');
const cancelSettings = $('cancelSettings');
const saveSettings = $('saveSettings');
const apiKeyInput = $('apiKeyInput');
const toggleKeyVis = $('toggleKeyVisibility');
const testKeyBtn = $('testKeyBtn');
const testKeyResult = $('testKeyResult');

// Unit toggle
const unitToggleBtn = $('unitToggleBtn');
const unitLabelEl = $('unitLabel');

const toast = $('toast');

// ════════════════════════════════════════
//  API KEY MANAGEMENT
// ════════════════════════════════════════
function getApiKey() {
  return localStorage.getItem(STORAGE_KEY) || '';
}
function saveApiKey(key) {
  localStorage.setItem(STORAGE_KEY, key.trim());
}

// ════════════════════════════════════════
//  TOAST
// ════════════════════════════════════════
let toastTimer = null;
function showToast(message, type = 'default', duration = 3000) {
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, duration);
}

// ════════════════════════════════════════
//  UI STATE
// ════════════════════════════════════════
function setUIState(uiState) {
  loadingState.hidden = uiState !== 'loading';
  errorState.hidden = uiState !== 'error';
  emptyState.hidden = uiState !== 'empty';
  resultsSection.hidden = uiState !== 'results';
}

function showError(message) {
  errorMsg.textContent = message;
  setUIState('error');
  resetSearchBtn();
  state.isLoading = false;
}

function updateSearchBtn(text) {
  searchBtn.disabled = true;
  searchBtn.style.opacity = '0.7';
  const btnText = searchBtn.querySelector('.btn-text');
  if (btnText) btnText.textContent = text;
}

function resetSearchBtn() {
  searchBtn.disabled = false;
  searchBtn.style.opacity = '1';
  const btnText = searchBtn.querySelector('.btn-text');
  if (btnText) btnText.textContent = 'Tìm kiếm';
}

// ════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════
function tempLabel(val) {
  return state.unit === 'metric' ? `${Math.round(val)}°C` : `${Math.round(val)}°F`;
}

function windLabel(ms) {
  if (state.unit === 'metric') return `${Math.round(ms)} m/s`;
  // ms là m/s, đổi sang mph
  return `${Math.round(ms * 2.237)} mph`;
}

function windDegToDir(deg) {
  const idx = Math.round(deg / 45) % 8;
  return WIND_DIRS[idx];
}

function formatTime(unix, timezoneOffset) {
  // timezoneOffset là giây lệch UTC từ API
  const date = new Date((unix + timezoneOffset) * 1000);
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatDate(unix, timezoneOffset, opts = {}) {
  const date = new Date((unix + timezoneOffset) * 1000);
  const defaults = { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' };
  return date.toLocaleDateString('vi-VN', { ...defaults, ...opts });
}

function getDayLabel(unix, timezoneOffset) {
  const now = new Date();
  const date = new Date((unix + timezoneOffset) * 1000);
  const nowDay = new Date((Math.floor(now.getTime() / 1000) + timezoneOffset) * 1000).toISOString().slice(0, 10);
  const itemDay = new Date((unix + timezoneOffset) * 1000).toISOString().slice(0, 10);

  if (itemDay === nowDay) return 'Hôm nay';
  return date.toLocaleDateString('vi-VN', { weekday: 'short', timeZone: 'UTC' });
}

function iconUrl(code, size = '2x') {
  return `${ICON_URL}/${code}@${size}.png`;
}

function uvLevel(uvi) {
  if (uvi <= 2) return { label: 'Thấp', color: '#4ade80' };
  if (uvi <= 5) return { label: 'Trung bình', color: '#fbbf24' };
  if (uvi <= 7) return { label: 'Cao', color: '#fb923c' };
  if (uvi <= 10) return { label: 'Rất cao', color: '#f87171' };
  return { label: 'Cực cao', color: '#c084fc' };
}

function feelsLabel(diff) {
  if (diff < -3) return '🥶 Lạnh hơn thực tế';
  if (diff > 3) return '🥵 Nóng hơn thực tế';
  return '😊 Gần như thực tế';
}

function getWeatherColorClass(weatherItem) {
  if (!weatherItem || !weatherItem.weather || !weatherItem.weather[0]) return 'weather-cloud';
  const main = (weatherItem.weather[0].main || '').toLowerCase();
  const desc = (weatherItem.weather[0].description || '').toLowerCase();
  const icon = weatherItem.weather[0].icon || '';

  // Mưa, dông, tuyết -> Xanh dương (Blue)
  if (
    main.includes('rain') ||
    main.includes('drizzle') ||
    main.includes('thunderstorm') ||
    main.includes('snow') ||
    desc.includes('mưa') ||
    desc.includes('dông') ||
    desc.includes('tuyết') ||
    ['09d', '09n', '10d', '10n', '11d', '11n', '13d', '13n'].includes(icon)
  ) {
    return 'weather-rain';
  }

  // Nắng, trời quang -> Vàng cam (Sun / Yellow-Orange)
  if (
    main.includes('clear') ||
    desc.includes('nắng') ||
    desc.includes('quang') ||
    ['01d', '01n', '02d', '02n'].includes(icon)
  ) {
    return 'weather-sun';
  }

  // Âm u, nhiều mây, sương mù -> Màu xám (Cloud / Grey)
  return 'weather-cloud';
}

// ════════════════════════════════════════
//  API CALLS
// ════════════════════════════════════════
async function fetchWeather(city) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API_KEY_MISSING');

  const units = state.unit;
  const [currentRes, forecastRes] = await Promise.all([
    fetch(`${BASE_URL}/weather?q=${encodeURIComponent(city)}&units=${units}&lang=vi&appid=${apiKey}`),
    fetch(`${BASE_URL}/forecast?q=${encodeURIComponent(city)}&units=${units}&lang=vi&cnt=40&appid=${apiKey}`),
  ]);

  if (!currentRes.ok) {
    if (currentRes.status === 401) throw new Error('API_KEY_INVALID');
    if (currentRes.status === 404) throw new Error('CITY_NOT_FOUND');
    if (currentRes.status === 429) throw new Error('API_RATE_LIMIT');
    throw new Error(`HTTP_${currentRes.status}`);
  }

  const current = await currentRes.json();
  const forecast = await forecastRes.json();
  return { current, forecast };
}

async function fetchWeatherByCoords(lat, lon) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API_KEY_MISSING');

  const units = state.unit;
  const [currentRes, forecastRes] = await Promise.all([
    fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=${units}&lang=vi&appid=${apiKey}`),
    fetch(`${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=${units}&lang=vi&cnt=40&appid=${apiKey}`),
  ]);

  if (!currentRes.ok) {
    if (currentRes.status === 401) throw new Error('API_KEY_INVALID');
    if (currentRes.status === 429) throw new Error('API_RATE_LIMIT');
    throw new Error(`HTTP_${currentRes.status}`);
  }

  const current = await currentRes.json();
  const forecast = await forecastRes.json();
  return { current, forecast };
}

// ════════════════════════════════════════
//  RENDER
// ════════════════════════════════════════
function renderCurrentWeather(data) {
  const tz = data.timezone; // seconds offset from UTC

  cityNameEl.textContent = data.name;
  countryNameEl.textContent = data.sys.country ? `(${data.sys.country})` : '';

  // Thời gian địa phương
  const now = Math.floor(Date.now() / 1000);
  const localDate = new Date((now + tz) * 1000);
  localTimeEl.textContent = localDate.toUTCString().replace(' GMT', '').slice(0, -3)
    .replace(/(\w+), (\d+) (\w+) (\d+) (\d+:\d+)/, '$1, $2 $3 $4 — $5');
  // Đơn giản hơn:
  localTimeEl.textContent = `📅 ${formatDate(now, tz, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ⏰ ${formatTime(now, tz)}`;

  weatherDescEl.textContent = data.weather[0].description;

  weatherIconEl.src = iconUrl(data.weather[0].icon, '4x');
  weatherIconEl.alt = data.weather[0].description;

  currentTempEl.textContent = Math.round(data.main.temp);
  tempUnitEl.textContent = state.unit === 'metric' ? '°C' : '°F';
  tempUnitEl.id = 'tempUnit'; // keep ref

  feelsLikeEl.textContent = tempLabel(data.main.feels_like);
  humidityEl.textContent = `${data.main.humidity}%`;
  windSpeedEl.textContent = windLabel(data.wind.speed) + (data.wind.deg ? ` ${windDegToDir(data.wind.deg)}` : '');
  pressureEl.textContent = `${data.main.pressure} hPa`;
  visibilityEl.textContent = data.visibility ? `${(data.visibility / 1000).toFixed(1)} km` : '–';
  sunriseEl.textContent = formatTime(data.sys.sunrise, tz);
  sunsetEl.textContent = formatTime(data.sys.sunset, tz);
  tempMinMaxEl.textContent = `${tempLabel(data.main.temp_min)} / ${tempLabel(data.main.temp_max)}`;

  // Env indicators
  const clouds = data.clouds?.all ?? 0;
  cloudinessEl.textContent = `${clouds}%`;
  cloudBarEl.style.width = `${clouds}%`;

  const humid = data.main.humidity;
  humidityEnvEl.textContent = `${humid}%`;
  humidBarEl.style.width = `${humid}%`;

  const wspd = windLabel(data.wind.speed);
  windValueEl.textContent = wspd;
  windDirEl.textContent = data.wind.deg ? `Hướng: ${windDegToDir(data.wind.deg)}` : '';

  const diff = data.main.feels_like - data.main.temp;
  feelsLikeEnvEl.textContent = tempLabel(data.main.feels_like);
  feelsLevelEl.textContent = feelsLabel(diff);

  const currentWeatherCard = $('currentWeather');
  if (currentWeatherCard) {
    currentWeatherCard.className = 'current-weather-card ' + getWeatherColorClass(data);
  }
}

function renderHourly(forecastData, tz) {
  hourlyScrollEl.innerHTML = '';
  const rawList = forecastData.list;
  if (!rawList || !rawList.length) return;

  const t0 = rawList[0].dt;
  const hourlyItems = [];

  // Tạo liên tục 24 giờ tiếp theo, mỗi giờ cách nhau đúng 1 tiếng (3600 giây)
  for (let hourOffset = 0; hourOffset < 24; hourOffset++) {
    const t = t0 + hourOffset * 3600;
    const k = Math.floor(hourOffset / 3);
    const rem = hourOffset % 3;
    const ratio = rem / 3;

    const A = rawList[k] || rawList[rawList.length - 1];
    const B = rawList[k + 1] || A;

    // Nội suy nhiệt độ và xác suất mưa theo giờ
    const interpTemp = A.main.temp + (B.main.temp - A.main.temp) * ratio;
    const interpPop = (A.pop || 0) + ((B.pop || 0) - (A.pop || 0)) * ratio;

    // Chọn thông tin thời tiết từ mốc gần nhất
    const baseWeather = ratio < 0.5 ? A.weather[0] : B.weather[0];
    let icon = baseWeather.icon || '01d';

    // Tự động chuyển icon Ngày / Đêm theo giờ địa phương thực tế (19h-5h: đêm 'n', 6h-18h: ngày 'd')
    const localHour = new Date((t + tz) * 1000).getUTCHours();
    const isNight = localHour >= 19 || localHour < 6;
    if (isNight && icon.endsWith('d')) {
      icon = icon.slice(0, -1) + 'n';
    } else if (!isNight && icon.endsWith('n')) {
      icon = icon.slice(0, -1) + 'd';
    }

    hourlyItems.push({
      dt: t,
      main: { temp: interpTemp },
      pop: interpPop,
      weather: [{
        main: baseWeather.main,
        description: baseWeather.description,
        icon: icon
      }]
    });
  }

  hourlyItems.forEach((item, i) => {
    const card = document.createElement('div');
    const weatherClass = getWeatherColorClass(item);
    card.className = `hourly-card ${weatherClass}` + (i === 0 ? ' highlight' : '');
    card.setAttribute('role', 'listitem');

    const popPct = Math.round((item.pop || 0) * 100);
    const pop = popPct > 0 ? `💧 ${popPct}%` : '';
    card.innerHTML = `
      <span class="hourly-time">${i === 0 ? 'Bây giờ' : formatTime(item.dt, tz)}</span>
      <img class="hourly-icon" src="${iconUrl(item.weather[0].icon)}" alt="${item.weather[0].description}" loading="lazy"/>
      <span class="hourly-temp">${tempLabel(item.main.temp)}</span>
      ${pop ? `<span class="hourly-pop">${pop}</span>` : ''}
    `;
    hourlyScrollEl.appendChild(card);
  });
}

function renderDaily(forecastData, tz) {
  dailyGridEl.innerHTML = '';

  // Group by day
  const dayMap = {};
  forecastData.list.forEach(item => {
    const day = new Date((item.dt + tz) * 1000).toISOString().slice(0, 10);
    if (!dayMap[day]) dayMap[day] = [];
    dayMap[day].push(item);
  });

  const days = Object.keys(dayMap).slice(0, 5);
  const todayKey = new Date((Math.floor(Date.now() / 1000) + tz) * 1000).toISOString().slice(0, 10);

  days.forEach(dayKey => {
    const items = dayMap[dayKey];
    const firstItem = items[0];
    const temps = items.map(i => i.main.temp);
    const maxTemp = Math.max(...temps);
    const minTemp = Math.min(...temps);
    const maxPop = Math.max(...items.map(i => i.pop || 0));
    // Lấy icon của giữa ngày nếu có
    const noonItem = items.find(i => {
      const h = new Date((i.dt + tz) * 1000).getUTCHours();
      return h >= 11 && h <= 13;
    }) || firstItem;

    const card = document.createElement('div');
    const weatherClass = getWeatherColorClass(noonItem);
    card.className = `daily-card ${weatherClass}` + (dayKey === todayKey ? ' today' : '');
    card.setAttribute('role', 'listitem');
    card.style.animationDelay = `${days.indexOf(dayKey) * 80}ms`;
    card.style.animation = 'fadeIn 0.5s ease both';

    card.innerHTML = `
      <span class="daily-day">${getDayLabel(firstItem.dt, tz)}</span>
      <img class="daily-icon" src="${iconUrl(noonItem.weather[0].icon)}" alt="${noonItem.weather[0].description}" loading="lazy"/>
      <span class="daily-desc">${noonItem.weather[0].description}</span>
      <div class="daily-temps">
        <span class="daily-high">${tempLabel(maxTemp)}</span>
        <span class="daily-sep">/</span>
        <span class="daily-low">${tempLabel(minTemp)}</span>
      </div>
      ${maxPop > 0 ? `<span class="daily-pop">💧 ${Math.round(maxPop * 100)}%</span>` : ''}
    `;
    dailyGridEl.appendChild(card);
  });
}

// ════════════════════════════════════════
//  SEARCH
// ════════════════════════════════════════
async function performSearch(city) {
  if (state.isLoading) return;
  if (!city) { searchInput.focus(); return; }

  state.isLoading = true;
  state.lastQuery = city;

  if (searchSuggestions) searchSuggestions.hidden = true;

  updateSearchBtn('Đang tải...');
  setUIState('loading');

  try {
    // 1. Ưu tiên số 1: Tìm trong CSDL 63 Tỉnh/Thành phố & Địa điểm nổi tiếng Việt Nam
    const vnMatch = findVietnamLocation(city);
    if (vnMatch) {
      const { current, forecast } = await fetchWeatherByCoords(vnMatch.lat, vnMatch.lon);
      current.name = vnMatch.name;
      current.sys = current.sys || {};
      current.sys.country = 'VN';

      state.current = current;
      state.forecast = forecast;

      const tz = current.timezone;

      renderCurrentWeather(current);
      renderHourly(forecast, tz);
      renderDaily(forecast, tz);

      setUIState('results');
      searchInput.value = vnMatch.name;
      clearBtn.hidden = false;
      resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    // 2. Nếu không thuộc CSDL Việt Nam -> Dùng OpenWeatherMap Geocoding API (chuẩn hơn /weather?q=)
    let targetLat = null;
    let targetLon = null;
    let targetName = null;
    let targetCountry = null;

    const apiKey = getApiKey();
    if (!apiKey) throw new Error('API_KEY_MISSING');

    try {
      const geoRes = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=5&appid=${apiKey}`);
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData && geoData.length > 0) {
          const vnGeo = geoData.find(g => g.country === 'VN') || geoData[0];
          targetLat = vnGeo.lat;
          targetLon = vnGeo.lon;
          targetName = vnGeo.local_names?.vi || vnGeo.name;
          targetCountry = vnGeo.country;
        }
      }
    } catch (e) {
      // Bỏ qua lỗi Geocoding, fallback xuống fetchWeather thông thường
    }

    if (targetLat !== null && targetLon !== null) {
      const { current, forecast } = await fetchWeatherByCoords(targetLat, targetLon);
      current.name = targetName || current.name;
      if (targetCountry) {
        current.sys = current.sys || {};
        current.sys.country = targetCountry;
      }

      state.current = current;
      state.forecast = forecast;

      const tz = current.timezone;

      renderCurrentWeather(current);
      renderHourly(forecast, tz);
      renderDaily(forecast, tz);

      setUIState('results');
      searchInput.value = current.name;
      clearBtn.hidden = false;
      resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    // 3. Fallback cuối cùng: dùng /weather?q= thông thường
    const { current, forecast } = await fetchWeather(city);
    state.current = current;
    state.forecast = forecast;

    const tz = current.timezone;

    renderCurrentWeather(current);
    renderHourly(forecast, tz);
    renderDaily(forecast, tz);

    setUIState('results');
    searchInput.value = current.name;
    clearBtn.hidden = false;
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    handleError(err);
  } finally {
    resetSearchBtn();
    state.isLoading = false;
  }
}

async function performSearchByCoords(lat, lon, customName = null) {
  if (state.isLoading) return;

  state.isLoading = true;
  if (searchSuggestions) searchSuggestions.hidden = true;
  updateSearchBtn('Đang định vị...');
  setUIState('loading');

  try {
    const { current, forecast } = await fetchWeatherByCoords(lat, lon);

    if (customName) {
      current.name = customName;
      current.sys = current.sys || {};
      current.sys.country = 'VN';
    } else {
      const closest = findClosestVietnamLocation(lat, lon);
      if (closest) {
        current.name = closest.name;
        current.sys = current.sys || {};
        current.sys.country = 'VN';
      }
    }

    state.current = current;
    state.forecast = forecast;

    const tz = current.timezone;

    renderCurrentWeather(current);
    renderHourly(forecast, tz);
    renderDaily(forecast, tz);

    setUIState('results');
    searchInput.value = current.name;
    clearBtn.hidden = false;
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    handleError(err);
  } finally {
    resetSearchBtn();
    state.isLoading = false;
  }
}

function handleError(err) {
  const messages = {
    'API_KEY_MISSING': '⚠️ Chưa có API Key. Nhấn vào ⚙️ để thêm OpenWeatherMap API Key.',
    'API_KEY_INVALID': '🔑 API Key không hợp lệ hoặc chưa kích hoạt. Vui lòng kiểm tra lại.',
    'CITY_NOT_FOUND': '🔍 Không tìm thấy thành phố. Hãy thử từ khóa khác.',
    'API_RATE_LIMIT': '⏱️ Đã vượt quá giới hạn yêu cầu. Vui lòng thử lại sau.',
    'Failed to fetch': '🌐 Lỗi kết nối mạng. Vui lòng kiểm tra internet.',
  };

  const key = Object.keys(messages).find(k => err.message?.includes(k));
  const message = key ? messages[key] : `Đã xảy ra lỗi: ${err.message}`;

  if (err.message === 'API_KEY_MISSING') {
    showError(message);
    openSettingsModal();
  } else if (err.message === 'CITY_NOT_FOUND') {
    setUIState('empty');
    resetSearchBtn();
    state.isLoading = false;
  } else {
    showError(message);
  }
}

// ════════════════════════════════════════
//  SETTINGS MODAL
// ════════════════════════════════════════
function openSettingsModal() {
  apiKeyInput.value = getApiKey();
  settingsModal.hidden = false;
  apiKeyInput.focus();
}
function closeSettingsModal() {
  settingsModal.hidden = true;
}

// ════════════════════════════════════════
//  UNIT TOGGLE
// ════════════════════════════════════════
function toggleUnit() {
  state.unit = state.unit === 'metric' ? 'imperial' : 'metric';
  unitLabelEl.textContent = state.unit === 'metric' ? '°C' : '°F';
  // Re-fetch if data exists
  if (state.lastQuery) performSearch(state.lastQuery);
}

// ════════════════════════════════════════
//  EVENT LISTENERS
// ════════════════════════════════════════

// ════════════════════════════════════════
//  AUTOCOMPLETE SUGGESTIONS
// ════════════════════════════════════════
let activeSuggestionIndex = -1;
let currentSuggestions = [];

function renderSuggestions(query) {
  if (!searchSuggestions) return;
  const list = filterVietnamLocations(query);
  currentSuggestions = list;
  activeSuggestionIndex = -1;

  if (list.length === 0) {
    searchSuggestions.hidden = true;
    searchSuggestions.innerHTML = '';
    return;
  }

  searchSuggestions.innerHTML = list.map((loc, idx) => `
    <div class="suggestion-item" role="option" data-idx="${idx}" data-id="${loc.id}">
      <span class="suggestion-name">🇻🇳 ${loc.name}</span>
      <span class="suggestion-region">${loc.region}</span>
    </div>
  `).join('');

  searchSuggestions.hidden = false;

  searchSuggestions.querySelectorAll('.suggestion-item').forEach((el, idx) => {
    el.addEventListener('click', () => {
      selectSuggestion(idx);
    });
  });
}

function selectSuggestion(idx) {
  const loc = currentSuggestions[idx];
  if (!loc) return;
  searchInput.value = loc.name;
  if (searchSuggestions) searchSuggestions.hidden = true;
  clearBtn.hidden = false;
  performSearchByCoords(loc.lat, loc.lon, loc.name);
}

function updateSuggestionHighlight(items) {
  items.forEach((el, i) => {
    el.classList.toggle('active', i === activeSuggestionIndex);
  });
}

// ════════════════════════════════════════
//  EVENT LISTENERS
// ════════════════════════════════════════

// Search form
searchForm.addEventListener('submit', e => {
  e.preventDefault();
  const q = searchInput.value.trim();
  if (searchSuggestions) searchSuggestions.hidden = true;
  if (q) performSearch(q);
});

// Search Input autocomplete & navigation
searchInput.addEventListener('input', () => {
  const val = searchInput.value.trim();
  clearBtn.hidden = !val;
  renderSuggestions(val);
});

searchInput.addEventListener('keydown', e => {
  if (!searchSuggestions || searchSuggestions.hidden || currentSuggestions.length === 0) return;

  const items = searchSuggestions.querySelectorAll('.suggestion-item');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeSuggestionIndex = (activeSuggestionIndex + 1) % currentSuggestions.length;
    updateSuggestionHighlight(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeSuggestionIndex = (activeSuggestionIndex - 1 + currentSuggestions.length) % currentSuggestions.length;
    updateSuggestionHighlight(items);
  } else if (e.key === 'Enter' && activeSuggestionIndex >= 0) {
    e.preventDefault();
    selectSuggestion(activeSuggestionIndex);
  } else if (e.key === 'Escape') {
    searchSuggestions.hidden = true;
  }
});

// Hide dropdown when clicking outside
document.addEventListener('click', e => {
  if (searchForm && !searchForm.contains(e.target)) {
    if (searchSuggestions) searchSuggestions.hidden = true;
  }
});

// Clear input
clearBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchInput.focus();
  clearBtn.hidden = true;
  if (searchSuggestions) searchSuggestions.hidden = true;
});

// ── City Browser – Region Tabs ──
const regionTabs = document.querySelectorAll('.region-tab');
const regionPanels = document.querySelectorAll('.region-panel');
const cityBrowser = document.querySelector('.city-browser');
const cityBrowserToggle = $('cityBrowserToggle');

regionTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const region = tab.dataset.region;
    regionTabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    regionPanels.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    document.querySelector(`.region-panel[data-panel="${region}"]`)?.classList.add('active');
  });
});

cityBrowserToggle.addEventListener('click', () => {
  cityBrowser.classList.toggle('collapsed');
});

// City chips – dùng tọa độ GPS (data-lat / data-lon) và truyền tên tiếng Việt chuẩn
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const lat = chip.dataset.lat;
    const lon = chip.dataset.lon;
    const label = chip.dataset.label || chip.textContent.trim();

    searchInput.value = label;
    clearBtn.hidden = false;
    if (searchSuggestions) searchSuggestions.hidden = true;

    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active-city'));
    chip.classList.add('active-city');

    if (lat && lon) {
      state.lastQuery = label;
      performSearchByCoords(parseFloat(lat), parseFloat(lon), label);
    } else {
      performSearch(label);
    }
  });
});

// Retry
retryBtn.addEventListener('click', () => {
  if (state.lastQuery) performSearch(state.lastQuery);
});

// Geolocation
locationBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    showToast('⚠️ Trình duyệt không hỗ trợ định vị.', 'error');
    return;
  }
  showToast('📡 Đang lấy vị trí của bạn...', 'default', 5000);
  navigator.geolocation.getCurrentPosition(
    pos => performSearchByCoords(pos.coords.latitude, pos.coords.longitude),
    () => showToast('⚠️ Không thể lấy vị trí. Hãy cho phép truy cập.', 'error'),
  );
});

// Unit toggle
unitToggleBtn.addEventListener('click', toggleUnit);

// Keyboard navigation
document.addEventListener('keydown', e => {
  if (!settingsModal.hidden && e.key === 'Escape') closeSettingsModal();
});

// Settings
settingsBtn.addEventListener('click', openSettingsModal);
closeSettings.addEventListener('click', closeSettingsModal);
cancelSettings.addEventListener('click', closeSettingsModal);
settingsModal.addEventListener('click', e => {
  if (e.target === settingsModal) closeSettingsModal();
});
saveSettings.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    showToast('⚠️ Vui lòng nhập API key', 'error');
    return;
  }
  saveApiKey(key);
  closeSettingsModal();
  showToast('✅ Đã lưu API key thành công!', 'success');
  // Reset test result khi lưu
  testKeyResult.hidden = true;
  testKeyResult.className = 'test-key-result';
  // Auto-search
  if (state.lastQuery) performSearch(state.lastQuery);
  else performSearch('Hanoi');
});

toggleKeyVis.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  $('eyeIcon').innerHTML = isPassword
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
});

// Test API Key
testKeyBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    testKeyResult.textContent = '⚠️ Vui lòng nhập API key trước.';
    testKeyResult.className = 'test-key-result fail';
    testKeyResult.hidden = false;
    return;
  }

  testKeyBtn.disabled = true;
  testKeyBtn.textContent = '⏳ Đang kiểm tra...';
  testKeyResult.textContent = '🔄 Đang gọi OpenWeatherMap API...';
  testKeyResult.className = 'test-key-result loading';
  testKeyResult.hidden = false;

  try {
    const res = await fetch(
      `${BASE_URL}/weather?q=London&units=metric&appid=${key}`
    );
    const data = await res.json();

    if (res.ok) {
      testKeyResult.textContent =
        `✅ API Key hợp lệ! Nhiệt độ London hiện tại: ${Math.round(data.main.temp)}°C. Key đang hoạt động tốt.`;
      testKeyResult.className = 'test-key-result ok';
    } else if (res.status === 401) {
      const msg = data?.message || '';
      testKeyResult.innerHTML =
        `❌ Lỗi 401 – Key chưa kích hoạt hoặc sai.<br/>
        <span style="font-weight:400;margin-top:4px;display:block">
          • Key mới cần <strong>10–120 phút</strong> để hoạt động sau khi đăng ký.<br/>
          • Hãy chắc chắn bạn copy đúng key (không thừa dấu cách).<br/>
          • Thử lại sau ít phút hoặc dùng key khác.
        </span>`;
      testKeyResult.className = 'test-key-result fail';
    } else {
      testKeyResult.textContent = `⚠️ Lỗi HTTP ${res.status}: ${data?.message || 'Không xác định'}`;
      testKeyResult.className = 'test-key-result fail';
    }
  } catch {
    testKeyResult.textContent = '🌐 Không thể kết nối. Hãy kiểm tra internet.';
    testKeyResult.className = 'test-key-result fail';
  } finally {
    testKeyBtn.disabled = false;
    testKeyBtn.textContent = '🔍 Kiểm tra Key';
  }
});

// ════════════════════════════════════════
//  INIT
// ════════════════════════════════════════
function init() {
  const savedKey = getApiKey();
  if (!savedKey) {
    setTimeout(() => {
      showToast('👋 Hãy thiết lập OpenWeatherMap API Key để bắt đầu!', 'default', 6000);
    }, 800);
  } else {
    // Auto-load Hà Nội khi đã có key
    setTimeout(() => performSearch('Hanoi'), 400);
  }
}

init();
