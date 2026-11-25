import { Module } from '@nestjs/common';
import { AmortisedRepaymentCalculator } from './amortised-repayment.calculator';
import { REPAYMENT_CALCULATOR } from './repayment-calculator';
import { RepaymentController } from './repayment.controller';
import { RepaymentService } from './repayment.service';

@Module({
  controllers: [RepaymentController],
  providers: [
    RepaymentService,
    { provide: REPAYMENT_CALCULATOR, useClass: AmortisedRepaymentCalculator },
  ],
  exports: [RepaymentService],
})
export class RepaymentModule {}
