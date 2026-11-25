import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { InvalidRepaymentAmountError } from '../repayment/repayment-calculator';
import {
  CreateContractDto,
  ListContractsDto,
  UpdateContractDto,
} from './contract.dto';
import { ContractOwnerUnavailableError } from './contract.repository';
import {
  ContractsService,
  InvalidContractUpdateError,
} from './contracts.service';

@Controller({ path: 'contracts', version: '1' })
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateContractDto,
  ) {
    try {
      return await this.contracts.create(
        user.id,
        input.deviceAmount,
        input.termMonths,
      );
    } catch (error) {
      if (error instanceof ContractOwnerUnavailableError)
        throw new UnauthorizedException();
      if (error instanceof InvalidRepaymentAmountError)
        throw new BadRequestException(error.message);
      throw error;
    }
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListContractsDto,
  ) {
    return this.contracts.list(
      user.id,
      Number(query.page),
      Number(query.pageSize),
    );
  }

  @Get(':id')
  async find(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const contract = await this.contracts.find(user.id, id);
    if (!contract) throw new NotFoundException();
    return contract;
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() changes: UpdateContractDto,
  ) {
    try {
      const contract = await this.contracts.update(user.id, id, changes);
      if (!contract) throw new NotFoundException();
      return contract;
    } catch (error) {
      if (
        error instanceof InvalidContractUpdateError ||
        error instanceof InvalidRepaymentAmountError
      ) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!(await this.contracts.delete(user.id, id)))
      throw new NotFoundException();
  }
}
