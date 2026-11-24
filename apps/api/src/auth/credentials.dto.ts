import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

class EmailDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class LoginDto extends EmailDto {
  @IsString()
  @Length(1, 128)
  password!: string;
}

export class RegisterDto extends EmailDto {
  @IsString()
  @Length(12, 128)
  password!: string;
}
