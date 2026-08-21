import { ApiProperty } from '@nestjs/swagger';

export class SimpleSuccessResponseDto {
  @ApiProperty({ example: true })
  success!: true;
}
