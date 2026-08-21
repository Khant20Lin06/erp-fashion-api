import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status!: 'ok';

  @ApiProperty({ example: 'fashion-erp-backend' })
  service!: string;

  @ApiProperty({ example: 'development' })
  environment!: string;

  @ApiProperty({ example: 'all', enum: ['all', 'api', 'worker'] })
  role!: 'all' | 'api' | 'worker';

  @ApiProperty({ example: '2026-08-15T09:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: true })
  ready!: boolean;

  @ApiProperty({ example: 'up', enum: ['up', 'down'] })
  mysql!: 'up' | 'down';

  @ApiProperty({ example: 'up', enum: ['up', 'down'] })
  kafka!: 'up' | 'down';

  @ApiProperty({ example: 'up', enum: ['up', 'down'] })
  redis!: 'up' | 'down';

  @ApiProperty({ example: 'up', enum: ['up', 'down'] })
  bullmq!: 'up' | 'down';
}
