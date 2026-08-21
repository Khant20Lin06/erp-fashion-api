import {
  Body,
  Controller,
  Get,
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
import { resolveRequestCompanyBranchScope } from '../../master-data/utils/resolve-request-company-branch-scope';
import { DataScope } from '../../rbac/enums/data-scope.enum';
import { AppException } from '../../../core/errors/app.exception';
import { ErrorCode } from '../../../core/errors/error-codes';
import {
  AttendanceRecordResponseDto,
  CreateAttendanceRecordDto,
  ListAttendanceRecordsDto,
  toAttendanceRecordResponseDto,
  UpdateAttendanceRecordDto,
} from '../dto/attendance.dto';
import { AttendanceService } from '../services/attendance.service';

const RESOURCE = 'attendance';

@ApiTags('HR - Attendance')
@Controller('attendance')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('attendance.read')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListAttendanceRecordsDto,
  ): Promise<{ data: AttendanceRecordResponseDto[]; meta: unknown }> {
    const resolved = await this.dataScopeService.resolveScope(
      user.id,
      RESOURCE,
    );
    if (!resolved) {
      throw new AppException(
        ErrorCode.Forbidden,
        'No data scope is configured for this resource',
      );
    }

    const result =
      resolved.scope === DataScope.Own
        ? await this.attendanceService.findAll(user.id, query, {
            ownOnly: true,
          })
        : await this.attendanceService.findAll(
            user.id,
            query,
            await resolveRequestCompanyBranchScope(
              this.dataScopeService,
              user.id,
              RESOURCE,
              query.companyId,
              query.branchId,
            ),
          );
    return {
      data: result.data.map(toAttendanceRecordResponseDto),
      meta: result.meta,
    };
  }

  @Get(':id')
  @RequirePermission('attendance.read')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<AttendanceRecordResponseDto> {
    const resolved = await this.dataScopeService.resolveScope(
      user.id,
      RESOURCE,
    );
    if (!resolved) {
      throw new AppException(
        ErrorCode.Forbidden,
        'No data scope is configured for this resource',
      );
    }

    const entity =
      resolved.scope === DataScope.Own
        ? await this.attendanceService.findById(id, user.id, { ownOnly: true })
        : await this.attendanceService.findById(
            id,
            user.id,
            await resolveRequestCompanyBranchScope(
              this.dataScopeService,
              user.id,
              RESOURCE,
              companyIdQuery,
              undefined,
            ),
          );

    return toAttendanceRecordResponseDto(entity);
  }

  @Post()
  @RequirePermission('attendance.create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAttendanceRecordDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<AttendanceRecordResponseDto> {
    const companyScope = await resolveRequestCompanyBranchScope(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
      undefined,
    );
    const entity = await this.attendanceService.create(
      companyScope.companyId,
      dto,
    );
    return toAttendanceRecordResponseDto(entity);
  }

  @Patch(':id')
  @RequirePermission('attendance.update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAttendanceRecordDto,
    @Query('companyId') companyIdQuery?: string,
  ): Promise<AttendanceRecordResponseDto> {
    const companyScope = await resolveRequestCompanyBranchScope(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
      undefined,
    );
    await this.attendanceService.findById(id, user.id, companyScope);
    const entity = await this.attendanceService.update(
      id,
      companyScope.companyId,
      dto,
    );
    return toAttendanceRecordResponseDto(entity);
  }
}
