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
import { ChannelsService } from '../services/channels.service';
import { SyncChannelOrderDto, UpdateChannelDto } from '../dto/sync-channel-order.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../shared/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user';
import { DataScopeService } from '../../rbac/services/data-scope.service';
import { resolveRequestCompanyId } from '../../master-data/utils/resolve-request-company-id';

const RESOURCE = 'sales';

@ApiTags('Omnichannel & E-Commerce')
@Controller('channels')
export class ChannelsController {
  constructor(
    private readonly channelsService: ChannelsService,
    private readonly dataScopeService: DataScopeService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getChannels(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyIdQuery?: string,
  ) {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    return this.channelsService.getChannels(companyId);
  }

  @Get('catalog-feed')
  async getCatalogFeed(
    @Query('companyId') companyId?: string,
    @Query('channel') channel?: string,
  ) {
    if (!companyId) {
      return { error: 'companyId query parameter is required' };
    }
    return this.channelsService.generateCatalogFeed(companyId, channel);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getChannelById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ) {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    return this.channelsService.getChannelById(id, companyId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async updateChannel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChannelDto,
    @Query('companyId') companyIdQuery?: string,
  ) {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    return this.channelsService.updateChannel(id, companyId, dto);
  }

  @Post(':id/sync')
  @UseGuards(JwtAuthGuard)
  async triggerSync(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('companyId') companyIdQuery?: string,
  ) {
    const companyId = await resolveRequestCompanyId(
      this.dataScopeService,
      user.id,
      RESOURCE,
      companyIdQuery,
    );
    return this.channelsService.triggerSync(id, companyId);
  }

  @Post('sync-orders')
  async syncOrder(
    @Body() dto: SyncChannelOrderDto,
    @Query('companyId') companyIdQuery?: string,
  ) {
    const companyId = companyIdQuery || 'company-default';
    return this.channelsService.ingestOrder(companyId, dto);
  }
}
