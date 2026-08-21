import 'dotenv/config';
import { In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '../data-source';
import { AttributeOption } from '../../modules/master-data/entities/attribute-option.entity';
import { AttributeKind } from '../../modules/master-data/entities/attribute-kind.enum';
import { AttributeOptionStatus } from '../../modules/master-data/entities/attribute-option-status.enum';
import { ProductVariant } from '../../modules/products/entities/product-variant.entity';
import { ProductVariantAttribute } from '../../modules/products/entities/product-variant-attribute.entity';
import { ProductType } from '../../modules/products/entities/product-type.enum';
import { computeCombinationKey } from '../../modules/products/utils/combination-key';
import {
  ATTRIBUTE_OPTION_CATALOG,
  AttributeCatalogEntry,
  findAttributeCatalogEntry,
  resolveLegacyVariantSelection,
} from '../seeds/attribute-option.catalog';

type VariantRow = {
  variantId: string;
  companyId: string;
  productId: string;
  productCode: string;
  productName: string;
  sku: string;
  combinationKey: string;
};

const UNSPECIFIED_COLOR_ENTRY: AttributeCatalogEntry = {
  kind: AttributeKind.Color,
  code: 'COLOR-UNSPECIFIED',
  value: 'Unspecified',
  aliases: ['unspecified', 'unknown'],
  swatch: '#9CA3AF',
  sortOrder: 9998,
};

const UNSPECIFIED_SIZE_ENTRY: AttributeCatalogEntry = {
  kind: AttributeKind.Size,
  code: 'SIZE-UNSPECIFIED',
  value: 'Unspecified',
  aliases: ['unspecified', 'unknown'],
  sortOrder: 9999,
};

async function repairVariantAttributeLinks() {
  await AppDataSource.initialize();

  const optionRepo = AppDataSource.getRepository(AttributeOption);
  const variantAttributeRepo = AppDataSource.getRepository(
    ProductVariantAttribute,
  );

  const variants: VariantRow[] = await AppDataSource.query(
    `
      SELECT
        pv.id AS variantId,
        pv.company_id AS companyId,
        pv.product_id AS productId,
        p.code AS productCode,
        p.name AS productName,
        pv.sku AS sku,
        pv.combination_key AS combinationKey
      FROM product_variants pv
      INNER JOIN products p ON p.id = pv.product_id
      WHERE pv.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND p.product_type = ?
      ORDER BY p.name, pv.sku
    `,
    [ProductType.Variant],
  );

  if (variants.length === 0) {
    console.log('No variant products found. Nothing to repair.');
    return;
  }

  const companyIds = [...new Set(variants.map((variant) => variant.companyId))];
  const variantIds = variants.map((variant) => variant.variantId);
  const existingAttributes = await variantAttributeRepo.find({
    where: { variantId: In(variantIds) },
  });

  const attributesByVariantId = new Map<string, ProductVariantAttribute[]>();
  for (const attribute of existingAttributes) {
    const bucket = attributesByVariantId.get(attribute.variantId) ?? [];
    bucket.push(attribute);
    attributesByVariantId.set(attribute.variantId, bucket);
  }

  const companyOptions = new Map<string, AttributeOption[]>();
  let createdOptions = 0;
  let updatedOptions = 0;
  let rewrittenVariantAttributes = 0;
  let updatedCombinationKeys = 0;
  let fallbackResolvedVariants = 0;
  const unresolvedVariants: string[] = [];

  const getCompanyOptions = async (
    companyId: string,
  ): Promise<AttributeOption[]> => {
    const cached = companyOptions.get(companyId);
    if (cached) return cached;

    const options = await optionRepo.find({ where: { companyId } });
    companyOptions.set(companyId, options);
    return options;
  };

  const ensureOption = async (
    companyId: string,
    entry: AttributeCatalogEntry,
  ): Promise<AttributeOption> => {
    const options = await getCompanyOptions(companyId);
    let option =
      options.find(
        (candidate) =>
          candidate.kind === entry.kind && candidate.code === entry.code,
      ) ??
      options.find((candidate) => {
        if (candidate.kind !== entry.kind) return false;
        return (
          findAttributeCatalogEntry(entry.kind, candidate.value)?.code ===
          entry.code
        );
      });

    if (!option) {
      option = optionRepo.create({
        id: uuidv4(),
        companyId,
        kind: entry.kind,
        code: entry.code,
        value: entry.value,
        swatch: entry.swatch ?? null,
        sortOrder: entry.sortOrder,
        status: AttributeOptionStatus.Active,
      });
      option = await optionRepo.save(option);
      options.push(option);
      createdOptions += 1;
    } else {
      let changed = false;
      const codeOwner = options.find(
        (candidate) =>
          candidate.id !== option!.id &&
          candidate.kind === entry.kind &&
          candidate.code === entry.code,
      );

      if (!codeOwner && option.code !== entry.code) {
        option.code = entry.code;
        changed = true;
      }
      if (option.value !== entry.value) {
        option.value = entry.value;
        changed = true;
      }
      if ((option.swatch ?? null) !== (entry.swatch ?? null)) {
        option.swatch = entry.swatch ?? null;
        changed = true;
      }
      if (option.sortOrder !== entry.sortOrder) {
        option.sortOrder = entry.sortOrder;
        changed = true;
      }
      if (option.status !== AttributeOptionStatus.Active) {
        option.status = AttributeOptionStatus.Active;
        changed = true;
      }

      if (changed) {
        option = await optionRepo.save(option);
        updatedOptions += 1;
      }
    }

    return option;
  };

  for (const companyId of companyIds) {
    for (const entry of ATTRIBUTE_OPTION_CATALOG) {
      await ensureOption(companyId, entry);
    }
  }

  for (const variant of variants) {
    const currentAttributes =
      attributesByVariantId.get(variant.variantId) ?? [];
    const currentColor = currentAttributes.find(
      (attribute) => attribute.kind === AttributeKind.Color,
    );
    const currentSize = currentAttributes.find(
      (attribute) => attribute.kind === AttributeKind.Size,
    );
    const hasNormalizedRelations =
      variant.combinationKey.includes('|') &&
      currentAttributes.length === 2 &&
      currentColor &&
      currentSize;

    let colorOptionId: string;
    let sizeOptionId: string;

    if (hasNormalizedRelations) {
      colorOptionId = currentColor.optionId;
      sizeOptionId = currentSize.optionId;
    } else {
      const resolved = resolveLegacyVariantSelection(
        variant.combinationKey ?? '',
        variant.sku,
      );
      if (!resolved) {
        const colorOption = await ensureOption(
          variant.companyId,
          UNSPECIFIED_COLOR_ENTRY,
        );
        const sizeOption = await ensureOption(
          variant.companyId,
          UNSPECIFIED_SIZE_ENTRY,
        );
        colorOptionId = colorOption.id;
        sizeOptionId = sizeOption.id;
        fallbackResolvedVariants += 1;
      } else {
        const colorOption = await ensureOption(
          variant.companyId,
          resolved.color,
        );
        const sizeOption = await ensureOption(variant.companyId, resolved.size);
        colorOptionId = colorOption.id;
        sizeOptionId = sizeOption.id;
      }
    }

    const desiredCombinationKey = computeCombinationKey([
      colorOptionId,
      sizeOptionId,
    ]);
    const needsAttributeRewrite =
      currentAttributes.length !== 2 ||
      currentColor?.optionId !== colorOptionId ||
      currentSize?.optionId !== sizeOptionId;

    if (
      !needsAttributeRewrite &&
      variant.combinationKey === desiredCombinationKey
    ) {
      continue;
    }

    await AppDataSource.transaction(async (manager) => {
      if (variant.combinationKey !== desiredCombinationKey) {
        await manager.update(
          ProductVariant,
          { id: variant.variantId },
          { combinationKey: desiredCombinationKey },
        );
        updatedCombinationKeys += 1;
      }

      if (needsAttributeRewrite) {
        await manager.delete(ProductVariantAttribute, {
          variantId: variant.variantId,
        });
        await manager.save(ProductVariantAttribute, [
          manager.create(ProductVariantAttribute, {
            id: uuidv4(),
            variantId: variant.variantId,
            optionId: colorOptionId,
            kind: AttributeKind.Color,
          }),
          manager.create(ProductVariantAttribute, {
            id: uuidv4(),
            variantId: variant.variantId,
            optionId: sizeOptionId,
            kind: AttributeKind.Size,
          }),
        ]);
        rewrittenVariantAttributes += 1;
      }
    });

    attributesByVariantId.set(variant.variantId, [
      Object.assign(new ProductVariantAttribute(), {
        variantId: variant.variantId,
        optionId: colorOptionId,
        kind: AttributeKind.Color,
      }),
      Object.assign(new ProductVariantAttribute(), {
        variantId: variant.variantId,
        optionId: sizeOptionId,
        kind: AttributeKind.Size,
      }),
    ]);
  }

  console.log(
    [
      'Variant attribute repair complete.',
      `Variants scanned: ${variants.length}`,
      `Combination keys updated: ${updatedCombinationKeys}`,
      `Variant attribute rows rewritten: ${rewrittenVariantAttributes}`,
      `Attribute options created: ${createdOptions}`,
      `Attribute options normalized: ${updatedOptions}`,
      `Fallback variants normalized: ${fallbackResolvedVariants}`,
      `Unresolved variants: ${unresolvedVariants.length}`,
    ].join('\n'),
  );

  if (unresolvedVariants.length > 0) {
    console.log(
      `Unresolved variant samples:\n${unresolvedVariants.slice(0, 10).join('\n')}`,
    );
  }
}

repairVariantAttributeLinks()
  .catch((error) => {
    console.error('Failed to repair variant attribute links.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });
