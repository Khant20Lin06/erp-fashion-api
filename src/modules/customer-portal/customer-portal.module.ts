import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerTelegramLink } from './entities/customer-telegram-link.entity';
import { TelegramLinkOtp } from './entities/telegram-link-otp.entity';
import { CustomerPortalService } from './services/customer-portal.service';
import { CustomerPortalController } from './controllers/customer-portal.controller';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { OrganizationModule } from '../organization/organization.module';
import { CustomerSupplierModule } from '../customer-supplier/customer-supplier.module';
import { SalesModule } from '../sales/sales.module';
import { ProductsModule } from '../products/products.module';
import { OnlineOrdersModule } from '../online-orders/online-orders.module';
import { CustomerCatalogService } from './services/customer-catalog.service';
import { CustomerCatalogController } from './controllers/customer-catalog.controller';
import { ShoppingStateController } from './controllers/shopping-state.controller';
import { ShoppingStateService } from './services/shopping-state.service';
import { ShoppingSession } from './entities/shopping-session.entity';
import { ShoppingEvent } from './entities/shopping-event.entity';
import { CustomerAgentToolsService } from './services/customer-agent-tools.service';
import { ShoppingAssistantService } from './services/shopping-assistant.service';
import { CustomerMultiAgentService } from './agents/customer-multi-agent.service';
import { CustomerAgentModelAdapter } from './agents/customer-agent-model.adapter';

/**
 * Backs the Customer Service Bot's Telegram-linking and order-intake flow
 * (see n8n-workflows/). A thin layer over SalesModule/CustomerSupplierModule
 * — no duplicated business logic, only identity resolution
 * (telegramUserId -> Customer) and DTO narrowing for what a bot-placed
 * order may legitimately contain.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomerTelegramLink,
      TelegramLinkOtp,
      ShoppingSession,
      ShoppingEvent,
    ]),
    AuthModule,
    RbacModule,
    OrganizationModule,
    CustomerSupplierModule,
    SalesModule,
    ProductsModule,
    OnlineOrdersModule,
  ],
  controllers: [
    CustomerPortalController,
    CustomerCatalogController,
    ShoppingStateController,
  ],
  providers: [
    CustomerPortalService,
    CustomerCatalogService,
    ShoppingStateService,
    CustomerAgentToolsService,
    ShoppingAssistantService,
    CustomerMultiAgentService,
    CustomerAgentModelAdapter,
  ],
  exports: [CustomerPortalService],
})
export class CustomerPortalModule {}
