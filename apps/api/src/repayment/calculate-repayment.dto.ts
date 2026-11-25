import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { deviceAmountField } from '../openapi/financial-fields';
import { DEVICE_AMOUNT_FORMAT } from './repayment-calculator';

export class CalculateRepaymentDto {
  @ApiProperty(deviceAmountField)
  @IsString()
  @Matches(DEVICE_AMOUNT_FORMAT)
  deviceAmount!: string;
}
