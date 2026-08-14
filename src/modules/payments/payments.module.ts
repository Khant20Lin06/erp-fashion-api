import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentAllocation } from './entities/payment-allocation.entity';
import { PaymentMethod } from './entities/payment-method.entity';
import { CompanyPaymentCounter } from './entities/company-payment-counter.entity';
import { PaymentsService } from './services/payments.service';
import { PaymentMethodsService } from './services/payment-methods.service';
import { PaymentsController } from './controllers/payments.controller';
import { PaymentMethodsController } from './controllers/payment-methods.controller';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { OrganizationModule } from '../organization/organization.module';
import { CustomerSupplierModule } from '../customer-supplier/customer-supplier.module';
import { SalesModule } from '../sales/sales.module';
import { PurchaseModule } from '../purchase/purchase.module';
import { AccountingModule } from '../accounting/accounting.module';
import { OutboxModule } from '../outbox/outbox.module';
import { PaymentEventConsumerModule } from './consumers/payment-event-consumer.module';

/**
 * Phase 16 — Payment. A single flat module directory
 * (`src/modules/payments/`), consistent with Phase 12/13's own module
 * shape. Depends on OrganizationModule (Company/Branch), CustomerSupplierModule
 * (Customer/Supplier), SalesModule (SalesService.applyPayment()), and
 * PurchaseModule (PurchaseOrdersService.applyPayment()) — the D16
 * cross-phase integration point calls the already-exported services
 * directly rather than re-deriving Sale/PurchaseOrder balance logic here.
 * No dependency on InventoryModule — Payment never touches stock (D9/D17,
 * LOCKED boundary).
 *
 * Phase 17 addition: also imports AccountingModule, so PaymentsService can
 * inject AccountingPostingService for the one authorized cross-phase
 * addition to PaymentsService.create() — a synchronous, same-transaction
 * call to AccountingPostingService.postPayment() (D6/D7/D13/D19, LOCKED).
 * No other Phase 16 file, logic, or contract changes.
 *
 * Phase 18 addition: imports OutboxModule so PaymentsService can inject
 * OutboxService for the one authorized cross-phase addition to
 * PaymentsService.create() — a same-transaction write of a
 * `payment.confirmed` OutboxEvent row (D1-D10, LOCKED). Also wires
 * PaymentEventConsumerModule (the audit consumer that subscribes to this
 * event over Kafka) here since it is a Payment-domain concern, even though
 * it runs independently of any HTTP request.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payment,
      PaymentAllocation,
      PaymentMethod,
      CompanyPaymentCounter,
    ]),
    AuthModule,
    RbacModule,
    OrganizationModule,
    CustomerSupplierModule,
    SalesModule,
    PurchaseModule,
    AccountingModule,
    OutboxModule,
    PaymentEventConsumerModule,
  ],
  controllers: [PaymentsController, PaymentMethodsController],
  providers: [PaymentsService, PaymentMethodsService],
  exports: [PaymentsService, PaymentMethodsService],
})
export class PaymentsModule {}
