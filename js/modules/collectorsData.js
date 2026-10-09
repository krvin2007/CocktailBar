/* =========================================================
   COLLECTORS-DATA.JS - World-Class Legendary Spirits & Wine Collectors
   Hồ sơ những nhà sưu tầm rượu mạnh và rượu vang lừng danh thế giới,
   những người đã dày công kiến tạo nên các kho tàng báu vật vô giá.

   Nội dung đã được đối chiếu lại (10/2026) với các nguồn công khai:
   scotchwhisky.com, The Whiskey Wash, InsideHook, Whisky Advocate,
   Journal du Net, Vinexposium, Whisky Auctioneer... Đã gỡ 2 mục không
   có thật ("Mario Cappelli", "The Dragon Vault Guild") và các số liệu
   không tìm được nguồn. Trường "philosophy" là phần TÓM TẮT do nhóm biên
   soạn, không phải trích dẫn nguyên văn (trừ khi ghi rõ người nói).
   ========================================================= */

export const COLLECTOR_CATEGORIES = {
  all: "Tất Cả Nhà Sưu Tầm",
  scotch: "Bộ Sưu Tập Single Malt & Scotch",
  wineCognac: "Vang Cổ Điển & Chai Rượu Lịch Sử",
  historical: "Nhà Giám Tuyển Tiên Phong",
};

export const COLLECTORS_COLLECTION = [
  {
    id: "col-richard-gooding",
    name: "Richard Gooding",
    title: "Nhà sưu tầm đứng sau 'The Perfect Collection'",
    category: "scotch",
    categoryLabel: "Huyền Thoại Single Malt",
    country: "Colorado, Hoa Kỳ",
    yearsCollecting: "Nhiều thập kỷ (bộ sưu tập được đấu giá năm 2020 sau khi ông qua đời)",
    vaultName: "Hầm rượu tư gia, Colorado",
    collectionScale: "Khoảng 3.900 chai (gần 1.900 lô đấu giá)",
    estimatedValue: "Khoảng 9,1 triệu USD tại buổi đấu giá (Whisky Auctioneer, 2020)",
    image: "img/collectors/richard-gooding.jpg",
    imageType: "portrait",
    specialty: "The Macallan, Bowmore và Springbank, cùng các nhà chưng cất Scotland đã đóng cửa ('lost distilleries'), Bourbon và Japanese Whisky",
    philosophy: "Vợ ông, bà Nancy, chia sẻ với báo giới về tâm niệm của chồng: \"Sứ mệnh của ông ấy là sưu tầm ít nhất một chai đại diện cho từng nhà chưng cất trên thế giới.\"",
    crownJewels: [
      {
        bottle: "The Macallan 1926 60-Year-Old (Valerio Adami label)",
        detail: "Chỉ có 12 chai trên thế giới mang nhãn do họa sĩ Valerio Adami thiết kế. Đạt mức giá 825.000 bảng Anh (khoảng 1,07 triệu USD) vào tháng 2/2020 – chai rượu đầu tiên vượt mốc 1 triệu USD trong một phiên đấu giá trực tuyến.",
        highlight: "Kỷ Lục Đấu Giá Trực Tuyến",
      },
      {
        bottle: "The Macallan 1926 Fine & Rare 60-Year-Old",
        detail: "Một trong những chai rượu lừng danh và đắt giá nhất lịch sử Scotch whisky, kiệt tác nằm trong bộ sưu tập.",
        highlight: "Chén Thánh Của Scotch",
      },
      {
        bottle: "Dallas Dhu 1921 64-Year-Old Single Cask",
        detail: "Đến từ nhà chưng cất đã vĩnh viễn ngừng hoạt động từ năm 1983; được nhà đấu giá đánh giá là báu vật lịch sử cực hiếm chưa từng xuất hiện trên thị trường thứ cấp.",
        highlight: "Báu Vật Lost Distillery",
      },
    ],
    biography: `Richard Gooding, một doanh nhân quê ở Colorado, từng là chủ sở hữu kiêm giám đốc điều hành của Pepsi-Cola Bottling Company of Denver. Trong nhiều thập kỷ, ông đã cất công săn tìm whisky chủ yếu qua các phiên đấu giá danh tiếng và trực tiếp từ các nhà chưng cất trong các chuyến du hành tới Scotland và Ireland.

Sau khi ông qua đời, bộ sưu tập gồm khoảng 3.900 chai – bao gồm những bộ sưu tập The Macallan, Bowmore và Springbank quy mô nhất từng xuất hiện trên thị trường – đã được sàn Whisky Auctioneer đấu giá vào năm 2020 thành 2 đợt mang tên "The Perfect Collection". Buổi đấu giá đã thu về khoảng 9,1 triệu USD, được ghi nhận là bộ sưu tập whisky tư nhân có giá trị chuyển nhượng cao nhất từng được bán trên thị trường thứ cấp.`,
  },

  {
    id: "col-michel-jack-chasseuil",
    name: "Michel-Jack Chasseuil",
    title: "Chủ nhân hầm rượu được mệnh danh là 'Bảo tàng Louvre của thế giới rượu vang'",
    category: "wineCognac",
    categoryLabel: "Huyền Thoại Vang Cổ & Cognac",
    country: "La Chapelle-Bâton, Deux-Sèvres, Pháp",
    yearsCollecting: "Thập niên 1960 – nay",
    vaultName: "Hầm ngầm kiên cố tự xây dưới lòng tư gia",
    collectionScale: "Khoảng 40.000 – 50.000 chai",
    estimatedValue: "Báo chí ước tính 40 – 50 triệu Euro (chưa từng thẩm định chính thức toàn bộ)",
    image: "img/collectors/michel-jack-chasseuil.jpg",
    imageType: "portrait",
    specialty: "Grand Cru Bordeaux, trọn bộ vertical Pétrus nguyên vẹn, Port cổ và những chai vang hiếm từ thế kỷ 19",
    philosophy: "Luôn tâm niệm lời khuyên của người sếp cũ Marcel Dassault: 'Chỉ mua những gì mà một ngày nào đó người đời sẽ không thể tìm thấy nữa'.",
    crownJewels: [
      {
        bottle: "Château d'Yquem 1811",
        detail: "Niên vụ 'Sao Chổi' (Comet Vintage) Sauternes lừng danh, thường được nhắc tới như một trong những chai vang trắng ngọt đắt nhất hành tinh.",
        highlight: "Niên Vụ Huyền Thoại",
      },
      {
        bottle: "Trọn bộ sưu tập Pétrus kể từ năm 1914",
        detail: "Sở hữu toàn bộ các niên vụ (vertical) của điền trang Pomerol huyền thoại từ năm 1914 đến nay không thiếu một năm.",
        highlight: "Vertical Trọn Vẹn",
      },
      {
        bottle: "1853 Lacryma Christi mang gia huy Sa hoàng Nicholas II",
        detail: "Chai vang lịch sử vô giá mang biểu tượng gia huy hoàng gia Đế quốc Nga.",
        highlight: "Xuất Xứ Hoàng Gia",
      },
      {
        bottle: "1735 Port",
        detail: "Thuộc nhóm những chai rượu lâu đời nhất còn nguyên vẹn trong lòng hầm rượu.",
        highlight: "Báu Vật Thế Kỷ 18",
      },
    ],
    biography: `Michel-Jack Chasseuil, con trai của một nhân viên bưu điện, từng làm việc tại tập đoàn hàng không Dassault Aviation với khởi điểm là thợ gò đồng rồi thăng tiến lên phòng thiết kế kỹ thuật. Từ những năm 1960, ông đã dành dụm từ đồng lương của mình để mua khoảng 600 chai đầu tiên, và quy mô bộ sưu tập đã tăng trưởng thần tốc trong suốt những thập kỷ sau đó.

Ông tự tay đào và xây dựng một hầm rượu ngầm kiên cố bên dưới ngôi nhà của gia đình ở Deux-Sèvres; các ống thông gió được ngụy trang tài tình giữa vườn rau và chuồng gà. Bộ sưu tập đồ sộ 40.000 – 50.000 chai này được giới thưởng thức phong tặng là "bảo tàng Louvre của thế giới rượu vang", và Chasseuil bày tỏ tâm nguyện một ngày nào đó nơi đây sẽ trở thành viện bảo tàng di sản chứ không bao giờ bị xé lẻ đem bán.`,
  },

  {
    id: "col-valentino-zagatti",
    name: "Valentino Zagatti",
    title: "'Nhà sưu tầm khiếm thị vùng Lugo'",
    category: "scotch",
    categoryLabel: "Huyền Thoại Single Malt",
    country: "Lugo (Ravenna), Emilia-Romagna, Ý",
    yearsCollecting: "1960 – nay",
    vaultName: "Bộ sưu tập The Unseen Valentino Zagatti",
    collectionScale: "Khoảng 3.000 chai (khoảng 97% là Scotch whisky)",
    estimatedValue: "Không công khai",
    image: "img/collectors/valentino-zagatti.jpg",
    imageType: "portrait",
    specialty: "Mọi phiên bản có thể tìm thấy từ từng nhà chưng cất Scotch, bao gồm những mẻ đóng chai cực kỳ cổ xưa",
    philosophy: "Bị khiếm thị từ nhỏ, Zagatti thẩm định, nhận biết và ghi nhớ từng chai rượu chủ yếu qua đôi bàn tay và xúc giác kỳ diệu.",
    crownJewels: [
      {
        bottle: "Scotch whisky từ năm 1843",
        detail: "Viên ngọc trung tâm của bộ sưu tập – một chai rượu từng được người cha trao tặng cho con gái làm của hồi môn ngày cưới.",
        highlight: "Chai Cổ Nhất",
      },
      {
        bottle: "Bộ sách 5 tập Zagatti Collection (2019)",
        detail: "Bộ bách khoa toàn thư đồ sộ ghi chép tường tận chi tiết từng chai rượu trong tổng số khoảng 3.000 chai của ông.",
        highlight: "Di Sản Xuất Bản",
      },
    ],
    biography: `Valentino Zagatti mất đi thị giác từ thuở nhỏ do vướng phải một quả mìn còn sót lại từ Thế chiến thứ hai. Vượt lên số phận, ông trở thành nghệ sĩ đàn accordion chuyên nghiệp, giảng dạy âm nhạc và từng giành chức vô địch accordion cổ điển toàn nước Ý vào năm 1956. Năm 1960, ông quyết định bỏ thuốc lá và chuyển trọn niềm đam mê sang việc sưu tầm whisky.

Trải qua nhiều thập kỷ, những chai whisky quý giá đã lấp đầy ngôi nhà của ông ở Lugo từ sàn lên tới tận trần. Vào giữa những năm 2010, bộ sưu tập được chuyển giao cho Scotch Whisky International cùng nhóm khoảng 20 nhà đầu tư với điều kiện tiên quyết: toàn bộ bộ sưu tập phải được lưu giữ nguyên vẹn cùng nhau. Từ tháng 10/2018, kho tàng này được trưng bày tại Sassenheim, Hà Lan với tên gọi "The Unseen Valentino Zagatti Collection".`,
  },

  {
    id: "col-sukhinder-singh",
    name: "Sukhinder Singh",
    title: "Đồng sáng lập The Whisky Exchange & Elixir Distillers",
    category: "historical",
    categoryLabel: "Nhà Giám Tuyển Tiên Phong",
    country: "London, Vương quốc Anh",
    yearsCollecting: "Thập niên 1980 – nay",
    vaultName: "Bộ sưu tập tư nhân, London",
    collectionScale: "Không công khai",
    estimatedValue: "Không công khai",
    image: "img/collectors/sukhinder-singh.jpg",
    imageType: "portrait",
    specialty: "Khởi đầu từ những chai rượu mini (miniatures), sau đó là single malt kích cỡ tiêu chuẩn – với mục tiêu mỗi nhà chưng cất một chai",
    philosophy: "Biến niềm đam mê tuổi thiếu niên thành một trong những đế chế thương mại và tuyển chọn whisky danh giá bậc nhất thế giới.",
    crownJewels: [
      {
        bottle: "Bộ sưu tập khoảng 8.000 chai mini",
        detail: "Được mệnh danh là bộ sưu tập chai thu nhỏ lớn nhất thế giới; ông mua lại tại một buổi đấu giá với giá 1.000 bảng khi còn là một nhà sưu tầm trẻ tuổi.",
        highlight: "Bộ Sưu Tập Chai Mini",
      },
      {
        bottle: "Vintage Springbank nguyên bản",
        detail: "Chai single malt đầu tiên mà ông mở thưởng thức – ông chia sẻ rằng mỗi ngày thưởng thức nó lại mang tới một tầng hương vị kỳ diệu khác biệt.",
        highlight: "Single Malt Đầu Tiên",
      },
    ],
    biography: `Sukhinder Singh lớn lên trong ngành kinh doanh đồ uống: năm 1972, cha mẹ ông đã mở cửa hàng bán lẻ rượu (off-licence) đầu tiên của người gốc Ấn tại Vương quốc Anh. Ông bắt đầu sưu tầm chai rượu mini từ năm 15 tuổi và sau đó nâng tầm lên những chai dung tích chuẩn, khởi đầu với mục tiêu sở hữu ít nhất một chai từ mỗi nhà chưng cất.

Năm 1999, ông cùng em trai Rajbir sáng lập The Whisky Exchange và nhà phân phối Speciality Drinks, rồi đến năm 2015 thành lập nhà đóng chai độc lập Elixir Distillers. Cả The Whisky Exchange và Speciality Drinks sau đó đã được Pernod Ricard mua lại vào năm 2021. Năm 2022, ông mua lại nhà chưng cất Tormore tại Speyside và hiện đang xây dựng nhà chưng cất Portintruan trên hòn đảo Islay huyền thoại.`,
  },

  {
    id: "col-edoardo-giaccone",
    name: "Edoardo Giaccone",
    title: "\"Baffo\" – Người tiên phong mang Single Malt đến nước Ý",
    category: "historical",
    categoryLabel: "Nhà Giám Tuyển Tiên Phong",
    country: "Salò, Hồ Garda, Ý",
    yearsCollecting: "1958 – khi ông qua đời",
    vaultName: "Quán bar Edward & Edward (nguyên gốc 'Garten'), Salò",
    collectionScale: "Hơn 5.500 mẻ đóng chai khác nhau",
    estimatedValue: "Giá trị lịch sử – Được ghi danh Kỷ lục Guinness",
    image: "img/collectors/edoardo-giaccone.jpg",
    imageType: "portrait",
    specialty: "Những mẻ đóng chai single malt chính hãng độc quyền dành riêng cho quán bar của ông từ cuối thập niên 1960",
    philosophy: "Được tôn vinh là nhà nhìn xa trông rộng đã đặt nền móng vững chắc cho phong trào nhà đóng chai độc lập (independent bottlers) lừng lẫy của nước Ý.",
    crownJewels: [
      {
        bottle: "Các mẻ đóng chai chính hãng độc quyền Edward & Edward",
        detail: "Ông là người đầu tiên tại Ý thuyết phục được các nhà chưng cất sản xuất các mẻ đóng chai chính hãng độc quyền riêng cho quán – bao gồm Clynelish, Bowmore, Dalmore, Highland Park và cả Jack Daniel's.",
        highlight: "Đóng Chai Độc Quyền Đầu Tiên Tại Ý",
      },
      {
        bottle: "Bộ sưu tập whisky ghi danh Kỷ lục Guinness",
        detail: "Bộ sưu tập của ông tại quán Edward & Edward đã vinh dự được Tổ chức Kỷ lục Guinness thế giới ghi nhận là bộ sưu tập whisky lớn nhất thế giới thời bấy giờ.",
        highlight: "Kỷ Lục Thế Giới Guinness",
      },
    ],
    biography: `Edoardo Giaccone, người thường được gọi với biệt danh thân mật "Baffo" bởi bộ ria mép đặc trưng, đã mở quán bar đầu tiên của mình tại Salò ven bờ hồ Garda tuyệt đẹp vào năm 1958, ban đầu lấy tên là Garten và sau đổi thành Edward & Edward. Quán bar này lưu giữ tới hơn 1.500 loại whisky thượng hạng.

Từ cuối thập niên 1960, ông tiên phong nhập khẩu các mẻ single malt chính hãng được tuyển chọn và đóng chai riêng, và ông thường được tôn vinh là nhà đóng chai độc lập đầu tiên của nước Ý. Bộ sưu tập đồ sộ của ông – ghi nhận hơn 5.500 mẫu chai khác biệt – đã được Tổ chức Kỷ lục Guinness thế giới công nhận là bộ sưu tập whisky lớn nhất hành tinh, và ông được hậu thế tri ân là người đã biến nước Ý thành chiếc nôi thưởng thức single malt Scotch sớm nhất tại châu Âu.`,
  },
];
