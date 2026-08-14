import { randomUUID } from 'crypto';
import { EntityManager } from 'typeorm';
import { WarehouseStock } from '../entities/warehouse-stock.entity';
import { retryOnDuplicateEntry } from './upsert-retry';

/**
 * Upserts (if missing) and locks a single WarehouseStock row with
 * SELECT ... FOR UPDATE, inside the caller's transaction — the exact
 * `INSERT ... ON DUPLICATE KEY UPDATE` + `setLock('pessimistic_write')`
 * pattern SalesService.generateSaleNumber()/PurchaseOrdersService's counter
 * methods established (Phase 12/13), applied here to a stock balance row
 * instead of a counter (Phase 14 locked decision D2/D19).
 *
 * The no-op `ON DUPLICATE KEY UPDATE on_hand_quantity = on_hand_quantity`
 * makes row creation itself atomic and lock-compatible — two concurrent
 * transactions both observing "no row yet" cannot both attempt a plain
 * INSERT and have one fail the unique constraint; the upsert always
 * succeeds and the following SELECT ... FOR UPDATE serializes on the
 * now-guaranteed-to-exist row.
 *
 * The candidate primary-key value is generated in application code
 * (`crypto.randomUUID()`), never via MySQL's own `UUID()` function — a
 * defensive improvement made while investigating the real bug described
 * below (ruled out as the root cause, but a strictly-better practice
 * regardless: never rely on a DB-generated id for a client-visible
 * candidate row in an upsert). The upsert itself is also wrapped in
 * `retryOnDuplicateEntry` — see `upsert-retry.ts` for the full root-cause
 * explanation: a real 10-way parallel e2e concurrency test against live
 * Docker MySQL 8.0.40 found that `INSERT ... ON DUPLICATE KEY UPDATE`
 * against this table's `(warehouse_id, product_variant_id)` secondary
 * unique index can raise a transient `ER_DUP_ENTRY` under high concurrent
 * first-ever-insert contention, even though the row does not yet visibly
 * exist to any of the racing connections — a documented InnoDB gap-lock
 * interaction, not a UUID collision (that was the first, disproven
 * hypothesis). The retry is safe because the upsert is fully idempotent.
 */
export async function lockWarehouseStockRow(
  manager: EntityManager,
  warehouseId: string,
  productVariantId: string,
): Promise<WarehouseStock> {
  await retryOnDuplicateEntry(() =>
    manager.query(
      'INSERT INTO `warehouse_stock` (`id`, `warehouse_id`, `product_variant_id`, `on_hand_quantity`, `reserved_quantity`) ' +
        'VALUES (?, ?, ?, 0, 0) ' +
        'ON DUPLICATE KEY UPDATE `on_hand_quantity` = `on_hand_quantity`',
      [randomUUID(), warehouseId, productVariantId],
    ),
  );

  return manager
    .createQueryBuilder(WarehouseStock, 'stock')
    .where('stock.warehouseId = :warehouseId', { warehouseId })
    .andWhere('stock.productVariantId = :productVariantId', {
      productVariantId,
    })
    .setLock('pessimistic_write')
    .getOneOrFail();
}

/**
 * Locks multiple WarehouseStock rows in a caller-determined order. Callers
 * MUST pass targets already sorted deterministically (e.g. by
 * productVariantId for a single-warehouse operation, or by
 * (warehouseId, productVariantId) tuple for a cross-warehouse operation
 * like StockTransfer) to avoid classic two-transaction deadlocks — this
 * helper only guarantees sequential acquisition in the given order, never
 * reorders its input.
 */
export async function lockWarehouseStockRows(
  manager: EntityManager,
  targets: Array<{ warehouseId: string; productVariantId: string }>,
): Promise<Map<string, WarehouseStock>> {
  const result = new Map<string, WarehouseStock>();
  for (const target of targets) {
    const key = `${target.warehouseId}:${target.productVariantId}`;
    if (result.has(key)) {
      continue;
    }
    const row = await lockWarehouseStockRow(
      manager,
      target.warehouseId,
      target.productVariantId,
    );
    result.set(key, row);
  }
  return result;
}

export function stockKey(
  warehouseId: string,
  productVariantId: string,
): string {
  return `${warehouseId}:${productVariantId}`;
}
