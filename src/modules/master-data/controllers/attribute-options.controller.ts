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
import { AttributeOptionsService } from '../services/attribute-options.service';
import { CreateAttributeOptionDto } from '../dto/create-attribute-option.dto';
import { UpdateAttributeOptionDto } from '../dto/update-attribute-option.dto';
import { ListAttributeOptionsDto } from '../dto/list-attribute-options.dto';
import {
  AttributeOptionResponseDto,
  toAttributeOptionResponseDto,
} from '../dto/attribute-option-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { resolveRequestCompanyId } from '../utils/resolve-request-company-id';

const RESOURCE = 'attribute_options';

@ApiTags('Master Data - Attribute Options')
@Controller('attribute-options')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AttributeOptionsController {
  constructor(
    private readonly attributeOptionsService: AttributeOptionsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('attribute_options.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAttributeOptionsDto,
  ): Promise<{ data: AttributeOptionResponseDto[]; meta: unknown }> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      query.companyId,
    );
    const result = await this.attributeOptionsService.findAll(companyId, query);
    return {
      data: result.data.map(toAttributeOptionResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('attribute_options.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<AttributeOptionResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const option = await this.attributeOptionsService.findByIdInCompany(
      id,
      companyId,
    );
    return toAttributeOptionResponseDto(option);
  }

  @Post()
  @RequirePermission('attribute_options.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAttributeOptionDto,
  ): Promise<AttributeOptionResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      dto.companyId,
    );
    const option = await this.attributeOptionsService.create(companyId, dto);
    return toAttributeOptionResponseDto(option);
  }

  @Patch(':id')
  @RequirePermission('attribute_options.update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAttributeOptionDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<AttributeOptionResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const option = await this.attributeOptionsService.update(
      id,
      companyId,
      dto,
    );
    return toAttributeOptionResponseDto(option);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('attribute_options.update')
  async activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<AttributeOptionResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const option = await this.attributeOptionsService.activate(id, companyId);
    return toAttributeOptionResponseDto(option);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('attribute_options.update')
  async deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<AttributeOptionResponseDto> {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    const option = await this.attributeOptionsService.deactivate(id, companyId);
    return toAttributeOptionResponseDto(option);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('attribute_options.delete')
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
    await this.attributeOptionsService.remove(id, companyId);
  }
}
