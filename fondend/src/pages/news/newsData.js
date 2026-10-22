export const newsCategories = [
  { id: 'all', label: 'Tất cả' },
  { id: 'thanh-tuu', label: 'Thành tựu & dấu mốc', shortLabel: 'Thành tựu' },
  { id: 'lang-nghe', label: 'Làng nghề & văn hóa', shortLabel: 'Làng nghề' },
  { id: 'tro-va-lam', label: 'Từ Tro & Lam', shortLabel: 'Tro & Lam' },
];

const official = (path) => `https://chudauceramic.vn/${path}`;

// Source dates are the publication dates of the linked articles, not new event dates.
// Tro & Lam entries are editorial introductions prepared for this news page.
export const newsArticles = [
  {
    slug: 'gom-chu-dau-tai-trien-lam-a80', category: 'lang-nghe', date: '2025-09-06',
    title: 'Gốm Chu Đậu tại A80: sắc gốm trong dòng chảy văn hóa Việt',
    excerpt: 'Những dáng bình quen thuộc và nét cọ của nghệ nhân cùng hiện diện tại triển lãm thành tựu đất nước năm 2025.',
    image: '/assets/news/trien-lam-a80.jpg', imageAlt: 'Cặp bình Hoa Lam – Tỳ Bà trưng bày tại triển lãm A80',
    imageCaption: 'Không gian trưng bày tại A80. Ảnh: Gốm Chu Đậu / Nhân Dân.',
    source: { label: 'Gốm Chu Đậu', url: official('gom-chu-dau-tai-trien-lam-a80-tu-hao-ban-sac-viet') },
    sections: [
      { heading: 'Một không gian gặp gỡ di sản', text: 'Theo tin ngày 6/9/2025 trên website Gốm Chu Đậu, doanh nghiệp tham gia triển lãm A80 tại Trung tâm Hội chợ Triển lãm Quốc gia, diễn ra từ 28/8 đến 5/9/2025.' },
      { heading: 'Từ tác phẩm đến bàn tay người thợ', text: 'Bên cạnh các bình Phú Quý, Giọt Ngọc và Hoa Lam, khách tham quan còn được xem nghệ nhân trình diễn vẽ gốm. Hoạt động này đưa kỹ nghệ thủ công đến gần công chúng qua trải nghiệm trực tiếp.' },
    ],
  },
  {
    slug: 'gom-chu-dau-thuong-hieu-quoc-gia-2024', category: 'thanh-tuu', date: '2024-11-21',
    title: 'Dấu mốc Thương hiệu Quốc gia Việt Nam 2024',
    excerpt: 'Sản phẩm Gốm Chu Đậu được vinh danh lần thứ ba liên tiếp, tiếp nối hành trình gìn giữ và phát triển dòng gốm cổ.',
    image: '/assets/news/thuong-hieu-quoc-gia.jpg', imageAlt: 'Đại diện doanh nghiệp nhận biểu trưng tại lễ công bố Thương hiệu Quốc gia 2024',
    imageCaption: 'Hình ảnh lễ công bố Thương hiệu Quốc gia 2024. Nguồn ảnh: Gốm Chu Đậu.',
    source: { label: 'Gốm Chu Đậu', url: official('san-pham-cong-ty-cp-gom-chu-dau-tiep-tuc-duoc-vinh-danh-thuong-hieu-quoc-gia-viet-nam') },
    sections: [
      { heading: 'Sự ghi nhận cho một hành trình', text: 'Bài công bố ngày 21/11/2024 của Gốm Chu Đậu ghi nhận sản phẩm của công ty đạt Thương hiệu Quốc gia Việt Nam 2024. Đây là lần thứ ba liên tiếp sản phẩm được trao danh hiệu, theo thông tin từ doanh nghiệp.' },
      { heading: 'Gìn giữ bản sắc trong phát triển', text: 'Nguồn tin nhấn mạnh quá trình phục dựng các dáng gốm, phát triển sản phẩm và giữ phong cách men, hoa văn truyền thống. Dấu mốc này gắn với nỗ lực đưa giá trị gốm Việt đến thị trường trong nước và quốc tế.' },
    ],
  },
  {
    slug: 'nghe-nhan-va-nhung-tang-pham-quoc-khanh', category: 'lang-nghe', date: '2025-08-19',
    title: 'Trong xưởng gốm, những tặng phẩm hướng về Quốc khánh',
    excerpt: 'Câu chuyện về nghệ nhân và công nhân Chu Đậu chuẩn bị bình Giọt Ngọc cho dịp kỷ niệm 80 năm Quốc khánh.',
    image: '/assets/news/nghe-nhan-quoc-khanh.jpg', imageAlt: 'Bình Giọt Ngọc mang hình ảnh kỷ niệm 80 năm Quốc khánh',
    imageCaption: 'Tặng phẩm gốm trong dịp kỷ niệm 80 năm Quốc khánh. Nguồn ảnh: Gốm Chu Đậu.',
    source: { label: 'Gốm Chu Đậu', url: official('nghe-nhan-chu-dau-hoi-ha-san-xuat-qua-tang-nhan-ky-niem-80-nam-cach-mang-thang-8-va-quoc-khanh-2-9') },
    sections: [
      { heading: 'Gửi lịch sử vào từng nét vẽ', text: 'Ngày 19/8/2025, website Gốm Chu Đậu giới thiệu hoạt động chuẩn bị tặng phẩm cho dịp kỷ niệm 80 năm Cách mạng Tháng Tám và Quốc khánh 2/9. Các nghệ nhân, công nhân chế tác bình Giọt Ngọc dành cho đại biểu trong nước và quốc tế.' },
      { heading: 'Dấu ấn của người làm gốm', text: 'Hình tượng chim Lạc được kết hợp với những hình ảnh gắn với lịch sử. Qua câu chuyện này, mỗi tặng phẩm còn mang theo công sức của người thợ và tâm ý gửi trao trong một dịp đặc biệt.' },
    ],
  },
  {
    slug: 'chu-dau-don-doan-tham-quan-abac', category: 'lang-nghe', date: '2025-07-16',
    title: 'Một chuyến trải nghiệm gốm Việt cùng đoàn ABAC',
    excerpt: 'Chuyến tham quan ngày 16/7/2025 mở ra cuộc gặp gỡ giữa khách quốc tế, nghệ nhân và những giá trị của làng gốm.',
    image: '/assets/news/tham-quan-abac.jpg', imageAlt: 'Đoàn khách ABAC tham quan không gian Gốm Chu Đậu',
    imageCaption: 'Đoàn tham quan trong hoạt động bên lề hội nghị ABAC. Nguồn ảnh: Gốm Chu Đậu.',
    source: { label: 'Gốm Chu Đậu', url: official('doan-cac-thanh-vien-abac-iii-tham-quan-cong-ty-cp-gom-chu-dau') },
    sections: [
      { heading: 'Giao lưu từ một làng nghề', text: 'Theo bài đăng ngày 16/7/2025, đoàn phu nhân, phu quân của các thành viên Hội đồng Tư vấn kinh doanh APEC đã tham quan và trải nghiệm tại Công ty cổ phần Gốm Chu Đậu trong khuôn khổ hoạt động bên lề hội nghị ABAC.' },
      { heading: 'Hiểu thêm về gốm qua trải nghiệm', text: 'Chuyến đi tạo cơ hội giới thiệu dòng gốm cùng những giá trị nghệ thuật, lịch sử và tay nghề thủ công. Đây cũng là một cách để văn hóa Việt được cảm nhận qua sản phẩm và con người làm ra sản phẩm ấy.' },
    ],
  },
  {
    slug: 'dia-nghin-chu-long-dau-an-ky-luc', category: 'thanh-tuu', date: '2020-02-05',
    title: 'Đĩa 1.000 chữ Long: khi thư pháp gặp nghệ thuật gốm',
    excerpt: 'Nhìn lại tác phẩm được ghi nhận kỷ lục thế giới năm 2019 và sự kết hợp giữa người thợ gốm với nhà thư pháp Lê Thiên Lý.',
    image: '/assets/news/dia-nghin-chu-long.jpg', imageAlt: 'Nhà thư pháp Lê Thiên Lý bên tác phẩm gốm',
    imageCaption: 'Nhà thư pháp Lê Thiên Lý. Ảnh tư liệu trong bài đăng của Gốm Chu Đậu.',
    source: { label: 'Gốm Chu Đậu', url: official('chuyen-ve-chiec-dia-ky-luc-the-gioi-cua-gom-chu-au') },
    sections: [
      { heading: 'Dấu mốc ngày 9/9/2019', text: 'Theo bài tư liệu đăng ngày 5/2/2020 trên website Gốm Chu Đậu, chiếc đĩa viết 1.000 chữ Long được ghi nhận kỷ lục Guinness thế giới ngày 9/9/2019. Trước đó, tác phẩm đã được xác lập kỷ lục Việt Nam năm 2013.' },
      { heading: 'Nỗ lực chung của người thợ và người viết chữ', text: 'Tác phẩm kết hợp tạo hình gốm thủ công với thư pháp của Lê Thiên Lý. Câu chuyện chế tác cho thấy sự kiên nhẫn, thử nghiệm và tinh thần sáng tạo để hoàn thiện một sản phẩm có quy mô đặc biệt.' },
    ],
  },
  {
    slug: 'hanh-trinh-phuc-hung-gom-chu-dau', category: 'thanh-tuu', date: '2025-04-25',
    title: 'Từ mốc 2001, viết tiếp hành trình phục hưng gốm Chu Đậu',
    excerpt: 'Sự hồi sinh của một dòng gốm được kể qua việc nghiên cứu men, phục dựng dáng cổ và đào tạo những bàn tay tiếp nối nghề.',
    image: '/assets/photography/chu-dau-heritage.jpg', imageAlt: 'Hiện vật gốm hoa lam Chu Đậu trong bảo tàng',
    imageCaption: 'Ảnh hiện vật tư liệu: Marie-Lan Nguyen / Wikimedia Commons / CC BY 2.5.',
    imageCreditUrl: 'https://commons.wikimedia.org/wiki/File:Blue_and_white_Chu_Dau_jar_NMVH_EDAV.jpg',
    source: { label: 'Gốm Chu Đậu', url: official('gom-chu-dau-khang-dinh-thuong-hieu-quoc-gia') },
    sections: [
      { heading: 'Một hành trình bắt đầu từ phục dựng', text: 'Bài viết ngày 25/4/2025 của Gốm Chu Đậu nhắc lại mốc thành lập doanh nghiệp năm 2001 với sứ mệnh phục dựng và phát triển dòng gốm cổ.' },
      { heading: 'Giữ nghề bằng thực hành', text: 'Công việc phục hưng đòi hỏi nghiên cứu màu men, dáng gốm và họa tiết, đồng thời tạo ra những sản phẩm phù hợp với đời sống. Những người thợ cùng hoạt động tham quan, trải nghiệm giúp nối tiếp câu chuyện ấy đến công chúng hôm nay.' },
    ],
  },
  {
    slug: 'gom-xua-hoi-tu-ket-noi-cong-dong', category: 'lang-nghe', date: '2026-04-24',
    title: 'Gốm xưa hội tụ: kết nối cộng đồng người yêu gốm',
    excerpt: 'Nhìn lại hoạt động giao lưu được Gốm Chu Đậu giới thiệu dịp kỷ niệm ngày thống nhất đất nước tháng 4/2026.',
    image: '/assets/news/gom-xua-hoi-tu.jpg', imageAlt: 'Hình ảnh truyền thông hoạt động Gốm xưa hội tụ của Gốm Chu Đậu',
    imageCaption: 'Tư liệu truyền thông tháng 4/2026. Nguồn ảnh: Gốm Chu Đậu.',
    source: { label: 'Gốm Chu Đậu', url: official('minigame-gom-xua-hoi-tu-dat-nuoc-tron-niem-vui') },
    sections: [
      { heading: 'Gặp nhau từ tình yêu gốm Việt', text: 'Ngày 24/4/2026, Gốm Chu Đậu đăng thông tin về minigame Gốm xưa hội tụ – Đất nước trọn niềm vui, gắn với dịp kỷ niệm Ngày Giải phóng miền Nam, thống nhất đất nước.' },
      { heading: 'Một ghi chép về hoạt động cộng đồng', text: 'Chương trình hướng tới người yêu gốm và các giá trị truyền thống. Bài viết này lưu lại thông tin về hoạt động tháng 4/2026; thể lệ và thời gian tổ chức được lưu tại bài công bố gốc.' },
    ],
  },
  {
    slug: 'tro-va-lam-gioi-thieu-binh-giot-ngoc', category: 'tro-va-lam', date: '2026-10-22', kind: 'Giới thiệu sản phẩm',
    title: 'Bình Giọt Ngọc: một dáng gốm, nhiều lời gửi gắm',
    excerpt: 'Tro & Lam giới thiệu câu chuyện phía sau dáng bình tròn, sắc men và những họa tiết mang tâm ý trao tặng.',
    image: '/assets/editorial/diplomacy-slides/binh-giot-ngoc.webp', imageAlt: 'Phối cảnh Bình Giọt Ngọc trong không gian ánh vàng',
    imageCaption: 'Ảnh phối cảnh sản phẩm trong bộ tư liệu Tro & Lam.',
    sections: [
      { heading: 'Bắt đầu từ một dáng bình', text: 'Trong góc giới thiệu sản phẩm của Tro & Lam, Bình Giọt Ngọc mở ra một câu chuyện về dáng gốm, hoa văn và ý nghĩa trao tặng. Miệng loe, cổ thắt, thân tròn tạo nên một hình khối dễ nhận biết; các họa tiết hoa lá gợi cảm hứng từ thiên nhiên và văn hóa Việt.' },
      { heading: 'Đọc chậm hơn, nhìn kỹ hơn', text: 'Trang câu chuyện Bình Giọt Ngọc tập hợp các góc nhìn sản phẩm, giới thiệu hành trình chế tác, ý nghĩa biểu tượng và hướng dẫn chăm sóc. Bạn có thể bắt đầu từ một chi tiết trên thân bình rồi tiếp tục khám phá cách người thợ gửi tâm ý vào đường nét và lớp men.' },
      { heading: 'Một món quà có câu chuyện đi cùng', text: 'Khi chọn gốm để trao tặng, điều được gửi đi còn là lời chúc và sự quan tâm dành cho người nhận. Tro & Lam mời bạn khám phá câu chuyện sản phẩm trước khi lựa chọn dáng bình phù hợp với không gian và dịp sử dụng.' },
    ],
    action: { href: '/nfc/binh_giot_ngoc', label: 'Khám phá câu chuyện Bình Giọt Ngọc' },
  },
  {
    slug: 'lifestyle-diplomacy-hai-cach-cham-vao-di-san', category: 'tro-va-lam', date: '2026-10-22', kind: 'Bộ sưu tập',
    title: 'Lifestyle & Diplomacy: hai cách đưa gốm vào đời sống',
    excerpt: 'Một bên là những khoảnh khắc thường ngày, một bên là những dịp trao tặng. Cùng khám phá hai dòng sản phẩm của Tro & Lam.',
    image: '/assets/editorial/lifestyle-slides/tea-set.webp', imageAlt: 'Bộ trà gốm trong không gian thưởng trà ấm áp',
    imageCaption: 'Ảnh phối cảnh dòng Lifestyle trong bộ tư liệu Tro & Lam.',
    sections: [
      { heading: 'Lifestyle – gốm trong từng ngày', text: 'Một ấm trà, một chiếc hũ hay bộ đồ ăn có thể trở thành điểm chạm của gốm trong đời sống. Dòng Lifestyle của Tro & Lam được giới thiệu từ những nhu cầu gần gũi ấy: thưởng trà, sắp đặt góc nhà và chăm chút những bữa ăn chung.' },
      { heading: 'Diplomacy – gốm trong dịp trao tặng', text: 'Với dòng Diplomacy, sự chú ý hướng tới những dáng bình, họa tiết và câu chuyện văn hóa đi cùng món quà. Một lựa chọn phù hợp bắt đầu từ người nhận, không gian trưng bày và lời chúc bạn muốn gửi gắm.' },
      { heading: 'Cùng một sắc lam, nhiều cách hiện diện', text: 'Hai dòng sản phẩm tạo nên những lối khám phá khác nhau trong danh mục Tro & Lam. Bạn có thể xem ảnh, tìm hiểu ý nghĩa sản phẩm rồi trò chuyện cùng đội ngũ để chọn món gốm cho nhu cầu cụ thể.' },
    ],
    action: { href: '/san-pham', label: 'Khám phá các dòng sản phẩm' },
  },
  {
    slug: 'tro-va-lam-ke-chuyen-gom-qua-phim-va-nfc', category: 'tro-va-lam', date: '2026-10-22', kind: 'Truyền thông & trải nghiệm',
    title: 'Từ thước phim đến trang NFC: kể tiếp câu chuyện gốm',
    excerpt: 'Góc nhìn truyền thông của Tro & Lam kết nối hình ảnh nghề gốm với những trang câu chuyện dành cho từng sản phẩm.',
    image: '/assets/video/tro-lam-banner-poster.jpg', imageAlt: 'Đôi bàn tay người thợ tạo hình gốm trong thước phim Tro & Lam',
    imageCaption: 'Khung hình từ phim tư liệu Tro & Lam sử dụng trên website. Nguồn phim được ghi tại trang tư liệu.',
    sections: [
      { heading: 'Để bàn tay người thợ được nhìn thấy', text: 'Những hình ảnh về đất, bàn xoay và người làm gốm giúp câu chuyện sản phẩm có thêm chiều sâu. Trên website, Tro & Lam kết nối các thước phim nghề gốm với nội dung giới thiệu về dáng bình, hoa văn và cách chăm sóc.' },
      { heading: 'Một điểm chạm, một câu chuyện', text: 'Bộ trang NFC hiện có câu chuyện của Bình Giọt Ngọc, Bình Thiên Nga, cặp Hoa Lam – Tỳ Bà, Bình Phú Quý và Bình Trường Phúc. Nội dung được sắp theo bốn phần để người đọc thuận tiện tìm hiểu sản phẩm trên cả máy tính và điện thoại.' },
      { heading: 'Tiếp nối trải nghiệm sau khi trao tặng', text: 'Trang câu chuyện đồng hành cùng món gốm, để người nhận tìm hiểu ý nghĩa, khám phá họa tiết và xem lại hướng dẫn bảo quản khi cần.' },
    ],
    action: { href: '/cau-chuyen', label: 'Đọc câu chuyện Tro & Lam' },
    references: [{ href: '/nguon-tu-lieu', label: 'Nguồn hình ảnh và phim' }],
  },
];

export const newsMilestones = [
  { year: '2001', title: 'Tiếp nối một dòng gốm cổ', description: 'Dấu mốc phục dựng và phát triển gốm Chu Đậu.', slug: 'hanh-trinh-phuc-hung-gom-chu-dau' },
  { year: '2019', title: 'Gốm gặp thư pháp', description: 'Đĩa 1.000 chữ Long được ghi nhận kỷ lục thế giới.', slug: 'dia-nghin-chu-long-dau-an-ky-luc' },
  { year: '2024', title: 'Thương hiệu Quốc gia', description: 'Lần thứ ba liên tiếp sản phẩm được vinh danh.', slug: 'gom-chu-dau-thuong-hieu-quoc-gia-2024' },
];

export const getNewsArticle = (slug) => newsArticles.find((article) => article.slug === slug);
export const getNewsCategory = (id) => newsCategories.find((category) => category.id === id) || newsCategories[0];
export const formatNewsDate = (date) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${date}T12:00:00+07:00`));
export const normalizeNewsSearch = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').replace(/đ/gu, 'd').replace(/Đ/gu, 'D').toLowerCase();

export function getNewsMetadata(pathname) {
  const path = pathname.replace(/\/+$/u, '');
  if (path === '/tin-tuc') return { title: 'Tin tức & câu chuyện gốm Chu Đậu | TRO & LAM', description: 'Dấu mốc, thành tựu gốm Chu Đậu, nhịp sống làng nghề và những ghi chép về sản phẩm, bộ sưu tập, truyền thông từ Tro & Lam.' };
  if (!path.startsWith('/tin-tuc/')) return null;
  let slug;
  try { slug = decodeURIComponent(path.slice('/tin-tuc/'.length)); } catch { return null; }
  const article = getNewsArticle(slug);
  return article ? { title: `${article.title} | Tin tức | TRO & LAM`, description: article.excerpt } : null;
}
