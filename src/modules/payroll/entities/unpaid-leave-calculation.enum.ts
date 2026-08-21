/**
 * Explicit, configured policy for how an unpaid LeaveRequest (LeaveType.isPaid
 * === false) affects an employee's pay for a period — never silently
 * assumed. NONE means unpaid leave has zero pay impact (the safest,
 * simplest default). DAILY_RATE deducts
 * (baseSalary / workingDaysPerMonth) * unpaidLeaveDays, where
 * workingDaysPerMonth must be explicitly configured on PayrollConfiguration
 * — this phase never assumes a bare "salary / 30" divisor.
 */
export enum UnpaidLeaveCalculation {
  None = 'NONE',
  DailyRate = 'DAILY_RATE',
}
