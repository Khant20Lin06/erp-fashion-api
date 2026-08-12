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
import { EmployeesService } from '../services/employees.service';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { UpdateEmployeeDto } from '../dto/update-employee.dto';
import { ListEmployeesDto } from '../dto/list-employees.dto';
import { LinkUserDto } from '../dto/link-user.dto';
import {
  EmployeeResponseDto,
  toEmployeeResponseDto,
} from '../dto/employee-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../rbac/guards/permission.guard';
import { RequirePermission } from '../../rbac/decorators/require-permission.decorator';

@ApiTags('Employees')
@Controller('employees')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @RequirePermission('employees.read')
  async findAll(
    @Query() query: ListEmployeesDto,
  ): Promise<{ data: EmployeeResponseDto[]; meta: unknown }> {
    const result = await this.employeesService.findAll(query);
    return {
      data: result.data.map(toEmployeeResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('employees.read')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EmployeeResponseDto> {
    const employee = await this.employeesService.findById(id);
    return toEmployeeResponseDto(employee);
  }

  @Post()
  @RequirePermission('employees.create')
  async create(@Body() dto: CreateEmployeeDto): Promise<EmployeeResponseDto> {
    const employee = await this.employeesService.create(dto);
    return toEmployeeResponseDto(employee);
  }

  @Patch(':id')
  @RequirePermission('employees.update')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ): Promise<EmployeeResponseDto> {
    const employee = await this.employeesService.update(id, dto);
    return toEmployeeResponseDto(employee);
  }

  @Post(':id/user')
  @RequirePermission('employees.update')
  async linkUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkUserDto,
  ): Promise<EmployeeResponseDto> {
    const employee = await this.employeesService.linkUser(id, dto.userId);
    return toEmployeeResponseDto(employee);
  }

  @Delete(':id/user')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('employees.update')
  async unlinkUser(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EmployeeResponseDto> {
    const employee = await this.employeesService.unlinkUser(id);
    return toEmployeeResponseDto(employee);
  }

  @Post(':id/terminate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('employees.update')
  async terminate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EmployeeResponseDto> {
    const employee = await this.employeesService.terminate(id);
    return toEmployeeResponseDto(employee);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('employees.update')
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EmployeeResponseDto> {
    const employee = await this.employeesService.activate(id);
    return toEmployeeResponseDto(employee);
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('employees.update')
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EmployeeResponseDto> {
    const employee = await this.employeesService.deactivate(id);
    return toEmployeeResponseDto(employee);
  }
}
