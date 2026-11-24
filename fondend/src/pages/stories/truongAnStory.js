const asset = '/assets/nfc/bo-am-tra-truong-an/';
const photo = (name, label, alt) => ({ src: `${asset}${name}.webp`, thumbnail: `${asset}${name}-thumb.webp`, label, alt });

const images = [
  photo('toan-canh', 'Bộ trà Trường An', 'Bộ Ấm Trà Trường An họa tiết chim Lạc bên hoa và bánh'),
  photo('rot-tra', 'Trao chén trà thơm', 'Rót trà từ ấm Trường An vào chén'),
  photo('sac-men', 'Sắc men và nét lam', 'Sắc men sáng và họa tiết lam trên ấm, chén Trường An'),
  photo('sum-vay', 'Một khoảng trà sum vầy', 'Ấm và chén Trường An trên bàn trà cùng bánh'),
  photo('bo-tra-hop-tra', 'Bộ trà cùng hộp trà', 'Bộ trà Trường An và hộp đựng trà cùng họa tiết chim Lạc'),
  photo('chi-tiet-am', 'Dáng ấm thanh nhã', 'Cận cảnh dáng ấm, nắp và hoa văn chim Lạc'),
  photo('thuong-tra', 'Khoảnh khắc thưởng trà', 'Bộ trà Trường An với những chén trà đã rót'),
  photo('chi-tiet-voi-am', 'Chi tiết lòng và vòi ấm', 'Cận cảnh lòng ấm, lỗ lọc trà và vòi ấm Trường An'),
];

export const truongAnStory = {
  name: 'Bộ Ấm Trà Trường An',
  variant: 'tea',
  titlePrefix: 'BỘ ẤM TRÀ',
  titleLines: ['TRƯỜNG AN'],
  subtitle: 'Gửi trọn bình yên trong từng chén trà',
  intro: 'Bộ Ấm Trà Trường An – Trao chén trà thơm, gửi lời bình an.',
  images,
  imageFit: 'contain',
  frameBackground: '#0b1c29',
  entryImages: [`${asset}chi-tiet-am.webp`],
  imageCaption: 'Dáng ấm mềm mại, họa tiết chim Lạc trên nền men sáng.',
  motifsTitle: 'Nét đẹp của bộ trà',
  motifs: [[
    { title: 'Họa tiết chim Lạc', text: 'Gợi nhắc cội nguồn văn hóa dân tộc và tinh thần gắn bó cộng đồng.' },
    { title: 'Dáng ấm thanh lịch', text: 'Đường nét mềm mại, cân đối, hài hòa với từng chén trà.' },
    { title: 'Sắc men Chu Đậu', text: 'Vẻ đẹp trang nhã mang dấu ấn nghệ thuật gốm truyền thống.' },
  ]],
  note: 'Trường An – Ước vọng về cuộc sống bình an, ổn định và hạnh phúc bền lâu.',
  wishImagery: [images[1], images[3], images[6], images[4]],
  wishTitles: ['Bình yên dài lâu', 'Gia đình thuận hòa', 'Gắn kết chân thành', 'Món quà tri ân'],
  wishTexts: [
    'Gửi gắm mong ước về cuộc sống an vui.',
    'Nâng niu những phút giây sum họp bên chén trà.',
    'Trân trọng những cuộc gặp gỡ và mối quan hệ tốt đẹp.',
    'Thay lời cảm ơn và lời chúc bình an dành cho người nhận.',
  ],
  craftSteps: [
    { title: 'Chuẩn bị nguyên liệu', src: '/assets/video/tro-lam-banner-poster.jpg', alt: 'Ảnh tư liệu người thợ làm gốm' },
    { title: 'Tạo hình', src: '/assets/photography/pottery-hands.jpg', alt: 'Ảnh tư liệu đôi bàn tay tạo hình gốm trên bàn xoay' },
    { title: 'Trang trí hoa văn', src: images[5].src, alt: 'Họa tiết chim Lạc trên ấm Trường An hoàn thiện' },
    { title: 'Tráng men & nung', src: images[2].src, alt: 'Sắc men bộ trà Trường An sau khi hoàn thiện' },
  ],
  productLinks: [],
  entries: [{
    name: 'Bộ Ấm Trà Trường An',
    story: [
      'Trong văn hóa Việt Nam, thưởng trà không đơn thuần là một thói quen sinh hoạt, mà còn là nét đẹp của sự hiếu khách, của những cuộc gặp gỡ và những phút giây con người dành cho nhau. Từ chén trà mời khách đầu câu chuyện đến những buổi sum họp gia đình, trà đã trở thành biểu tượng của sự gắn kết, chân thành và thanh nhã.',
      'Lấy cảm hứng từ tinh thần ấy, Bộ Ấm Trà Trường An gốm Chu Đậu mang vẻ đẹp hài hòa giữa nghệ thuật chế tác truyền thống và văn hóa thưởng trà Việt Nam. Tên gọi Trường An gợi nhắc ước vọng về cuộc sống bình an, ổn định và hạnh phúc bền lâu, những giá trị giản dị nhưng luôn được người Việt trân trọng.',
      'Bộ trà mang dáng vẻ cổ điển, cân đối và thanh lịch, với sắc men đặc trưng của gốm Chu Đậu. Ở phiên bản trang trí chim Lạc, họa tiết gợi liên tưởng đến cội nguồn văn hóa dân tộc, tinh thần gắn bó cộng đồng và khát vọng vươn lên của người Việt. Những đường nét trang trí kết hợp cùng dáng ấm mềm mại tạo nên một tổng thể vừa trang nhã, vừa mang dấu ấn nghệ thuật truyền thống.',
      'Đằng sau mỗi chén trà là sự kết nối giữa con người với con người. Đó có thể là phút giây ông bà kể chuyện cho con cháu, cuộc gặp gỡ giữa những người bạn lâu ngày hay lời mời trà thể hiện sự kính trọng dành cho khách quý.',
      'Bởi vậy, Bộ Ấm Trà Trường An không chỉ là một vật dụng phục vụ đời sống, mà còn là biểu tượng của sự đoàn viên, hòa thuận và những mối quan hệ tốt đẹp. Qua nghệ thuật gốm Chu Đậu, sản phẩm góp phần lưu giữ một nét văn hóa đẹp của người Việt, nơi mỗi chén trà được trao đi cũng là một lời chúc bình an và sự trân trọng dành cho người nhận.',
    ],
    craft: [
      'Từ đất và lửa đến những chén trà bình an',
      'Để tạo nên Bộ Ấm Trà Trường An, người thợ gốm phải trải qua một hành trình đòi hỏi sự kết hợp giữa kỹ thuật chế tác, kinh nghiệm và sự khéo léo trong từng công đoạn.',
      'Quá trình sản xuất bắt đầu từ việc chuẩn bị và xử lý nguyên liệu, sau đó tạo hình các bộ phận như thân ấm, vòi ấm, quai cầm, nắp và chén trà. Mỗi chi tiết cần được hoàn thiện cẩn thận để tạo nên tổng thể cân đối, hài hòa, đồng thời đáp ứng công năng sử dụng.',
      'Sau khi tạo hình, sản phẩm bước vào công đoạn trang trí hoa văn. Những đường nét mang cảm hứng từ nghệ thuật gốm truyền thống được thể hiện trên bề mặt, góp phần tạo nên vẻ đẹp thanh nhã và dấu ấn văn hóa riêng của bộ trà.',
      'Tiếp đó là quá trình tráng men và nung đốt ở nhiệt độ phù hợp. Dưới tác động của lửa, lớp men dần hoàn thiện, tạo nên bề mặt gốm sáng đẹp và những sắc độ đặc trưng. Thành phẩm được kiểm tra về hình dáng, độ hoàn thiện, chất lượng lớp men và các chi tiết sử dụng trước khi đưa đến tay khách hàng.',
      'Từ nguyên liệu thô mộc đến bộ trà hoàn chỉnh là sự kết tinh của nhiều công đoạn và kinh nghiệm nghề gốm. Qua hành trình ấy, Bộ Ấm Trà Trường An không chỉ mang giá trị sử dụng mà còn lưu giữ nét đẹp của nghệ thuật thủ công truyền thống.',
      'Mỗi chén trà được nâng trên tay cũng là một cách cảm nhận sự tỉ mỉ và tâm huyết của những người làm gốm Chu Đậu.',
    ],
    wishes: [
      'Một chén trà ấm – Một lời chúc Trường An',
      'Tên gọi Trường An gửi gắm mong ước về sự bình yên lâu dài, gia đình thuận hòa và cuộc sống an vui.',
      'Khi được lựa chọn làm quà tặng, bộ trà có thể thay lời tri ân chân thành dành cho ông bà, cha mẹ, thầy cô, bạn bè hoặc đối tác. Món quà không chỉ mang giá trị sử dụng mà còn thể hiện sự quan tâm và mong muốn gìn giữ những mối quan hệ tốt đẹp.',
      'Bộ Ấm Trà Trường An – Trao chén trà thơm, gửi lời bình an.',
    ],
    care: {
      intro: [
        'Nâng niu từng chén trà – Gìn giữ nét đẹp gốm Việt',
        'Bộ Ấm Trà Trường An mang vẻ đẹp thanh nhã của nghệ thuật gốm Chu Đậu, đồng hành cùng những khoảnh khắc thưởng trà và sum họp. Để giữ gìn nước men, họa tiết trang trí và chất lượng sản phẩm trong quá trình sử dụng, cần lưu ý những hướng dẫn sau:',
      ],
      groups: [
        [
          'Làm sạch sau khi sử dụng: Sau mỗi lần thưởng trà, đổ bỏ bã trà và tráng nhẹ ấm, chén bằng nước sạch. Không để nước trà hoặc bã trà tồn đọng quá lâu, tránh hình thành vết ố và mùi khó chịu.',
          'Vệ sinh nhẹ nhàng: Sử dụng khăn mềm hoặc miếng bọt biển mềm để làm sạch. Với những vết bẩn thông thường, có thể dùng nước ấm và dung dịch rửa chén dịu nhẹ nếu nhà sản xuất cho phép.',
          'Bảo vệ hoa văn: Không sử dụng miếng cọ kim loại, vật liệu có tính mài mòn hoặc chất tẩy rửa mạnh vì có thể ảnh hưởng đến lớp men và các chi tiết trang trí.',
          'Làm khô sản phẩm: Sau khi vệ sinh, đặt ấm và chén tại nơi thoáng mát để ráo nước hoàn toàn trước khi cất giữ.',
        ],
        [
          'Tránh va đập: Đặt bộ trà trên bề mặt phẳng, chắc chắn; hạn chế xếp chồng các chén hoặc đĩa kê khi không có lớp ngăn bảo vệ.',
          'Tránh thay đổi nhiệt độ đột ngột: Không rót nước sôi vào sản phẩm đang quá lạnh hoặc làm nguội đột ngột bằng nước lạnh sau khi sử dụng nước nóng.',
          'Giữ gìn chi tiết trang trí: Đối với phiên bản có viền vàng hoặc họa tiết đặc biệt, hạn chế chà xát mạnh và sử dụng dụng cụ vệ sinh thô ráp.',
          'Cất giữ đúng cách: Khi không sử dụng trong thời gian dài, bảo đảm sản phẩm sạch, khô và được đặt tại nơi thông thoáng, tránh nguy cơ va chạm.',
        ],
        [
          'Chỉ sử dụng bộ trà để pha và thưởng trà nóng trong phạm vi nhiệt độ được nhà sản xuất xác nhận phù hợp.',
          'Không sử dụng trong lò vi sóng, lò nướng hoặc máy rửa bát khi chưa có hướng dẫn cụ thể từ nhà sản xuất, đặc biệt với các phiên bản có trang trí vàng kim.',
          'Khi di chuyển, cầm chắc thân ấm và nâng đỡ phần đáy; tránh nhấc ấm đầy nước chỉ bằng vòi hoặc nắp.',
        ],
        ['Đối với sản phẩm tích hợp chip NFC của Tro & Lam, hạn chế ngâm nước hoặc tác động mạnh vào khu vực gắn chip khi chưa xác nhận khả năng chống nước.'],
      ],
      closing: ['Chăm sóc đúng cách không chỉ giúp Bộ Ấm Trà Trường An giữ được vẻ đẹp lâu dài, mà còn thể hiện sự trân trọng đối với nghệ thuật gốm Chu Đậu và những khoảnh khắc thưởng trà bình yên.'],
    },
  }],
};
