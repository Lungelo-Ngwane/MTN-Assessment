import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { parseUuid } from '../http/request-validation';
import {
  CreateContractDto,
  ListContractsDto,
  UpdateContractDto,
} from './contract.dto';
import { ContractsService } from './contracts.service';

@Controller({ path: 'contracts', version: '1' })
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateContractDto,
  ) {
    return this.contracts.create(user.id, input.deviceAmount, input.termMonths);
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
    @Param('id', parseUuid) id: string,
  ) {
    const contract = await this.contracts.find(user.id, id);
    if (!contract) throw new NotFoundException();
    return contract;
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', parseUuid) id: string,
    @Body() changes: UpdateContractDto,
  ) {
    const contract = await this.contracts.update(user.id, id, changes);
    if (!contract) throw new NotFoundException();
    return contract;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', parseUuid) id: string,
  ) {
    if (!(await this.contracts.delete(user.id, id)))
      throw new NotFoundException();
  }
}
