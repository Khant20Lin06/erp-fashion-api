import 'dotenv/config';
import { AppDataSource } from '../data-source';
import { Company } from '../../modules/organization/entities/company.entity';
import { CompanyStatus } from '../../modules/organization/entities/company-status.enum';
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
import { Product } from '../../modules/products/entities/product.entity';
import { ProductStatus } from '../../modules/products/entities/product-status.enum';
import { ProductType } from '../../modules/products/entities/product-type.enum';
import { ProductVariant } from '../../modules/products/entities/product-variant.entity';
import { ProductVariantStatus } from '../../modules/products/entities/product-variant-status.enum';
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
import { SaleItem } from '../../modules/sales/entities/sale-item.entity';
import { User } from '../../modules/users/entities/user.entity';
import { UserCompany } from '../../modules/organization/entities/user-company.entity';
import { MembershipStatus } from '../../modules/organization/entities/membership-status.enum';
import { FindOptionsWhere, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ATTRIBUTE_OPTION_CATALOG } from './attribute-option.catalog';

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

async function seedEnterpriseData() {
  await AppDataSource.initialize();
  console.log('--- Connecting Database for Enterprise Data Seeding ---');

  const companyRepo = AppDataSource.getRepository(Company);
  const branchRepo = AppDataSource.getRepository(Branch);
  const warehouseRepo = AppDataSource.getRepository(Warehouse);
  const categoryRepo = AppDataSource.getRepository(Category);
  const brandRepo = AppDataSource.getRepository(Brand);
  const collectionRepo = AppDataSource.getRepository(Collection);
  const attributeOptionRepo = AppDataSource.getRepository(AttributeOption);
  const productRepo = AppDataSource.getRepository(Product);
  const variantRepo = AppDataSource.getRepository(ProductVariant);
  const priceListRepo = AppDataSource.getRepository(PriceList);
  const priceListItemRepo = AppDataSource.getRepository(PriceListItem);
  const customerRepo = AppDataSource.getRepository(Customer);
  const supplierRepo = AppDataSource.getRepository(Supplier);
  const stockRepo = AppDataSource.getRepository(WarehouseStock);
  const saleRepo = AppDataSource.getRepository(Sale);
  const saleItemRepo = AppDataSource.getRepository(SaleItem);
  const userRepo = AppDataSource.getRepository(User);
  const userCompanyRepo = AppDataSource.getRepository(UserCompany);

  // 1. Company
  let company = await findSeedRow(companyRepo, { code: 'FASHION-ENT-MAIN' });
  if (!company) {
    company = companyRepo.create({
      id: uuidv4(),
      code: 'FASHION-ENT-MAIN',
      name: 'Fashion Enterprise Group Co., Ltd.',
      status: CompanyStatus.Active,
      baseCurrency: 'USD',
      timezone: 'Asia/Yangon',
      phone: '+95912345678',
      email: 'contact@fashionenterprise.com',
      address: 'No. 100, Pyay Road, Mayangone, Yangon',
    });
    company = await companyRepo.save(company);
    console.log('Created Company:', company.name);
  }

  // Assign admin user to company
  const adminUser = await userRepo.findOne({
    where: { email: 'admin@fashionerp.com' },
  });
  if (adminUser) {
    const userCompany = await findSeedRow(userCompanyRepo, {
      userId: adminUser.id,
      companyId: company.id,
    });
    if (!userCompany) {
      await userCompanyRepo.save(
        userCompanyRepo.create({
          userId: adminUser.id,
          companyId: company.id,
          status: MembershipStatus.Active,
        }),
      );
    }
  }

  // 2. Branch
  let branch = await findSeedRow(branchRepo, {
    code: 'BR-YGN-MAIN',
    companyId: company.id,
  });
  if (!branch) {
    branch = branchRepo.create({
      id: uuidv4(),
      companyId: company.id,
      code: 'BR-YGN-MAIN',
      name: 'Yangon Flagship Branch',
      status: BranchStatus.Active,
      phone: '+95911122233',
      address: 'Junction City, Level 2, Yangon',
    });
    branch = await branchRepo.save(branch);
    console.log('Created Branch:', branch.name);
  }

  // 3. Warehouse
  let warehouse = await findSeedRow(warehouseRepo, {
    code: 'WH-YGN-CENTRAL',
    companyId: company.id,
  });
  if (!warehouse) {
    warehouse = warehouseRepo.create({
      id: uuidv4(),
      companyId: company.id,
      branchId: branch.id,
      code: 'WH-YGN-CENTRAL',
      name: 'Central Fashion Warehouse (Yangon)',
      status: WarehouseStatus.Active,
      type: WarehouseType.Main,
      address: 'Industrial Zone 1, Hlaing Tharyar, Yangon',
    });
    warehouse = await warehouseRepo.save(warehouse);
    console.log('Created Warehouse:', warehouse.name);
  }

  // 4. Categories & Brands & Collections
  const categoriesData = [
    { code: 'CAT-APPAR-MEN', name: "Men's Apparel" },
    { code: 'CAT-APPAR-WOMEN', name: "Women's Fashion" },
    { code: 'CAT-ACCESSORIES', name: 'Accessories & Footwear' },
  ];
  const categoriesMap: Record<string, Category> = {};

  for (const c of categoriesData) {
    let cat = await findSeedRow(categoryRepo, {
      code: c.code,
      companyId: company.id,
    });
    if (!cat) {
      cat = categoryRepo.create({
        id: uuidv4(),
        companyId: company.id,
        code: c.code,
        name: c.name,
        status: CategoryStatus.Active,
      });
      cat = await categoryRepo.save(cat);
    }
    categoriesMap[c.code] = cat;
  }

  const brandsData = [
    { code: 'BRD-GUCCI', name: 'Gucci' },
    { code: 'BRD-ZARA', name: 'Zara Fashion' },
    { code: 'BRD-LEVIS', name: "Levi's Denim" },
    { code: 'BRD-NIKE', name: 'Nike Sportswear' },
  ];
  const brandsMap: Record<string, Brand> = {};

  for (const b of brandsData) {
    let brand = await findSeedRow(brandRepo, {
      code: b.code,
      companyId: company.id,
    });
    if (!brand) {
      brand = brandRepo.create({
        id: uuidv4(),
        companyId: company.id,
        code: b.code,
        name: b.name,
        status: BrandStatus.Active,
      });
      brand = await brandRepo.save(brand);
    }
    brandsMap[b.code] = brand;
  }

  let collection = await findSeedRow(collectionRepo, {
    code: 'COL-SUMMER-2026',
    companyId: company.id,
  });
  if (!collection) {
    collection = collectionRepo.create({
      id: uuidv4(),
      companyId: company.id,
      code: 'COL-SUMMER-2026',
      name: 'Summer 2026 Collection',
      status: CollectionStatus.Active,
    });
    collection = await collectionRepo.save(collection);
  }

  // 5. Attribute Options
  for (const attr of ATTRIBUTE_OPTION_CATALOG) {
    let option = await findSeedRow(attributeOptionRepo, {
      companyId: company.id,
      code: attr.code,
    });
    if (!option) {
      option = attributeOptionRepo.create({
        id: uuidv4(),
        companyId: company.id,
        code: attr.code,
        kind: attr.kind,
        value: attr.value,
        swatch: attr.swatch ?? null,
        sortOrder: attr.sortOrder,
        status: AttributeOptionStatus.Active,
      });
    } else {
      option.kind = attr.kind;
      option.value = attr.value;
      option.swatch = attr.swatch ?? null;
      option.sortOrder = attr.sortOrder;
      option.status = AttributeOptionStatus.Active;
    }

    await attributeOptionRepo.save(option);
  }

  // 6. Customers & Suppliers
  let customer = await findSeedRow(customerRepo, {
    email: 'sarah.chen@example.com',
    companyId: company.id,
  });
  if (!customer) {
    customer = customerRepo.create({
      id: uuidv4(),
      companyId: company.id,
      customerCode: 'CUST-0001',
      name: 'Sarah Chen',
      email: 'sarah.chen@example.com',
      phone: '+95977788899',
      status: CustomerStatus.Active,
      creditLimit: '1000.00',
    });
    customer = await customerRepo.save(customer);
    console.log('Created Customer:', customer.name);
  }

  let supplier = await findSeedRow(supplierRepo, {
    email: 'orders@textileglobal.com',
    companyId: company.id,
  });
  if (!supplier) {
    supplier = supplierRepo.create({
      id: uuidv4(),
      companyId: company.id,
      supplierCode: 'SUPP-0001',
      name: 'Textile Global Mills Ltd.',
      email: 'orders@textileglobal.com',
      phone: '+95944455566',
      status: SupplierStatus.Active,
    });
    supplier = await supplierRepo.save(supplier);
    console.log('Created Supplier:', supplier.name);
  }

  // 7. Price List
  let priceList = await findSeedRow(priceListRepo, {
    code: 'PL-RETAIL-USD',
    companyId: company.id,
  });
  if (!priceList) {
    priceList = priceListRepo.create({
      id: uuidv4(),
      companyId: company.id,
      code: 'PL-RETAIL-USD',
      name: 'Standard Retail Price List',
      currency: 'USD',
      status: PriceListStatus.Active,
    });
    priceList = await priceListRepo.save(priceList);
  }

  // 8. Products & Variants
  const sampleProducts = [
    {
      code: 'PROD-DJ-001',
      name: 'Classic Denim Jacket',
      type: ProductType.Variant,
      category: categoriesMap['CAT-APPAR-MEN'],
      brand: brandsMap['BRD-LEVIS'],
      sku: 'DJ-001',
      variants: [
        {
          sku: 'DJ-001-BLK-M',
          name: 'Classic Denim Jacket - Black / M',
          price: '120.00',
        },
        {
          sku: 'DJ-001-NVY-L',
          name: 'Classic Denim Jacket - Navy / L',
          price: '125.00',
        },
      ],
    },
    {
      code: 'PROD-FD-014',
      name: 'Floral Summer Silk Dress',
      type: ProductType.Variant,
      category: categoriesMap['CAT-APPAR-WOMEN'],
      brand: brandsMap['BRD-ZARA'],
      sku: 'FD-014',
      variants: [
        {
          sku: 'FD-014-WHT-M',
          name: 'Floral Silk Dress - White / M',
          price: '150.00',
        },
      ],
    },
    {
      code: 'PROD-NK-045',
      name: 'Urban Cotton Hoodie',
      type: ProductType.Variant,
      category: categoriesMap['CAT-APPAR-MEN'],
      brand: brandsMap['BRD-NIKE'],
      sku: 'NK-045',
      variants: [
        {
          sku: 'NK-045-BLK-L',
          name: 'Urban Cotton Hoodie - Black / L',
          price: '85.00',
        },
      ],
    },
  ];

  for (const pData of sampleProducts) {
    let product = await findSeedRow(productRepo, {
      code: pData.code,
      companyId: company.id,
    });
    if (!product) {
      product = productRepo.create({
        id: uuidv4(),
        companyId: company.id,
        code: pData.code,
        name: pData.name,
        productType: pData.type,
        categoryId: pData.category?.id,
        brandId: pData.brand?.id,
        collectionId: collection.id,
        status: ProductStatus.Active,
      });
      product = await productRepo.save(product);
      console.log('Created Product:', product.name);

      for (const vData of pData.variants) {
        let variant = await findSeedRow(variantRepo, {
          sku: vData.sku,
          companyId: company.id,
        });
        if (!variant) {
          variant = variantRepo.create({
            id: uuidv4(),
            companyId: company.id,
            productId: product.id,
            sku: vData.sku,
            combinationKey: vData.sku,
            costPrice: '60.00',
            sellingPrice: vData.price,
            status: ProductVariantStatus.Active,
          });
          variant = await variantRepo.save(variant);

          // Price List Item
          await priceListItemRepo.save(
            priceListItemRepo.create({
              id: uuidv4(),
              companyId: company.id,
              priceListId: priceList.id,
              productVariantId: variant.id,
              price: vData.price,
              status: PriceListItemStatus.Active,
            }),
          );

          // Warehouse Stock (100 units per variant)
          const existingStock = await findSeedRow(stockRepo, {
            warehouseId: warehouse.id,
            productVariantId: variant.id,
          });
          if (!existingStock) {
            await stockRepo.save(
              stockRepo.create({
                id: uuidv4(),
                warehouseId: warehouse.id,
                productVariantId: variant.id,
                onHandQuantity: 100,
                reservedQuantity: 0,
              }),
            );
          }
        }
      }
    }
  }

  // 9. Sample Sales Order
  const sampleVariant = await variantRepo.findOne({
    where: { companyId: company.id },
    withDeleted: true,
  });
  if (sampleVariant && customer) {
    const existingSale = await findSeedRow(saleRepo, {
      companyId: company.id,
      customerId: customer.id,
    });
    if (!existingSale) {
      let sale = saleRepo.create({
        id: uuidv4(),
        companyId: company.id,
        branchId: branch.id,
        warehouseId: warehouse.id,
        saleNumber: 'SO-2026-1001',
        saleType: SaleType.Pos,
        customerId: customer.id,
        transactionDate: new Date(),
        status: SaleStatus.Confirmed,
        subtotal: '240.00',
        discountAmount: '0.00',
        taxAmount: '12.00',
        grandTotal: '252.00',
        paidAmount: '252.00',
        balanceAmount: '0.00',
        currency: 'USD',
        notes: 'Enterprise Demo Initial Sale',
        createdBy: adminUser?.id || null,
      });
      sale = await saleRepo.save(sale);

      await saleItemRepo.save(
        saleItemRepo.create({
          id: uuidv4(),
          saleId: sale.id,
          productVariantId: sampleVariant.id,
          quantity: 2,
          unitPriceSnapshot: '120.00',
          discountSnapshot: '0.00',
          taxSnapshot: '6.00',
          lineTotal: '252.00',
          productNameSnapshot: 'Classic Denim Jacket - Black / M',
          skuSnapshot: 'DJ-001-BLK-M',
        }),
      );
      console.log('Created Sample Sale Order:', sale.saleNumber);
    }
  }

  await AppDataSource.destroy();
  console.log('🎉 Enterprise Data Seeding Completed Successfully!');
}

seedEnterpriseData().catch((err) => {
  console.error('Enterprise Seeding Failed:', err);
  process.exit(1);
});
