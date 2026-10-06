import { Logger } from 'nestjs-pino';
import { createApp } from './app.factory';
import { AppConfigService } from './config/app-config.service';
import { OPENAPI_DOCS_PATH, OPENAPI_JSON_PATH, setupOpenApi } from './openapi/openapi';

async function bootstrap(): Promise<void> {
  const app = await createApp();
  setupOpenApi(app);

  const config = app.get(AppConfigService);
  const port = config.get('PORT');
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(
    `Dreamhouse API listening on http://localhost:${port} (env=${config.get('NODE_ENV')})`,
  );
  logger.log(
    `OpenAPI: http://localhost:${port}/${OPENAPI_JSON_PATH}  docs: http://localhost:${port}/${OPENAPI_DOCS_PATH}`,
  );
}

bootstrap().catch((error) => {
  console.error('Failed to start Dreamhouse API', error);
  process.exit(1);
});
