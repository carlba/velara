import packageJson from '../package.json' with { type: 'json' };
import { initConfig } from './lib/config.js';
import { createLogger } from './lib/logger.js';
import { envSchema } from './schema.js';

const PACKAGE_NAME = packageJson.name;

export const bootstrapLogger = createLogger(undefined, 'production').child({
  name: PACKAGE_NAME,
});
export const config = initConfig(envSchema, bootstrapLogger);
export const LOGGER = createLogger(undefined, config.NODE_ENV).child({ name: PACKAGE_NAME });
