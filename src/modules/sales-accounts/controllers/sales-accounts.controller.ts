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
import { SalesAccountsService } from '../services/sales-accounts.service';
import { SalesAccountAssignmentService } from '../services/sales-account-assignment.service';
import { CreateSalesAccountDto } from '../dto/create-sales-account.dto';
import { UpdateSalesAccountDto } from '../dto/update-sales-account.dto';
import { ListSalesAccountsDto } from '../dto/list-sales-accounts.dto';
import { AssignSalesAccountDto } from '../dto/assign-sales-account.dto';
import {
  SalesAccountResponseDto,
  toSalesAccountResponseDto,
} from '../dto/sales-account-response.dto';
import {
  SalesAccountAssignmentResponseDto,
  toSalesAccountAssignmentResponseDto,
} from '../dto/sales-account-assignment-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';

@ApiTags('Sales Accounts')
@Controller('sales-accounts')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SalesAccountsController {
  constructor(
    private readonly salesAccountsService: SalesAccountsService,
    private readonly assignmentService: SalesAccountAssignmentService,
  ) {}

  @Get()
  @RequirePermission('sales_accounts.read')
  async findAll(
    @Query() query: ListSalesAccountsDto,
  ): Promise<{ data: SalesAccountResponseDto[]; meta: unknown }> {
    const result = await this.salesAccountsService.findAll(query);
    return {
      data: result.data.map(toSalesAccountResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('sales_accounts.read')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SalesAccountResponseDto> {
    const account = await this.salesAccountsService.findById(id);
    return toSalesAccountResponseDto(account);
  }

  @Post()
  @RequirePermission('sales_accounts.create')
  async create(
    @Body() dto: CreateSalesAccountDto,
  ): Promise<SalesAccountResponseDto> {
    const account = await this.salesAccountsService.create(dto);
    return toSalesAccountResponseDto(account);
  }

  @Patch(':id')
  @RequirePermission('sales_accounts.update')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSalesAccountDto,
  ): Promise<SalesAccountResponseDto> {
    const account = await this.salesAccountsService.update(id, dto);
    return toSalesAccountResponseDto(account);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales_accounts.update')
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SalesAccountResponseDto> {
    const account = await this.salesAccountsService.activate(id);
    return toSalesAccountResponseDto(account);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('sales_accounts.update')
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SalesAccountResponseDto> {
    const account = await this.salesAccountsService.deactivate(id);
    return toSalesAccountResponseDto(account);
  }

  @Get(':id/assignments')
  @RequirePermission('sales_accounts.read')
  async listAssignments(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SalesAccountAssignmentResponseDto[]> {
    const assignments = await this.assignmentService.listForAccount(id);
    return assignments.map(toSalesAccountAssignmentResponseDto);
  }

  @Post(':id/assignments')
  @RequirePermission('sales_accounts.assign')
  async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignSalesAccountDto,
  ): Promise<SalesAccountAssignmentResponseDto> {
    const assignment = await this.assignmentService.assign(
      id,
      dto.userId,
      dto.employeeId,
    );
    return toSalesAccountAssignmentResponseDto(assignment);
  }

  @Delete(':id/assignments/:assignmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('sales_accounts.unassign')
  async unassign(
    @Param('id', ParseUUIDPipe) _id: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
  ): Promise<void> {
    await this.assignmentService.unassign(assignmentId);
  }
}
