import { IsString, Matches } from 'class-validator';
import { DEVICE_AMOUNT_FORMAT } from './repayment-calculator';

export class CalculateRepaymentDto {
  @IsString()
  @Matches(DEVICE_AMOUNT_FORMAT)
  deviceAmount!: string;
}
