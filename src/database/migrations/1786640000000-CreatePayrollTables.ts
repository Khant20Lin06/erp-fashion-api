import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePayrollTables1786640000000 implements MigrationInterface {
  name = 'CreatePayrollTables1786640000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`shifts\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` char(36) NOT NULL, \`branch_id\` char(36) NULL, \`name\` varchar(150) NOT NULL, \`code\` varchar(50) NOT NULL, \`start_time\` time NOT NULL, \`end_time\` time NOT NULL, \`break_minutes\` int NOT NULL DEFAULT 0, \`grace_minutes\` int NOT NULL DEFAULT 0, \`is_active\` tinyint NOT NULL DEFAULT 1, \`created_by\` char(36) NULL, \`updated_by\` char(36) NULL, UNIQUE INDEX \`IDX_shift_company_code\` (\`company_id\`, \`code\`), INDEX \`IDX_shift_is_active\` (\`is_active\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`employee_shift_assignments\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`employee_id\` char(36) NOT NULL, \`shift_id\` char(36) NOT NULL, \`effective_from\` date NOT NULL, \`effective_to\` date NULL, \`created_by\` char(36) NULL, INDEX \`IDX_emp_shift_employee_effective\` (\`employee_id\`, \`effective_from\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`employee_compensations\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` char(36) NOT NULL, \`employee_id\` char(36) NOT NULL, \`effective_from\` date NOT NULL, \`effective_to\` date NULL, \`base_salary\` decimal(14,2) NOT NULL, \`currency\` char(3) NOT NULL, \`pay_frequency\` enum ('MONTHLY') NOT NULL DEFAULT 'MONTHLY', \`created_by\` char(36) NULL, \`updated_by\` char(36) NULL, INDEX \`IDX_emp_comp_employee_effective\` (\`employee_id\`, \`effective_from\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`payroll_components\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` char(36) NOT NULL, \`name\` varchar(150) NOT NULL, \`code\` varchar(50) NOT NULL, \`type\` enum ('EARNING', 'DEDUCTION', 'EMPLOYER_CONTRIBUTION') NOT NULL, \`calculation_type\` enum ('FIXED_AMOUNT', 'PERCENTAGE_OF_BASE') NOT NULL, \`fixed_amount\` decimal(14,2) NULL, \`percentage\` decimal(7,4) NULL, \`is_taxable\` tinyint NOT NULL DEFAULT 0, \`is_active\` tinyint NOT NULL DEFAULT 1, \`created_by\` char(36) NULL, \`updated_by\` char(36) NULL, UNIQUE INDEX \`IDX_payroll_comp_company_code\` (\`company_id\`, \`code\`), INDEX \`IDX_payroll_comp_type\` (\`type\`), INDEX \`IDX_payroll_comp_is_active\` (\`is_active\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`employee_payroll_components\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`employee_id\` char(36) NOT NULL, \`payroll_component_id\` char(36) NOT NULL, \`amount\` decimal(14,2) NULL, \`percentage\` decimal(7,4) NULL, \`effective_from\` date NOT NULL, \`effective_to\` date NULL, \`created_by\` char(36) NULL, INDEX \`IDX_emp_payroll_comp_employee_component_effective\` (\`employee_id\`, \`payroll_component_id\`, \`effective_from\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`payroll_configurations\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` char(36) NOT NULL, \`default_currency\` char(3) NOT NULL, \`unpaid_leave_calculation\` enum ('NONE', 'DAILY_RATE') NOT NULL DEFAULT 'NONE', \`working_days_per_month\` int NULL, \`created_by\` char(36) NULL, \`updated_by\` char(36) NULL, UNIQUE INDEX \`IDX_payroll_config_company\` (\`company_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`company_payroll_period_counters\` (\`id\` varchar(36) NOT NULL, \`company_id\` char(36) NOT NULL, \`year\` int NOT NULL, \`last_sequence\` int NOT NULL DEFAULT 0, UNIQUE INDEX \`IDX_payroll_period_counter_company_year\` (\`company_id\`, \`year\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`payroll_periods\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` char(36) NOT NULL, \`period_number\` varchar(50) NOT NULL, \`name\` varchar(150) NOT NULL, \`start_date\` date NOT NULL, \`end_date\` date NOT NULL, \`pay_date\` date NOT NULL, \`status\` enum ('OPEN', 'PROCESSING', 'FINALIZED', 'CANCELLED') NOT NULL DEFAULT 'OPEN', \`created_by\` char(36) NOT NULL, \`updated_by\` char(36) NULL, UNIQUE INDEX \`IDX_payroll_period_company_dates\` (\`company_id\`, \`start_date\`, \`end_date\`), INDEX \`IDX_payroll_period_status\` (\`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`company_payroll_run_counters\` (\`id\` varchar(36) NOT NULL, \`company_id\` char(36) NOT NULL, \`year\` int NOT NULL, \`last_sequence\` int NOT NULL DEFAULT 0, UNIQUE INDEX \`IDX_payroll_run_counter_company_year\` (\`company_id\`, \`year\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`payroll_runs\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` char(36) NOT NULL, \`payroll_period_id\` char(36) NOT NULL, \`run_number\` varchar(50) NOT NULL, \`status\` enum ('DRAFT', 'PROCESSING', 'CALCULATED', 'FINALIZED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT', \`employee_count\` int NOT NULL DEFAULT 0, \`total_gross_pay\` decimal(14,2) NOT NULL DEFAULT '0.00', \`total_deductions\` decimal(14,2) NOT NULL DEFAULT '0.00', \`total_net_pay\` decimal(14,2) NOT NULL DEFAULT '0.00', \`started_at\` timestamp NULL, \`completed_at\` timestamp NULL, \`finalized_at\` timestamp NULL, \`created_by\` char(36) NOT NULL, \`finalized_by\` char(36) NULL, INDEX \`IDX_payroll_run_period\` (\`payroll_period_id\`), INDEX \`IDX_payroll_run_status\` (\`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`payroll_run_employees\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`payroll_run_id\` char(36) NOT NULL, \`employee_id\` char(36) NOT NULL, \`employee_code_snapshot\` varchar(50) NOT NULL, \`employee_name_snapshot\` varchar(200) NOT NULL, \`department_snapshot\` varchar(150) NULL, \`designation_snapshot\` varchar(150) NULL, \`base_salary_snapshot\` decimal(14,2) NOT NULL, \`gross_pay\` decimal(14,2) NOT NULL, \`total_deductions\` decimal(14,2) NOT NULL, \`net_pay\` decimal(14,2) NOT NULL, \`status\` enum ('CALCULATED', 'FINALIZED') NOT NULL DEFAULT 'CALCULATED', UNIQUE INDEX \`IDX_payroll_run_employee_run_employee\` (\`payroll_run_id\`, \`employee_id\`), INDEX \`IDX_payroll_run_employee_status\` (\`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`payroll_run_employee_items\` (\`id\` varchar(36) NOT NULL, \`payroll_run_employee_id\` char(36) NOT NULL, \`payroll_component_id\` char(36) NULL, \`component_name_snapshot\` varchar(150) NOT NULL, \`component_code_snapshot\` varchar(50) NOT NULL, \`type\` enum ('EARNING', 'DEDUCTION', 'EMPLOYER_CONTRIBUTION') NOT NULL, \`calculation_type_snapshot\` enum ('FIXED_AMOUNT', 'PERCENTAGE_OF_BASE') NOT NULL, \`amount\` decimal(14,2) NOT NULL, \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `ALTER TABLE \`shifts\` ADD CONSTRAINT \`FK_shift_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`shifts\` ADD CONSTRAINT \`FK_shift_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee_shift_assignments\` ADD CONSTRAINT \`FK_emp_shift_employee\` FOREIGN KEY (\`employee_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee_shift_assignments\` ADD CONSTRAINT \`FK_emp_shift_shift\` FOREIGN KEY (\`shift_id\`) REFERENCES \`shifts\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee_compensations\` ADD CONSTRAINT \`FK_emp_comp_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee_compensations\` ADD CONSTRAINT \`FK_emp_comp_employee\` FOREIGN KEY (\`employee_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`payroll_components\` ADD CONSTRAINT \`FK_payroll_comp_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee_payroll_components\` ADD CONSTRAINT \`FK_emp_payroll_comp_employee\` FOREIGN KEY (\`employee_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee_payroll_components\` ADD CONSTRAINT \`FK_emp_payroll_comp_component\` FOREIGN KEY (\`payroll_component_id\`) REFERENCES \`payroll_components\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`payroll_configurations\` ADD CONSTRAINT \`FK_payroll_config_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`company_payroll_period_counters\` ADD CONSTRAINT \`FK_payroll_period_counter_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`payroll_periods\` ADD CONSTRAINT \`FK_payroll_period_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`payroll_periods\` ADD CONSTRAINT \`FK_payroll_period_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`company_payroll_run_counters\` ADD CONSTRAINT \`FK_payroll_run_counter_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`payroll_runs\` ADD CONSTRAINT \`FK_payroll_run_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`payroll_runs\` ADD CONSTRAINT \`FK_payroll_run_period\` FOREIGN KEY (\`payroll_period_id\`) REFERENCES \`payroll_periods\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`payroll_runs\` ADD CONSTRAINT \`FK_payroll_run_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`payroll_runs\` ADD CONSTRAINT \`FK_payroll_run_finalized_by\` FOREIGN KEY (\`finalized_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`payroll_run_employees\` ADD CONSTRAINT \`FK_payroll_run_employee_run\` FOREIGN KEY (\`payroll_run_id\`) REFERENCES \`payroll_runs\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`payroll_run_employees\` ADD CONSTRAINT \`FK_payroll_run_employee_employee\` FOREIGN KEY (\`employee_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`payroll_run_employee_items\` ADD CONSTRAINT \`FK_payroll_run_item_run_employee\` FOREIGN KEY (\`payroll_run_employee_id\`) REFERENCES \`payroll_run_employees\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`payroll_run_employee_items\` ADD CONSTRAINT \`FK_payroll_run_item_component\` FOREIGN KEY (\`payroll_component_id\`) REFERENCES \`payroll_components\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`payroll_run_employee_items\` DROP FOREIGN KEY \`FK_payroll_run_item_component\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payroll_run_employee_items\` DROP FOREIGN KEY \`FK_payroll_run_item_run_employee\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payroll_run_employees\` DROP FOREIGN KEY \`FK_payroll_run_employee_employee\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payroll_run_employees\` DROP FOREIGN KEY \`FK_payroll_run_employee_run\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payroll_runs\` DROP FOREIGN KEY \`FK_payroll_run_finalized_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payroll_runs\` DROP FOREIGN KEY \`FK_payroll_run_created_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payroll_runs\` DROP FOREIGN KEY \`FK_payroll_run_period\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payroll_runs\` DROP FOREIGN KEY \`FK_payroll_run_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`company_payroll_run_counters\` DROP FOREIGN KEY \`FK_payroll_run_counter_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payroll_periods\` DROP FOREIGN KEY \`FK_payroll_period_created_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payroll_periods\` DROP FOREIGN KEY \`FK_payroll_period_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`company_payroll_period_counters\` DROP FOREIGN KEY \`FK_payroll_period_counter_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payroll_configurations\` DROP FOREIGN KEY \`FK_payroll_config_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee_payroll_components\` DROP FOREIGN KEY \`FK_emp_payroll_comp_component\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee_payroll_components\` DROP FOREIGN KEY \`FK_emp_payroll_comp_employee\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`payroll_components\` DROP FOREIGN KEY \`FK_payroll_comp_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee_compensations\` DROP FOREIGN KEY \`FK_emp_comp_employee\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee_compensations\` DROP FOREIGN KEY \`FK_emp_comp_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee_shift_assignments\` DROP FOREIGN KEY \`FK_emp_shift_shift\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee_shift_assignments\` DROP FOREIGN KEY \`FK_emp_shift_employee\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`shifts\` DROP FOREIGN KEY \`FK_shift_branch\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`shifts\` DROP FOREIGN KEY \`FK_shift_company\``,
    );

    await queryRunner.query(`DROP TABLE \`payroll_run_employee_items\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_payroll_run_employee_status\` ON \`payroll_run_employees\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_payroll_run_employee_run_employee\` ON \`payroll_run_employees\``,
    );
    await queryRunner.query(`DROP TABLE \`payroll_run_employees\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_payroll_run_status\` ON \`payroll_runs\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_payroll_run_period\` ON \`payroll_runs\``,
    );
    await queryRunner.query(`DROP TABLE \`payroll_runs\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_payroll_run_counter_company_year\` ON \`company_payroll_run_counters\``,
    );
    await queryRunner.query(`DROP TABLE \`company_payroll_run_counters\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_payroll_period_status\` ON \`payroll_periods\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_payroll_period_company_dates\` ON \`payroll_periods\``,
    );
    await queryRunner.query(`DROP TABLE \`payroll_periods\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_payroll_period_counter_company_year\` ON \`company_payroll_period_counters\``,
    );
    await queryRunner.query(`DROP TABLE \`company_payroll_period_counters\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_payroll_config_company\` ON \`payroll_configurations\``,
    );
    await queryRunner.query(`DROP TABLE \`payroll_configurations\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_emp_payroll_comp_employee_component_effective\` ON \`employee_payroll_components\``,
    );
    await queryRunner.query(`DROP TABLE \`employee_payroll_components\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_payroll_comp_is_active\` ON \`payroll_components\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_payroll_comp_type\` ON \`payroll_components\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_payroll_comp_company_code\` ON \`payroll_components\``,
    );
    await queryRunner.query(`DROP TABLE \`payroll_components\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_emp_comp_employee_effective\` ON \`employee_compensations\``,
    );
    await queryRunner.query(`DROP TABLE \`employee_compensations\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_emp_shift_employee_effective\` ON \`employee_shift_assignments\``,
    );
    await queryRunner.query(`DROP TABLE \`employee_shift_assignments\``);

    await queryRunner.query(`DROP INDEX \`IDX_shift_is_active\` ON \`shifts\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_shift_company_code\` ON \`shifts\``,
    );
    await queryRunner.query(`DROP TABLE \`shifts\``);
  }
}
