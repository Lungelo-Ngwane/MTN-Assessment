import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { CalculateRepaymentDto } from './calculate-repayment.dto';
import { InvalidRepaymentAmountError } from './repayment-calculator';
import { RepaymentService } from './repayment.service';

@Controller({ path: 'contracts', version: '1' })
export class RepaymentController {
  constructor(private readonly repayments: RepaymentService) {}

  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  calculate(@Body() input: CalculateRepaymentDto) {
    try {
      return this.repayments.calculate(input.deviceAmount);
    } catch (error) {
      if (error instanceof InvalidRepaymentAmountError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
