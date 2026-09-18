import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BranchTransfersService } from '../services/branch-transfers.service';
import { CreateBranchTransferDto } from '../dto/create-branch-transfer.dto';
import { DispatchBranchTransferDto } from '../dto/dispatch-branch-transfer.dto';
import { ReceiveBranchTransferDto } from '../dto/receive-branch-transfer.dto';
import { ListBranchTransfersDto } from '../dto/list-branch-transfers.dto';
import { BranchTransferResponseDto } from '../dto/branch-transfer-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';

const RESOURCE = 'stock_transfers';

@ApiTags('Branch Transfers')
@Controller('branch-transfers')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BranchTransfersController {
  constructor(
    private readonly branchTransfersService: BranchTransfersService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('stock_transfers.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListBranchTransfersDto,
  ): Promise<{ data: BranchTransferResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    return this.branchTransfersService.findAllView(companyId, query);
  }

  @Get(':id')
  @RequirePermission('stock_transfers.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<BranchTransferResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    return this.branchTransfersService.findViewByIdInCompany(id, companyId);
  }

  @Post()
  @RequirePermission('stock_transfers.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBranchTransferDto,
  ): Promise<BranchTransferResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    return this.branchTransfersService.createView(companyId, user.id, dto);
  }

  @Post(':id/dispatch')
  @RequirePermission('stock_transfers.create')
  async dispatch(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DispatchBranchTransferDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<BranchTransferResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    return this.branchTransfersService.dispatchView(id, companyId, user.id, dto);
  }

  @Post(':id/receive')
  @RequirePermission('stock_transfers.create')
  async receive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceiveBranchTransferDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<BranchTransferResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    return this.branchTransfersService.receiveView(id, companyId, user.id, dto);
  }

  @Post(':id/cancel')
  @RequirePermission('stock_transfers.create')
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<BranchTransferResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    return this.branchTransfersService.cancelView(id, companyId, user.id);
  }
}
