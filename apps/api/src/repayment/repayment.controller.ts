import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BODY_ERRORS, DocumentOperation } from '../openapi/api-operation';
import { CalculateRepaymentDto } from './calculate-repayment.dto';
import { RepaymentService } from './repayment.service';

@Controller({ path: 'contracts', version: '1' })
@ApiTags('Repayment')
export class RepaymentController {
  constructor(private readonly repayments: RepaymentService) {}

  @Post('calculate')
  @DocumentOperation({
    summary: 'Calculate repayment options',
    description:
      'Quotes 12, 24 and 36 months at 6.5% nominal annual interest using monthly reducing-balance amortisation. Regular instalments and an adjusted final instalment reconcile to the total. The operation performs no database writes.',
    status: 200,
    response: 'RepaymentQuote',
    errors: [...BODY_ERRORS, 'INVALID_DEVICE_AMOUNT'],
  })
  @HttpCode(HttpStatus.OK)
  calculate(@Body() input: CalculateRepaymentDto) {
    return this.repayments.calculate(input.deviceAmount);
  }
}
