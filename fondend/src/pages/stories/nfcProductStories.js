import content from './nfcProductContent.json' with { type: 'json' };
import { getListingProductBySlug } from '../catalog/productListingData.js';

const image = (src, label, alt = label) => ({ src, label, alt });
const catalogImages = (slug) => getListingProductBySlug(slug).images;
const pair = '/assets/products/owner-provided/hoa-lam-ty-ba-pair.webp';
const derived = '/assets/products/derived/';
const supplied = '/assets/products/owner-provided/';
const vrg = '/assets/nfc/products/';

const stories = {
  binh_thien_nga: {
    name: 'Bình Thiên Nga', titleLines: ['THIÊN NGA'],
    subtitle: 'Phi – Minh – Túc – Thực · Lời chúc cuộc sống đủ đầy',
    intro: 'Dáng bình cân đối, hình tượng thiên nga sinh động và những nét vẽ thủ công dưới men kể câu chuyện về sự no đủ, bình an và một tương lai tươi sáng.',
    images: catalogImages('binh-thien-nga').map((src, index) => image(src, `Mẫu ${index + 1}`, 'Bình Thiên Nga gốm Chu Đậu')),
    entryImages: [`${derived}binh-thien-nga-03-motif-detail.webp`],
    motifs: [[
      { icon: 'leaf', title: 'Hoa dây', text: 'Gợi nền văn hóa lúa nước của người Việt.' },
      { icon: 'star', title: 'Lệnh bài – sắc phong', text: 'Ý chí hiếu học và sự thành đạt.' },
      { icon: 'flower', title: 'Phi – Minh – Túc – Thực', text: 'Bốn tư thế thiên nga, bốn khía cạnh của cuộc sống.' },
      { icon: 'lotus', title: 'Cánh sen cách điệu', text: 'Dấu ấn văn hóa tín ngưỡng Việt.' },
    ]],
    note: 'Dáng cao, thân to, chắc khỏe – vẻ đẹp cân đối, hài hòa của Bình Thiên Nga.',
    wishTitles: ['Ấm no và sung túc', 'Bình an và hạnh phúc', 'Tương lai tươi sáng', 'Món quà tri ân'],
    wishTexts: ['Gửi gắm mong ước về cuộc sống no đủ.', 'Trân trọng những khoảnh khắc bình yên.', 'Tinh thần cầu tiến, hướng tới thành công.', 'Lời chúc ý nghĩa trong dịp tân gia, khai trương hoặc mừng thành công.'],
    productLinks: [{ slug: 'binh-thien-nga', label: 'Xem Bình Thiên Nga' }],
  },
  binh_hoa_lam_ty_ba: {
    name: 'Bình Hoa Lam – Bình Tỳ Bà', titlePrefix: 'CẶP BÌNH', titleLines: ['HOA LAM', 'TỲ BÀ'],
    subtitle: 'Âm – Dương hòa hợp · Gửi lời chúc bình an',
    intro: 'Bình Hoa Lam khỏe khoắn và Bình Tỳ Bà mềm mại cùng tạo nên cặp bình mang ý nghĩa hòa hợp, hạnh phúc gia đình và nét đẹp văn hóa Việt.',
    images: [image(pair, 'Cặp bình Âm – Dương', 'Bình Tỳ Bà bên trái và Bình Hoa Lam bên phải'), image(catalogImages('binh-hoa-lam')[0], 'Bình Hoa Lam'), image(catalogImages('binh-ty-ba')[0], 'Bình Tỳ Bà')],
    imageFit: 'contain', frameBackground: '#f5e8da',
    entryImages: [`${derived}binh-hoa-lam-03-motif-detail.webp`, `${derived}binh-ty-ba-03-motif-detail.webp`],
    motifs: [[
      { icon: 'star', title: 'Vương miện – lệnh bài', text: 'Sự cao quý và thành đạt của người đàn ông.' },
      { icon: 'flower', title: 'Hoa cúc đại đóa', text: 'Hình tượng người quân tử quang minh chính đại.' },
      { icon: 'leaf', title: 'Hoa dây', text: 'Người phụ nữ đồng hành trên con đường thành đạt.' },
      { icon: 'lotus', title: 'Cánh sen cách điệu', text: 'Văn hóa tín ngưỡng Việt.' },
    ], [
      { icon: 'leaf', title: 'Lá lúa – lông chim Lạc', text: 'Văn minh lúa nước và khát vọng độc lập dân tộc.' },
      { icon: 'flower', title: 'Xuân – Hạ – Thu – Đông', text: 'Lời chúc bốn mùa bình an.' },
      { icon: 'star', title: 'Công – Dung – Ngôn – Hạnh', text: 'Nét đẹp truyền thống của người phụ nữ Việt Nam.' },
      { icon: 'lotus', title: 'Cánh sen cách điệu', text: 'Dấu ấn văn hóa tín ngưỡng Việt.' },
    ]],
    note: 'Cặp bình Âm – Dương hòa hợp, biểu trưng cho hạnh phúc gia đình.',
    wishTitles: ['Tâm ý trao tặng', 'Bình an, thuận hòa', 'Hạnh phúc gia đình', 'Trân trọng và hòa điệu'],
    wishTexts: ['Một món quà gốm mang nhiều tâm ý.', 'Gửi lời chúc những điều tốt đẹp trong cuộc sống.', 'Cặp bình gợi sự ấm cúng, hòa hợp và hạnh phúc.', 'Thể hiện sự trân trọng với người nhận và những mối quan hệ tốt đẹp.'],
    productLinks: [{ slug: 'binh-hoa-lam', label: 'Xem Bình Hoa Lam' }, { slug: 'binh-ty-ba', label: 'Xem Bình Tỳ Bà' }],
  },
  binh_phu_quy: {
    name: 'Bình Phú Quý', titleLines: ['PHÚ QUÝ'],
    subtitle: 'Phú quý – Ước vọng về một cuộc sống viên mãn',
    intro: 'Dáng bình thân tròn, cổ cao thanh thoát gửi gắm mong ước về sự sung túc, thành đạt và những điều tốt đẹp trong cuộc sống.',
    images: [image(`${supplied}binh-phu-quy.webp`, 'Toàn cảnh', 'Bình Phú Quý với thân tròn, cổ cao'), image(`${derived}binh-phu-quy-02-neck-detail.webp`, 'Chi tiết cổ bình'), image(`${derived}binh-phu-quy-03-motif-detail.webp`, 'Chi tiết họa tiết')],
    entryImages: [`${derived}binh-phu-quy-03-motif-detail.webp`],
    motifs: [[
      { icon: 'leaf', title: 'Hoa văn cách điệu', text: 'Nét văn hóa Việt được gửi gắm ở phần cổ bình.' },
      { icon: 'flower', title: 'Hoa cúc đại đóa', text: 'Biểu tượng người quân tử và sự thành đạt.' },
      { icon: 'leaf', title: 'Hoa dây', text: 'Hình ảnh người phụ nữ luôn đồng hành.' },
      { icon: 'lotus', title: 'Cánh sen cách điệu', text: 'Văn hóa tín ngưỡng của người Việt.' },
    ]],
    note: 'Thân tròn, cổ cao – dáng bình thanh thoát, sang trọng.',
    wishTitles: ['Sung túc và phú quý', 'May mắn và thuận lợi', 'Cuộc sống viên mãn', 'Thành đạt và tri ân'],
    wishTexts: ['Gửi gắm mong ước phát tài, phát lộc.', 'Lời chúc tốt đẹp trong những dịp đặc biệt.', 'Ước vọng về cuộc sống đủ đầy và hạnh phúc.', 'Trao lời chúc mừng thành công và tình cảm chân thành.'],
    productLinks: [{ slug: 'binh-phu-quy-ly-ngu', label: 'Xem dòng Bình Phú Quý' }],
  },
  binh_truong_phuc: {
    name: 'Bình Trường Phúc', titleLines: ['TRƯỜNG PHÚC'],
    subtitle: 'Phúc lành dài lâu – Hạnh phúc trường tồn',
    intro: 'Dáng bình thân tròn, miệng rộng cùng họa tiết hoa cúc và hoa dây gửi gắm lời chúc may mắn, phát triển và hạnh phúc lâu dài.',
    images: [image(`${vrg}binh-truong-phuc-vrg-01.jpg`, 'Phiên bản VRG', 'Bình gốm phiên bản VRG với hoa văn hoa cúc'), image(`${vrg}binh-truong-phuc-vrg-02.jpg`, 'Hai mặt trang trí', 'Hai mặt trang trí của bình gốm phiên bản VRG')],
    entryImages: [`${vrg}binh-truong-phuc-vrg-01.jpg`],
    motifs: [[
      { icon: 'flower', title: 'Hoa cúc đại đóa', text: 'Hình tượng người chính nhân quân tử, người đàn ông thành đạt.' },
      { icon: 'leaf', title: 'Hoa dây', text: 'Sự đồng hành, gắn bó trên con đường thành đạt.' },
      { icon: 'star', title: 'Thân tròn, miệng rộng', text: 'May mắn, thăng hoa và hạnh phúc trường tồn.' },
      { icon: 'lotus', title: 'Men tro trấu', text: 'Dấu ấn kỹ nghệ gốm truyền thống.' },
    ]],
    note: 'Một dáng bình tinh tế, gửi lời chúc phúc lành lâu dài.',
    wishTitles: ['Phúc lành dài lâu', 'May mắn, hanh thông', 'Cuộc sống an vui', 'Phát triển bền vững'],
    wishTexts: ['Gửi gắm những điều tốt đẹp qua tên gọi Trường Phúc.', 'Lời chúc thuận lợi và thăng hoa trong công việc.', 'Ước vọng hạnh phúc trường tồn và niềm vui viên mãn.', 'Trao tâm ý chân thành trong một món quà gốm.'],
    productLinks: [],
    imageSource: 'https://chudauceramic.vn/binh-giot-ngoc-phien-ban-vrg',
    imageCaption: 'Phiên bản VRG · Ảnh từ Gốm Chu Đậu',
  },
};

export const nfcProductStories = Object.fromEntries(Object.entries(stories).map(([id, story]) => [id, { id, ...story, ...content[id] }]));

export const nfcWishImagery = [
  image('/assets/nfc/binh-giot-ngoc/thu-hut-tai-loc.png', 'Túi gấm đỏ đựng tiền vàng'),
  image('/assets/nfc/binh-giot-ngoc/may-man-vuong-khi.png', 'Cỏ bốn lá xanh'),
  image('/assets/nfc/binh-giot-ngoc/cuoc-song-du-day.png', 'Gia đình quây quần bên mâm cơm'),
  image('/assets/nfc/binh-giot-ngoc/thanh-dat-thinh-vuong.png', 'Đôi tay trao tặng hộp quà'),
];

export function parseNfcCare(lines) {
  const result = { intro: [], groups: [[], [], [], []], closing: [] };
  let activeGroup;
  for (const rawLine of lines) {
    const line = rawLine.replace(/^-\s*/u, '');
    if (/^(Một chút chăm sóc|Chăm sóc)/u.test(line)) {
      result.closing.push(line);
      continue;
    }
    const group = /^(Vệ sinh(?: sản phẩm)?|Tránh trầy xước):/u.test(line) ? 0
      : /^(Bảo quản(?: sản phẩm)?|Vị trí trưng bày|Di chuyển an toàn):/u.test(line) ? 1
        : /^(Lưu ý(?: khi sử dụng)?|Với phiên bản vàng kim):/u.test(line) ? 2
          : /^(Lưu ý đối với chip NFC|Với sản phẩm tích hợp NFC|Với chip NFC|Bảo quản chip NFC):/u.test(line) ? 3 : undefined;
    if (group !== undefined) {
      activeGroup = group;
      const body = line.slice(line.indexOf(':') + 1).trim();
      if (body) result.groups[group].push(body);
    } else if (activeGroup === undefined) result.intro.push(line);
    else result.groups[activeGroup].push(line);
  }
  return result;
}
