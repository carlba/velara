import got from 'got';
import { config } from '../registry.js';

export const omdbClient = got.extend({
  prefixUrl: 'https://www.omdbapi.com',
  responseType: 'json',
  searchParams: {
    apikey: config.OMDB_API_KEY,
  },
});
