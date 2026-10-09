/* =========================================================
   DRINKS-SERVICE.JS - Nghiệp vụ CRUD cho menu đồ uống
   Mọi trang (menu, chi tiết, đặt món, quản trị, dashboard) đều
   đọc/ghi đồ uống qua các hàm ở đây. Dữ liệu thật nằm trong
   db.json, được json-server cung cấp tại /drinks; các hàm đều là
   async vì phải chờ máy chủ trả lời (async/await - Slide 4).
   ========================================================= */

import { api, getCollection, getRecord } from "./api.js";
import { uid } from "./utils.js";

const COLLECTION = "drinks";

/** Một món đồ uống trong thực đơn chuẩn bar */
export class Drink {
  constructor({
    id = uid("drink"),
    name,
    category,
    price,
    image = "", // chưa có ảnh thì hiện biểu tượng mặc định, KHÔNG mượn ảnh món khác
    description = "",
    ingredients = [],
    baseSpirit = "",
    glassType = "",
    tasteNotes = [],
    status = "available",
    rating = 4.8,
    featured = false,
    stock = 20,
    abv = 0,
    createdAt = new Date().toISOString(),
  }) {
    this.id = id;
    this.name = name;
    this.category = category;
    this.price = Number(price) || 0;
    this.image = image;
    this.description = description;
    this.ingredients = Array.isArray(ingredients) ? ingredients : [];
    this.baseSpirit = baseSpirit;
    this.glassType = glassType;
    this.tasteNotes = Array.isArray(tasteNotes) ? tasteNotes : [];
    this.status = status;       // "available" | "soldout"
    this.rating = Number(rating) || 0;
    this.featured = Boolean(featured);
    this.stock = Number(stock) || 0;   // tồn kho hiện có (ly có thể pha được)
    this.abv = Number(abv) || 0;       // nồng độ cồn (%) - 0 với đồ uống không cồn
    this.createdAt = createdAt;
  }
}

/** Nhãn tiếng Việt cho từng danh mục cocktail & rượu chuẩn quán bar */
export const CATEGORY_LABELS = {
  classic: "Cocktail Cổ Điển",
  signature: "Cocktail Đặc Tuyển",
  "sour-fizz": "Sour & Highball",
  aperitivo: "Aperitivo & Spritz",
  spirits: "Rượu Mạnh Thượng Hạng",
};

/** Nhãn tiếng Anh cho từng danh mục cocktail */
export const CATEGORY_LABELS_EN = {
  classic: "Classic Cocktails",
  signature: "Signature Cocktails",
  "sour-fizz": "Sour & Highball",
  aperitivo: "Aperitivo & Spritz",
  spirits: "Rare Heritage Spirits",
};

/** Lấy nhãn danh mục theo ngôn ngữ hiện hành */
export function getCategoryLabel(category) {
  let isEn;
  try {
    isEn = typeof localStorage !== "undefined" && localStorage.getItem("site_language") === "en";
  } catch {
    isEn = false;
  }
  if (isEn && CATEGORY_LABELS_EN[category]) {
    return CATEGORY_LABELS_EN[category];
  }
  return CATEGORY_LABELS[category] || category;
}

/**
 * Dữ liệu đồ uống mẫu - 100% thức uống có cồn & cocktail thủ công.
 * Dùng cho 2 việc: (1) script tools/tao-db.js sinh ra db.json từ đây,
 * (2) dữ liệu dự phòng khi máy chủ API chưa chạy và chưa có bản đệm.
 */
export const SEED_DRINKS = [
  new Drink({
    id: "d1",
    name: "Negroni Classico",
    category: "classic",
    price: 125000,
    image: "img/drinks/negroni.jpg",
    description: "Tỷ lệ vàng 1:1:1 chuẩn quốc tế giữa London Dry Gin, rượu đắng Campari và Sweet Vermouth Carpano, điểm xuyết tinh dầu vỏ cam tươi.",
    ingredients: ["London Dry Gin", "Campari Bitter", "Sweet Vermouth Carpano", "Vỏ cam cháy", "Đá vuông thủ công"],
    baseSpirit: "London Dry Gin & Campari",
    glassType: "Crystal Rocks",
    tasteNotes: ["Đắng thanh", "Thảo mộc", "Cam cháy"],
    featured: true,
    rating: 5.0,
    stock: 25,
    abv: 24,
  }),
  new Drink({
    id: "d2",
    name: "Smoked Old Fashioned",
    category: "classic",
    price: 135000,
    image: "img/drinks/old-fashioned.jpg",
    description: "Bourbon thượng hạng ủ thùng gỗ sồi hun khói gỗ hồ đào, chút đắng thơm từ Angostura Bitters, cam cháy và khối đá điêu khắc.",
    ingredients: ["Bourbon Whiskey", "Angostura Bitters", "Đường mía nâu", "Vỏ cam nướng", "Khói sồi Pecan"],
    baseSpirit: "Kentucky Bourbon Whiskey",
    glassType: "Crystal Rocks",
    tasteNotes: ["Khói sồi", "Cam cháy", "Trầm ấm"],
    featured: true,
    rating: 5.0,
    stock: 20,
    abv: 30,
  }),
  new Drink({
    id: "d3",
    name: "Dry Martini 007",
    category: "classic",
    price: 130000,
    image: "img/drinks/dry-martini.jpg",
    description: "Huyền thoại thanh lịch của thế giới cocktail: Dry Gin thượng hạng khuấy lạnh cùng Dry Vermouth Pháp, hoàn thiện với quả ô liu xanh muối biển.",
    ingredients: ["Tanqueray London Dry Gin", "Noilly Prat Dry Vermouth", "Quả ô liu xanh muối", "Vỏ chanh vàng xoắn"],
    baseSpirit: "Tanqueray Gin & Dry Vermouth",
    glassType: "Classic Martini Glass",
    tasteNotes: ["Thảo mộc khô", "Thanh khiết", "Hậu vị sâu"],
    featured: true,
    rating: 4.9,
    stock: 18,
    abv: 28,
  }),
  new Drink({
    id: "d4",
    name: "Bourbon Whiskey Sour",
    category: "sour-fizz",
    price: 120000,
    image: "img/drinks/whiskey-sour.jpg",
    description: "Sự cân bằng tinh tế giữa độ nồng ấm của Bourbon, vị chua giòn từ chanh vàng và lớp bọt lòng trắng trứng đánh mịn như nhung mượt.",
    ingredients: ["Bourbon Whiskey", "Nước cốt chanh vàng", "Lòng trắng trứng bọt velvet", "Siro đường mía", "Angostura Bitters"],
    baseSpirit: "Kentucky Bourbon",
    glassType: "Old Fashioned Glass",
    tasteNotes: ["Bọt mịn màng", "Chua thanh dịu", "Hương sồi nồng"],
    featured: true,
    rating: 4.9,
    stock: 22,
    abv: 18,
  }),
  new Drink({
    id: "d5",
    name: "Classic Margarita",
    category: "sour-fizz",
    price: 115000,
    image: "img/drinks/margarita.jpg",
    description: "Tequila 100% Blue Agave kết hợp rượu mùi cam cao cấp Cointreau và nước cốt chanh tươi, viền muối hồng Himalaya thủ công.",
    ingredients: ["Tequila Blanco 100% Agave", "Cointreau Orange Liqueur", "Nước cốt chanh tươi", "Viền muối hồng Himalaya"],
    baseSpirit: "Tequila Blanco",
    glassType: "Vintage Coupe",
    tasteNotes: ["Chua dịu", "Mặn nhẹ", "Hương cam tươi"],
    featured: false,
    rating: 4.8,
    stock: 26,
    abv: 20,
  }),
  new Drink({
    id: "d6",
    name: "Mojito Havana Rum",
    category: "sour-fizz",
    price: 105000,
    image: "img/drinks/mojito.jpg",
    description: "Rum trắng Cuba truyền thống hòa quyện cùng lá bạc hà tươi giã dập nhẹ, nước cốt chanh tươi, đường mía tự nhiên và soda suối khoáng.",
    ingredients: ["Havana Club 3 Años White Rum", "Chanh tươi", "Lá bạc hà tươi", "Đường mía tự nhiên", "Soda sủi tăm", "Đá tuyết"],
    baseSpirit: "Cuban White Rum",
    glassType: "Highball Pha Lê",
    tasteNotes: ["Bạc hà thơm ngát", "Chua thanh", "Sảng khoái"],
    featured: false,
    rating: 4.8,
    stock: 30,
    abv: 14,
  }),
  new Drink({
    id: "d7",
    name: "Velvet Espresso Martini",
    category: "signature",
    price: 130000,
    image: "img/drinks/espresso-martini.jpg",
    description: "Espresso mới chiết xuất từ hạt Arabica đậm đà, Vodka mịn màng cùng rượu mùi cà phê Kahlúa với lớp bọt crema vàng óng và 3 hạt cà phê may mắn.",
    ingredients: ["Vodka Absolut", "Kahlúa Coffee Liqueur", "Fresh Espresso Arabica", "Siro Vanilla Madagascar", "3 Hạt cà phê rang"],
    baseSpirit: "Vodka & Coffee Liqueur",
    glassType: "Coupe Pha Lê",
    tasteNotes: ["Cà phê nồng ấm", "Crema mịn", "Hậu vị đắng ngọt"],
    featured: true,
    rating: 4.9,
    stock: 20,
    abv: 19,
  }),
  new Drink({
    id: "d8",
    name: "Aperol Spritz Veneziano",
    category: "aperitivo",
    price: 120000,
    image: "img/drinks/aperol-spritz.jpg",
    description: "Thức uống khai vị biểu tượng nước Ý: Rượu thảo mộc Aperol rực rỡ, vang sủi Prosecco DOC sủi bọt lăn tăn và lát cam vàng ngập tràn nắng hè.",
    ingredients: ["Aperol Aperitivo", "Prosecco DOC", "Soda suối khoáng", "Lát cam vàng tươi", "Đá khối pha lê"],
    baseSpirit: "Aperol & Prosecco DOC",
    glassType: "Stemmed Wine Glass",
    tasteNotes: ["Cam thảo mộc", "Sủi bọt thanh nhã", "Chát nhẹ dịu dàng"],
    featured: false,
    rating: 4.8,
    stock: 28,
    abv: 11,
  }),
  new Drink({
    id: "d9",
    name: "Manhattan Reserve",
    category: "classic",
    price: 140000,
    image: "img/drinks/manhattan.jpg",
    description: "Nữ hoàng của các loại cocktail: Bulleit Rye Whiskey cay nồng ủ thùng gỗ sồi, Sweet Vermouth Ý cổ truyền và quả anh đào Maraschino đỏ thẫm.",
    ingredients: ["Bulleit Rye Whiskey", "Carpano Antica Sweet Vermouth", "Angostura Bitters", "Quả anh đào Maraschino"],
    baseSpirit: "Bulleit Rye Whiskey",
    glassType: "Coupe Pha Lê",
    tasteNotes: ["Cay ấm gia vị", "Quả sẫm màu", "Đậm đà quý tộc"],
    featured: false,
    rating: 4.9,
    stock: 16,
    abv: 30,
  }),
  new Drink({
    id: "d10",
    name: "The Macallan 12 Double Cask",
    category: "spirits",
    price: 195000,
    image: "img/drinks/macallan-12.jpg",
    description: "Dòng Single Malt Scotch trứ danh từ Speyside Scotland, ủ kết hợp thùng gỗ sồi Sherry Châu Âu và Châu Mỹ, phục vụ Neat hoặc On The Rocks.",
    ingredients: ["Single Malt Scotch Whisky 12 Years Old", "Khối đá tròn điêu khắc tay"],
    baseSpirit: "Single Malt Scotch Whisky",
    glassType: "Glencairn Glass",
    tasteNotes: ["Mật ong sồi", "Gừng ấm", "Trái cây sấy khô"],
    featured: false,
    rating: 5.0,
    stock: 12,
    abv: 40,
  }),
  new Drink({
    id: "d11",
    name: "Sazerac New Orleans",
    category: "classic",
    price: 135000,
    image: "img/drinks/sazerac.jpg",
    description: "Cocktail cổ xưa nhất nước Mỹ: Rye Whiskey ủ sồi kết hợp rượu đắng Peychaud's Bitters đỏ thắm, ly tráng một lớp mỏng hương hồi Absinthe huyền bí và vỏ chanh xoắn.",
    ingredients: ["Rye Whiskey", "Peychaud's Bitters", "Hồi Absinthe thượng hạng", "Đường mía nguyên chất", "Vỏ chanh vàng xoắn"],
    baseSpirit: "Rye Whiskey & Absinthe",
    glassType: "Crystal Rocks",
    tasteNotes: ["Thảo mộc hồi", "Cay nồng sồi", "Thanh lịch"],
    featured: true,
    rating: 4.9,
    stock: 20,
    abv: 32,
  }),
  new Drink({
    id: "d12",
    name: "Daiquiri Hemingway",
    category: "classic",
    price: 120000,
    image: "img/drinks/daiquiri.jpg",
    description: "Phiên bản danh tiếng gắn liền với đại văn hào Hemingway: Rum trắng Cuba lắc lạnh cùng nước bưởi chùm hồng tươi, Maraschino Liqueur và chanh mọng nước.",
    ingredients: ["Havana Club White Rum", "Maraschino Liqueur", "Nước bưởi chùm hồng tươi", "Nước cốt chanh tươi", "Lát chanh xanh"],
    baseSpirit: "Cuban White Rum",
    glassType: "Chilled Coupe",
    tasteNotes: ["Chua sắc nét", "Trái cây khô", "Sảng khoái tinh tế"],
    featured: false,
    rating: 4.8,
    stock: 25,
    abv: 22,
  }),
  new Drink({
    id: "d13",
    name: "Boulevardier Parisien",
    category: "classic",
    price: 135000,
    image: "img/drinks/boulevardier.jpg",
    description: "Biến tấu quý tộc của Negroni ra đời tại Paris thập niên 1920: Bourbon Whiskey nồng ấm thay thế Gin, hòa cùng Campari đắng đậm và Sweet Vermouth Carpano.",
    ingredients: ["Kentucky Bourbon", "Campari Bitter", "Carpano Sweet Vermouth", "Vỏ cam cháy", "Khối đá điêu khắc"],
    baseSpirit: "Bourbon Whiskey & Campari",
    glassType: "Crystal Rocks",
    tasteNotes: ["Đắng ngọt trầm", "Hương sồi nồng", "Cam thảo mộc"],
    featured: true,
    rating: 5.0,
    stock: 22,
    abv: 26,
  }),
  new Drink({
    id: "d14",
    name: "French 75 Champagne",
    category: "classic",
    price: 145000,
    image: "img/drinks/french-75.jpg",
    description: "Biểu tượng thanh tao của quầy bar Paris: London Dry Gin lắc cùng nước cốt chanh tươi, rót đầy bởi rượu Champagne Brut sủi tăm óng ánh và dải vỏ chanh xoắn.",
    ingredients: ["Tanqueray London Dry Gin", "Champagne Brut thượng hạng", "Nước cốt chanh vàng tươi", "Siro đường mía", "Vỏ chanh xoắn dài"],
    baseSpirit: "London Dry Gin & Champagne",
    glassType: "Flute Pha Lê",
    tasteNotes: ["Sủi tăm tươi sáng", "Chua thanh tao", "Hương hoa cỏ"],
    featured: false,
    rating: 4.9,
    stock: 18,
    abv: 16,
  }),
  new Drink({
    id: "d15",
    name: "Hanky Panky Savoy 1903",
    category: "classic",
    price: 130000,
    image: "img/drinks/hanky-panky.jpg",
    description: "Kiệt tác được nữ huyền thoại Ada Coleman sáng chế tại khách sạn Savoy London: London Dry Gin, Sweet Vermouth và vài giọt rượu thảo mộc đắng bí truyền Fernet-Branca.",
    ingredients: ["London Dry Gin", "Sweet Vermouth Ý", "Fernet-Branca Thảo Mộc", "Vỏ cam tươi xoắn"],
    baseSpirit: "London Dry Gin",
    glassType: "Coupe Pha Lê",
    tasteNotes: ["Thảo mộc đắng sâu", "Hương hoa quả sấy", "Dư vị kéo dài"],
    featured: false,
    rating: 4.9,
    stock: 20,
    abv: 24,
  }),
  new Drink({
    id: "d16",
    name: "White Lady Coupe",
    category: "classic",
    price: 125000,
    image: "img/drinks/white-lady.jpg",
    description: "Công thức bất hủ trong cuốn Savoy Cocktail Book của Harry Craddock: Dry Gin hòa cùng Cointreau mượt mà, chanh tươi và bọt lòng trắng trứng trắng muốt.",
    ingredients: ["Tanqueray Dry Gin", "Cointreau Liqueur", "Nước cốt chanh vàng", "Lòng trắng trứng bọt mịn", "Vỏ chanh"],
    baseSpirit: "Tanqueray Dry Gin",
    glassType: "Classic Coupe",
    tasteNotes: ["Bọt tuyết mịn", "Chua thanh dịu", "Hương cam tinh tế"],
    featured: false,
    rating: 4.8,
    stock: 24,
    abv: 21,
  }),
  new Drink({
    id: "d17",
    name: "Flaming Cosmopolitan",
    category: "signature",
    price: 130000,
    image: "img/drinks/cosmopolitan.jpg",
    description: "Biến tấu đẳng cấp của Dale DeGroff tại Rainbow Room New York: Vodka ngâm vỏ chanh, Cointreau, nước ép nam việt quất và ngọn lửa tinh dầu cam bùng cháy ngoạn mục.",
    ingredients: ["Citron Vodka", "Cointreau Orange Liqueur", "Nước ép nam việt quất Cranberry", "Chanh tươi", "Tinh dầu cam khò lửa"],
    baseSpirit: "Citron Vodka",
    glassType: "Martini Glass",
    tasteNotes: ["Quả mọng tươi", "Cam cháy nồng", "Chua ngọt cân bằng"],
    featured: true,
    rating: 4.9,
    stock: 22,
    abv: 19,
  }),
  new Drink({
    id: "d18",
    name: "Breakfast Martini",
    category: "signature",
    price: 140000,
    image: "img/drinks/breakfast-martini.jpg",
    description: "Sáng tạo lừng danh thế giới của bậc thầy Salvatore Calabrese: Gin thượng hạng lắc cùng mứt cam đắng Seville cao cấp của Anh, Cointreau và chanh tươi thanh nhã.",
    ingredients: ["Plymouth Gin", "Mứt cam đắng Seville Marmalade", "Cointreau", "Nước cốt chanh tươi", "Vỏ cam vàng"],
    baseSpirit: "Plymouth Gin",
    glassType: "Martini Glass",
    tasteNotes: ["Mứt cam thơm ngát", "Vị chua thanh mát", "Hậu vị ngọt êm"],
    featured: true,
    rating: 5.0,
    stock: 18,
    abv: 22,
  }),
  new Drink({
    id: "d19",
    name: "Green Park Basil Velvet",
    category: "signature",
    price: 135000,
    image: "img/drinks/green-park.jpg",
    description: "Tác phẩm đoạt giải Bartender of the Year của Erik Lorincz: Gin thảo mộc, lá húng tây basil tươi giã mịn, giọt Celery Bitters và lớp bọt mượt mà sắc xanh ngọc.",
    ingredients: ["Tanqueray Gin", "Lá húng tây Sweet Basil tươi", "Nước cốt chanh vàng", "Celery Bitters", "Lòng trắng trứng velvet"],
    baseSpirit: "Tanqueray Gin",
    glassType: "Coupe Pha Lê",
    tasteNotes: ["Húng quế thơm thảo", "Thanh mát", "Bọt nhung mượt"],
    featured: false,
    rating: 4.9,
    stock: 20,
    abv: 18,
  }),
  new Drink({
    id: "d20",
    name: "Serendipity Champagne Ritz",
    category: "signature",
    price: 155000,
    image: "img/drinks/serendipity.jpg",
    description: "Món cocktail biểu tượng tại Bar Hemingway thuộc khách sạn Ritz Paris của Colin Field: Rượu táo Calvados Pays d'Auge danh tiếng, Champagne, nước táo tươi và lá bạc hà.",
    ingredients: ["Calvados Pays d'Auge", "Champagne Brut", "Nước ép táo tươi ép lạnh", "Lá bạc hà tươi", "Đá viên pha lê"],
    baseSpirit: "Calvados & Champagne",
    glassType: "Highball Pha Lê",
    tasteNotes: ["Táo xanh giòn", "Sủi tăm quý tộc", "Bạc hà mát lành"],
    featured: true,
    rating: 5.0,
    stock: 16,
    abv: 15,
  }),
  new Drink({
    id: "d21",
    name: "Blue Blazer 1862 Flaming",
    category: "signature",
    price: 160000,
    image: "img/drinks/blue-blazer.jpg",
    description: "Màn trình diễn ngoạn mục của ông tổ Jerry Thomas từ năm 1862: Cask Strength Whisky và nước sôi hòa quyện trong luồng lửa xanh biếc được rót qua lại giữa hai ca bạc sáng loáng.",
    ingredients: ["Cask Strength Scotch Whisky", "Nước sôi thảo mộc", "Đường mía Demerara", "Vỏ chanh vàng nướng"],
    baseSpirit: "Cask Strength Scotch Whisky",
    glassType: "Antique Silver / Heatproof Glass",
    tasteNotes: ["Ấm nồng rực rỡ", "Khói lửa sồi", "Mật ong đậm sâu"],
    featured: true,
    rating: 5.0,
    stock: 15,
    abv: 35,
  }),
  new Drink({
    id: "d22",
    name: "Diamond Ice Single Malt",
    category: "signature",
    price: 175000,
    image: "img/drinks/diamond-ice.jpg",
    description: "Nghệ thuật điêu khắc đá đỉnh cao phong cách Tokyo của Hidetsugu Ueno: Khối đá kim cương trong suốt thủ công tan cực chậm trong ly Single Malt ủ thùng sherry hảo hạng.",
    ingredients: ["Single Malt Whisky tuyển chọn", "Đá kim cương cắt tay trong suốt"],
    baseSpirit: "Single Malt Whisky",
    glassType: "Crystal Tumbler",
    tasteNotes: ["Tinh khiết tuyệt đối", "Hương sồi lan tỏa", "Lạnh sâu không loãng"],
    featured: false,
    rating: 5.0,
    stock: 14,
    abv: 40,
  }),
  new Drink({
    id: "d23",
    name: "The Macallan 18 Sherry Oak",
    category: "spirits",
    price: 285000,
    image: "img/drinks/macallan-18.jpg",
    description: "Đỉnh cao Single Malt Scotch từ vùng Speyside: 18 năm ủ trọn vẹn trong thùng gỗ sồi Oloroso Sherry từ Jerez Tây Ban Nha, màu hổ phách đậm đà đầy mê hoặc.",
    ingredients: ["Single Malt Scotch 18 Năm Tuổi", "Đá cầu pha lê thủ công"],
    baseSpirit: "The Macallan 18 Years",
    glassType: "Glencairn Glass",
    tasteNotes: ["Gừng ngâm", "Nho khô sấy", "Gỗ sồi trưởng thành"],
    featured: true,
    rating: 5.0,
    stock: 10,
    abv: 43,
  }),
  new Drink({
    id: "d24",
    name: "Lagavulin 16 Islay Peat",
    category: "spirits",
    price: 230000,
    image: "img/drinks/lagavulin-16.jpg",
    description: "Vua khói của đảo Islay Scotland: Mùi hương khói than bùn biển nồng nàn, rong biển mặn mòi kết hợp vị ngọt ngào sâu thẳm của trái cây chín và gỗ sồi già.",
    ingredients: ["Single Malt Scotch Islay 16 Năm", "Khối đá điêu khắc hoặc uống Neat"],
    baseSpirit: "Lagavulin Single Malt",
    glassType: "Glencairn Glass",
    tasteNotes: ["Khói than bùn đậm", "Gió biển mặn mòi", "Hậu vị bất tận"],
    featured: false,
    rating: 4.9,
    stock: 12,
    abv: 43,
  }),
  new Drink({
    id: "d25",
    name: "Hennessy X.O Cognac",
    category: "spirits",
    price: 260000,
    image: "img/drinks/hennessy-xo.jpg",
    description: "Biểu tượng Cognac Extra Old trứ danh vùng Cognac nước Pháp: Pha trộn từ hơn 100 loại eaux-de-vie lâu năm với hương thơm vani, tiêu đen cay nhẹ và socola đen quyến rũ.",
    ingredients: ["Hennessy X.O Extra Old Cognac", "Đá tròn pha lê"],
    baseSpirit: "Hennessy X.O Cognac",
    glassType: "Snifter Pha Lê",
    tasteNotes: ["Vani gỗ sồi", "Gia vị cay ấm", "Socola đắng mềm mại"],
    featured: false,
    rating: 5.0,
    stock: 12,
    abv: 40,
  }),
  new Drink({
    id: "d26",
    name: "Don Julio 1942 Añejo Tequila",
    category: "spirits",
    price: 270000,
    image: "img/drinks/don-julio-1942.jpg",
    description: "Kiệt tác Tequila Añejo thủ công sản xuất số lượng giới hạn: 100% Blue Weber Agave thu hoạch tại cao nguyên Jalisco, ủ ít nhất hai năm rưỡi trong thùng sồi trắng Mỹ.",
    ingredients: ["100% Blue Weber Agave Tequila 1942", "Đá khối hoặc uống Neat"],
    baseSpirit: "Don Julio 1942 Tequila",
    glassType: "Tequila Snifter",
    tasteNotes: ["Caramel mượt mà", "Agave nướng thơm lừng", "Hương sồi vani"],
    featured: true,
    rating: 5.0,
    stock: 10,
    abv: 38,
  }),
  new Drink({
    id: "d27",
    name: "Monkey 47 Schwarzwald Dry Gin",
    category: "spirits",
    price: 195000,
    image: "img/drinks/monkey-47.jpg",
    description: "Dòng Gin thủ công nổi tiếng từ Rừng Đen nước Đức: Chưng cất cùng 47 loại thảo mộc quý hiếm, quả nam việt quất và nguồn nước suối rừng sâu nguyên sơ.",
    ingredients: ["Monkey 47 Dry Gin", "Tonic Fever-Tree cao cấp", "Vỏ bưởi và quả việt quất"],
    baseSpirit: "Monkey 47 Schwarzwald Gin",
    glassType: "Copa Balloon Glass",
    tasteNotes: ["47 Loại thảo mộc", "Quả mọng rừng", "Tiêu hoa thơm lừng"],
    featured: false,
    rating: 4.9,
    stock: 15,
    abv: 47,
  }),
  new Drink({
    id: "d28",
    name: "Bulleit Bourbon Frontier 10Y",
    category: "spirits",
    price: 180000,
    image: "img/drinks/bulleit-bourbon.jpg",
    description: "Dòng Bourbon Kentucky mang đậm tinh thần miền viễn Tây nước Mỹ: Tỷ lệ lúa mạch đen Rye cao độc đáo, ủ 10 năm trong thùng gỗ sồi Mỹ đốt than bề mặt số 4.",
    ingredients: ["Bulleit 10-Year Kentucky Bourbon", "Khối đá vuông điêu khắc"],
    baseSpirit: "Bulleit Bourbon Whiskey",
    glassType: "Crystal Rocks",
    tasteNotes: ["Gỗ sồi cháy", "Vani phong phú", "Hương khói ấm áp"],
    featured: false,
    rating: 4.8,
    stock: 18,
    abv: 45,
  }),
  new Drink({
    id: "d29",
    name: "Diplomático Reserva Exclusiva Rum",
    category: "spirits",
    price: 175000,
    image: "img/drinks/diplomatico-rum.jpg",
    description: "Dòng Dark Rum thượng hạng từ Venezuela: Chưng cất trong nồi đồng cổ truyền và ủ tới 12 năm trong thùng gỗ sồi, hương vị ngọt ngào như bản giao hưởng caramel và chuối chín.",
    ingredients: ["Diplomático Reserva Exclusiva Rum", "Vỏ cam cháy", "Khối đá pha lê"],
    baseSpirit: "Diplomático Venezuelan Rum",
    glassType: "Old Fashioned Glass",
    tasteNotes: ["Caramel bơ ngọt", "Vỏ cam thơm", "Socola mềm mại"],
    featured: false,
    rating: 4.9,
    stock: 16,
    abv: 40,
  }),
  new Drink({
    id: "d30",
    name: "Campari Cask Bitter Milano",
    category: "aperitivo",
    price: 125000,
    image: "img/drinks/campari-bitter.jpg",
    description: "Rượu khai vị huyền thoại nước Ý phục vụ On The Rocks: Sắc đỏ ruby lộng lẫy từ công thức bí truyền năm 1860 của Gaspare Campari, đắng thanh thảo mộc và lát cam tươi sảng khoái.",
    ingredients: ["Campari Bitter Milano", "Soda suối khoáng sủi tăm", "Lát cam vàng tươi", "Đá viên pha lê"],
    baseSpirit: "Campari Bitter",
    glassType: "Crystal Tumbler",
    tasteNotes: ["Đắng thanh thảo mộc", "Vỏ cam rực rỡ", "Sảng khoái khai vị"],
    featured: false,
    rating: 4.8,
    stock: 25,
    abv: 25,
  }),
];


/* ---------------- CRUD qua API ---------------- */

/** Đọc toàn bộ (R) - GET /drinks */
export async function getAllDrinks() {
  return getCollection(COLLECTION, SEED_DRINKS);
}

/** Đọc theo id (R) - GET /drinks/:id, trả null nếu không có */
export async function getDrinkById(id) {
  return getRecord(COLLECTION, id, SEED_DRINKS);
}

/**
 * Thêm mới (C) - POST /drinks.
 * Luôn dùng bản ghi MÁY CHỦ TRẢ VỀ làm kết quả: json-server bản 1.x tự
 * sinh id mới và bỏ qua id do trình duyệt gửi lên.
 */
export async function addDrink(data) {
  const drink = new Drink(data);
  return api.post(`/${COLLECTION}`, { ...drink });
}

/** Cập nhật (U) - PATCH /drinks/:id, chỉ gửi những trường thay đổi */
export async function updateDrink(id, changes) {
  const { id: _ignored, ...body } = changes; // không cho phép đổi id
  return api.patch(`/${COLLECTION}/${encodeURIComponent(id)}`, body);
}

/** Xoá (D) - DELETE /drinks/:id */
export async function deleteDrink(id) {
  await api.delete(`/${COLLECTION}/${encodeURIComponent(id)}`);
  return true;
}

/* ---------------- Tìm kiếm / Lọc / Sắp xếp ---------------- */

/**
 * Lọc + sắp xếp một danh sách đồ uống CÓ SẴN trong bộ nhớ (hàm đồng bộ).
 * Trang thực đơn tải dữ liệu 1 lần rồi gọi hàm này mỗi khi người dùng
 * gõ phím - không phải gọi lại API liên tục, và không bị "kết quả cũ
 * về sau ghi đè kết quả mới" khi gõ nhanh.
 */
export function filterDrinks(drinks, opts = {}) {
  const {
    keyword = "",
    category = "all",
    minPrice = 0,
    maxPrice = Infinity,
    onlyAvailable = false,
    sortBy = "default",
  } = opts;

  let list = [...drinks];

  const kw = keyword.trim().toLowerCase();
  if (kw) {
    list = list.filter((d) =>
      d.name.toLowerCase().includes(kw)
      || (d.ingredients && d.ingredients.join(" ").toLowerCase().includes(kw))
      || (d.baseSpirit && d.baseSpirit.toLowerCase().includes(kw))
      || (d.description && d.description.toLowerCase().includes(kw))
    );
  }

  if (category !== "all") {
    list = list.filter((d) => d.category === category);
  }

  list = list.filter((d) => d.price >= minPrice && d.price <= maxPrice);

  if (onlyAvailable) {
    list = list.filter((d) => d.status === "available" && d.stock > 0);
  }

  const sorters = {
    "price-asc": (a, b) => a.price - b.price,
    "price-desc": (a, b) => b.price - a.price,
    "name-asc": (a, b) => a.name.localeCompare(b.name, "vi"),
    "name-desc": (a, b) => b.name.localeCompare(a.name, "vi"),
    newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    oldest: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  };

  if (sorters[sortBy]) {
    list.sort(sorters[sortBy]);
  }

  return list;
}

/** Tải dữ liệu từ API rồi lọc - dùng ở những nơi chỉ cần truy vấn 1 lần */
export async function queryDrinks(opts = {}) {
  return filterDrinks(await getAllDrinks(), opts);
}

/** Danh sách món nổi bật cho trang chủ */
export async function getFeaturedDrinks(limit = 4) {
  const drinks = await getAllDrinks();
  return drinks.filter((d) => d.featured).slice(0, limit);
}

/* ---------------- Tồn kho ---------------- */

/** Món còn đủ tồn kho để bán "qty" ly hay không (đọc số liệu mới nhất từ API) */
export async function hasEnoughStock(id, qty = 1) {
  const drink = await getDrinkById(id);
  return Boolean(drink) && drink.status === "available" && drink.stock >= qty;
}

/**
 * Cộng/trừ tồn kho một món (delta âm = bán ra, delta dương = hoàn lại
 * khi đơn bị huỷ). Tự đồng bộ status: hết hàng (<=0) thì "soldout",
 * có hàng trở lại thì mở bán lại. Quản trị viên vẫn có thể tạm ẩn món
 * qua form Sửa - lựa chọn thủ công đó bị ghi đè ở lần adjustStock() kế tiếp.
 */
export async function adjustStock(id, delta) {
  const drink = await getDrinkById(id);
  if (!drink) return null;

  const stock = Math.max(0, (Number(drink.stock) || 0) + delta);
  const status = stock > 0 ? "available" : "soldout";
  return updateDrink(id, { stock, status });
}
