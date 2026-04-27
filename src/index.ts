import { fileURLToPath } from 'url';
import { config, LOGGER } from './registry.js';

const logger = LOGGER.child({ module: 'index' });

export function helloWorld() {
  return `Hello World! NODE_ENV is ${config.NODE_ENV}`;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  logger.info(helloWorld());
}
