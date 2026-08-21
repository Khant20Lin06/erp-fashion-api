import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  LoyaltyProgramResponseDto,
  toLoyaltyProgramResponseDto,
  UpsertLoyaltyProgramDto,
} from '../dto/loyalty-program.dto';
import { LoyaltyProgramService } from '../services/loyalty-program.service';

const RESOURCE = 'loyalty';

@ApiTags('Loyalty - Program')
@Controller('loyalty/program')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class LoyaltyProgramController {
  constructor(
    private readonly loyaltyProgramService: LoyaltyProgramService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('loyalty.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<LoyaltyProgramResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity =
      await this.loyaltyProgramService.findByCompanyIdOrNull(companyId);
    if (!entity) {
      throw new AppException(
        ErrorCode.NotFound,
        'Loyalty program has not been set up for this company',
      );
    }
    return toLoyaltyProgramResponseDto(entity);
  }

  @Put()
  @RequirePermission('loyalty.manage')
  async upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertLoyaltyProgramDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<LoyaltyProgramResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const entity = await this.loyaltyProgramService.upsert(
      companyId,
      user.id,
      dto,
    );
    return toLoyaltyProgramResponseDto(entity);
  }
}
