import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const photo = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=640&q=85`;
async function seed() {
  await db.store.upsert({
    where: { id: 'indiranagar' },
    update: {},
    create: {
      id: 'indiranagar',
      name: 'Daybasket Indiranagar',
      latitude: 12.9784,
      longitude: 77.6408,
      radiusKm: 8,
    },
  });
  const categories = [
    ['produce', 'Fruits & vegetables', 'photo-1619566636858-adf3ef46400b', '#edf4dd'],
    ['dairy', 'Dairy, bread & eggs', 'photo-1563636619-e9143da7973b', '#fff2de'],
    ['pantry', 'Everyday essentials', 'photo-1515543904379-3d757afe72e4', '#f2eada'],
    ['snacks', 'Snacks & munchies', 'photo-1598373182133-52452f7691ef', '#f9e6da'],
    ['drinks', 'Drinks & juices', 'photo-1600271886742-f049cd451bba', '#e7f0e9'],
    ['breakfast', 'Breakfast favourites', 'photo-1517673400267-0251440c45dc', '#f1e6f1'],
    ['care', 'Home & personal care', 'photo-1608571423902-eed4a5ad8108', '#e3edf1'],
    ['frozen', 'Frozen & ready to eat', 'photo-1563805042-7684c019e1cb', '#f6e6e7'],
  ];
  for (const [id, name, img, color] of categories)
    await db.category.upsert({
      where: { id },
      update: {},
      create: { id, name, image: photo(img), color },
    });
  const products = [
    [
      'avocado',
      'Farm-fresh avocados',
      'produce',
      'The Good Farm',
      '2 pieces',
      11900,
      14900,
      'photo-1523049673857-eb18f1d7b578',
    ],
    [
      'milk',
      'Fresh whole milk',
      'dairy',
      'Farmstead',
      '1 litre',
      6800,
      7500,
      'photo-1563636619-e9143da7973b',
    ],
    [
      'sourdough',
      'Artisan sourdough loaf',
      'dairy',
      'Daily Bread',
      '400 g',
      14900,
      18000,
      'photo-1598373182133-52452f7691ef',
    ],
    [
      'bananas',
      'Naturally sweet bananas',
      'produce',
      'The Good Farm',
      '6 pieces',
      4900,
      6500,
      'photo-1571771894821-ce9b6c11b08e',
    ],
    [
      'eggs',
      'Free-range brown eggs',
      'dairy',
      'Happy Hens',
      '6 pieces',
      8900,
      11000,
      'photo-1518569656558-1f25e69d93d7',
    ],
    [
      'tomatoes',
      'Vine-ripened tomatoes',
      'produce',
      'The Good Farm',
      '500 g',
      3500,
      4500,
      'photo-1546094096-0df4bcaaa337',
    ],
    [
      'strawberries',
      'Sweet strawberries',
      'produce',
      'The Good Farm',
      '200 g',
      9900,
      12900,
      'photo-1464965911861-746a04b4bca6',
    ],
    [
      'oranges',
      'Juicy Nagpur oranges',
      'produce',
      'The Good Farm',
      '500 g',
      6500,
      8500,
      'photo-1547514701-42782101795e',
    ],
    [
      'oats',
      'Wholegrain rolled oats',
      'breakfast',
      'Honest Pantry',
      '500 g',
      15900,
      19900,
      'photo-1517673400267-0251440c45dc',
    ],
    [
      'juice',
      'Cold-pressed orange juice',
      'drinks',
      'Squeeze',
      '250 ml',
      8900,
      11000,
      'photo-1600271886742-f049cd451bba',
    ],
    [
      'cookies',
      'Chocolate chip cookies',
      'snacks',
      'Oven Stories',
      '200 g',
      12900,
      16000,
      'photo-1499636136210-6f4ee915583e',
    ],
    [
      'rice',
      'Premium basmati rice',
      'pantry',
      'Honest Pantry',
      '1 kg',
      16900,
      21000,
      'photo-1586201375761-83865001e31c',
    ],
    [
      'coffee',
      'Roasted filter coffee',
      'breakfast',
      'Morning Ritual',
      '200 g',
      24900,
      29900,
      'photo-1447933601403-0c6688de566e',
    ],
    [
      'soap',
      'Botanical hand wash',
      'care',
      'Everyday Kind',
      '250 ml',
      14900,
      19900,
      'photo-1608571423902-eed4a5ad8108',
    ],
    [
      'icecream',
      'Vanilla bean ice cream',
      'frozen',
      'Little Scoop',
      '500 ml',
      22900,
      28000,
      'photo-1563805042-7684c019e1cb',
    ],
    [
      'almonds',
      'Whole California almonds',
      'pantry',
      'Honest Pantry',
      '200 g',
      19900,
      24900,
      'photo-1508061253366-f7da158b6d46',
    ],
  ] as const;
  for (const [id, name, categoryId, brand, unit, price, mrp, img] of products) {
    await db.product.upsert({
      where: { id },
      update: {},
      create: {
        id,
        slug: id,
        name,
        categoryId,
        brand,
        unit,
        price,
        mrp,
        image: photo(img),
        description: `A little everyday goodness. Carefully selected ${name.toLowerCase()} from trusted suppliers, checked for quality and packed with care. Store as directed on the label. Prices include applicable taxes.`,
      },
    });
    await db.inventory.upsert({
      where: { storeId_productId: { storeId: 'indiranagar', productId: id } },
      update: {},
      create: { storeId: 'indiranagar', productId: id, available: 50 },
    });
  }
  if (process.env.NODE_ENV !== 'production')
    for (const [id, name, role, phone] of [
      ['demo-customer', 'Aarav Sharma', 'customer', '9876543210'],
      ['demo-admin', 'Store owner', 'super_admin', '9876543211'],
      ['demo-driver', 'Ravi Kumar', 'delivery', '9876543212'],
    ])
      await db.user.upsert({ where: { id }, update: {}, create: { id, name, role, phone } });
  await db.coupon.upsert({
    where: { code: 'HELLO10' },
    update: {},
    create: { code: 'HELLO10', discountBps: 1000, minimum: 29900, maximum: 10000 },
  });
  console.log(
    'Seeded Daybasket catalogue. Development accounts:',
    process.env.NODE_ENV !== 'production',
  );
}
seed().finally(() => db.$disconnect());
