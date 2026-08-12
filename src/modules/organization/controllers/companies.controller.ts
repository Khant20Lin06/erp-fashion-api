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
import { CompaniesService } from '../services/companies.service';
import { CreateCompanyDto } from '../dto/create-company.dto';
import { UpdateCompanyDto } from '../dto/update-company.dto';
import {
  CompanyResponseDto,
  toCompanyResponseDto,
} from '../dto/company-response.dto';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';

@ApiTags('Organization - Companies')
@Controller('companies')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @RequirePermission('companies.read')
  async findAll(
    @Query() pagination: PaginationDto,
  ): Promise<{ data: CompanyResponseDto[]; meta: unknown }> {
    const result = await this.companiesService.findAll(pagination);
    return {
      data: result.data.map(toCompanyResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('companies.read')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CompanyResponseDto> {
    const company = await this.companiesService.findById(id);
    return toCompanyResponseDto(company);
  }

  @Post()
  @RequirePermission('companies.create')
  async create(@Body() dto: CreateCompanyDto): Promise<CompanyResponseDto> {
    const company = await this.companiesService.create(dto);
    return toCompanyResponseDto(company);
  }

  @Patch(':id')
  @RequirePermission('companies.update')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyDto,
  ): Promise<CompanyResponseDto> {
    const company = await this.companiesService.update(id, dto);
    return toCompanyResponseDto(company);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('companies.update')
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CompanyResponseDto> {
    const company = await this.companiesService.activate(id);
    return toCompanyResponseDto(company);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('companies.update')
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CompanyResponseDto> {
    const company = await this.companiesService.deactivate(id);
    return toCompanyResponseDto(company);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('companies.delete')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.companiesService.remove(id);
  }
}
