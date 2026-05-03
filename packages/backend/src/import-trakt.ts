import { fileURLToPath } from 'node:url';
import path, { dirname } from 'node:path';
import fs from 'fs/promises';
import type { TraktExport } from './trakt.types.js';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFile);

const listRatedMovies = (traktExport: TraktExport) => {
  return traktExport.ratings?.filter(rating => rating.type === 'movie');
};

const listMovieHistory = (traktExport: TraktExport) => {
  return traktExport.history?.filter(record => record.type === 'movie');
};

async function main() {
  const contents = JSON.parse(
    await fs.readFile(path.join(currentDir, 'data.json'), 'utf-8')
  ) as TraktExport;

  console.log(listMovieHistory(contents));

  console.log(listRatedMovies(contents));
}

await main();
