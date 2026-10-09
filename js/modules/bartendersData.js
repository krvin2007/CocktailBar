/* =========================================================
   BARTENDERS-DATA.JS - Huyền Thoại Master Bartenders Thế Giới
   Biên niên sử những bậc thầy mixology tiên phong đã định hình
   văn hóa cocktail, sáng tạo những công thức kinh điển bất hủ.

   Nội dung đã được đối chiếu lại (10/2026) với các nguồn công khai:
   Difford's Guide, Wikipedia, The Drinks Business, Tales of the Cocktail,
   The World's 50 Best Bars, Punch...
   ========================================================= */

export const BARTENDER_CATEGORIES = {
  all: "Tất cả Bậc Thầy",
  renaissance: "Phục Hưng Đương Đại (Modern Renaissance)",
  classic: "Kỷ Nguyên Vàng (Golden Age Pioneers)",
  japanese: "Kỹ Nghệ Nhật Bản (Japanese Precision)",
  european: "Tiên Phong Châu Âu (European Avant-Garde)"
};

export const BARTENDERS_COLLECTION = [
  {
    id: "bt-salvatore-calabrese",
    name: "Salvatore Calabrese",
    nickname: "The Maestro",
    category: "renaissance",
    categoryLabel: "Huyền Thoại Phục Hưng Hiện Đại",
    origin: "Maiori, Bờ biển Amalfi, Ý (sinh năm 1955)",
    currentBase: "London, Vương quốc Anh",
    yearsActive: "1966 – nay",
    venues: [
      "Quầy bar Khách sạn Dukes (London, thập niên 1980 – 1994)",
      "The Library Bar, Khách sạn The Lanesborough (London, từ 1994)",
      "Salvatore at FIFTY / Salvatore at Playboy (London)",
      "The Donovan Bar, Brown's Hotel (London, từ 2018)",
      "Velvet, Corinthia London (2022)"
    ],
    image: "img/bartenders/salvatore-calabrese.jpg",
    imageType: "portrait",
    accolades: [
      "Giải thưởng Thành tựu Trọn đời Helen David tại Tales of the Cocktail (2013)",
      "Cựu Chủ tịch Hiệp hội Bartender Vương quốc Anh (UKBG)",
      "Kỷ lục Guinness Thế giới: Ly cocktail đắt nhất – Salvatore's Legacy, £5,500 (2012)",
      "Tác giả cuốn sách kinh điển 'Classic Cocktails'"
    ],
    philosophy: "Nổi tiếng với nghệ thuật hiếu khách đỉnh cao: những ly Dry Martini chuẩn xác tại Dukes và triết lý 'Lịch Sử Dạng Lỏng (Liquid History)'—phục vụ những dòng rượu cognac và spirits cổ hiếm từ nhiều thế kỷ trước cho thực khách.",
    signatureDrinks: [
      {
        name: "Breakfast Martini",
        year: "Thập niên 1990",
        desc: "Sáng tạo tại The Library Bar thuộc The Lanesborough; câu chuyện bắt nguồn từ việc vợ ông hối thúc ông ăn sáng với bánh mì nướng phết mứt cam trước khi đi làm.",
        recipe: "50ml London Dry Gin, 15ml Cointreau, 15ml Nước cốt chanh tươi, 1 Barspoon Mứt cam đắng.",
        glass: "Chilled Cocktail Glass",
        onMenu: true
      },
      {
        name: "Salvatore's Legacy",
        year: "2012",
        desc: "Xác lập Kỷ lục Guinness thế giới cho ly cocktail đắt nhất (£5,500/ly), pha chế từ Cognac Clos de Griffier Vieux năm 1788, Rượu mùi Kummel 1770, Dubb Orange Curaçao 1860 và Angostura Bitters đầu thế kỷ 20.",
        recipe: "40ml Cognac Clos de Griffier 1788, 20ml Kummel 1770, 20ml Dubb Orange Curaçao 1860, 2 dashes Angostura Bitters cổ.",
        glass: "Antique Crystal Glass",
        onMenu: false
      },
      {
        name: "Spicy Fifty",
        year: "Thập niên 2000",
        desc: "Món cocktail hiện đại kinh điển thời kỳ Salvatore at FIFTY, hòa quyện hương vani, hoa cơm cháy, mật ong cùng vị cay nồng bất ngờ từ ớt tươi.",
        recipe: "50ml Vanilla Vodka, 15ml Elderflower Cordial, 15ml Nước cốt chanh tươi, 10ml Siro mật ong, 2 lát ớt đỏ.",
        glass: "Chilled Martini Glass",
        onMenu: true
      }
    ],
    biography: `Mùa hè năm 1966, khi mới 11 tuổi, Salvatore Calabrese đã bắt đầu phụ việc sau quầy bar khách sạn tại quê nhà Maiori ven bờ biển Amalfi. Đến năm 21 tuổi, ông đã trở thành trưởng bộ phận phục vụ trẻ nhất trên dải bờ biển nước Ý.

Năm 1980, ông chuyển đến London và gia nhập Dukes Hotel, nơi ông trở nên nổi tiếng với phong cách phục vụ Dry Martini siêu lạnh không dùng đá và khởi xướng khái niệm "Liquid History" – phục vụ những dòng vintage cognac cực hiếm. Năm 1994, ông chuyển sang The Library Bar tại The Lanesborough, sáng tạo nên ly Breakfast Martini trứ danh và trở thành nhân vật tiên phong trong phong trào phục hưng cocktail thập niên 1990. Cuốn sách đầu tay của ông, 'Classic Cocktails', đã bán được hơn một triệu bản trên toàn cầu.`
  },

  {
    id: "bt-ada-coleman",
    name: "Ada Coleman",
    nickname: "Coley",
    category: "classic",
    categoryLabel: "Tiên Phong Kỷ Nguyên Vàng",
    origin: "Anh Quốc (1875 – 1966)",
    currentBase: "The Savoy, London (Di sản lịch sử)",
    yearsActive: "1899 – 1925 (Trưởng Bar American Bar 1903 – 1925)",
    venues: [
      "Khách sạn Claridge's (London)",
      "The American Bar tại Khách sạn The Savoy (London)"
    ],
    image: "img/bartenders/ada-coleman.jpg",
    imageType: "portrait",
    accolades: [
      "Trưởng quầy bar The American Bar tại The Savoy hơn 20 năm – một trong ba phụ nữ duy nhất từng nắm giữ vị trí danh giá này",
      "Người sáng tạo ra Hanky Panky, công thức sau này được in trong cuốn 'The Savoy Cocktail Book' (1930)",
      "Từng phục vụ các nhân vật lịch sử như đại văn hào Mark Twain, Thân vương xứ Wales và danh kịch Sir Charles Hawtrey"
    ],
    philosophy: "Được nhớ đến như một trong những bartender nổi tiếng đầu tiên của lịch sử: một người chủ quầy nồng hậu, hóm hỉnh, biến The American Bar thành điểm hẹn của giới quý tộc, kịch nghệ và văn nhân thế giới.",
    signatureDrinks: [
      {
        name: "Hanky Panky",
        year: "Đầu thập niên 1900",
        desc: "Sáng tạo riêng cho nam diễn viên Sir Charles Hawtrey khi ông yêu cầu một ly nước 'có chút uy lực đánh thức vị giác'. Sau khi nhấp ngụm đầu tiên, ông đã thốt lên: 'Lạy Chúa! Đây chính là hanky-panky đích thực!'",
        recipe: "45ml London Dry Gin, 45ml Sweet Vermouth, 2 dashes Fernet-Branca, Vỏ cam xoắn.",
        glass: "Coupe Glass",
        onMenu: true
      }
    ],
    biography: `Ada "Coley" Coleman bắt đầu làm việc tại chuỗi khách sạn của gia đình D'Oyly Carte sau khi cha qua đời năm cô 24 tuổi – ban đầu ở quầy hoa, sau đó bước sau quầy bar tại Claridge's. Năm 1903, cô tiếp quản vị trí Trưởng quầy bar (Head Bartender) tại The American Bar của khách sạn The Savoy lừng danh, kế nhiệm Frank Wells.

Trong hơn hai thập kỷ tại The Savoy, cô đã pha chế cho Mark Twain, Thân vương xứ Wales và Sir Charles Hawtrey. Cuối năm 1925, The Savoy đóng cửa The American Bar để cải tạo và công bố lễ nghỉ hưu của Coleman; học trò của cô là Harry Craddock sau đó đã tiếp quản vị trí này.`
  },

  {
    id: "bt-dale-degroff",
    name: "Dale DeGroff",
    nickname: "King Cocktail",
    category: "renaissance",
    categoryLabel: "Người Cha Của Phong Trào Craft Cocktail",
    origin: "Rhode Island, Hoa Kỳ",
    currentBase: "Thành phố New York, Hoa Kỳ",
    yearsActive: "Thập niên 1980 – nay",
    venues: [
      "Nhà hàng Aurora (New York – của Joe Baum)",
      "The Rainbow Room, Trung tâm Rockefeller (New York, 1987 – 1999)",
      "Bảo tàng Cocktail Hoa Kỳ (Chủ tịch sáng lập)"
    ],
    image: "img/bartenders/dale-degroff.jpg",
    imageType: "portrait",
    accolades: [
      "Người đầu tiên nhận Giải thưởng Cống hiến Trọn đời Helen David tại Tales of the Cocktail (2008)",
      "Hai giải thưởng danh giá từ James Beard Foundation (Chuyên gia Rượu vang & Rượu mạnh)",
      "Tác giả hai cuốn sách gối đầu giường: 'The Craft of the Cocktail' và 'The Essential Cocktail'",
      "Đồng sáng lập chương trình đào tạo uy tín Beverage Alcohol Resource (BAR)"
    ],
    philosophy: "Tiên phong đấu tranh đưa nước ép hoa quả tươi và công thức cổ điển thời kỳ Tiền Cấm Vận (Pre-Prohibition) trở lại quầy bar giữa thời kỳ ngành công nghiệp tràn ngập bột pha nhân tạo; ông yêu cầu mỗi bartender phải tư duy như một 'đầu bếp quầy bar (bar chef)'.",
    signatureDrinks: [
      {
        name: "Cosmopolitan (Rainbow Room spec)",
        year: "1996",
        desc: "Dù không phải người phát minh ra Cosmopolitan, DeGroff là người đưa nó lên đỉnh cao danh vọng toàn cầu: sau khi Madonna thưởng thức món này tại The Rainbow Room năm 1996, công thức với kỹ thuật đốt tinh dầu vỏ cam của ông đã lan truyền khắp thế giới.",
        recipe: "45ml Citrus Vodka, 20ml Cointreau, 10ml Nước cốt chanh tươi, 30ml Nước ép nam việt quất (Cranberry), Vỏ cam đốt lửa.",
        glass: "Martini Glass",
        onMenu: true
      }
    ],
    biography: `Dale DeGroff gặp gỡ nhà đầu tư ẩm thực huyền thoại Joe Baum vào cuối thập niên 1960. Baum sau đó giao cho ông xây dựng thực đơn đồ uống tại Aurora – nơi trở thành bệ phóng thử nghiệm triết lý cocktail sử dụng 100% nguyên liệu tươi sống nguyên bản.

Khi The Rainbow Room tại Trung tâm Rockefeller mở cửa lại vào năm 1987, DeGroff quản lý quầy bar tại đây cho đến năm 1999. Ông đào tạo đội ngũ bartender chuẩn mực như những đầu bếp chuyên nghiệp – đưa họ vào bếp tìm hiểu cách dùng dao gọt, kỹ thuật nêm nếm và hồi sinh các công thức kinh điển. Di sản của ông tại The Rainbow Room được toàn giới công nhận là khởi điểm của phong trào Craft Cocktail hiện đại.`
  },

  {
    id: "bt-harry-craddock",
    name: "Harry Craddock",
    nickname: "The Dean of Cocktail Shakers",
    category: "classic",
    categoryLabel: "Bậc Thầy Kỷ Nguyên Vàng",
    origin: "Stroud, Gloucestershire, Anh Quốc (sau nhập quốc tịch Mỹ)",
    currentBase: "London / New York (Di sản lịch sử)",
    yearsActive: "1897 – thập niên 1940",
    venues: [
      "Khách sạn Hollenden (Cleveland)",
      "Khách sạn Knickerbocker & Hoffman House (New York)",
      "The American Bar tại The Savoy (London, 1920 – 1939)",
      "The Dorchester (London, từ 1939)"
    ],
    image: "img/bartenders/harry-craddock.jpg",
    imageType: "portrait",
    accolades: [
      "Tác giả cuốn kinh thư bất hủ 'The Savoy Cocktail Book' (1930)",
      "Đồng sáng lập Hiệp hội Bartender Vương quốc Anh (UKBG)",
      "Trưởng quầy bar đầu tiên của khách sạn The Dorchester (1939)"
    ],
    philosophy: "Nổi tiếng với câu châm ngôn kinh điển: \"Cách tốt nhất để uống một ly cocktail là uống thật nhanh, khi nó vẫn còn đang mỉm cười với bạn.\"",
    signatureDrinks: [
      {
        name: "White Lady",
        year: "1930",
        desc: "Được Craddock hoàn thiện và phổ biến tại The Savoy, ghi chép trong 'The Savoy Cocktail Book'. Năm 1927, ông thậm chí còn niêm phong một bình lắc chứa ly White Lady bên trong bức tường của The American Bar.",
        recipe: "40ml Dry Gin, 20ml Cointreau, 20ml Nước cốt chanh tươi (Tỷ lệ vàng Savoy 1930: 2:1:1).",
        glass: "Coupe Glass",
        onMenu: true
      },
      {
        name: "Corpse Reviver No. 2",
        year: "1930",
        desc: "Xuất hiện trong 'The Savoy Cocktail Book' kèm lời cảnh báo nổi tiếng: 'Nếu uống liền bốn ly liên tiếp, nó sẽ khiến xác chết sống lại thêm một lần nữa.'",
        recipe: "20ml Dry Gin, 20ml Cointreau, 20ml Lillet Blanc, 20ml Nước cốt chanh tươi, 1 dash Absinthe.",
        glass: "Nick & Nora Glass",
        onMenu: true
      }
    ],
    biography: `Sinh ra tại Gloucestershire (Anh), Harry Craddock di cư sang Mỹ năm 1897, làm việc tại những khách sạn hoa lệ nhất Cleveland và New York trước khi nhập quốc tịch Mỹ.

Khi Đạo luật Cấm Rượu (Prohibition) được ban hành tại Mỹ, ông quay về Anh và gia nhập The American Bar tại The Savoy năm 1920, kế nhiệm chức Trưởng quầy sau khi Ada Coleman nghỉ hưu. Năm 1930, ông xuất bản 'The Savoy Cocktail Book' – cuốn sách vẫn là tài liệu tham khảo được trích dẫn nhiều nhất lịch sử mixology. Năm 1939, ông chuyển sang The Dorchester, nơi ông chôn giấu các bình rượu chứa White Lady, Manhattan và Martini vào tường gạch – những kỷ vật được tìm thấy nhiều thập kỷ sau đó.`
  },

  {
    id: "bt-hidetsugu-ueno",
    name: "Hidetsugu Ueno",
    nickname: "The Ice Diamond Master",
    category: "japanese",
    categoryLabel: "Đại Sư Kỹ Nghệ Tinh Hoa Nhật Bản",
    origin: "Nhật Bản (sinh năm 1967)",
    currentBase: "Ginza, Tokyo, Nhật Bản",
    yearsActive: "1992 – nay",
    venues: [
      "Star Bar Ginza (Tokyo, cùng sư phụ Hisashi Kishi)",
      "Bar High Five (Ginza, Tokyo – khai trương ngày 4/7/2008)"
    ],
    image: "img/bartenders/hidetsugu-ueno.jpg",
    imageType: "portrait",
    accolades: [
      "Bar High Five: Giải thưởng Heering 'Legend of the List' từ The World's 50 Best Bars",
      "Bar High Five: Quán bar xuất sắc nhất Nhật Bản (Best Bar in Japan) tại Asia's 50 Best Bars 2019",
      "Được tôn vinh như đại sứ toàn cầu của nghệ thuật pha chế quầy bar Nhật Bản"
    ],
    philosophy: "Bar High Five hoàn toàn không có thực đơn: mỗi ly cocktail đều được sáng tạo độc bản ngay tại chỗ sau cuộc trò chuyện lắng nghe khẩu vị, tâm trạng và cảm xúc của từng vị khách.",
    signatureDrinks: [
      {
        name: "White Lady",
        year: "Thời kỳ High Five",
        desc: "Được truyền thông quốc tế ca ngợi như tấm danh thiếp của Ueno – phiên bản classic chuẩn mực được lắc bằng kỹ thuật Hard Shake điêu luyện kết hợp Gin, Cointreau và chanh tươi.",
        recipe: "45ml Dry Gin, 25ml Cointreau, 20ml Nước cốt chanh tươi, lắc lạnh Hard Shake.",
        glass: "Chilled Coupe",
        onMenu: true
      },
      {
        name: "Ice Diamond on the Rocks",
        year: "Thời kỳ Star Bar",
        desc: "Khối đá được đẽo gọt thủ công hình kim cương nhiều mặt sắc sảo để thưởng thức whisky on the rocks, sáng tạo cùng Hisashi Kishi – kỹ thuật đỉnh cao tạo nên thương hiệu của Ueno.",
        recipe: "Whisky thượng hạng rót ngập một viên đá kim cương pha lê điêu khắc tay.",
        glass: "Rocks Glass",
        onMenu: false
      }
    ],
    biography: `Hidetsugu Ueno bắt đầu sự nghiệp vào năm 1992 và nhanh chóng vang danh khi làm bartender khai trương tại Star Bar Ginza cùng sư phụ Hisashi Kishi. Tại đây, hai người đã sáng tạo ra nghệ thuật đẽo đá "Ice Diamond" tinh xảo, kỹ thuật mà sau này Ueno đã truyền bá ra toàn thế giới.

Năm 2008, ông mở quán bar riêng Bar High Five tại Ginza. Quán không in menu mà phục vụ theo trải nghiệm cá nhân hóa tuyệt đối. High Five liên tục nằm trong danh sách The World's 50 Best Bars suốt một thập kỷ và nhận giải thưởng huyền thoại 'Legend of the List'.`
  },

  {
    id: "bt-colin-field",
    name: "Colin Peter Field",
    nickname: "Huyền Thoại Bar Hemingway Tại Ritz Paris",
    category: "european",
    categoryLabel: "Bậc Thầy Khách Sạn Cổ Điển Châu Âu",
    origin: "Rugby, Anh Quốc (sinh năm 1961)",
    currentBase: "Paris, Pháp",
    yearsActive: "1982 – nay",
    venues: [
      "Bar Hemingway, Khách sạn Ritz Paris (Trưởng quầy bar từ 1994 trong gần 30 năm)"
    ],
    image: "img/bartenders/colin-field.jpg",
    imageType: "portrait",
    accolades: [
      "Được tạp chí Forbes vinh danh là Bartender xuất sắc nhất thế giới (1997, 2001, 2004)",
      "Bartender đầu tiên trong lịch sử được ghi danh vào cuốn 'Who's Who' danh giá của nước Pháp (2011)",
      "Tác giả cuốn 'The Cocktails of the Ritz Paris' (2003)"
    ],
    philosophy: "Nổi tiếng với nghệ thuật kể chuyện duyên dáng, kỹ thuật gắp trang trí bằng nhíp y khoa chuẩn mực và những sáng tạo tái định nghĩa ly Dry Martini truyền thống.",
    signatureDrinks: [
      {
        name: "Serendipity",
        year: "Bar Hemingway",
        desc: "Một trong những tác phẩm được yêu thích nhất của Field tại Ritz Paris: Rượu táo Calvados vùng Normandy, nước ép táo tươi và lá bạc hà mát lạnh rót ngập vang Champagne Pháp.",
        recipe: "30ml Calvados, 30ml Nước ép táo tươi, Lá bạc hà tươi, rót đầy Champagne hảo hạng.",
        glass: "Highball Glass",
        onMenu: true
      },
      {
        name: "Picasso Martini",
        year: "Bar Hemingway",
        desc: "Một ly Martini chuyển biến kỳ diệu khi thưởng thức: Dry Vermouth được đông đặc thành một viên đá lạnh tinh khiết tan chảy chậm rãi vào dòng Dry Gin ướp lạnh sâu.",
        recipe: "60ml Dry Gin (ướp lạnh sâu), 1 Viên đá đông lạnh từ Dry Vermouth.",
        glass: "Martini Glass",
        onMenu: false
      }
    ],
    biography: `Colin Peter Field từng đoạt huy chương bạc tại giải Scott Cup cho bartender Pháp và Giải Vô địch Martini Thế giới năm 1982. Khi Bar Hemingway tại khách sạn Ritz Paris mở cửa trở lại năm 1994, ông đảm nhận vị trí Trưởng quầy bar và cống hiến tại đây gần 30 năm, đồng thời là cố vấn cấp cao về thức uống cho hãng hàng không Air France.

Forbes từng 3 lần tôn vinh ông là Bartender xuất sắc nhất hành tinh. Ông là tác giả của các tác phẩm được đón đọc rộng rãi: 'The Cocktails of the Ritz Paris' (2003) và 'The Ritz Paris: Mixing Drinks, A Simple Story' (2010).`
  },

  {
    id: "bt-erik-lorincz",
    name: "Erik Lorincz",
    nickname: "Trưởng Quầy Bar Đời Thứ 10 Của The Savoy",
    category: "european",
    categoryLabel: "Bậc Thầy Tiên Phong Đương Đại",
    origin: "Nitra, Slovakia",
    currentBase: "London, Vương quốc Anh",
    yearsActive: "1998 – nay",
    venues: [
      "Purple Bar, Sanderson Hotel (London)",
      "Connaught Bar (London, từ 2008)",
      "The American Bar tại The Savoy (Trưởng quầy, 2010 – 2018)",
      "Kwānt (Mayfair, London, mở năm 2019)"
    ],
    image: "img/bartenders/erik-lorincz.jpg",
    imageType: "portrait",
    accolades: [
      "Quán quân toàn cầu Diageo Reserve World Class Bartender of the Year (2010)",
      "Đưa The American Bar tại The Savoy lên vị trí Quán Bar Xuất Sắc Nhất Thế Giới (World's Best Bar 2017)",
      "Kwānt: Khai trương ấn tượng nhất (Best New Opening) tại The World's 50 Best Bars 2020",
      "Bartender của năm do tạp chí Condé Nast Traveler US bình chọn"
    ],
    philosophy: "Hòa quyện di sản cổ điển thế kỷ của The Savoy với độ chuẩn xác tuyệt đối của kỹ thuật lắc Hard Shake học hỏi từ bậc thầy Nhật Bản Kazuo Uyeda.",
    signatureDrinks: [
      {
        name: "Green Park",
        year: "2011",
        desc: "Sáng tạo tại The American Bar của The Savoy: một ly gin sour xanh dịu, thơm nồng thảo mộc từ lá húng quế tươi, cần tây bitters và lớp bọt lòng trắng trứng sánh mượt.",
        recipe: "45ml Old Tom Gin, 30ml Nước cốt chanh tươi, 15ml Siro đường, 6 Lá húng quế tươi, 3 dashes Celery Bitters, Lòng trắng trứng.",
        glass: "Coupe Glass",
        onMenu: true
      }
    ],
    biography: `Erik Lorincz lớn lên tại Nitra, Slovakia. Ông đến London mà không nói được tiếng Anh, ban đầu học ngoại ngữ ban ngày và đi thu dọn ly cốc vào ban đêm. Tại nhà hàng Nozomi, ông may mắn được thụ giáo trực tiếp từ đại sư pha chế Nhật Bản Kazuo Uyeda.

Ông gia nhập The Connaught năm 2008 và giành ngôi vị Quán quân World Class toàn cầu năm 2010. Tháng 10 năm đó, ông trở thành Trưởng quầy bar đời thứ 10 của The American Bar tại The Savoy, dẫn dắt quán đạt danh hiệu Quán Bar Xuất Sắc Nhất Thế Giới năm 2017. Năm 2019, ông khai trương quán bar riêng mang tên Kwānt tại Mayfair London.`
  },

  {
    id: "bt-jerry-thomas",
    name: "Jerry Thomas",
    nickname: "The Professor",
    category: "classic",
    categoryLabel: "Người Khai Sinh Ngành Mixology Hoa Kỳ",
    origin: "Sackets Harbor, New York, Hoa Kỳ (1830 – 1885)",
    currentBase: "New York / San Francisco (Di sản lịch sử)",
    yearsActive: "khoảng 1849 – 1885",
    venues: [
      "Quán rượu cờ bạc El Dorado (San Francisco)",
      "Khách sạn Occidental (San Francisco)",
      "Bốn quán saloon danh tiếng do chính ông sáng lập tại New York"
    ],
    image: "img/bartenders/jerry-thomas.jpg",
    imageType: "portrait",
    accolades: [
      "Tác giả cuốn 'Bar-Tender's Guide' (1862) – cuốn sách dạy pha chế đầu tiên trong lịch sử nhân loại",
      "Người phát minh ra món cocktail rực lửa huyền thoại The Blue Blazer",
      "Được lịch sử tôn kính với danh xưng 'Người cha của ngành Mixology Hoa Kỳ'"
    ],
    philosophy: "Một nghệ sĩ trình diễn bậc thầy biến nghề bar thành một môn nghệ thuật sân khấu cuốn hút – tung hứng những chai rượu xoay tít và mang theo bộ dụng cụ pha chế đúc bằng bạc nguyên khối trong các chuyến lưu diễn Châu Âu.",
    signatureDrinks: [
      {
        name: "The Blue Blazer",
        year: "Thập niên 1850",
        desc: "Thức uống bốc lửa làm nên huyền thoại của ông tại El Dorado ở San Francisco: Scotch whisky nồng độ cao và nước sôi được châm lửa bùng cháy, rót qua lại giữa hai ca bạc tạo thành một vòng cung lửa xanh sống động trong màn đêm.",
        recipe: "1 Ly vang Scotch Whisky, 1 Ly vang Nước sôi, 1 Muỗng đường mía, Vỏ chanh vàng (công thức gốc 1862).",
        glass: "Silver Mugs / Small Tumbler",
        onMenu: false
      },
      {
        name: "Japanese Cocktail",
        year: "1862",
        desc: "In trong cuốn sách năm 1862; gắn liền với phái đoàn ngoại giao đầu tiên của Nhật Bản đến thăm Hoa Kỳ năm 1860.",
        recipe: "60ml Brandy, 15ml Siro hạnh nhân Orgeat, 2 dashes Angostura Bitters, Vỏ chanh xoắn.",
        glass: "Cocktail Glass",
        onMenu: true
      }
    ],
    biography: `Jerry Thomas học nghề pha chế tại New Haven trước khi giong buồm tới California trong Cơn sốt vàng (Gold Rush). Trở lại New York năm 1851, ông mở quán saloon đầu tiên bên dưới Bảo tàng American Museum của P.T. Barnum. Tại Khách sạn Occidental ở San Francisco, ông được trả mức lương kỷ lục 100 USD/tuần – thời điểm đó cao hơn cả lương Phó Tổng thống Hoa Kỳ.

Cuốn sách xuất bản năm 1862 của ông 'Bar-Tender's Guide' (còn có tên 'How to Mix Drinks, or The Bon-Vivant's Companion') là cuốn sách dạy pha chế đầu tiên được in tại Mỹ, đặt nền móng ghi chép chính quy cho những công thức vốn trước đó chỉ được truyền miệng. Phiên bản năm 1876 của sách cũng là nơi đầu tiên ghi lại công thức Tom Collins.`
  }
];
