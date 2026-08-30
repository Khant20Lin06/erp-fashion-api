import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { GlobalRateLimitGuard } from './common/security/global-rate-limit.guard';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import authConfig from './config/auth.config';
import kafkaConfig from './config/kafka.config';
import outboxConfig from './config/outbox.config';
import redisConfig from './config/redis.config';
import queueConfig from './config/queue.config';
import aiConfig from './config/ai.config';
import qdrantConfig from './config/qdrant.config';
import { envValidationSchema } from './config/env.validation';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { HealthModule } from './health/health.module';
import { createLoggerOptions } from './common/logging/logger.options';
import { DatabaseModule } from './database/database.module';
import { DocumentationDatabaseModule } from './database/documentation-database.module';
import { RequestContextModule } from './core/context/request-context.module';
import { RequestContextMiddleware } from './core/context/request-context.middleware';
import { TransactionModule } from './core/transaction/transaction.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { HrModule } from './modules/hr/hr.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { SalesAccountsModule } from './modules/sales-accounts/sales-accounts.module';
import { MasterDataModule } from './modules/master-data/master-data.module';
import { ProductsModule } from './modules/products/products.module';
import { CustomerSupplierModule } from './modules/customer-supplier/customer-supplier.module';
import { SalesModule } from './modules/sales/sales.module';
import { PurchaseModule } from './modules/purchase/purchase.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { LoyaltyModule } from './modules/loyalty/loyalty.module';
import { SalesReturnsModule } from './modules/sales-returns/sales-returns.module';
import { KafkaModule } from './modules/kafka/kafka.module';
import { OutboxModule } from './modules/outbox/outbox.module';
import { RedisModule } from './modules/redis/redis.module';
import { QueueModule } from './modules/queue/queue.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AiAssistantModule } from './modules/ai-assistant/ai-assistant.module';
import { SettingsModule } from './modules/settings/settings.module';
import { UomModule } from './modules/uom/uom.module';
import { ObservabilityModule } from './observability/observability.module';
import { isOpenApiGenerationMode } from './shared/utils/runtime-flags';

const databaseImport = isOpenApiGenerationMode()
  ? DocumentationDatabaseModule
  : DatabaseModule;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        authConfig,
        kafkaConfig,
        outboxConfig,
        redisConfig,
        queueConfig,
        aiConfig,
        qdrantConfig,
      ],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
      },
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: createLoggerOptions,
    }),
    ObservabilityModule,
    databaseImport,
    RequestContextModule,
    TransactionModule,
    RedisModule,
    QueueModule,
    KafkaModule,
    OutboxModule,
    HealthModule,
    UsersModule,
    AuthModule,
    RbacModule,
    OrganizationModule,
    EmployeesModule,
    HrModule,
    PayrollModule,
    SalesAccountsModule,
    MasterDataModule,
    ProductsModule,
    CustomerSupplierModule,
    SalesModule,
    PurchaseModule,
    InventoryModule,
    PromotionsModule,
    LoyaltyModule,
    SalesReturnsModule,
    PaymentsModule,
    AccountingModule,
    NotificationsModule,
    WebhooksModule,
    ReportsModule,
    AiAssistantModule,
    SettingsModule,
    UomModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: GlobalRateLimitGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware, RequestContextMiddleware)
      .forRoutes('*');
  }
}
