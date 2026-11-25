const { createHash } = require('node:crypto');

process.env.JWT_SECRET = createHash('sha256')
  .update('isolated Jest fixture')
  .digest('base64url');
process.env.JWT_ISSUER = 'test-issuer';
process.env.JWT_AUDIENCE = 'test-audience';
process.env.JWT_TTL_SECONDS = '900';
process.env.AUTH_RATE_LIMIT = '30';
process.env.AUTH_RATE_WINDOW_SECONDS = '60';
process.env.CORS_ORIGINS = 'https://client.example.test';
process.env.LOG_LEVEL = 'silent';
process.env.SWAGGER_ENABLED = 'false';
process.env.METRICS_ENABLED = 'false';
