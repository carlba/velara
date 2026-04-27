import got from 'got';
import { config } from '../registry.js';

export const tmdbClient = got.extend({
  prefixUrl: 'https://api.themoviedb.org/3',
  responseType: 'json',
  headers: {
    Authorization: `Bearer ${config.TMDB_API_KEY}`,
    Accept: 'application/json',
  },
});
