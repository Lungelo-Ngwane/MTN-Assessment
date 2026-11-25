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
import { ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { parseUuid } from '../http/request-validation';
import { BODY_ERRORS, DocumentOperation } from '../openapi/api-operation';
import {
  CreateContractDto,
  ListContractsDto,
  UpdateContractDto,
} from './contract.dto';
import { ContractsService } from './contracts.service';

const ContractId = ApiParam({
  name: 'id',
  description: 'Contract UUID.',
  schema: { type: 'string', format: 'uuid' },
});

@Controller({ path: 'contracts', version: '1' })
@ApiTags('Contracts')
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Post()
  @DocumentOperation({
    summary: 'Create a contract',
    description:
      'Persists the selected repayment term as a financial snapshot with a calculation method and version. The JWT identifies the owner.',
    status: 201,
    response: 'Contract',
    errors: [...BODY_ERRORS, 'INVALID_DEVICE_AMOUNT', 'DATABASE_UNAVAILABLE'],
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateContractDto,
  ) {
    return this.contracts.create(user.id, input.deviceAmount, input.termMonths);
  }

  @Get()
  @DocumentOperation({
    summary: 'List the current user’s contracts',
    description:
      'Returns an owner-scoped page ordered by creation time and UUID, both descending.',
    status: 200,
    response: 'ContractPage',
    errors: ['VALIDATION_FAILED', 'DATABASE_UNAVAILABLE'],
  })
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
  @ContractId
  @DocumentOperation({
    summary: 'Read a contract',
    description:
      'Returns the selected contract for its owner. Missing and inaccessible records return the same 404 response.',
    status: 200,
    response: 'Contract',
    errors: ['INVALID_UUID', 'NOT_FOUND', 'DATABASE_UNAVAILABLE'],
  })
  async find(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', parseUuid) id: string,
  ) {
    const contract = await this.contracts.find(user.id, id);
    if (!contract) throw new NotFoundException();
    return contract;
  }

  @Patch(':id')
  @ContractId
  @DocumentOperation({
    summary: 'Update a contract',
    description:
      'Provide deviceAmount, termMonths or both. The server recalculates and replaces the financial snapshot in one transaction.',
    status: 200,
    response: 'Contract',
    errors: [
      ...BODY_ERRORS,
      'INVALID_UUID',
      'INVALID_DEVICE_AMOUNT',
      'INVALID_CONTRACT_UPDATE',
      'NOT_FOUND',
      'DATABASE_UNAVAILABLE',
    ],
  })
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
  @ContractId
  @DocumentOperation({
    summary: 'Delete a contract',
    description:
      'Permanently deletes a contract owned by the current user. The successful response has no body.',
    status: 204,
    errors: ['INVALID_UUID', 'NOT_FOUND', 'DATABASE_UNAVAILABLE'],
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', parseUuid) id: string,
  ) {
    if (!(await this.contracts.delete(user.id, id)))
      throw new NotFoundException();
  }
}
