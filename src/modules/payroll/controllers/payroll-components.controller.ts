import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';
import {
  CreatePayrollComponentDto,
  ListPayrollComponentsDto,
  PayrollComponentResponseDto,
  toPayrollComponentResponseDto,
  UpdatePayrollComponentDto,
} from '../dto/payroll-components.dto';
import { PayrollComponentsService } from '../services/payroll-components.service';

const RESOURCE = 'payroll_components';

@ApiTags('Payroll - Components')
@Controller('payroll/components')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PayrollComponentsController {
  constructor(
    private readonly componentsService: PayrollComponentsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('payroll_components.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPayrollComponentsDto,
  ): Promise<{ data: PayrollComponentResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.componentsService.findAll(companyId, query);
    const usageById = await this.componentsService.getUsageSummaries(
      result.data.map((component) => component.id),
    );
    return {
      data: result.data.map((component) =>
        toPayrollComponentResponseDto(
          component,
          usageById.get(component.id),
        ),
      ),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('payroll_components.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PayrollComponentResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.componentsService.findByIdInCompany(
      id,
      companyId,
    );
    return toPayrollComponentResponseDto(
      entity,
      await this.componentsService.getUsageSummary(entity.id),
    );
  }

  @Post()
  @RequirePermission('payroll_components.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePayrollComponentDto,
  ): Promise<PayrollComponentResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const entity = await this.componentsService.create(companyId, user.id, dto);
    return toPayrollComponentResponseDto(
      entity,
      await this.componentsService.getUsageSummary(entity.id),
    );
  }

  @Patch(':id')
  @RequirePermission('payroll_components.update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePayrollComponentDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PayrollComponentResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.componentsService.update(
      id,
      companyId,
      user.id,
      dto,
    );
    return toPayrollComponentResponseDto(
      entity,
      await this.componentsService.getUsageSummary(entity.id),
    );
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payroll_components.update')
  async activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PayrollComponentResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.componentsService.activate(
      id,
      companyId,
      user.id,
    );
    return toPayrollComponentResponseDto(
      entity,
      await this.componentsService.getUsageSummary(entity.id),
    );
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('payroll_components.update')
  async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<PayrollComponentResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.componentsService.deactivate(
      id,
      companyId,
      user.id,
    );
    return toPayrollComponentResponseDto(
      entity,
      await this.componentsService.getUsageSummary(entity.id),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('payroll_components.delete')
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<void> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    await this.componentsService.remove(id, companyId);
  }
}
