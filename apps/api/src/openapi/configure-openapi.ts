import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { LoginDto, RegisterDto } from '../auth/credentials.dto';
import {
  CreateContractDto,
  UpdateContractDto,
} from '../contracts/contract.dto';
import { CalculateRepaymentDto } from '../repayment/calculate-repayment.dto';
import { BEARER_SCHEME } from './api-operation';
import { responseSchemas } from './response-schemas';

export function configureOpenApi(app: INestApplication): void {
  const options = new DocumentBuilder()
    .setTitle('Contract Repayment API')
    .setDescription(
      'Compare ZAR repayment options and manage authenticated contract snapshots.',
    )
    .setVersion('1.0.0')
    .addTag('Authentication')
    .addTag('Repayment')
    .addTag('Contracts')
    .addTag('Health')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      BEARER_SCHEME,
    )
    .build();

  const document = SwaggerModule.createDocument(app, options);
  const schemas = document.components?.schemas;
  for (const dto of [
    LoginDto,
    RegisterDto,
    CreateContractDto,
    UpdateContractDto,
    CalculateRepaymentDto,
  ]) {
    const schema = schemas?.[dto.name];
    if (schema && !('$ref' in schema)) {
      schema.additionalProperties = false;
      if (dto === UpdateContractDto) schema.minProperties = 1;
    }
  }
  document.components = {
    ...document.components,
    schemas: { ...schemas, ...responseSchemas },
  };

  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    swaggerUrl: '/api/docs-json',
    raw: ['json'],
    swaggerOptions: {
      persistAuthorization: false,
      validatorUrl: null,
      queryConfigEnabled: false,
    },
  });
}
