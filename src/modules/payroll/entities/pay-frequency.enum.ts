/**
 * Phase 16 implements MONTHLY payroll calculation only — PayrollPeriod's
 * duplicate/overlap prevention and PayrollCalculationService's attendance/
 * leave aggregation are both written and tested against a full-calendar-
 * month period. WEEKLY/BIWEEKLY are deliberately NOT included: adding them
 * to this enum without calculation logic that actually handles a partial-
 * month period would be exactly the "pretending all frequencies work"
 * anti-pattern this phase's spec explicitly forbids. A future phase can
 * extend this enum once weekly/biweekly calculation is genuinely built.
 */
export enum PayFrequency {
  Monthly = 'MONTHLY',
}
