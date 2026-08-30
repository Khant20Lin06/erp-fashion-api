import 'dotenv/config';
import {
  createScriptLogger,
  logScriptFailure,
} from '../../common/logging/script-logger';
import { AppDataSource } from '../data-source';
import { Company } from '../../modules/organization/entities/company.entity';
import { Branch } from '../../modules/organization/entities/branch.entity';
import { BranchStatus } from '../../modules/organization/entities/branch-status.enum';
import { Warehouse } from '../../modules/organization/entities/warehouse.entity';
import { WarehouseStatus } from '../../modules/organization/entities/warehouse-status.enum';
import { WarehouseType } from '../../modules/organization/entities/warehouse-type.enum';
import { Category } from '../../modules/master-data/entities/category.entity';
import { CategoryStatus } from '../../modules/master-data/entities/category-status.enum';
import { Brand } from '../../modules/master-data/entities/brand.entity';
import { BrandStatus } from '../../modules/master-data/entities/brand-status.enum';
import { Collection } from '../../modules/master-data/entities/collection.entity';
import { CollectionStatus } from '../../modules/master-data/entities/collection-status.enum';
import { AttributeOption } from '../../modules/master-data/entities/attribute-option.entity';
import { AttributeOptionStatus } from '../../modules/master-data/entities/attribute-option-status.enum';
import { AttributeKind } from '../../modules/master-data/entities/attribute-kind.enum';
import { Product } from '../../modules/products/entities/product.entity';
import { ProductStatus } from '../../modules/products/entities/product-status.enum';
import { ProductType } from '../../modules/products/entities/product-type.enum';
import { ProductVariant } from '../../modules/products/entities/product-variant.entity';
import { ProductVariantStatus } from '../../modules/products/entities/product-variant-status.enum';
import { ProductVariantAttribute } from '../../modules/products/entities/product-variant-attribute.entity';
import { PriceList } from '../../modules/products/entities/price-list.entity';
import { PriceListStatus } from '../../modules/products/entities/price-list-status.enum';
import { PriceListItem } from '../../modules/products/entities/price-list-item.entity';
import { PriceListItemStatus } from '../../modules/products/entities/price-list-item-status.enum';
import { Customer } from '../../modules/customer-supplier/entities/customer.entity';
import { CustomerStatus } from '../../modules/customer-supplier/entities/customer-status.enum';
import { Supplier } from '../../modules/customer-supplier/entities/supplier.entity';
import { SupplierStatus } from '../../modules/customer-supplier/entities/supplier-status.enum';
import { WarehouseStock } from '../../modules/inventory/entities/warehouse-stock.entity';
import { Sale } from '../../modules/sales/entities/sale.entity';
import { SaleStatus } from '../../modules/sales/entities/sale-status.enum';
import { SaleType } from '../../modules/sales/entities/sale-type.enum';

const logger = createScriptLogger('BulkSeed');
import { SaleItem } from '../../modules/sales/entities/sale-item.entity';
import { User } from '../../modules/users/entities/user.entity';
import { FindOptionsWhere, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  ATTRIBUTE_OPTION_CATALOG,
  findAttributeCatalogEntry,
} from './attribute-option.catalog';
import { computeCombinationKey } from '../../modules/products/utils/combination-key';

async function findSeedRow<T extends object>(
  repo: Repository<T>,
  where: FindOptionsWhere<T>,
): Promise<T | null> {
  const entity = await repo.findOne({ where, withDeleted: true });
  const restorable = entity as (T & { deletedAt?: Date | null }) | null;
  if (restorable?.deletedAt) {
    restorable.deletedAt = null;
    return repo.save(restorable as T);
  }
  return entity;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function price(min: number, max: number): string {
  return (Math.random() * (max - min) + min).toFixed(2);
}
function pad(n: number, digits = 4): string {
  return String(n).padStart(digits, '0');
}

// ── catalogue data ────────────────────────────────────────────────────────────
const PRODUCT_TEMPLATES = [
  {
    name: 'Classic Denim Jacket',
    cat: 'MENS',
    brand: 'LEVIS',
    cost: 60,
    sell: 120,
  },
  {
    name: 'Slim Fit Chino Trousers',
    cat: 'MENS',
    brand: 'ZARA',
    cost: 25,
    sell: 59,
  },
  {
    name: 'Oxford Button-Down Shirt',
    cat: 'MENS',
    brand: 'POLO',
    cost: 18,
    sell: 45,
  },
  {
    name: 'Merino Wool Sweater',
    cat: 'MENS',
    brand: 'GUCCI',
    cost: 80,
    sell: 195,
  },
  {
    name: 'Athletic Running Shorts',
    cat: 'MENS',
    brand: 'NIKE',
    cost: 12,
    sell: 35,
  },
  {
    name: 'Floral Summer Silk Dress',
    cat: 'WOMENS',
    brand: 'ZARA',
    cost: 55,
    sell: 149,
  },
  {
    name: 'High-Waist Yoga Leggings',
    cat: 'WOMENS',
    brand: 'NIKE',
    cost: 20,
    sell: 65,
  },
  {
    name: 'Cashmere Turtleneck',
    cat: 'WOMENS',
    brand: 'GUCCI',
    cost: 120,
    sell: 299,
  },
  {
    name: 'Linen Wrap Skirt',
    cat: 'WOMENS',
    brand: 'ZARA',
    cost: 18,
    sell: 49,
  },
  {
    name: 'Oversized Blazer',
    cat: 'WOMENS',
    brand: 'POLO',
    cost: 65,
    sell: 155,
  },
  {
    name: 'Leather Biker Jacket',
    cat: 'MENS',
    brand: 'LEVIS',
    cost: 140,
    sell: 349,
  },
  {
    name: 'Graphic Tee – City Edition',
    cat: 'MENS',
    brand: 'NIKE',
    cost: 8,
    sell: 28,
  },
  {
    name: 'Cargo Utility Pants',
    cat: 'MENS',
    brand: 'LEVIS',
    cost: 30,
    sell: 79,
  },
  {
    name: 'Ribbed Knit Cardigan',
    cat: 'WOMENS',
    brand: 'ZARA',
    cost: 28,
    sell: 75,
  },
  {
    name: 'Satin Slip Blouse',
    cat: 'WOMENS',
    brand: 'GUCCI',
    cost: 45,
    sell: 115,
  },
  { name: 'Puffer Down Vest', cat: 'MENS', brand: 'NIKE', cost: 38, sell: 95 },
  {
    name: 'Lace Trim Cami Top',
    cat: 'WOMENS',
    brand: 'ZARA',
    cost: 14,
    sell: 39,
  },
  {
    name: 'Tailored Wool Coat',
    cat: 'WOMENS',
    brand: 'GUCCI',
    cost: 180,
    sell: 450,
  },
  {
    name: 'Stretch Denim Jeans',
    cat: 'MENS',
    brand: 'LEVIS',
    cost: 32,
    sell: 89,
  },
  {
    name: 'Performance Track Jacket',
    cat: 'MENS',
    brand: 'NIKE',
    cost: 42,
    sell: 110,
  },
  { name: 'Cropped Hoodie', cat: 'WOMENS', brand: 'NIKE', cost: 22, sell: 59 },
  {
    name: 'Embroidered Polo Shirt',
    cat: 'MENS',
    brand: 'POLO',
    cost: 20,
    sell: 55,
  },
  {
    name: 'Sequin Party Dress',
    cat: 'WOMENS',
    brand: 'GUCCI',
    cost: 95,
    sell: 245,
  },
  {
    name: 'Cotton Canvas Tote Bag',
    cat: 'ACCES',
    brand: 'ZARA',
    cost: 8,
    sell: 22,
  },
  {
    name: 'Leather Belt – Classic',
    cat: 'ACCES',
    brand: 'POLO',
    cost: 15,
    sell: 45,
  },
  {
    name: 'Silk Pocket Square',
    cat: 'ACCES',
    brand: 'GUCCI',
    cost: 25,
    sell: 75,
  },
  {
    name: 'Knitted Beanie Hat',
    cat: 'ACCES',
    brand: 'NIKE',
    cost: 7,
    sell: 20,
  },
  {
    name: 'Leather Crossbody Bag',
    cat: 'ACCES',
    brand: 'GUCCI',
    cost: 120,
    sell: 310,
  },
  {
    name: 'Sports Socks 3-Pack',
    cat: 'ACCES',
    brand: 'NIKE',
    cost: 5,
    sell: 15,
  },
  {
    name: 'Floral Print Scarf',
    cat: 'ACCES',
    brand: 'ZARA',
    cost: 10,
    sell: 30,
  },
  {
    name: 'Velvet Hair Scrunchie Set',
    cat: 'ACCES',
    brand: 'ZARA',
    cost: 3,
    sell: 10,
  },
  {
    name: 'Linen Beach Shorts',
    cat: 'MENS',
    brand: 'POLO',
    cost: 16,
    sell: 42,
  },
  {
    name: 'Strappy Sundress',
    cat: 'WOMENS',
    brand: 'ZARA',
    cost: 20,
    sell: 55,
  },
  {
    name: 'Tie-Dye Sweatshirt',
    cat: 'WOMENS',
    brand: 'NIKE',
    cost: 25,
    sell: 65,
  },
  {
    name: 'Formal Suit Jacket',
    cat: 'MENS',
    brand: 'GUCCI',
    cost: 220,
    sell: 550,
  },
  {
    name: 'Wide-Leg Trousers',
    cat: 'WOMENS',
    brand: 'POLO',
    cost: 38,
    sell: 99,
  },
  {
    name: 'Quilted Shoulder Bag',
    cat: 'ACCES',
    brand: 'GUCCI',
    cost: 95,
    sell: 240,
  },
  {
    name: 'Recycled Denim Shorts',
    cat: 'MENS',
    brand: 'LEVIS',
    cost: 22,
    sell: 58,
  },
  {
    name: 'Asymmetric Hem Blouse',
    cat: 'WOMENS',
    brand: 'ZARA',
    cost: 17,
    sell: 46,
  },
  {
    name: 'Fleece Zip-Up Hoodie',
    cat: 'MENS',
    brand: 'NIKE',
    cost: 30,
    sell: 79,
  },
  {
    name: 'Pleated Midi Skirt',
    cat: 'WOMENS',
    brand: 'POLO',
    cost: 28,
    sell: 72,
  },
  {
    name: 'Printed Silk Tie',
    cat: 'ACCES',
    brand: 'GUCCI',
    cost: 35,
    sell: 90,
  },
  {
    name: 'Reversible Bucket Hat',
    cat: 'ACCES',
    brand: 'NIKE',
    cost: 9,
    sell: 26,
  },
  {
    name: 'Corduroy Shirt Jacket',
    cat: 'MENS',
    brand: 'LEVIS',
    cost: 45,
    sell: 119,
  },
  {
    name: 'Padded Gilet Vest',
    cat: 'WOMENS',
    brand: 'ZARA',
    cost: 30,
    sell: 78,
  },
  { name: 'Monogram Tote', cat: 'ACCES', brand: 'GUCCI', cost: 150, sell: 380 },
  {
    name: 'Boardshort Swim Trunks',
    cat: 'MENS',
    brand: 'POLO',
    cost: 14,
    sell: 38,
  },
  {
    name: 'Velvet Blazer',
    cat: 'WOMENS',
    brand: 'GUCCI',
    cost: 110,
    sell: 275,
  },
  {
    name: 'Organic Cotton T-Shirt',
    cat: 'MENS',
    brand: 'POLO',
    cost: 10,
    sell: 29,
  },
  {
    name: 'Chain Strap Mini Bag',
    cat: 'ACCES',
    brand: 'GUCCI',
    cost: 85,
    sell: 215,
  },
];

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const COLORS = ['Black', 'White', 'Navy', 'Red', 'Green', 'Beige', 'Grey'];

const FIRST_NAMES = [
  'Alice',
  'Bob',
  'Carol',
  'David',
  'Eva',
  'Frank',
  'Grace',
  'Henry',
  'Iris',
  'Jack',
  'Karen',
  'Leo',
  'Mia',
  'Nathan',
  'Olivia',
  'Peter',
  'Quinn',
  'Rachel',
  'Sam',
  'Tina',
  'Uma',
  'Victor',
  'Wendy',
  'Xander',
  'Yara',
  'Zoe',
  'Aaron',
  'Beth',
  'Carl',
  'Diana',
  'Eric',
  'Fiona',
  'George',
  'Helen',
  'Ivan',
  'Julia',
  'Kyle',
  'Laura',
  'Mike',
  'Nina',
  'Oscar',
  'Paula',
  'Roger',
  'Susan',
  'Tom',
  'Una',
  'Vera',
  'Will',
  'Xena',
  'Yusuf',
];
const LAST_NAMES = [
  'Smith',
  'Jones',
  'Williams',
  'Brown',
  'Taylor',
  'Davies',
  'Wilson',
  'Evans',
  'Thomas',
  'Roberts',
  'Johnson',
  'Lewis',
  'Walker',
  'Robinson',
  'Wood',
  'Thompson',
  'White',
  'Watson',
  'Jackson',
  'Harris',
  'Martin',
  'Garcia',
  'Martinez',
  'Anderson',
  'Lee',
  'Perez',
  'Hall',
  'Young',
  'King',
  'Wright',
  'Chen',
  'Zhang',
  'Wang',
  'Liu',
  'Yang',
  'Kim',
  'Park',
  'Choi',
  'Nguyen',
  'Tran',
  'Patel',
  'Shah',
  'Kumar',
  'Singh',
  'Sharma',
  'Kaur',
  'Ali',
  'Khan',
  'Ahmed',
  'Hussain',
];

const SALE_STATUSES = [
  SaleStatus.Confirmed,
  SaleStatus.Confirmed,
  SaleStatus.Confirmed,
  SaleStatus.Draft,
];

// ─────────────────────────────────────────────────────────────────────────────

async function bulkSeed() {
  await AppDataSource.initialize();
  logger.log('Bulk seed starting.');

  const companyRepo = AppDataSource.getRepository(Company);
  const branchRepo = AppDataSource.getRepository(Branch);
  const warehouseRepo = AppDataSource.getRepository(Warehouse);
  const categoryRepo = AppDataSource.getRepository(Category);
  const brandRepo = AppDataSource.getRepository(Brand);
  const collectionRepo = AppDataSource.getRepository(Collection);
  const attributeOptionRepo = AppDataSource.getRepository(AttributeOption);
  const productRepo = AppDataSource.getRepository(Product);
  const variantRepo = AppDataSource.getRepository(ProductVariant);
  const variantAttributeRepo = AppDataSource.getRepository(
    ProductVariantAttribute,
  );
  const priceListRepo = AppDataSource.getRepository(PriceList);
  const priceListItemRepo = AppDataSource.getRepository(PriceListItem);
  const customerRepo = AppDataSource.getRepository(Customer);
  const supplierRepo = AppDataSource.getRepository(Supplier);
  const stockRepo = AppDataSource.getRepository(WarehouseStock);
  const saleRepo = AppDataSource.getRepository(Sale);
  const saleItemRepo = AppDataSource.getRepository(SaleItem);
  const userRepo = AppDataSource.getRepository(User);

  // ── resolve company ────────────────────────────────────────────────────────
  const company = await findSeedRow(companyRepo, { code: 'FASHION-ENT-MAIN' });
  if (!company) {
    logger.error('Company not found. Run enterprise.seed.ts first.');
    process.exit(1);
  }
  logger.log(`Using company: ${company.name}`);

  const adminUser = await userRepo.findOne({
    where: { email: 'admin@fashionerp.com' },
  });
  const optionCache = new Map<string, AttributeOption>();
  const optionCacheKey = (kind: string, value: string) =>
    `${kind}:${value.toLowerCase()}`;

  const ensureAttributeOption = async (
    kind: AttributeKind.Color | AttributeKind.Size,
    rawValue: string,
  ): Promise<AttributeOption> => {
    const spec = findAttributeCatalogEntry(kind, rawValue);
    if (!spec) {
      throw new Error(
        `No attribute catalog entry found for ${kind}:${rawValue}`,
      );
    }

    const cached = optionCache.get(optionCacheKey(spec.kind, spec.value));
    if (cached) return cached;

    let option = await findSeedRow(attributeOptionRepo, {
      companyId: company.id,
      code: spec.code,
    });

    if (!option) {
      option = attributeOptionRepo.create({
        id: uuidv4(),
        companyId: company.id,
        code: spec.code,
        kind: spec.kind,
        value: spec.value,
        swatch: spec.swatch ?? null,
        sortOrder: spec.sortOrder,
        status: AttributeOptionStatus.Active,
      });
    } else {
      option.kind = spec.kind;
      option.value = spec.value;
      option.swatch = spec.swatch ?? null;
      option.sortOrder = spec.sortOrder;
      option.status = AttributeOptionStatus.Active;
    }

    option = await attributeOptionRepo.save(option);
    optionCache.set(optionCacheKey(option.kind, option.value), option);
    return option;
  };

  // ── resolve / create branches ──────────────────────────────────────────────
  const branchDefs = [
    {
      code: 'BR-YGN-MAIN',
      name: 'Yangon Flagship',
      address: 'Junction City, Level 2, Yangon',
    },
    {
      code: 'BR-MDY-CENTRAL',
      name: 'Mandalay Central',
      address: '78th St, Mandalay',
    },
    {
      code: 'BR-NPT-MALL',
      name: 'Naypyidaw Mall',
      address: 'Junction Square, Naypyidaw',
    },
  ];
  const branches: Branch[] = [];
  for (const bd of branchDefs) {
    let b = await findSeedRow(branchRepo, {
      code: bd.code,
      companyId: company.id,
    });
    if (!b) {
      b = await branchRepo.save(
        branchRepo.create({
          id: uuidv4(),
          companyId: company.id,
          code: bd.code,
          name: bd.name,
          status: BranchStatus.Active,
          address: bd.address,
        }),
      );
    }
    branches.push(b);
  }
  logger.log(`Branches ready: ${branches.length}`);

  // ── resolve / create warehouses ────────────────────────────────────────────
  const warehouseDefs = [
    {
      code: 'WH-YGN-CENTRAL',
      name: 'Yangon Central Warehouse',
      branchIdx: 0,
      type: WarehouseType.Main,
    },
    {
      code: 'WH-MDY-STORE',
      name: 'Mandalay Store Warehouse',
      branchIdx: 1,
      type: WarehouseType.Store,
    },
    {
      code: 'WH-NPT-STORE',
      name: 'Naypyidaw Store Warehouse',
      branchIdx: 2,
      type: WarehouseType.Store,
    },
  ];
  const warehouses: Warehouse[] = [];
  for (const wd of warehouseDefs) {
    let w = await findSeedRow(warehouseRepo, {
      code: wd.code,
      companyId: company.id,
    });
    if (!w) {
      w = await warehouseRepo.save(
        warehouseRepo.create({
          id: uuidv4(),
          companyId: company.id,
          branchId: branches[wd.branchIdx].id,
          code: wd.code,
          name: wd.name,
          status: WarehouseStatus.Active,
          type: wd.type,
        }),
      );
    }
    warehouses.push(w);
  }
  logger.log(`Warehouses ready: ${warehouses.length}`);

  // ── resolve / create categories ────────────────────────────────────────────
  const categoryDefs = [
    { code: 'CAT-APPAR-MEN', name: "Men's Apparel" },
    { code: 'CAT-APPAR-WOMEN', name: "Women's Fashion" },
    { code: 'CAT-ACCESSORIES', name: 'Accessories & Bags' },
    { code: 'CAT-ACTIVEWEAR', name: 'Activewear & Sport' },
    { code: 'CAT-OUTERWEAR', name: 'Outerwear & Jackets' },
  ];
  const categoriesMap: Record<string, Category> = {};
  const catKeyMap: Record<string, string> = {
    MENS: 'CAT-APPAR-MEN',
    WOMENS: 'CAT-APPAR-WOMEN',
    ACCES: 'CAT-ACCESSORIES',
  };
  for (const cd of categoryDefs) {
    let cat = await findSeedRow(categoryRepo, {
      code: cd.code,
      companyId: company.id,
    });
    if (!cat) {
      cat = await categoryRepo.save(
        categoryRepo.create({
          id: uuidv4(),
          companyId: company.id,
          code: cd.code,
          name: cd.name,
          status: CategoryStatus.Active,
        }),
      );
    }
    categoriesMap[cd.code] = cat;
  }
  logger.log(`Categories ready: ${Object.keys(categoriesMap).length}`);

  // ── resolve / create brands ────────────────────────────────────────────────
  const brandDefs = [
    { code: 'BRD-GUCCI', name: 'Gucci' },
    { code: 'BRD-ZARA', name: 'Zara Fashion' },
    { code: 'BRD-LEVIS', name: "Levi's Denim" },
    { code: 'BRD-NIKE', name: 'Nike Sportswear' },
    { code: 'BRD-POLO', name: 'Polo Ralph Lauren' },
  ];
  const brandsMap: Record<string, Brand> = {};
  for (const bd of brandDefs) {
    let br = await findSeedRow(brandRepo, {
      code: bd.code,
      companyId: company.id,
    });
    if (!br) {
      br = await brandRepo.save(
        brandRepo.create({
          id: uuidv4(),
          companyId: company.id,
          code: bd.code,
          name: bd.name,
          status: BrandStatus.Active,
        }),
      );
    }
    brandsMap[bd.code] = br;
  }
  logger.log(`Brands ready: ${Object.keys(brandsMap).length}`);

  // ── collections ────────────────────────────────────────────────────────────
  const collectionDefs = [
    { code: 'COL-SUMMER-2026', name: 'Summer 2026' },
    { code: 'COL-AUTUMN-2026', name: 'Autumn/Winter 2026' },
    { code: 'COL-SALE-2026', name: 'Season Sale 2026' },
  ];
  const collections: Collection[] = [];
  for (const cd of collectionDefs) {
    let col = await findSeedRow(collectionRepo, {
      code: cd.code,
      companyId: company.id,
    });
    if (!col) {
      col = await collectionRepo.save(
        collectionRepo.create({
          id: uuidv4(),
          companyId: company.id,
          code: cd.code,
          name: cd.name,
          status: CollectionStatus.Active,
        }),
      );
    }
    collections.push(col);
  }

  // ── price list ─────────────────────────────────────────────────────────────
  for (const spec of ATTRIBUTE_OPTION_CATALOG) {
    await ensureAttributeOption(spec.kind, spec.value);
  }

  let priceList = await findSeedRow(priceListRepo, {
    code: 'PL-RETAIL-USD',
    companyId: company.id,
  });
  if (!priceList) {
    priceList = await priceListRepo.save(
      priceListRepo.create({
        id: uuidv4(),
        companyId: company.id,
        code: 'PL-RETAIL-USD',
        name: 'Standard Retail Price List',
        currency: 'USD',
        status: PriceListStatus.Active,
      }),
    );
  }

  // ── products (50) ──────────────────────────────────────────────────────────
  const allVariants: ProductVariant[] = [];
  let createdProducts = 0;

  for (let i = 0; i < PRODUCT_TEMPLATES.length; i++) {
    const tmpl = PRODUCT_TEMPLATES[i];
    const pCode = `PROD-BULK-${pad(i + 1, 3)}`;
    let product = await findSeedRow(productRepo, {
      code: pCode,
      companyId: company.id,
    });

    if (!product) {
      const catCode = catKeyMap[tmpl.cat] ?? 'CAT-APPAR-MEN';
      product = await productRepo.save(
        productRepo.create({
          id: uuidv4(),
          companyId: company.id,
          code: pCode,
          name: tmpl.name,
          productType: ProductType.Variant,
          categoryId: categoriesMap[catCode]?.id,
          brandId: brandsMap[`BRD-${tmpl.brand}`]?.id,
          collectionId: pick(collections).id,
          status: ProductStatus.Active,
          description: `${tmpl.name} — premium quality fashion item.`,
        }),
      );
      createdProducts++;
    }

    // 2–3 variants per product
    const numVariants = rand(2, 3);
    const usedCombos = new Set<string>();
    for (let v = 0; v < numVariants; v++) {
      let color: string, size: string, combo: string;
      do {
        color = pick(COLORS);
        size = pick(SIZES);
        combo = `${color}-${size}`;
      } while (usedCombos.has(combo));
      usedCombos.add(combo);

      const vSku = `${pCode}-${color.slice(0, 3).toUpperCase()}-${size}`;
      const colorOption = await ensureAttributeOption(
        AttributeKind.Color,
        color,
      );
      const sizeOption = await ensureAttributeOption(AttributeKind.Size, size);
      const combinationKey = computeCombinationKey([
        colorOption.id,
        sizeOption.id,
      ]);
      let variant = await findSeedRow(variantRepo, {
        sku: vSku,
        companyId: company.id,
      });
      if (!variant) {
        const sellingPrice = price(tmpl.sell * 0.9, tmpl.sell * 1.1);
        const costPrice = price(tmpl.cost * 0.9, tmpl.cost * 1.1);
        variant = await variantRepo.save(
          variantRepo.create({
            id: uuidv4(),
            companyId: company.id,
            productId: product.id,
            sku: vSku,
            combinationKey,
            costPrice,
            sellingPrice,
            status: ProductVariantStatus.Active,
          }),
        );

        // Price list item
        const existingPli = await findSeedRow(priceListItemRepo, {
          priceListId: priceList.id,
          productVariantId: variant.id,
        });
        if (!existingPli) {
          await priceListItemRepo.save(
            priceListItemRepo.create({
              id: uuidv4(),
              companyId: company.id,
              priceListId: priceList.id,
              productVariantId: variant.id,
              price: sellingPrice,
              status: PriceListItemStatus.Active,
              validFrom: new Date('2026-01-01'),
            }),
          );
        }

        // Stock in all warehouses
        for (const wh of warehouses) {
          const existingStock = await findSeedRow(stockRepo, {
            warehouseId: wh.id,
            productVariantId: variant.id,
          });
          if (!existingStock) {
            await stockRepo.save(
              stockRepo.create({
                id: uuidv4(),
                warehouseId: wh.id,
                productVariantId: variant.id,
                onHandQuantity: rand(20, 200),
                reservedQuantity: 0,
              }),
            );
          }
        }
      } else if (variant.combinationKey !== combinationKey) {
        variant.combinationKey = combinationKey;
        variant = await variantRepo.save(variant);
      }

      const existingAttributes = await variantAttributeRepo.find({
        where: { variantId: variant.id },
      });
      const existingColor = existingAttributes.find(
        (attribute) => attribute.kind === AttributeKind.Color,
      );
      const existingSize = existingAttributes.find(
        (attribute) => attribute.kind === AttributeKind.Size,
      );

      if (
        existingAttributes.length !== 2 ||
        existingColor?.optionId !== colorOption.id ||
        existingSize?.optionId !== sizeOption.id
      ) {
        await variantAttributeRepo.delete({ variantId: variant.id });
        await variantAttributeRepo.save([
          variantAttributeRepo.create({
            id: uuidv4(),
            variantId: variant.id,
            optionId: colorOption.id,
            kind: AttributeKind.Color,
          }),
          variantAttributeRepo.create({
            id: uuidv4(),
            variantId: variant.id,
            optionId: sizeOption.id,
            kind: AttributeKind.Size,
          }),
        ]);
      }
      allVariants.push(variant);
    }
  }
  logger.log(
    `Products seeded (${createdProducts} new). Total variants: ${allVariants.length}`,
  );

  // ── customers (50) ────────────────────────────────────────────────────────
  const customers: Customer[] = [];
  let createdCustomers = 0;

  for (let i = 0; i < 50; i++) {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@fashionclient.com`;
    const custCode = `CUST-${pad(i + 2)}`; // CUST-0002..CUST-0051

    let cust = await findSeedRow(customerRepo, {
      email,
      companyId: company.id,
    });
    if (!cust) {
      cust = await customerRepo.save(
        customerRepo.create({
          id: uuidv4(),
          companyId: company.id,
          customerCode: custCode,
          name: `${firstName} ${lastName}`,
          email,
          phone: `+959${rand(700000000, 799999999)}`,
          status: CustomerStatus.Active,
          creditLimit: price(500, 5000),
        }),
      );
      createdCustomers++;
    }
    customers.push(cust);
  }
  logger.log(
    `Customers seeded (${createdCustomers} new). Total: ${customers.length}`,
  );

  // ── suppliers (10) ────────────────────────────────────────────────────────
  const supplierDefs = [
    {
      code: 'SUPP-0001',
      name: 'Textile Global Mills Ltd.',
      email: 'orders@textileglobal.com',
    },
    {
      code: 'SUPP-0002',
      name: 'Yangon Fashion Fabrics Co.',
      email: 'supply@ygfabrics.com',
    },
    {
      code: 'SUPP-0003',
      name: 'Bangkok Thread & Weave',
      email: 'sales@bkk-thread.co.th',
    },
    {
      code: 'SUPP-0004',
      name: 'Shenzhen Garment Factory',
      email: 'export@szgarment.cn',
    },
    {
      code: 'SUPP-0005',
      name: 'Milan Couture Supplies',
      email: 'b2b@milancouture.it',
    },
    {
      code: 'SUPP-0006',
      name: 'Delhi Embroidery House',
      email: 'orders@delhiembroidery.in',
    },
    {
      code: 'SUPP-0007',
      name: 'Istanbul Denim Co.',
      email: 'sales@istdenim.com.tr',
    },
    {
      code: 'SUPP-0008',
      name: 'Ho Chi Minh Stitching Co.',
      email: 'hcm@stitchingco.vn',
    },
    {
      code: 'SUPP-0009',
      name: 'Dhaka Knitwear Exports Ltd.',
      email: 'export@dknitwear.bd',
    },
    {
      code: 'SUPP-0010',
      name: 'Jakarta Batik & Silk Studio',
      email: 'studio@jakartabatik.id',
      country: 'Indonesia',
    },
  ];
  for (const sd of supplierDefs) {
    const exists = await findSeedRow(supplierRepo, {
      email: sd.email,
      companyId: company.id,
    });
    if (!exists) {
      await supplierRepo.save(
        supplierRepo.create({
          id: uuidv4(),
          companyId: company.id,
          supplierCode: sd.code,
          name: sd.name,
          email: sd.email,
          country: sd.country,
          phone: `+959${rand(700000000, 799999999)}`,
          status: SupplierStatus.Active,
        }),
      );
    }
  }
  logger.log('Suppliers ready.');

  // ── sales orders (50) ─────────────────────────────────────────────────────
  // Get all existing variants from DB to ensure we have valid IDs
  const dbVariants = await variantRepo.find({
    where: { companyId: company.id },
  });
  if (dbVariants.length === 0) {
    logger.error('No variants found. Cannot create sales orders.');
    await AppDataSource.destroy();
    process.exit(1);
  }

  let createdSales = 0;
  const existingSaleCount = await saleRepo.count({
    where: { companyId: company.id },
  });

  for (let i = 0; i < 50; i++) {
    const saleNumber = `SO-2026-${pad(1002 + i)}`;
    const exists = await findSeedRow(saleRepo, {
      saleNumber,
      companyId: company.id,
    });
    if (exists) continue;

    const customer = pick(customers);
    const branch = pick(branches);
    const warehouse = pick(warehouses);
    const status = pick(SALE_STATUSES);
    const numItems = rand(1, 4);
    const daysAgo = rand(0, 90);
    const txDate = new Date(Date.now() - daysAgo * 86400_000);

    // Build line items
    const lineItems: Array<{ variant: ProductVariant; qty: number }> = [];
    const usedVariantIds = new Set<string>();
    for (let j = 0; j < numItems; j++) {
      let v: ProductVariant;
      let attempts = 0;
      do {
        v = pick(dbVariants);
        attempts++;
      } while (usedVariantIds.has(v.id) && attempts < 20);
      usedVariantIds.add(v.id);
      lineItems.push({ variant: v, qty: rand(1, 5) });
    }

    let subtotal = 0;
    for (const li of lineItems) {
      subtotal += parseFloat(li.variant.sellingPrice) * li.qty;
    }
    const taxAmount = subtotal * 0.05;
    const grandTotal = subtotal + taxAmount;
    const isPaid = status === SaleStatus.Confirmed;

    let sale = saleRepo.create({
      id: uuidv4(),
      companyId: company.id,
      branchId: branch.id,
      warehouseId: warehouse.id,
      saleNumber,
      saleType: rand(0, 1) === 0 ? SaleType.Pos : SaleType.Retail,
      customerId: customer.id,
      transactionDate: txDate,
      status,
      subtotal: subtotal.toFixed(2),
      discountAmount: '0.00',
      taxAmount: taxAmount.toFixed(2),
      grandTotal: grandTotal.toFixed(2),
      paidAmount: isPaid ? grandTotal.toFixed(2) : '0.00',
      balanceAmount: isPaid ? '0.00' : grandTotal.toFixed(2),
      currency: 'USD',
      notes: `Bulk seeded sale #${i + 1}`,
      createdBy: adminUser?.id ?? null,
    });
    sale = await saleRepo.save(sale);

    for (const li of lineItems) {
      const lineTotal = parseFloat(li.variant.sellingPrice) * li.qty * 1.05;
      await saleItemRepo.save(
        saleItemRepo.create({
          id: uuidv4(),
          saleId: sale.id,
          productVariantId: li.variant.id,
          quantity: li.qty,
          unitPriceSnapshot: li.variant.sellingPrice,
          discountSnapshot: '0.00',
          taxSnapshot: (parseFloat(li.variant.sellingPrice) * 0.05).toFixed(2),
          lineTotal: lineTotal.toFixed(2),
          productNameSnapshot: `Product Variant ${li.variant.sku}`,
          skuSnapshot: li.variant.sku,
        }),
      );
    }
    createdSales++;
  }
  logger.log(
    `Sales orders seeded (${createdSales} new). Total in DB: ${existingSaleCount + createdSales}`,
  );

  await AppDataSource.destroy();
  logger.log('Bulk seeding completed successfully.');
}

bulkSeed().catch((err) => {
  logScriptFailure('Bulk seeding failed', err, logger);
  process.exit(1);
});
