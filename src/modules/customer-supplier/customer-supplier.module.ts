import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { Supplier } from './entities/supplier.entity';
import { CustomerGroup } from './entities/customer-group.entity';
import { SupplierGroup } from './entities/supplier-group.entity';
import { PaymentTerm } from './entities/payment-term.entity';
import { CustomerAddress } from './entities/customer-address.entity';
import { SupplierAddress } from './entities/supplier-address.entity';
import { CustomerContact } from './entities/customer-contact.entity';
import { CustomerNote } from './entities/customer-note.entity';
import { SupplierContact } from './entities/supplier-contact.entity';
import { Sale } from '../sales/entities/sale.entity';
import { PaymentTermsService } from './services/payment-terms.service';
import { CustomerGroupsService } from './services/customer-groups.service';
import { SupplierGroupsService } from './services/supplier-groups.service';
import { CustomersService } from './services/customers.service';
import { SuppliersService } from './services/suppliers.service';
import { CustomerAddressesService } from './services/customer-addresses.service';
import { SupplierAddressesService } from './services/supplier-addresses.service';
import { CustomerContactsService } from './services/customer-contacts.service';
import { SupplierContactsService } from './services/supplier-contacts.service';
import { PaymentTermsController } from './controllers/payment-terms.controller';
import { CustomerGroupsController } from './controllers/customer-groups.controller';
import { SupplierGroupsController } from './controllers/supplier-groups.controller';
import { CustomersController } from './controllers/customers.controller';
import { SuppliersController } from './controllers/suppliers.controller';
import { CustomerAddressesController } from './controllers/customer-addresses.controller';
import { SupplierAddressesController } from './controllers/supplier-addresses.controller';
import { CustomerContactsController } from './controllers/customer-contacts.controller';
import { SupplierContactsController } from './controllers/supplier-contacts.controller';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { OrganizationModule } from '../organization/organization.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { PurchaseOrder } from '../purchase/entities/purchase-order.entity';
import { Payment } from '../payments/entities/payment.entity';
import { GoodsReceipt } from '../inventory/entities/goods-receipt.entity';

/**
 * Phase 11 — Customer / Supplier (locked decision §1-27). A single flat
 * module directory (`src/modules/customer-supplier/`), consistent with how
 * Phase 09 (master-data) and Phase 10 (products) each keep several related
 * entities/services/controllers in one module rather than Phase 11.md
 * §32's suggested deep per-entity subfolder nesting — that suggestion is
 * explicitly only "a guideline... use the actual existing architecture if
 * it differs" (§32).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Customer,
      Supplier,
      CustomerGroup,
      SupplierGroup,
      PaymentTerm,
      CustomerAddress,
      SupplierAddress,
      CustomerContact,
      SupplierContact,
      CustomerNote,
      Sale,
      PurchaseOrder,
      Payment,
      GoodsReceipt,
    ]),
    AuthModule,
    RbacModule,
    OrganizationModule,
    MasterDataModule,
  ],
  controllers: [
    PaymentTermsController,
    CustomerGroupsController,
    SupplierGroupsController,
    CustomersController,
    SuppliersController,
    CustomerAddressesController,
    SupplierAddressesController,
    CustomerContactsController,
    SupplierContactsController,
  ],
  providers: [
    PaymentTermsService,
    CustomerGroupsService,
    SupplierGroupsService,
    CustomersService,
    SuppliersService,
    CustomerAddressesService,
    SupplierAddressesService,
    CustomerContactsService,
    SupplierContactsService,
  ],
  exports: [
    PaymentTermsService,
    CustomerGroupsService,
    SupplierGroupsService,
    CustomersService,
    SuppliersService,
    CustomerAddressesService,
    SupplierAddressesService,
    CustomerContactsService,
    SupplierContactsService,
  ],
})
export class CustomerSupplierModule {}
