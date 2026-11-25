import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

class EmailDto {
  @ApiProperty({
    type: 'string',
    format: 'email',
    maxLength: 254,
    example: 'assessment@example.test',
    description:
      'Email is trimmed and lowercased before validation and lookup.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class LoginDto extends EmailDto {
  @ApiProperty({
    type: 'string',
    format: 'password',
    minLength: 1,
    maxLength: 128,
    writeOnly: true,
    example: 'Demo passphrase! 123',
  })
  @IsString()
  @Length(1, 128)
  password!: string;
}

export class RegisterDto extends EmailDto {
  @ApiProperty({
    type: 'string',
    format: 'password',
    minLength: 12,
    maxLength: 128,
    writeOnly: true,
    example: 'Demo passphrase! 123',
  })
  @IsString()
  @Length(12, 128)
  password!: string;
}
