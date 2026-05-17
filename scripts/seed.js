// =============================================
// دليلك — Seed: إضافة الأماكن الأساسية لـ MongoDB
// يُضيف الأماكن فقط إذا لم تكن موجودة (idempotent)
// التشغيل:  npm run seed   أو   node scripts/seed.js
// =============================================
require('dotenv').config();
const mongoose = require('mongoose');
const Place = require('../src/models/Place');

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/dalilak';

const IMG = {
  cafe1:  'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&q=80',
  cafe2:  'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80',
  cafe3:  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80',
  cafe4:  'https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=800&q=80',
  rest1:  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
  rest2:  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
  rest3:  'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80',
  rest4:  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80',
  hotel1: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
  hotel2: 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&q=80',
  hotel3: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80',
};

// نفس الـ 26 مكاناً المستخدمة كـ fallback في الفرونتند
const places = [
  // ══════════ البصرة — مطاعم ══════════
  {
    name:'مطعم بربين', type:'مطعم', governorate:'البصرة',
    description:'مطعم شهير في شارع الجزائر يقدم أشهى المشاوي والوجبات العراقية. يتميز بأجوائه الدافئة وخدمته المميزة.',
    address:'شارع الجزائر، البصرة', phone:'07700111222', openHours:'12:00 م - 12:00 ص',
    area:'الجزائر', priceRange:'متوسط',
    features:['مشاوي','صالة عوائل','موقف سيارات','مكيف'],
    images:[IMG.rest1, IMG.rest2],
    location:{lat:30.5130, lng:47.8100, mapUrl:'https://maps.google.com/?q=مطعم+بربين+البصرة'},
    menu:[
      {name:'كباب غنمي', description:'كباب طازج مشوي على الفحم', price:12000, category:'مشاوي'},
      {name:'تيكا دجاج', description:'دجاج متبل مشوي', price:10000, category:'مشاوي'},
      {name:'مسكوف', description:'سمك بصراوي أصيل', price:28000, category:'أسماك'},
    ],
    reviews:[
      {author:'أحمد الزبيدي', rating:5, comment:'أفضل مطعم بالبصرة!', createdAt:'2025-01-10'},
      {author:'سارة محمد', rating:4, comment:'طعام ممتاز وسعر مناسب', createdAt:'2025-01-20'},
    ],
    averageRating:4.4, isActive:true
  },
  {
    name:'BBQ المنقل', type:'مطعم', governorate:'البصرة',
    description:'مطعم باربكيو شهير بتقييم عالٍ يجذب محبي المشاوي. يقدم أشهى اللحوم المشوية بطريقة فنية احترافية.',
    address:'البصرة', phone:'07701234567', openHours:'1:00 م - 1:00 ص',
    area:'البصرة الجديدة', priceRange:'متوسط',
    features:['باربكيو','مشاوي','صالة عوائل','واي فاي'],
    images:[IMG.rest2, IMG.rest3],
    location:{lat:30.5080, lng:47.7850, mapUrl:'https://maps.google.com/?q=BBQ+المنقل+البصرة'},
    menu:[
      {name:'ريش لحم', description:'ريش بقري مشوية بالتوابل', price:18000, category:'مشاوي'},
      {name:'برغر لحم', description:'برغر بالجبن واللحم الطازج', price:12000, category:'برغر'},
    ],
    reviews:[
      {author:'كريم علي', rating:4, comment:'أفضل باربكيو جربته', createdAt:'2025-02-01'},
    ],
    averageRating:4.1, isActive:true
  },
  {
    name:'مطعم 360', type:'مطعم', governorate:'البصرة',
    description:'مطعم عصري يقدم تجربة طعام متكاملة بإطلالة بانورامية رائعة. قائمة متنوعة تناسب جميع الأذواق.',
    address:'البصرة', phone:'07702233445', openHours:'12:00 م - 12:00 ص',
    area:'وسط البصرة', priceRange:'غالي',
    features:['إطلالة بانورامية','واي فاي','صالة VIP','مكيف'],
    images:[IMG.rest1, IMG.rest4],
    location:{lat:30.5090, lng:47.7900, mapUrl:'https://maps.google.com/?q=360+restaurant+basra'},
    menu:[
      {name:'فيليه مشوي', description:'فيليه بقري مع صوص الفطر', price:32000, category:'مشاوي'},
      {name:'دجاج كريمة', description:'صدر دجاج بالكريمة والثوم', price:22000, category:'رئيسية'},
    ],
    reviews:[
      {author:'هند الربيعي', rating:4, comment:'جو رائع وطعام ممتاز', createdAt:'2025-01-15'},
    ],
    averageRating:4.0, isActive:true
  },
  {
    name:'مطعم الحسون والحدائق', type:'مطعم', governorate:'البصرة',
    description:'مطعم تراثي عريق يقدم المأكولات العراقية الأصيلة في حديقة خضراء جميلة. من أشهر مطاعم البصرة القديمة.',
    address:'ملعب الجنة الأولمبية، البصرة', phone:'07700998877', openHours:'11:00 ص - 11:00 م',
    area:'الجنة الأولمبية', priceRange:'متوسط',
    features:['حديقة','تراثي','صالة عوائل','جلسات خارجية'],
    images:[IMG.rest3, IMG.rest1],
    location:{lat:30.5200, lng:47.8200, mapUrl:'https://maps.google.com/?q=الحسون+البصرة'},
    menu:[
      {name:'مسكوف بصراوي', description:'سمك مشوي على الجمر', price:25000, category:'أسماك'},
      {name:'مرق باميا', description:'مرق عراقي تقليدي', price:9000, category:'رئيسية'},
    ],
    reviews:[
      {author:'وسام ناصر', rating:4, comment:'أصالة وطعام حقيقي', createdAt:'2024-12-20'},
    ],
    averageRating:3.9, isActive:true
  },
  {
    name:'مندي المدينة', type:'مطعم', governorate:'البصرة',
    description:'متخصص في أطباق المندي الخليجية الأصيلة. يقدم أفضل المندي في البصرة بأسعار مناسبة.',
    address:'شارع دينار، البصرة', phone:'07703344556', openHours:'12:00 م - 11:00 م',
    area:'شارع دينار', priceRange:'متوسط',
    features:['مندي','مشاوي','دليفري','مكيف'],
    images:[IMG.rest2, IMG.rest3],
    location:{lat:30.5050, lng:47.7800, mapUrl:'https://maps.google.com/?q=مندي+المدينة+البصرة'},
    menu:[
      {name:'مندي دجاج', description:'دجاج مطبوخ على الدخان', price:20000, category:'مندي'},
      {name:'مندي لحم', description:'لحم بسمتي بالزعفران', price:28000, category:'مندي'},
    ],
    reviews:[
      {author:'علي حسن', rating:4, comment:'مندي لذيذ وكميات كبيرة', createdAt:'2025-01-05'},
    ],
    averageRating:4.1, isActive:true
  },
  {
    name:'Lodge Restaurant', type:'مطعم', governorate:'البصرة',
    description:'مطعم راقٍ في شارع الجزائر يجمع بين الأجواء العصرية والطعام العالمي الفاخر.',
    address:'شارع الجزائر، البصرة', phone:'07701122334', openHours:'1:00 م - 1:00 ص',
    area:'الجزائر', priceRange:'غالي',
    features:['واي فاي','مكيف','صالة خاصة','موسيقى هادئة'],
    images:[IMG.rest4, IMG.rest2],
    location:{lat:30.5140, lng:47.8110, mapUrl:'https://maps.google.com/?q=Lodge+Restaurant+Basra'},
    menu:[
      {name:'ستيك ريب آي', description:'ستيك بقري فاخر بالأعشاب', price:38000, category:'مشاوي'},
      {name:'سمون سالمون', description:'سمك السالمون المشوي', price:30000, category:'أسماك'},
    ],
    reviews:[
      {author:'رنا الجاسم', rating:4, comment:'تجربة فاخرة تستحق السعر', createdAt:'2025-02-10'},
    ],
    averageRating:4.3, isActive:true
  },

  // ══════════ البصرة — كافيهات ══════════
  {
    name:'Nook Cafe', type:'كافيه', governorate:'البصرة',
    description:'كافيه عصري هادئ في شارع سيد حامد يقدم قهوة مختصة وحلويات متنوعة. مكان مثالي للعمل أو الاسترخاء.',
    address:'شارع سيد حامد، البصرة', phone:'07704455667', openHours:'9:00 ص - 1:00 ص',
    area:'سيد حامد', priceRange:'متوسط',
    features:['واي فاي','قهوة مختصة','هادئ','مكيف'],
    images:[IMG.cafe1, IMG.cafe2],
    location:{lat:30.5100, lng:47.7950, mapUrl:'https://maps.google.com/?q=Nook+Cafe+Basra'},
    menu:[
      {name:'كولد برو', description:'قهوة باردة منقوعة 24 ساعة', price:8000, category:'قهوة'},
      {name:'لاتيه كراميل', description:'قهوة بالكراميل والكريمة', price:7000, category:'قهوة'},
      {name:'تشيز كيك', description:'تشيز كيك نيويورك', price:9000, category:'حلويات'},
    ],
    reviews:[
      {author:'سلمى عبدالله', rating:5, comment:'أجمل كافيه بالبصرة', createdAt:'2025-01-25'},
      {author:'يوسف الكريم', rating:4, comment:'قهوة رائعة وجو هادئ', createdAt:'2025-02-05'},
    ],
    averageRating:4.2, isActive:true
  },
  {
    name:'Shour Cafe', type:'كافيه', governorate:'البصرة',
    description:'كافيه ومطعم في شارع الجزائر بتقييم 4.5 نجوم. يقدم مشروبات متنوعة وأجواء رومانسية هادئة.',
    address:'شارع الجزائر، البصرة', phone:'07705566778', openHours:'10:00 ص - 2:00 ص',
    area:'الجزائر', priceRange:'متوسط',
    features:['واي فاي','رومانسي','هوكا','جلسات خارجية'],
    images:[IMG.cafe2, IMG.cafe3],
    location:{lat:30.5125, lng:47.8095, mapUrl:'https://maps.google.com/?q=Shour+Cafe+Basra'},
    menu:[
      {name:'موهيتو', description:'مشروب ليمون بالنعناع', price:6000, category:'مشروبات'},
      {name:'قهوة تركية', description:'تركية فاخرة بالهيل', price:3500, category:'قهوة'},
    ],
    reviews:[
      {author:'نور الحسيني', rating:5, comment:'الجو رومانسي والمشروبات ممتازة', createdAt:'2025-01-30'},
    ],
    averageRating:4.5, isActive:true
  },
  {
    name:'GG Gaming Lounge', type:'كافيه', governorate:'البصرة',
    description:'كافيه وصالة ألعاب إلكترونية بتقييم 4.7 نجوم. الوجهة الأولى لمحبي الألعاب والقهوة في البصرة.',
    address:'حي عمان، البصرة', phone:'07706677889', openHours:'11:00 ص - 3:00 ص',
    area:'حي عمان', priceRange:'متوسط',
    features:['ألعاب إلكترونية','واي فاي','PS5','قهوة'],
    images:[IMG.cafe3, IMG.cafe4],
    location:{lat:30.5060, lng:47.7820, mapUrl:'https://maps.google.com/?q=GG+Gaming+Lounge+Basra'},
    menu:[
      {name:'قهوة أمريكانو', description:'إسبريسو مع ماء ساخن', price:4000, category:'قهوة'},
      {name:'شيك شوكولاتة', description:'شيك شوكولاتة بالآيس كريم', price:7000, category:'مشروبات'},
    ],
    reviews:[
      {author:'محمد الدوري', rating:5, comment:'مكان رائع للقيمرز', createdAt:'2025-02-15'},
    ],
    averageRating:4.7, isActive:true
  },
  {
    name:'Lucas Cafe', type:'كافيه', governorate:'البصرة',
    description:'كافيه شهير في الشارع التجاري بالبصرة. يقدم قهوة مختصة وحلويات أوروبية في أجواء أنيقة.',
    address:'الشارع التجاري، البصرة', phone:'07700123456', openHours:'9:00 ص - 12:00 ص',
    area:'الشارع التجاري', priceRange:'متوسط',
    features:['واي فاي','قهوة أوروبية','حلويات','مكيف'],
    images:[IMG.cafe1, IMG.cafe4],
    location:{lat:30.5085, lng:47.7870, mapUrl:'https://maps.google.com/?q=Lucas+Cafe+Basra'},
    menu:[
      {name:'فلات وايت', description:'قهوة بيضاء ناعمة', price:7000, category:'قهوة'},
      {name:'كيك الشوكولاتة', description:'كيك بلجيكي داكن', price:8000, category:'حلويات'},
    ],
    reviews:[
      {author:'لمى التميمي', rating:4, comment:'قهوة لذيذة وجو هادئ', createdAt:'2025-01-12'},
    ],
    averageRating:4.1, isActive:true
  },

  // ══════════ بغداد — مطاعم ══════════
  {
    name:'HuQQabaz Baghdad', type:'مطعم', governorate:'بغداد',
    description:'مطعم فاخر بتقييم 4.8 نجوم في قرية دجلة. من أرقى المطاعم البغداوية يقدم أشهى المأكولات العراقية والعالمية بإطلالة على نهر دجلة.',
    address:'قرية دجلة، بغداد', phone:'07701234900', openHours:'1:00 م - 1:00 ص',
    area:'قرية دجلة', priceRange:'غالي',
    features:['إطلالة على دجلة','واي فاي','صالة VIP','موسيقى حية','موقف'],
    images:[IMG.rest1, IMG.rest4],
    location:{lat:33.3250, lng:44.4050, mapUrl:'https://maps.google.com/?q=HuQQabaz+Baghdad'},
    menu:[
      {name:'مسكوف دجلة', description:'سمك شبوط أمام دجلة', price:40000, category:'أسماك'},
      {name:'لحم مشوي فاخر', description:'لحم بأجود التوابل', price:35000, category:'مشاوي'},
    ],
    reviews:[
      {author:'مصطفى العبيدي', rating:5, comment:'أروع مطعم بالعراق!', createdAt:'2025-01-20'},
      {author:'نور الهاشمي', rating:5, comment:'الإطلالة على دجلة لا تنسى', createdAt:'2025-02-01'},
    ],
    averageRating:4.8, isActive:true
  },
  {
    name:'Pachi Pizza Baghdad', type:'مطعم', governorate:'بغداد',
    description:'أشهر مطعم بيتزا في بغداد بتقييم 4.8 نجوم وأكثر من 3700 تقييم. يقدم البيتزا الإيطالية الأصيلة بعجينة طازجة يومياً.',
    address:'بغداد', phone:'07709876543', openHours:'12:00 م - 12:00 ص',
    area:'المنصور', priceRange:'متوسط',
    features:['بيتزا إيطالية','دليفري','واي فاي','مكيف'],
    images:[IMG.rest2, IMG.rest3],
    location:{lat:33.3200, lng:44.3700, mapUrl:'https://maps.google.com/?q=Pachi+Pizza+Baghdad'},
    menu:[
      {name:'بيتزا مارغريتا', description:'بيتزا إيطالية كلاسيكية', price:18000, category:'بيتزا'},
      {name:'بيتزا دجاج BBQ', description:'دجاج وصوص باربكيو', price:22000, category:'بيتزا'},
    ],
    reviews:[
      {author:'أحمد الراوي', rating:5, comment:'أحسن بيتزا بالعراق!', createdAt:'2025-01-08'},
    ],
    averageRating:4.8, isActive:true
  },
  {
    name:'مطعم صمد', type:'مطعم', governorate:'بغداد',
    description:'مطعم شهير في المنصور بتقييم 4.1 وأكثر من 2500 تقييم. يقدم المأكولات العراقية والمشاوي بجودة ثابتة منذ سنوات.',
    address:'شارع المنصور، بغداد', phone:'07703344567', openHours:'12:00 م - 11:00 م',
    area:'المنصور', priceRange:'متوسط',
    features:['مشاوي','صالة عوائل','دليفري','موقف'],
    images:[IMG.rest3, IMG.rest1],
    location:{lat:33.3300, lng:44.3600, mapUrl:'https://maps.google.com/?q=مطعم+صمد+المنصور'},
    menu:[
      {name:'كباب إسكندر', description:'كباب مع صلصة الطماطم', price:15000, category:'مشاوي'},
      {name:'برياني بغدادي', description:'أرز بسمتي بالزعفران', price:18000, category:'رئيسية'},
    ],
    reviews:[
      {author:'كريم الحيالي', rating:4, comment:'طعام ثابت وكميات كافية', createdAt:'2025-01-18'},
    ],
    averageRating:4.1, isActive:true
  },

  // ══════════ بغداد — كافيهات ══════════
  {
    name:'650 Cafe اليرموك', type:'كافيه', governorate:'بغداد',
    description:'كافيه أسطوري بتقييم 4.9 نجوم في اليرموك. من أفضل الكافيهات في العراق بقهوة مختصة استثنائية وأجواء لا تنسى.',
    address:'شارع اليرموك، بغداد', phone:'07701100200', openHours:'7:00 ص - 1:00 ص',
    area:'اليرموك', priceRange:'متوسط',
    features:['قهوة مختصة','واي فاي','صحي','مكيف'],
    images:[IMG.cafe1, IMG.cafe3],
    location:{lat:33.3150, lng:44.3200, mapUrl:'https://maps.google.com/?q=650+Cafe+Yarmuk+Baghdad'},
    menu:[
      {name:'إسبريسو مزدوج', description:'شوت مركّز قوي', price:5000, category:'قهوة'},
      {name:'كولد برو', description:'قهوة باردة 24 ساعة', price:9000, category:'قهوة'},
      {name:'أفوكادو توست', description:'خبز محمص مع أفوكادو', price:12000, category:'طعام'},
    ],
    reviews:[
      {author:'سارة العمار', rating:5, comment:'تقييم 4.9 يقول كل شيء!', createdAt:'2025-02-10'},
      {author:'علي الجبوري', rating:5, comment:'أحسن قهوة بالعراق', createdAt:'2025-01-25'},
    ],
    averageRating:4.9, isActive:true
  },
  {
    name:'مقهى الشابندر', type:'كافيه', governorate:'بغداد',
    description:'من أعرق المقاهي البغداوية التاريخية في شارع المتنبي الشهير. تقييم 4.4 نجوم وأكثر من 1177 تقييم. ملتقى الأدباء والمثقفين.',
    address:'شارع المتنبي، باب المعظم، بغداد', phone:'07700100200', openHours:'8:00 ص - 10:00 م',
    area:'المتنبي — باب المعظم', priceRange:'رخيص',
    features:['تاريخي','ثقافي','شاي عراقي','كتب'],
    images:[IMG.cafe4, IMG.cafe2],
    location:{lat:33.3461, lng:44.3955, mapUrl:'https://maps.google.com/?q=مقهى+الشابندر+بغداد'},
    menu:[
      {name:'شاي حبال', description:'استكان شاي عراقي أصيل', price:1000, category:'شاي'},
      {name:'قيمر مع عيش', description:'قيمر بغدادي مع الخبز', price:3000, category:'إفطار'},
    ],
    reviews:[
      {author:'مصطفى الدليمي', rating:5, comment:'روح بغداد الحقيقية!', createdAt:'2025-01-05'},
      {author:'رنا السهل', rating:4, comment:'مكان ثقافي فريد', createdAt:'2024-12-15'},
    ],
    averageRating:4.4, isActive:true
  },
  {
    name:'Ni Caffè', type:'كافيه', governorate:'بغداد',
    description:'كافيه فاخر في قرية دجلة بتقييم 4.7 نجوم. يقدم قهوة مختصة مبتكرة وحلويات عالمية في أجواء راقية هادئة.',
    address:'قرية دجلة، بغداد', phone:'07703300400', openHours:'9:00 ص - 2:00 ص',
    area:'قرية دجلة', priceRange:'غالي',
    features:['واي فاي','قهوة فاخرة','حلويات راقية','إطلالة'],
    images:[IMG.cafe2, IMG.cafe1],
    location:{lat:33.3245, lng:44.4040, mapUrl:'https://maps.google.com/?q=Ni+Caffe+Baghdad'},
    menu:[
      {name:'سيكريت لاتيه', description:'قهوة سرية الوصفة', price:10000, category:'قهوة'},
      {name:'تيراميسو', description:'إيطالي أصيل', price:13000, category:'حلويات'},
    ],
    reviews:[
      {author:'لينا العباسي', rating:5, comment:'أفضل كافيه راقٍ بالعراق', createdAt:'2025-02-08'},
    ],
    averageRating:4.7, isActive:true
  },
  {
    name:'الريف كافيه', type:'كافيه', governorate:'بغداد',
    description:'كافيه شهير وواسع في شارع 42 بتقييم 4.3 نجوم وأكثر من 1500 تقييم. يقدم جميع أنواع القهوة والمشروبات الباردة.',
    address:'شارع 42، بغداد', phone:'07705500600', openHours:'9:00 ص - 1:00 ص',
    area:'شارع 42', priceRange:'متوسط',
    features:['واسع','واي فاي','خارجي','عائلي'],
    images:[IMG.cafe3, IMG.cafe2],
    location:{lat:33.3180, lng:44.3850, mapUrl:'https://maps.google.com/?q=الريف+كافيه+بغداد'},
    menu:[
      {name:'كابيتشينو', description:'قهوة إيطالية كلاسيكية', price:6000, category:'قهوة'},
      {name:'فرابتشينو', description:'قهوة مثلجة بالكريمة', price:8000, category:'قهوة'},
    ],
    reviews:[
      {author:'باسم حسن', rating:4, comment:'مكان واسع وهادئ', createdAt:'2025-01-22'},
    ],
    averageRating:4.3, isActive:true
  },

  // ══════════ أربيل — مطاعم ══════════
  {
    name:'Seven Chefs', type:'مطعم', governorate:'أربيل',
    description:'مطعم فاخر بتقييم 4.8 نجوم في منطقة 128. سبعة طهاة متخصصون يقدمون تجربة طعام استثنائية متعددة المطابخ.',
    address:'منطقة 128، أربيل', phone:'07501000200', openHours:'1:00 م - 1:00 ص',
    area:'منطقة 128', priceRange:'غالي',
    features:['واي فاي','شيف مميز','صالة VIP','موقف'],
    images:[IMG.rest4, IMG.rest1],
    location:{lat:36.2100, lng:44.0050, mapUrl:'https://maps.google.com/?q=Seven+Chefs+Erbil'},
    menu:[
      {name:'فيليه بقري فاخر', description:'لحم من أجود الأنواع', price:45000, category:'مشاوي'},
      {name:'سيفيتشي', description:'سمك طازج بالليمون', price:28000, category:'أسماك'},
    ],
    reviews:[
      {author:'آراس كمال', rating:5, comment:'أفضل مطعم بأربيل!', createdAt:'2025-02-05'},
    ],
    averageRating:4.8, isActive:true
  },
  {
    name:'ABC Restaurant', type:'مطعم', governorate:'أربيل',
    description:'مطعم أسطوري في أربيل بتقييم 4.3 نجوم وأكثر من 5700 تقييم! أكثر مطعم تقييماً في المدينة.',
    address:'طريق بحركة، أربيل', phone:'07501122000', openHours:'12:00 م - 12:00 ص',
    area:'بحركة', priceRange:'متوسط',
    features:['صالة عوائل','مشاوي','واي فاي','موقف كبير'],
    images:[IMG.rest2, IMG.rest3],
    location:{lat:36.2200, lng:44.0200, mapUrl:'https://maps.google.com/?q=ABC+Restaurant+Erbil'},
    menu:[
      {name:'كباب كردي', description:'كباب بالتوابل الكردية الأصيلة', price:14000, category:'مشاوي'},
      {name:'دولمة', description:'دولمة عراقية تقليدية', price:12000, category:'رئيسية'},
    ],
    reviews:[
      {author:'هيمن رشيد', rating:4, comment: '5700 تقييم ولازال الأفضل', createdAt:'2025-01-15'},
    ],
    averageRating:4.3, isActive:true
  },
  {
    name:'The Grill أربيل', type:'مطعم', governorate:'أربيل',
    description:'مطعم شواية راقٍ في كولان بارك بتقييم 4.4 نجوم. يقدم أجود اللحوم المشوية مع إطلالة رائعة على الحديقة.',
    address:'كولان بارك، أربيل', phone:'07501233456', openHours:'12:00 م - 12:00 ص',
    area:'كولان بارك', priceRange:'غالي',
    features:['إطلالة على الحديقة','مشاوي فاخرة','واي فاي','مكيف'],
    images:[IMG.rest1, IMG.rest4],
    location:{lat:36.1950, lng:44.0100, mapUrl:'https://maps.google.com/?q=The+Grill+Golan+Park+Erbil'},
    menu:[
      {name:'تي-بون ستيك', description:'عظم T بقري بالأعشاب الطازجة', price:50000, category:'مشاوي'},
      {name:'ريش غنمي', description:'ريش مشوية متبلة', price:28000, category:'مشاوي'},
    ],
    reviews:[
      {author:'دلشاد أحمد', rating:4, comment:'مكان راقٍ يستحق السعر', createdAt:'2025-01-28'},
    ],
    averageRating:4.4, isActive:true
  },

  // ══════════ أربيل — كافيهات ══════════
  {
    name:'Fabuela Cafe & Brunch', type:'كافيه', governorate:'أربيل',
    description:'كافيه استثنائي بتقييم 4.8 نجوم وأكثر من 800 تقييم. وجهة البرنش الأولى في أربيل بقهوة متخصصة وإفطارات فاخرة.',
    address:'أربيل', phone:'07502000300', openHours:'8:00 ص - 11:00 م',
    area:'وسط أربيل', priceRange:'متوسط',
    features:['برنش','قهوة مختصة','واي فاي','إنستغرامي'],
    images:[IMG.cafe1, IMG.cafe3],
    location:{lat:36.1900, lng:44.0090, mapUrl:'https://maps.google.com/?q=Fabuela+Cafe+Erbil'},
    menu:[
      {name:'إفطار فابيولا', description:'بيض+جبنة+خبز+قهوة', price:16000, category:'إفطار'},
      {name:'ماتشا لاتيه', description:'ماتشا ياباني مع حليب', price:9000, category:'قهوة'},
    ],
    reviews:[
      {author:'شيرين عمر', rating:5, comment:'أجمل كافيه بأربيل!', createdAt:'2025-02-12'},
    ],
    averageRating:4.8, isActive:true
  },
  {
    name:'Sidra Coffee', type:'كافيه', governorate:'أربيل',
    description:'كافيه نادر بتقييم 5.0 نجوم كامل في سوق القيصرية! يقدم قهوة مختصة بمستوى عالمي في مكان تاريخي.',
    address:'سوق القيصرية، قلعة أربيل', phone:'07501500600', openHours:'9:00 ص - 10:00 م',
    area:'سوق القيصرية', priceRange:'متوسط',
    features:['قهوة عالمية','تاريخي','بجانب القلعة','هادئ'],
    images:[IMG.cafe4, IMG.cafe1],
    location:{lat:36.1912, lng:44.0100, mapUrl:'https://maps.google.com/?q=Sidra+Coffee+Erbil'},
    menu:[
      {name:'قهوة سيدرا', description:'مزيج خاص من حبوب إثيوبية وكولومبية', price:9000, category:'قهوة'},
      {name:'بور أوفر', description:'قهوة مصفّاة يدوياً', price:10000, category:'قهوة'},
    ],
    reviews:[
      {author:'ئاراس بكر', rating:5, comment:'تقييم 5.0 يعني الكمال!', createdAt:'2025-02-18'},
      {author:'نارين جمال', rating:5, comment:'أفضل قهوة جربتها بحياتي', createdAt:'2025-01-30'},
    ],
    averageRating:5.0, isActive:true
  },
  {
    name:'Cafe Barbera أربيل', type:'كافيه', governorate:'أربيل',
    description:'سلسلة إيطالية عالمية الشهرة بتقييم 4.2 نجوم في بارك فيو أربيل. قهوة إيطالية أصيلة بجودة ثابتة عالية.',
    address:'بارك فيو مول، أربيل', phone:'07501100300', openHours:'8:00 ص - 12:00 ص',
    area:'بارك فيو', priceRange:'متوسط',
    features:['واي فاي','إيطالي','مكيف','حلويات إيطالية'],
    images:[IMG.cafe2, IMG.cafe3],
    location:{lat:36.2050, lng:44.0200, mapUrl:'https://maps.google.com/?q=Cafe+Barbera+Erbil'},
    menu:[
      {name:'إسبريسو إيطالي', description:'حبوب إيطالية فاخرة', price:6000, category:'قهوة'},
      {name:'تيراميسو', description:'الأصلي الإيطالي', price:12000, category:'حلويات'},
    ],
    reviews:[
      {author:'ئاوات محمد', rating:4, comment:'جودة إيطالية حقيقية', createdAt:'2025-01-20'},
    ],
    averageRating:4.2, isActive:true
  },

  // ══════════ فنادق ══════════
  {
    name:'فندق البصرة الدولي', type:'فندق', governorate:'البصرة',
    description:'من أفخم فنادق البصرة يقع على ضفاف شط العرب بإطلالة خلابة على النهر. يضم غرفاً فاخرة ومرافق عالمية ومطعماً فخماً ومسبحاً داخلياً.',
    address:'كورنيش شط العرب، البصرة', phone:'07701111000', openHours:'طوال اليوم',
    area:'كورنيش شط العرب', priceRange:'غالي',
    features:['إطلالة على النهر','مسبح داخلي','واي فاي','مطعم فاخر','موقف سيارات','غرف VIP'],
    images:[IMG.hotel1, IMG.hotel2],
    location:{lat:30.5130, lng:47.8050, mapUrl:'https://maps.google.com/?q=فندق+البصرة+الدولي'},
    menu:[
      {name:'إفطار فُل', description:'بوفيه إفطار متنوع', price:35000, category:'إفطار'},
      {name:'خدمة الغرفة', description:'غرفة مزدوججة ليلة واحدة', price:150000, category:'إقامة'},
    ],
    reviews:[
      {author:'كريم الجاسم', rating:5, comment:'فندق أكثر من رائع، الخدمة فاخرة!', createdAt:'2025-01-15'},
      {author:'نور الحسيني', rating:4, comment:'إطلالة ممتازة على شط العرب', createdAt:'2025-02-01'},
    ],
    averageRating:4.7, isActive:true
  },
  {
    name:'فندق روتانا بغداد', type:'فندق', governorate:'بغداد',
    description:'فندق عالمي خمس نجوم في قلب بغداد يتمتع بإطلالة بانورامية على نهر دجلة. يضم مطاعم متعددة وسبا فاخراً وصالات مؤتمرات.',
    address:'شارع الكرادة، بغداد', phone:'07801234567', openHours:'طوال اليوم',
    area:'الكرادة', priceRange:'غالي',
    features:['خمس نجوم','سبا','مسبح','إطلالة دجلة','صالات مؤتمرات','واي فاي سريع'],
    images:[IMG.hotel2, IMG.hotel3],
    location:{lat:33.3120, lng:44.3920, mapUrl:'https://maps.google.com/?q=روتانا+بغداد'},
    menu:[
      {name:'إفطار بوفيه', description:'بوفيه إفطار دولي 5 نجوم', price:45000, category:'إفطار'},
      {name:'غرفة ديلوكس', description:'غرفة ديلوكس بإطلالة دجلة', price:250000, category:'إقامة'},
    ],
    reviews:[
      {author:'مصطفى العبيدي', rating:5, comment:'خدمة لا تضاهيها، فندق عالمي حقيقي!', createdAt:'2025-01-28'},
    ],
    averageRating:4.8, isActive:true
  },
  {
    name:'فندق شيراتون أربيل', type:'فندق', governorate:'أربيل',
    description:'فندق فاخر خمس نجوم وسط أربيل، من أكبر فنادق إقليم كردستان. يضم مطاعم عالمية ومركز لياقة بدنية وظرفاً خلاباً يطل على المدينة.',
    address:'شارع 100 متر، أربيل', phone:'07502233445', openHours:'طوال اليوم',
    area:'شارع 100 متر', priceRange:'غالي',
    features:['خمس نجوم','مركز لياقة','واي فاي','مطعم عربي دولي','موقف كبير','إطلالة بانورامية'],
    images:[IMG.hotel3, IMG.hotel1],
    location:{lat:36.1955, lng:44.0134, mapUrl:'https://maps.google.com/?q=شيراتون+أربيل'},
    menu:[
      {name:'إفطار فاخر', description:'بوفيه صباحي كامل', price:40000, category:'إفطار'},
      {name:'غرفة سويت', description:'جناح فاخر بإطلالة بانورامية', price:220000, category:'إقامة'},
    ],
    reviews:[
      {author:'دلشاد أحمد', rating:5, comment:'فندق استثنائي، أحسن فندق بأربيل!', createdAt:'2025-02-10'},
    ],
    averageRating:4.8, isActive:true
  },
];

async function seed() {
  console.log('🌱 الاتصال بـ MongoDB ...');
  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
  });
  console.log('✅ متصل — بدء الإضافة (idempotent)');

  let inserted = 0;
  let skipped  = 0;

  for (const place of places) {
    // أضف فقط إذا لم يوجد مكان بنفس الاسم — لا يُكرّر ولا يَمسح بيانات حقيقية
    const exists = await Place.findOne({ name: place.name }).lean();
    if (exists) {
      skipped++;
      continue;
    }
    await Place.create(place);
    inserted++;
    console.log(`  + أُضيف: ${place.name}`);
  }

  console.log(`\n🎉 اكتمل — أُضيف ${inserted} | موجود مسبقاً ${skipped} | الإجمالي ${places.length}`);
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ فشل الـ seed:', err.message);
  process.exit(1);
});
