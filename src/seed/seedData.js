const mongoose = require('mongoose');
require('dotenv').config();

const Place = require('../models/Place');

// ==============================
// بيانات تجريبية — 9 أماكن في البصرة
// ==============================
const places = [
  // ===================== كافيهات =====================
  {
    name: 'كافيه الشط العربي',
    type: 'كافيه',
    description: 'كافيه راقٍ يطل على شط العرب، يقدم أجود أنواع القهوة المختصة والحلويات الشرقية. أجواء هادئة مثالية للاسترخاء ومشاهدة غروب الشمس على النهر.',
    address: 'كورنيش شط العرب، البصرة',
    phone: '07701234567',
    openHours: '8:00 ص - 12:00 م',
    area: 'كورنيش البصرة',
    features: ['واي فاي مجاني', 'إطلالة على النهر', 'صالة عائلية', 'موقف سيارات', 'تكييف'],
    images: [
      'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800',
      'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=800',
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800'
    ],
    location: {
      lat: 30.5141,
      lng: 47.8172,
      mapUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3577.8!2d47.8172!3d30.5141!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzDCsDMwJzUwLjgiTiA0N8KwNDknMDEuOSJF!5e0!3m2!1sar!2siq!4v1234567890'
    },
    menu: [
      { name: 'قهوة مختصة', description: 'إسبريسو أثيوبي فاخر', price: 5000, category: 'قهوة' },
      { name: 'كابيتشينو', description: 'مع حليب مبخر وشوكولاتة', price: 6000, category: 'قهوة' },
      { name: 'كولد برو', description: 'قهوة باردة منقوعة 24 ساعة', price: 7000, category: 'قهوة' },
      { name: 'تشيز كيك', description: 'تشيز كيك نيويورك بصوص التوت', price: 8000, category: 'حلويات' },
      { name: 'وافل بلجيكي', description: 'مع مثلجات الفانيليا والتوفي', price: 9000, category: 'حلويات' },
      { name: 'ليمون نعناع', description: 'عصير طازج بالنعناع الطازج', price: 4000, category: 'مشروبات' }
    ],
    reviews: [
      { author: 'أحمد الموسوي', rating: 5, comment: 'مكان رائع والإطلالة على النهر خلابة! القهوة ممتازة.' },
      { author: 'فاطمة العلي', rating: 4, comment: 'جو هادئ ومريح، سأعود قريباً بالتأكيد' },
      { author: 'علي حسن', rating: 5, comment: 'أفضل كافيه في البصرة بدون منافس' }
    ]
  },
  {
    name: 'كافيه النخيل الذهبي',
    type: 'كافيه',
    description: 'كافيه عصري في قلب البصرة يجمع بين الأجواء الدافئة والتصميم الأنيق. متخصص في القهوة التركية والشاي الإيراني.',
    address: 'شارع العشار، البصرة',
    phone: '07709876543',
    openHours: '9:00 ص - 11:30 م',
    area: 'العشار',
    features: ['واي فاي مجاني', 'خدمة دليفري', 'صالة خاصة للأعمال'],
    images: [
      'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=800',
      'https://images.unsplash.com/photo-1498804103079-a6351b050096?w=800',
      'https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=800'
    ],
    location: {
      lat: 30.5082,
      lng: 47.7877,
      mapUrl: 'https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d3577!2d47.7877!3d30.5082!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sar!2siq!4v1234'
    },
    menu: [
      { name: 'قهوة تركية', description: 'قهوة تركية تقليدية بالهيل', price: 3000, category: 'قهوة' },
      { name: 'شاي فارسي', description: 'شاي أحمر مع الزعفران', price: 3500, category: 'شاي' },
      { name: 'ماتشا لاتيه', description: 'ماتشا ياباني مع حليب اللوز', price: 8000, category: 'قهوة' },
      { name: 'كرواسان', description: 'طازج يومياً مع زبدة الفستق', price: 6000, category: 'مخبوزات' }
    ],
    reviews: [
      { author: 'زينب الكريم', rating: 4, comment: 'القهوة التركية هنا الأفضل في البصرة!' },
      { author: 'محمد جاسم', rating: 5, comment: 'تصميم رائع وخدمة ممتازة' }
    ]
  },
  {
    name: 'كافيه الميناء',
    type: 'كافيه',
    description: 'كافيه ساحلي بأجواء بحرية فريدة، يقدم مشروبات متنوعة ومأكولات خفيفة. المكان المفضل للعائلات في نهايات الأسبوع.',
    address: 'منطقة الميناء، البصرة',
    phone: '07800112233',
    openHours: '10:00 ص - 12:00 م',
    area: 'الميناء',
    features: ['صالة عائلية', 'منطقة ألعاب أطفال', 'إطلالة بحرية'],
    images: [
      'https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=800',
      'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800',
      'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=800'
    ],
    location: {
      lat: 30.4950,
      lng: 47.8100,
      mapUrl: 'https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d3578!2d47.8100!3d30.4950!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sar!2siq!4v5678'
    },
    menu: [
      { name: 'فرابيه', description: 'مثلج بالكراميل والقهوة', price: 7500, category: 'مشروبات باردة' },
      { name: 'موهيتو', description: 'نعناع وليمون طازج', price: 5000, category: 'مشروبات باردة' },
      { name: 'بانيني', description: 'دجاج مشوي وجبن وخضروات', price: 12000, category: 'وجبات خفيفة' }
    ],
    reviews: [
      { author: 'سارة العبد', rating: 4, comment: 'مكان جميل وهادئ للعائلة' },
      { author: 'كريم الناصر', rating: 3, comment: 'جيد لكن الخدمة تحتاج تحسين' }
    ]
  },

  // ===================== مطاعم =====================
  {
    name: 'مطعم السمك البصري',
    type: 'مطعم',
    description: 'المطعم الأشهر في البصرة لتقديم سمك المسگوف الأصيل والمأكولات البحرية الطازجة. خبرة تتجاوز 30 عاماً في إعداد أشهى أطباق النهر.',
    address: 'شارع الكورنيش، البصرة',
    phone: '07701122334',
    openHours: '12:00 م - 11:00 م',
    area: 'كورنيش البصرة',
    features: ['مسكوف طازج يومياً', 'صالة عائلية', 'موقف سيارات مجاني', 'خدمة دليفري'],
    images: [
      'https://images.unsplash.com/photo-1544025162-d76694265947?w=800',
      'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800',
      'https://images.unsplash.com/photo-1559847844-5315695dadae?w=800'
    ],
    location: {
      lat: 30.5085,
      lng: 47.8162,
      mapUrl: 'https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d3577.5!2d47.8162!3d30.5085!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sar!2siq!4v9012'
    },
    menu: [
      { name: 'سمك مسگوف', description: 'كارب نهري مشوي على الفحم بالطريقة البصرية الأصيلة', price: 35000, category: 'أطباق رئيسية' },
      { name: 'سمك شيلو', description: 'شيلو طازج مقلي', price: 25000, category: 'أطباق رئيسية' },
      { name: 'مطبگ سمك', description: 'مطبگ محشو بالسمك والبصل والتوابل', price: 15000, category: 'مقبلات' },
      { name: 'شوربة سمك', description: 'حساء كريمي بالسمك والخضروات', price: 8000, category: 'شوربات' },
      { name: 'أرز بخاري', description: 'أرز مطبوخ بمرق السمك والزعفران', price: 5000, category: 'طبق جانبي' },
      { name: 'مشروب ليمون', description: 'ليمونادة طازجة', price: 2000, category: 'مشروبات' }
    ],
    reviews: [
      { author: 'حيدر الزبيدي', rating: 5, comment: 'والله المسگوف هنا ما يوصف! أفضل مطعم في البصرة' },
      { author: 'أم محمد', rating: 5, comment: 'نجي كل أسبوع، الطعم دايماً ثابت وممتاز' },
      { author: 'عمر القيسي', rating: 4, comment: 'رائع جداً، السمك طازج ومشوي بشكل مثالي' }
    ]
  },
  {
    name: 'مطعم الدار العراقية',
    type: 'مطعم',
    description: 'مطعم متخصص في الأكلات العراقية الأصيلة كالقوزي والدولمة والمسلات. أجواء عائلية دافئة بتصميم تراثي عراقي.',
    address: 'شارع أبو الخصيب، البصرة',
    phone: '07800998877',
    openHours: '12:00 م - 10:30 م',
    area: 'أبو الخصيب',
    features: ['أكلات تراثية', 'صالة حفلات', 'خدمة كاترينج', 'موقف سيارات'],
    images: [
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800',
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800',
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800'
    ],
    location: {
      lat: 30.4710,
      lng: 47.7500,
      mapUrl: 'https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d3578!2d47.7500!3d30.4710!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sar!2siq!4v3456'
    },
    menu: [
      { name: 'قوزي خروف', description: 'خروف كامل مشوي بالأرز والزبيب والمكسرات', price: 120000, category: 'أطباق رئيسية' },
      { name: 'دولمة', description: 'ورق عنب وخضروات محشوة باللحم والأرز', price: 18000, category: 'أطباق رئيسية' },
      { name: 'مسلات', description: 'لحم مشوي على الأسياخ', price: 22000, category: 'مشاوي' },
      { name: 'تمن باقلاء', description: 'أرز بالفول الأخضر والشبت', price: 8000, category: 'أطباق جانبية' },
      { name: 'شوربة عدس', description: 'شوربة عدس بالليمون والكمون', price: 5000, category: 'شوربات' }
    ],
    reviews: [
      { author: 'لقمان العباس', rating: 5, comment: 'القوزي هنا يذكرني بأكل أمي. طعم أصيل ورائع' },
      { author: 'هناء سعيد', rating: 4, comment: 'الدولمة ممتازة والخدمة لطيفة' }
    ]
  },
  {
    name: 'مطعم برغر البصرة',
    type: 'مطعم',
    description: 'أول مطعم برغر حرفي في البصرة يستخدم لحم بقر محلي طازج 100%. وجبات سريعة بجودة عالية وأسعار مناسبة.',
    address: 'شارع الجمهورية، البصرة',
    phone: '07709900112',
    openHours: '11:00 ص - 12:00 م',
    area: 'الجمهورية',
    features: ['لحم طازج يومياً', 'خدمة دليفري', 'مقاعد خارجية'],
    images: [
      'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
      'https://images.unsplash.com/photo-1550317138-10000687a72b?w=800',
      'https://images.unsplash.com/photo-1586816001966-79b736744398?w=800'
    ],
    location: {
      lat: 30.5200,
      lng: 47.7800,
      mapUrl: 'https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d3577!2d47.7800!3d30.5200!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sar!2siq!4v7890'
    },
    menu: [
      { name: 'برغر كلاسيك', description: '180غ لحم بقر، جبن، خس، طماطم', price: 14000, category: 'برغر' },
      { name: 'برغر دبل سموكي', description: 'دبل باتي مع صوص BBQ المدخن', price: 20000, category: 'برغر' },
      { name: 'دجاج كريسبي', description: 'فيليه دجاج مقرمش مع كول سلو', price: 15000, category: 'دجاج' },
      { name: 'بطاطس مقلية', description: 'بطاطس ذهبية مقرمشة', price: 5000, category: 'جانبيات' },
      { name: 'ميلك شيك', description: 'شوكولاتة أو فراولة أو فانيليا', price: 8000, category: 'مشروبات' }
    ],
    reviews: [
      { author: 'باسم طارق', rating: 4, comment: 'أفضل برغر أكلته في البصرة، اللحم طازج ومشوي صح' },
      { author: 'ريم جمال', rating: 5, comment: 'الدبل سموكي خيالي! الميلك شيك أيضاً ممتاز' }
    ]
  },

  // ===================== مزارع =====================
  {
    name: 'مزرعة النخيل الملكية',
    type: 'مزرعة',
    description: 'مزرعة نخيل أصيلة تمتد على مساحة 50 دونماً في قلب الأهوار البصرية. تنتج أجود أنواع التمر البصري الشهير، مفتوحة للزوار طوال موسم الحصاد.',
    address: 'قضاء القرنة، البصرة',
    phone: '07700445566',
    openHours: '8:00 ص - 6:00 م',
    area: 'القرنة',
    features: ['جولات سياحية', 'قطف التمر المباشر', 'بيع منتجات طازجة', 'جلسات تراثية', 'مرشد سياحي'],
    images: [
      'https://images.unsplash.com/photo-1504472478235-9bc48ba4d60f?w=800',
      'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800',
      'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=800'
    ],
    location: {
      lat: 31.0001,
      lng: 47.4376,
      mapUrl: 'https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d14293!2d47.4376!3d31.0001!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sar!2siq!4v1111'
    },
    menu: [
      { name: 'تمر زهدي', description: 'كيلو من أفضل أنواع التمر البصري', price: 15000, category: 'منتجات' },
      { name: 'تمر بريم', description: 'تمر بريم فاخر طازج', price: 20000, category: 'منتجات' },
      { name: 'دبس نخيل', description: 'دبس طبيعي 100% صنع يدوي', price: 12000, category: 'منتجات' },
      { name: 'جولة سياحية', description: 'جولة مع مرشد لساعتين داخل المزرعة', price: 10000, category: 'خدمات' }
    ],
    reviews: [
      { author: 'جاسم الربيعي', rating: 5, comment: 'تجربة رائعة! قطفت التمر بيدي والطعم لا يوصف' },
      { author: 'نور الأمين', rating: 5, comment: 'المزرعة جميلة جداً والمنتجات طبيعية 100%' },
      { author: 'سلمى خضير', rating: 4, comment: 'مكان رائع للعائلة، الجو الطبيعي خيالي' }
    ]
  },
  {
    name: 'مزرعة الأهوار الخضراء',
    type: 'مزرعة',
    description: 'مزرعة سياحية عائلية في منطقة الأهوار تجمع الزراعة التقليدية مع البيئة الطبيعية الفريدة. نزهات بالقارب في الأهوار بين القصب والبرديّ.',
    address: 'هور الحمّار، المدينة',
    phone: '07801234321',
    openHours: '7:00 ص - 5:00 م',
    area: 'شرق البصرة',
    features: ['نزهات بالقارب', 'مراقبة الطيور', 'بيوت القصب', 'وجبات تراثية', 'مخيم ليلي'],
    images: [
      'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800',
      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800',
      'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=800'
    ],
    location: {
      lat: 30.8500,
      lng: 47.5000,
      mapUrl: 'https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d14310!2d47.5000!3d30.8500!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sar!2siq!4v2222'
    },
    menu: [
      { name: 'جولة قارب', description: 'جولة بالقارب في الأهوار لمدة ساعة', price: 15000, category: 'أنشطة' },
      { name: 'وجبة تراثية', description: 'أرز وسمك وخبز طنور + شاي', price: 20000, category: 'طعام' },
      { name: 'مخيم ليلي', description: 'ليلة كاملة في بيت القصب مع وجبة', price: 75000, category: 'إقامة' }
    ],
    reviews: [
      { author: 'رائد الشمري', rating: 5, comment: 'جولة الأهوار كانت من أجمل تجارب حياتي!' },
      { author: 'دلال حمزة', rating: 4, comment: 'الطبيعة خلابة والناس طيبون' }
    ]
  },
  {
    name: 'مزرعة الفاكهة الجنوبية',
    type: 'مزرعة',
    description: 'مزرعة متكاملة لزراعة الفاكهة الاستوائية والحمضيات في جنوب العراق. تضم أكثر من 200 نوع من الفاكهة، وتقدم تجربة الزراعة المستدامة للزوار.',
    address: 'طريق الزبير، البصرة',
    phone: '07703344556',
    openHours: '8:00 ص - 5:00 م',
    area: 'الزبير',
    features: ['قطف الفاكهة', 'ورش زراعية', 'متجر المنتجات الطبيعية', 'منطقة شواء'],
    images: [
      'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=800',
      'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=800',
      'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=800'
    ],
    location: {
      lat: 30.3900,
      lng: 47.7060,
      mapUrl: 'https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d14310!2d47.7060!3d30.3900!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sar!2siq!4v3333'
    },
    menu: [
      { name: 'سلة فاكهة مشكلة', description: 'تشكيلة من أطيب فواكه المزرعة', price: 25000, category: 'منتجات' },
      { name: 'عصير طازج', description: 'عصير مباشر من الفاكهة المقطوفة', price: 5000, category: 'مشروبات' },
      { name: 'ورشة زراعة', description: 'تعلم زراعة النباتات لمدة 3 ساعات', price: 20000, category: 'أنشطة' }
    ],
    reviews: [
      { author: 'ياسمين الحلي', rating: 5, comment: 'تجربة رائعة للأطفال! أحبوا قطف الفاكهة' },
      { author: 'طارق منصور', rating: 4, comment: 'المنتجات طازجة جداً والمزرعة منظمة' }
    ]
  }
];

// ==============================
// تشغيل seed
// ==============================
const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // حذف البيانات القديمة
    await Place.deleteMany({});
    console.log('🗑️  Cleared existing places');

    // إدراج البيانات الجديدة
    const inserted = await Place.insertMany(places);
    console.log(`✅ Inserted ${inserted.length} places successfully`);

    // طباعة ملخص
    const types = {};
    inserted.forEach(p => { types[p.type] = (types[p.type] || 0) + 1; });
    console.log('\n📊 Summary:');
    Object.entries(types).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} أماكن`);
    });

    await mongoose.disconnect();
    console.log('\n🎉 Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

seedDatabase();
