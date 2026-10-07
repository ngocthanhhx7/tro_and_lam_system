// Source of truth for the curated product listing and product detail template.
// Names, prices, images and storytelling copy were supplied or explicitly approved by the project owner.
export const listingGroups = [
  { id: 'heritage', number: '01', label: 'TINH HOA DI SẢN', title: 'Những dáng gốm mang câu chuyện Việt.' },
  { id: 'tea', number: '02', label: 'TRÀ & THƯỞNG THỨC', title: 'Một khoảng lặng bên chén trà.' },
  { id: 'tableware', number: '03', label: 'GIA DỤNG & BÀN ĂN', title: 'Di sản hiện diện trong đời sống thường ngày.' },
];

const products = [
  {
    id: 'binh-phuong-hoang', slug: 'binh-phuong-hoang', category: 'heritage', line: 'diplomacy',
    name: 'Bình Phượng Hoàng', priceVnd: 5800000,
    description: 'Biểu tượng của hòa hợp, thịnh vượng và nguồn sinh khí.',
    images: ['/images/products/binh-phuong-hoang.jpg', '/images/products/binh-phuong-hoang-01.jpg', '/images/products/binh-phuong-hoang-03.jpg'],
    storyText: 'Bình Phượng Hoàng được nghệ nhân Gốm Chu Đậu phỏng theo bình gốm cổ triều Trần – Lê Sơ, thế kỷ XIV–XV. Theo nội dung khách hàng cung cấp, nguyên mẫu hiện được lưu giữ tại Bảo tàng Lịch sử Việt Nam.',
    craft: 'Hoa văn được vẽ thủ công dưới men tro trấu – dòng men đặc trưng của Gốm Chu Đậu.',
    meanings: [
      { title: 'Dấu triện', body: 'Mang đậm bản sắc văn hóa Việt.' },
      { title: 'Quân hàm, quân hiệu, lệnh bài', body: 'Biểu tượng cho công danh và sự thành đạt.' },
      { title: 'Rồng gặp mây', body: 'Tượng trưng cho sự thăng hoa và phát triển.' },
      { title: 'Bốn Phượng Hoàng', body: 'Thể hiện nguồn sinh khí và sự chuyển động.' },
      { title: 'Hoa cúc đại đóa', body: 'Biểu tượng cho chính nhân quân tử.' },
      { title: 'Hoa dây', body: 'Gợi hình ảnh người phụ nữ luôn đồng hành.' },
      { title: 'Cánh sen', body: 'Thể hiện văn hóa tín ngưỡng của người Việt.' },
    ],
    message: 'Hòa hợp âm dương – hòa bình – thịnh vượng – hạnh phúc.',
  },
  {
    id: 'binh-thien-nga', slug: 'binh-thien-nga', apiSlug: 'binh-thien-nga', category: 'heritage', line: 'diplomacy',
    name: 'Bình Thiên Nga', priceVnd: 5200000,
    description: 'Bốn khoảnh khắc của Thiên Nga – bốn ý niệm về một cuộc sống viên mãn.',
    images: ['/images/products/binh-thien-nga.jpg', '/images/products/binh-thien-nga-02.jpg'],
    storyText: 'Bình Thiên Nga được phục dựng theo bình gốm cổ Chu Đậu triều Lê Sơ, thế kỷ XV. Theo nội dung khách hàng cung cấp, nguyên mẫu được khai quật tại tàu đắm ngoài khơi Cù Lao Chàm và được công nhận là Bảo vật quốc gia năm 2012.',
    craft: 'Tạo hình cân đối, hoa văn được vẽ thủ công dưới men tro trấu.',
    meanings: [
      { title: 'Hoa dây', body: 'Sự trường tồn và nối tiếp qua nhiều thế hệ.' },
      { title: 'Lệnh bài – sắc phong', body: 'Thể hiện sự hiếu học và thành đạt.' },
      { title: 'Vân mây cát tường', body: 'Mang ý nghĩa may mắn và thái bình.' },
      { title: 'Phi', body: 'Thiên Nga bay – biểu tượng cho sự thăng tiến.' },
      { title: 'Minh', body: 'Thiên Nga hót – nghỉ ngơi và hồi phục năng lượng.' },
      { title: 'Túc', body: 'Thiên Nga ngủ – biểu tượng cho sự sung túc.' },
      { title: 'Thực', body: 'Thiên Nga kiếm ăn – những nhu cầu căn bản của cuộc sống.' },
      { title: 'Cánh sen', body: 'Mang ý nghĩa văn hóa tín ngưỡng Việt.' },
    ],
    message: 'Ấm no – sung túc – bình an – hạnh phúc.',
  },
  {
    id: 'binh-hoa-lam', slug: 'binh-hoa-lam', apiSlug: 'binh-hoa-lam', category: 'heritage', line: 'diplomacy',
    name: 'Bình Hoa Lam', priceVnd: 4600000,
    description: 'Khí chất của người trụ cột, được kể qua sắc lam và hoa văn cổ truyền.',
    images: ['/assets/products/derived/binh-hoa-lam-02-vase-crop.webp', '/assets/products/owner-provided/hoa-lam-ty-ba-pair.webp', '/assets/products/derived/binh-hoa-lam-03-motif-detail.webp'],
    storyText: 'Bình Hoa Lam được phỏng theo bình gốm cổ Chu Đậu triều Trần – Lê Sơ, thế kỷ XIV–XV. Theo nội dung khách hàng cung cấp, nguyên mẫu hiện được lưu giữ tại Bảo tàng Topkapi Saray, Istanbul, Thổ Nhĩ Kỳ.',
    meaning: 'Dáng trụ mang tính dương, tượng trưng cho người đàn ông và người trụ cột trong gia đình.',
    meanings: [
      { title: 'Vương miện', body: 'Biểu tượng cho sự cao quý.' },
      { title: 'Hoa dây', body: 'Biểu tượng cho sự trường tồn và tiếp nối.' },
      { title: 'Sắc phong – quân hàm – lệnh bài', body: 'Thể hiện địa vị và sự thành đạt.' },
      { title: 'Hoa cúc đại đóa', body: 'Biểu tượng cho chính nhân quân tử.' },
      { title: 'Hoa dây đi cùng hoa cúc', body: 'Gợi hình ảnh người phụ nữ đồng hành.' },
    ],
    message: 'Kết hợp cùng Bình Tỳ Bà tạo thành cặp Dương – Âm, Cha – Mẹ, Vợ – Chồng, tượng trưng cho hạnh phúc gia đình.',
  },
  {
    id: 'binh-ty-ba', slug: 'binh-ty-ba', apiSlug: 'binh-ty-ba', category: 'heritage', line: 'diplomacy',
    name: 'Bình Tỳ Bà', priceVnd: 4800000,
    description: 'Dáng đàn mềm mại, biểu tượng cho người phụ nữ và vẻ đẹp bốn mùa.',
    images: ['/assets/products/derived/binh-ty-ba-02-vase-crop.webp', '/assets/products/owner-provided/hoa-lam-ty-ba-pair.webp', '/assets/products/derived/binh-ty-ba-03-motif-detail.webp'],
    storyText: 'Bình Tỳ Bà được nghệ nhân Chu Đậu phỏng lại theo bình gốm cổ với tạo hình lấy cảm hứng từ cây đàn tỳ bà. Theo nội dung khách hàng cung cấp, một bình gốm cùng dòng từng được đấu giá tại Mỹ với mức 521.000 USD.',
    meaning: 'Dáng bình mang tính âm, tượng trưng cho người phụ nữ Việt Nam.',
    meanings: [
      { title: 'Lá chuối – lá lúa', body: 'Gợi nền văn minh lúa nước Việt Nam.' },
      { title: 'Lông chim Lạc Việt', body: 'Gắn với bản sắc và tinh thần dân tộc.' },
      { title: 'Xuân – Hạ – Thu – Đông', body: 'Biểu tượng cho bốn mùa bình an.' },
      { title: 'Công – Dung – Ngôn – Hạnh', body: 'Gợi những nét đẹp truyền thống của người phụ nữ Việt Nam.' },
    ],
    message: 'Kết hợp cùng Bình Hoa Lam biểu trưng cho âm dương hòa hợp và hạnh phúc gia đình.',
  },
  {
    id: 'binh-giot-ngoc-cuu-ngu', slug: 'binh-giot-ngoc-cuu-ngu', apiSlug: 'binh-giot-ngoc', category: 'heritage', line: 'diplomacy',
    name: 'Bình Giọt Ngọc – Cửu Ngư Quần Hội', priceVnd: 6200000,
    description: 'Công danh thăng tiến, tài lộc dồi dào, gia đình sum vầy.',
    images: ['/images/products/binh-giot-ngoc-cuu-ngu.jpg'],
    storyText: 'Bình Giọt Ngọc khắc nổi được phỏng theo dáng gốm Chu Đậu triều Trần – Lê Sơ, thế kỷ XIV–XV.',
    craft: 'Hoa văn được khắc và vẽ thủ công dưới men tro trấu.',
    meanings: [
      { title: 'Cá chép vượt Vũ Môn', body: 'Biểu tượng cho công danh, thăng tiến, học hành đỗ đạt và khát vọng vươn lên.' },
      { title: 'Cửu Ngư Quần Hội', body: 'Chín cá chép kết hợp hoa sen, biểu tượng cho tài lộc, sung túc, dư dả và gia đình quây quần.' },
    ],
    message: 'Công danh phát đạt – gia đình hạnh phúc sum vầy.',
  },
  {
    id: 'binh-phu-quy-ly-ngu', slug: 'binh-phu-quy-ly-ngu', apiSlug: 'binh-phu-quy', category: 'heritage', line: 'diplomacy',
    name: 'Bình Phú Quý – Lý Ngư Vọng Nguyệt', priceVnd: 7500000,
    description: 'Lời chúc phú quý, tài lộc và ý chí vượt Vũ Môn hóa Rồng.',
    images: ['/images/products/binh-phu-quy-ly-ngu.jpg'],
    storyText: 'Bình Phú Quý được nghệ nhân Chu Đậu phỏng theo dáng bình cổ thế kỷ XV–XVI, tạo hình bằng phương pháp đổ khuôn và điêu khắc thủ công với tích Lý Ngư Vọng Nguyệt.',
    materials: ['Đất sét trắng Trúc Thôn, Chí Linh.', 'Cao lanh vùng núi phía Bắc.', 'Nguồn nước thuộc hệ thống Lục Đầu Giang.'],
    meanings: [
      { title: 'Đôi cá chép', body: 'Ý chí, nghị lực và khát vọng vươn lên.' },
      { title: 'Vượt Vũ Môn hóa Rồng', body: 'Biểu tượng cho công danh và thành đạt.' },
      { title: 'Trăng tròn', body: 'Tượng trưng cho sự viên mãn và trường tồn.' },
      { title: 'Hoa sen', body: 'Gắn với bản sắc văn hóa Việt.' },
      { title: 'Niên Niên Hữu Dư', body: 'Mang ý nghĩa cuộc sống luôn dư dả và đủ đầy.' },
    ],
    fiveElements: 'Kim – Mộc – Thủy – Hỏa – Thổ được thể hiện qua vàng kim, men tro trấu, nước, lửa và đất.',
    message: 'Phú quý – tài lộc – công danh – sự nghiệp phát đạt.',
  },
  {
    id: 'bo-tra-lac-hong-vien-vang', slug: 'bo-tra-lac-hong-vien-vang', category: 'tea', line: 'lifestyle',
    name: 'Bộ Trà Lạc Hồng – Viền Vàng', priceVnd: 3900000,
    description: 'Trà cụ thuần Việt kết hợp thủ công truyền thống và vẻ đẹp đương đại.',
    images: ['/images/products/bo-tra-lac-hong-vien-vang.png'],
    storyText: 'Bộ Trà Lạc Hồng là dòng gia dụng cao cấp của Gốm Chu Đậu, kết hợp công nghệ sản xuất hiện đại với kỹ nghệ thủ công.',
    materials: ['Đất sét trắng Trúc Thôn.', 'Cao lanh vùng núi phía Bắc.', 'Nguồn nước thuộc hệ thống Lục Đầu Giang.', 'Men tro trấu.'],
    craft: 'Trang trí thủ công dưới men với hình tượng chim hạc mang dấu ấn văn hóa Việt.',
    specifications: [{ label: 'Ấm', value: '01' }, { label: 'Chén', value: '06' }, { label: 'Đĩa kê', value: '07' }, { label: 'Dung tích', value: '760 ml' }],
    message: 'Phù hợp cho thưởng trà, tiếp khách và làm quà tặng.',
    note: 'Do đặc tính thủ công, sắc độ, kích thước và vị trí họa tiết có thể có khác biệt nhẹ giữa từng sản phẩm.',
  },
  {
    id: 'hop-tra-gom-chu-dau', slug: 'hop-tra-gom-chu-dau', category: 'tea', line: 'lifestyle',
    name: 'Hộp Trà Gốm Chu Đậu', priceVnd: 1800000,
    description: 'Giữ hương trà bằng một vật phẩm mang câu chuyện văn hóa Việt.',
    images: ['/images/products/hop-tra-gom-chu-dau.webp'],
    storyText: 'Hộp Trà Gốm Chu Đậu là dòng trà cụ cao cấp được sản xuất bằng sự kết hợp giữa công nghệ và kỹ nghệ thủ công truyền thống.',
    materials: ['Đất sét trắng Trúc Thôn.', 'Cao lanh vùng núi phía Bắc.', 'Nguồn nước thuộc hệ thống Lục Đầu Giang.', 'Men tro trấu.'],
    motifs: ['Hoa lá', 'Cỏ cây', 'Đồng quê', 'Hoa sen', 'Chim hạc'],
    message: 'Dùng để bảo quản trà, kết hợp cùng bộ trà Chu Đậu và phù hợp làm quà tặng.',
  },
  {
    id: 'bo-do-an-gom-chu-dau', slug: 'bo-do-an-gom-chu-dau', category: 'tableware', line: 'lifestyle',
    name: 'Bộ Đồ Ăn Gốm Chu Đậu – Bộ 6 Người', priceVnd: 4200000,
    description: 'Nét đẹp đồng quê Việt trên bàn ăn hiện đại.',
    images: ['/images/products/bo-do-an.png', '/images/products/bo-do-an-02.png'],
    storyText: 'Bộ đồ ăn Gốm Chu Đậu là dòng gia dụng cao cấp thuần Việt, kết hợp công nghệ tạo hình hiện đại với các công đoạn hoàn thiện và trang trí thủ công.',
    process: ['Tạo hình', 'Chỉnh sửa', 'Đánh chuốt', 'Sấy khô', 'Trang trí thủ công dưới men', 'Nung nhiệt độ cao'],
    motifs: 'Các họa tiết lấy cảm hứng từ đồng quê Việt Nam, thể hiện cuộc sống thanh bình, no ấm và hạnh phúc.',
    specifications: [
      { label: 'Bát cơm', value: '6 chiếc' }, { label: 'Đĩa 6', value: '1 chiếc' },
      { label: 'Đĩa 7 bằng', value: '1 chiếc' }, { label: 'Đĩa 7 sâu', value: '1 chiếc' },
      { label: 'Đĩa 8 bằng', value: '1 chiếc' }, { label: 'Đĩa 8 sâu', value: '1 chiếc' },
      { label: 'Tô F16', value: '1 chiếc' }, { label: 'Bát mắm', value: '1 chiếc' },
      { label: 'Đĩa muối', value: '1 chiếc' }, { label: 'Liễn cơm', value: '1 chiếc' },
    ],
    message: 'Phù hợp cho bữa ăn gia đình, bàn tiệc, nhà hàng và quà tặng doanh nghiệp.',
  },
];

export const listingProducts = products.map((product) => ({ ...product, detailSlug: product.slug, image: product.images[0] }));

export function getListingProductBySlug(slug) {
  return listingProducts.find((product) => product.slug === slug || product.apiSlug === slug);
}

export function getRelatedListingProducts(product, limit = 4) {
  if (!product) return [];
  const sameCategory = listingProducts.filter((item) => item.id !== product.id && item.category === product.category);
  const sameLine = listingProducts.filter((item) => item.id !== product.id && item.category !== product.category && item.line === product.line);
  return [...sameCategory, ...sameLine].slice(0, limit);
}
