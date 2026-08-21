/**
 * Deliberately closed, deterministic set — no arbitrary formulas, no
 * eval()/Function()/dynamic SQL/user-defined expressions of any kind (this
 * phase's explicit, non-negotiable rule). PERCENTAGE_OF_BASE's base is
 * always the employee's resolved EmployeeCompensation.baseSalary for the
 * payroll period being calculated — never ambiguous, never configurable to
 * mean something else.
 */
export enum PayrollCalculationType {
  FixedAmount = 'FIXED_AMOUNT',
  PercentageOfBase = 'PERCENTAGE_OF_BASE',
}
