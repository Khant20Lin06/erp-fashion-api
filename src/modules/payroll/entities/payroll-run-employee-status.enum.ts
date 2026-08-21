/**
 * Mirrors the parent PayrollRun's lifecycle at the per-employee row level:
 * a row starts CALCULATED as soon as PayrollRunsService.calculate() creates
 * it, and becomes FINALIZED only when the parent run is finalized (same
 * transaction, same instant) — there is no independent per-employee
 * approval step in Phase 16 (no generic workflow engine, per this phase's
 * explicit non-goals).
 */
export enum PayrollRunEmployeeStatus {
  Calculated = 'CALCULATED',
  Finalized = 'FINALIZED',
}
