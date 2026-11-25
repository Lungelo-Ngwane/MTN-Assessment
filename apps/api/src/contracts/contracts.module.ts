import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { RepaymentModule } from '../repayment/repayment.module';
import { ContractRepository } from './contract.repository';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';

@Module({
  imports: [DatabaseModule, RepaymentModule],
  controllers: [ContractsController],
  providers: [ContractRepository, ContractsService],
  exports: [ContractRepository],
})
export class ContractsModule {}
