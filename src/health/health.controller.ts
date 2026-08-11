import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/app.config';

interface HealthResponse {
  status: 'ok';
  service: string;
  environment: string;
  timestamp: string;
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  check(): HealthResponse {
    const appConfig = this.configService.get<AppConfig>('app')!;

    return {
      status: 'ok',
      service: 'fashion-erp-backend',
      environment: appConfig.nodeEnv,
      timestamp: new Date().toISOString(),
    };
  }
}
