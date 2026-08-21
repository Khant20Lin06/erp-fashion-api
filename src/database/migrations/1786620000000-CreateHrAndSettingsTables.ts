import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHrAndSettingsTables1786620000000 implements MigrationInterface {
  name = 'CreateHrAndSettingsTables1786620000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`employees\` ADD \`date_of_birth\` date NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`employees\` ADD \`address\` varchar(500) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`employees\` ADD \`emergency_contact_name\` varchar(200) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`employees\` ADD \`emergency_contact_phone\` varchar(50) NULL`,
    );

    await queryRunner.query(
      `CREATE TABLE \`departments\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` char(36) NOT NULL, \`name\` varchar(150) NOT NULL, \`code\` varchar(50) NULL, \`description\` varchar(500) NULL, \`status\` enum ('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', UNIQUE INDEX \`IDX_dept_company_name\` (\`company_id\`, \`name\`), UNIQUE INDEX \`IDX_dept_company_code\` (\`company_id\`, \`code\`), INDEX \`IDX_dept_status\` (\`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`designations\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` char(36) NOT NULL, \`name\` varchar(150) NOT NULL, \`code\` varchar(50) NULL, \`description\` varchar(500) NULL, \`status\` enum ('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', UNIQUE INDEX \`IDX_desig_company_name\` (\`company_id\`, \`name\`), UNIQUE INDEX \`IDX_desig_company_code\` (\`company_id\`, \`code\`), INDEX \`IDX_desig_status\` (\`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`employee_assignments\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`employee_id\` char(36) NOT NULL, \`company_id\` char(36) NOT NULL, \`branch_id\` char(36) NOT NULL, \`department_id\` char(36) NULL, \`designation_id\` char(36) NULL, \`warehouse_id\` char(36) NULL, \`effective_from\` date NOT NULL, \`effective_to\` date NULL, \`status\` enum ('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', INDEX \`IDX_emp_assign_employee_effective\` (\`employee_id\`, \`effective_from\`), INDEX \`IDX_emp_assign_company_branch\` (\`company_id\`, \`branch_id\`), INDEX \`IDX_emp_assign_status\` (\`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`leave_types\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`company_id\` char(36) NOT NULL, \`name\` varchar(150) NOT NULL, \`code\` varchar(50) NOT NULL, \`description\` varchar(500) NULL, \`is_paid\` tinyint NOT NULL DEFAULT 0, \`default_days\` decimal(10,2) NULL, \`status\` enum ('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE', UNIQUE INDEX \`IDX_leave_type_company_name\` (\`company_id\`, \`name\`), UNIQUE INDEX \`IDX_leave_type_company_code\` (\`company_id\`, \`code\`), INDEX \`IDX_leave_type_status\` (\`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`leave_requests\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`employee_id\` char(36) NOT NULL, \`company_id\` char(36) NOT NULL, \`branch_id\` char(36) NOT NULL, \`leave_type_id\` char(36) NOT NULL, \`from_date\` date NOT NULL, \`to_date\` date NOT NULL, \`reason\` varchar(1000) NULL, \`status\` enum ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING', \`approved_by_user_id\` char(36) NULL, \`rejected_by_user_id\` char(36) NULL, \`decision_at\` timestamp NULL, \`cancelled_at\` timestamp NULL, INDEX \`IDX_leave_req_company_branch_status\` (\`company_id\`, \`branch_id\`, \`status\`), INDEX \`IDX_leave_req_employee_dates\` (\`employee_id\`, \`from_date\`, \`to_date\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`attendance_records\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`employee_id\` char(36) NOT NULL, \`company_id\` char(36) NOT NULL, \`branch_id\` char(36) NOT NULL, \`attendance_date\` date NOT NULL, \`status\` enum ('PRESENT', 'ABSENT', 'LATE', 'LEAVE', 'HALF_DAY') NOT NULL DEFAULT 'PRESENT', \`check_in_at\` timestamp NULL, \`check_out_at\` timestamp NULL, \`note\` varchar(1000) NULL, UNIQUE INDEX \`IDX_attendance_employee_date\` (\`employee_id\`, \`attendance_date\`), INDEX \`IDX_attendance_company_branch_date\` (\`company_id\`, \`branch_id\`, \`attendance_date\`), INDEX \`IDX_attendance_status\` (\`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `CREATE TABLE \`setting_definitions\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`key\` varchar(150) NOT NULL, \`category\` varchar(100) NOT NULL, \`data_type\` enum ('STRING', 'INTEGER', 'BOOLEAN', 'DECIMAL', 'JSON') NOT NULL, \`description\` varchar(500) NULL, \`default_value\` json NULL, \`allowed_scopes\` json NOT NULL, \`is_active\` tinyint NOT NULL DEFAULT 1, UNIQUE INDEX \`IDX_setting_definition_key\` (\`key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`setting_values\` (\`id\` varchar(36) NOT NULL, \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`definition_id\` char(36) NOT NULL, \`scope_type\` enum ('SYSTEM', 'COMPANY', 'BRANCH', 'USER') NOT NULL, \`scope_id\` varchar(64) NOT NULL, \`value\` json NULL, UNIQUE INDEX \`IDX_setting_value_definition_scope\` (\`definition_id\`, \`scope_type\`, \`scope_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );

    await queryRunner.query(
      `ALTER TABLE \`departments\` ADD CONSTRAINT \`FK_dept_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`designations\` ADD CONSTRAINT \`FK_desig_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee_assignments\` ADD CONSTRAINT \`FK_emp_assign_employee\` FOREIGN KEY (\`employee_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee_assignments\` ADD CONSTRAINT \`FK_emp_assign_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee_assignments\` ADD CONSTRAINT \`FK_emp_assign_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee_assignments\` ADD CONSTRAINT \`FK_emp_assign_department\` FOREIGN KEY (\`department_id\`) REFERENCES \`departments\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee_assignments\` ADD CONSTRAINT \`FK_emp_assign_designation\` FOREIGN KEY (\`designation_id\`) REFERENCES \`designations\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee_assignments\` ADD CONSTRAINT \`FK_emp_assign_warehouse\` FOREIGN KEY (\`warehouse_id\`) REFERENCES \`warehouses\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`leave_types\` ADD CONSTRAINT \`FK_leave_type_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`leave_requests\` ADD CONSTRAINT \`FK_leave_req_employee\` FOREIGN KEY (\`employee_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`leave_requests\` ADD CONSTRAINT \`FK_leave_req_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`leave_requests\` ADD CONSTRAINT \`FK_leave_req_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`leave_requests\` ADD CONSTRAINT \`FK_leave_req_type\` FOREIGN KEY (\`leave_type_id\`) REFERENCES \`leave_types\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`leave_requests\` ADD CONSTRAINT \`FK_leave_req_approved_user\` FOREIGN KEY (\`approved_by_user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`leave_requests\` ADD CONSTRAINT \`FK_leave_req_rejected_user\` FOREIGN KEY (\`rejected_by_user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`attendance_records\` ADD CONSTRAINT \`FK_attendance_employee\` FOREIGN KEY (\`employee_id\`) REFERENCES \`employees\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`attendance_records\` ADD CONSTRAINT \`FK_attendance_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`attendance_records\` ADD CONSTRAINT \`FK_attendance_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`setting_values\` ADD CONSTRAINT \`FK_setting_value_definition\` FOREIGN KEY (\`definition_id\`) REFERENCES \`setting_definitions\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `INSERT INTO \`setting_definitions\` (\`id\`, \`key\`, \`category\`, \`data_type\`, \`description\`, \`default_value\`, \`allowed_scopes\`, \`is_active\`) VALUES
      ('cc9c4997-24b8-4f4f-9499-0b8792b20411', 'notifications.in_app.enabled', 'notifications', 'BOOLEAN', 'Enable in-app notifications by scope', CAST('true' AS JSON), CAST('["SYSTEM","COMPANY","BRANCH","USER"]' AS JSON), 1),
      ('65d973dc-4c53-4a03-b7a1-b4d446919690', 'reports.dashboard.default_range_days', 'reports', 'INTEGER', 'Default dashboard date range in days', CAST('30' AS JSON), CAST('["SYSTEM","COMPANY","BRANCH","USER"]' AS JSON), 1),
      ('bd1ef5cf-0907-4a85-9f4b-2fb86f08b95e', 'reports.dashboard.show_inventory_snapshot', 'reports', 'BOOLEAN', 'Show inventory snapshot in dashboard summaries', CAST('true' AS JSON), CAST('["SYSTEM","COMPANY","BRANCH"]' AS JSON), 1),
      ('dd3676d3-160f-4dbc-bcb9-71fb49168f49', 'hr.leave.self_service_enabled', 'hr', 'BOOLEAN', 'Allow employees to submit their own leave requests', CAST('true' AS JSON), CAST('["SYSTEM","COMPANY","BRANCH"]' AS JSON), 1),
      ('1e9329cc-8f39-4d0d-af80-f5442db58789', 'user.preferences.locale', 'user', 'STRING', 'Preferred UI locale for the signed-in user', CAST('"en"' AS JSON), CAST('["SYSTEM","USER"]' AS JSON), 1)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM \`setting_values\` WHERE \`definition_id\` IN ('cc9c4997-24b8-4f4f-9499-0b8792b20411','65d973dc-4c53-4a03-b7a1-b4d446919690','bd1ef5cf-0907-4a85-9f4b-2fb86f08b95e','dd3676d3-160f-4dbc-bcb9-71fb49168f49','1e9329cc-8f39-4d0d-af80-f5442db58789')`,
    );
    await queryRunner.query(
      `DELETE FROM \`setting_definitions\` WHERE \`id\` IN ('cc9c4997-24b8-4f4f-9499-0b8792b20411','65d973dc-4c53-4a03-b7a1-b4d446919690','bd1ef5cf-0907-4a85-9f4b-2fb86f08b95e','dd3676d3-160f-4dbc-bcb9-71fb49168f49','1e9329cc-8f39-4d0d-af80-f5442db58789')`,
    );

    await queryRunner.query(
      `ALTER TABLE \`setting_values\` DROP FOREIGN KEY \`FK_setting_value_definition\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`attendance_records\` DROP FOREIGN KEY \`FK_attendance_branch\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`attendance_records\` DROP FOREIGN KEY \`FK_attendance_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`attendance_records\` DROP FOREIGN KEY \`FK_attendance_employee\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`leave_requests\` DROP FOREIGN KEY \`FK_leave_req_rejected_user\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`leave_requests\` DROP FOREIGN KEY \`FK_leave_req_approved_user\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`leave_requests\` DROP FOREIGN KEY \`FK_leave_req_type\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`leave_requests\` DROP FOREIGN KEY \`FK_leave_req_branch\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`leave_requests\` DROP FOREIGN KEY \`FK_leave_req_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`leave_requests\` DROP FOREIGN KEY \`FK_leave_req_employee\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`leave_types\` DROP FOREIGN KEY \`FK_leave_type_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee_assignments\` DROP FOREIGN KEY \`FK_emp_assign_warehouse\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee_assignments\` DROP FOREIGN KEY \`FK_emp_assign_designation\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee_assignments\` DROP FOREIGN KEY \`FK_emp_assign_department\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee_assignments\` DROP FOREIGN KEY \`FK_emp_assign_branch\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee_assignments\` DROP FOREIGN KEY \`FK_emp_assign_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`employee_assignments\` DROP FOREIGN KEY \`FK_emp_assign_employee\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`designations\` DROP FOREIGN KEY \`FK_desig_company\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`departments\` DROP FOREIGN KEY \`FK_dept_company\``,
    );

    await queryRunner.query(
      `DROP INDEX \`IDX_setting_value_definition_scope\` ON \`setting_values\``,
    );
    await queryRunner.query(`DROP TABLE \`setting_values\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_setting_definition_key\` ON \`setting_definitions\``,
    );
    await queryRunner.query(`DROP TABLE \`setting_definitions\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_attendance_status\` ON \`attendance_records\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_attendance_company_branch_date\` ON \`attendance_records\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_attendance_employee_date\` ON \`attendance_records\``,
    );
    await queryRunner.query(`DROP TABLE \`attendance_records\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_leave_req_employee_dates\` ON \`leave_requests\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_leave_req_company_branch_status\` ON \`leave_requests\``,
    );
    await queryRunner.query(`DROP TABLE \`leave_requests\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_leave_type_status\` ON \`leave_types\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_leave_type_company_code\` ON \`leave_types\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_leave_type_company_name\` ON \`leave_types\``,
    );
    await queryRunner.query(`DROP TABLE \`leave_types\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_emp_assign_status\` ON \`employee_assignments\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_emp_assign_company_branch\` ON \`employee_assignments\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_emp_assign_employee_effective\` ON \`employee_assignments\``,
    );
    await queryRunner.query(`DROP TABLE \`employee_assignments\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_desig_status\` ON \`designations\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_desig_company_code\` ON \`designations\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_desig_company_name\` ON \`designations\``,
    );
    await queryRunner.query(`DROP TABLE \`designations\``);

    await queryRunner.query(
      `DROP INDEX \`IDX_dept_status\` ON \`departments\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_dept_company_code\` ON \`departments\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_dept_company_name\` ON \`departments\``,
    );
    await queryRunner.query(`DROP TABLE \`departments\``);

    await queryRunner.query(
      `ALTER TABLE \`employees\` DROP COLUMN \`emergency_contact_phone\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`employees\` DROP COLUMN \`emergency_contact_name\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`employees\` DROP COLUMN \`address\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`employees\` DROP COLUMN \`date_of_birth\``,
    );
  }
}
