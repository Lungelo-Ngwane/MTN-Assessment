import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ContractRepository } from './contract.repository';

@Module({
  imports: [DatabaseModule],
  providers: [ContractRepository],
  exports: [ContractRepository],
})
export class ContractsModule {}
