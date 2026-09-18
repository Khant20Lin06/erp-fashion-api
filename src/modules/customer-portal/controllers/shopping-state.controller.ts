import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';
import { ShoppingStepDto } from '../dto/shopping-step.dto';
import { ShoppingStateService } from '../services/shopping-state.service';
import { CustomerAgentToolsService } from '../services/customer-agent-tools.service';
import { CustomerAgentToolDto } from '../dto/customer-agent-tool.dto';
import { CustomerAssistantDto } from '../dto/customer-assistant.dto';
import { ShoppingAssistantService } from '../services/shopping-assistant.service';

@ApiTags('Customer Portal (Bot Integration)')
@Controller('customer-portal/shopping')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ShoppingStateController {
  constructor(
    private readonly shopping: ShoppingStateService,
    private readonly scope: DataScopeService,
    private readonly agentTools: CustomerAgentToolsService,
    private readonly assistant: ShoppingAssistantService,
  ) {}

  @Post('assistant')
  @HttpCode(200)
  @RequirePermission('customer_portal.order.create', 'products.read')
  async runAssistant(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CustomerAssistantDto,
  ) {
    const companyId = await resolveRequestCompanyId(
      this.scope,
      user.id,
      'products',
      dto.companyId,
    );
    return this.assistant.run(user.id, { ...dto, companyId });
  }

  @Post('agent-tool')
  @HttpCode(200)
  @RequirePermission('customer_portal.order.create', 'products.read')
  async agentTool(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CustomerAgentToolDto,
  ) {
    const companyId = await resolveRequestCompanyId(
      this.scope,
      user.id,
      'products',
      dto.companyId,
    );
    return this.agentTools.call(user.id, { ...dto, companyId });
  }

  @Post('step')
  @HttpCode(200)
  @RequirePermission('customer_portal.order.create', 'products.read')
  async step(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ShoppingStepDto,
  ) {
    const companyId = await resolveRequestCompanyId(
      this.scope,
      user.id,
      'products',
      dto.companyId,
    );
    return this.shopping.step(user.id, { ...dto, companyId });
  }
}
