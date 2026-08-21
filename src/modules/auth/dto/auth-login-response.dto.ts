import { ApiProperty } from '@nestjs/swagger';
import { SafeUserDto } from './safe-user.dto';

export class AuthLoginResponseDto {
  @ApiProperty({ type: SafeUserDto })
  user!: SafeUserDto;
}
