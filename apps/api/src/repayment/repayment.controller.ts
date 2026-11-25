import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CalculateRepaymentDto } from './calculate-repayment.dto';
import { RepaymentService } from './repayment.service';

@Controller({ path: 'contracts', version: '1' })
export class RepaymentController {
  constructor(private readonly repayments: RepaymentService) {}

  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  calculate(@Body() input: CalculateRepaymentDto) {
    return this.repayments.calculate(input.deviceAmount);
  }
}
