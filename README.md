# Velara

A full-stack movie tracker app. Search and discover movies via TMDB,
track what you've watched, rate films 1–5, and write reviews. Displays
TMDB, IMDb, and Rotten Tomatoes ratings on each movie detail page.

## Features

- Browse and search movies powered by TMDB
- View IMDb and Rotten Tomatoes scores (via OMDb)
- Multi-user auth with JWT stored in httpOnly cookies
- Mark movies as watched with a date
- Rate movies 1–5 stars and write reviews
- Import ratings or comments from Filmtipset CSV exports
- Sort by popularity or rating

## Installation

Requires Node.js 24+, Docker (for PostgreSQL), and API keys for
[TMDB](https://www.themoviedb.org/settings/api) and
[OMDb](https://www.omdbapi.com/apikey.aspx).

```bash
cp .env.example .env
# Fill in DATABASE_URL, TMDB_API_KEY, OMDB_API_KEY, JWT_SECRET,
# TRAKT_CLIENT_ID, and TRAKT_CLIENT_SECRET
npm install
cd packages/backend && npm run db:generate
```

Start the database:

```bash
docker compose up -d postgres
```

Run migrations and start dev servers:

```bash
cd packages/backend && npx prisma migrate dev
npm run start:dev --workspaces --if-present
```

The backend runs on `http://localhost:3070` and the frontend on
`http://localhost:5173`.

## Usage

```bash
# Generate backend Prisma client (required after install or schema changes)
cd packages/backend && npm run db:generate

# Build all packages
npm run build

# Lint all packages
npm run lint

# Run tests
npm test

## Plex integration

Velara can record movies and episodes as watched automatically when Plex
finishes playing them, via a Plex webhook.

1. Log in to Velara in your browser, then open the browser console on any
   Velara page and run:

   ```js
   await fetch('/api/plex/integration', { method: 'POST', credentials: 'include' })
     .then(r => r.json())
   ```

   This reuses your existing login session cookie automatically. The
   response includes a `webhookToken`. Your webhook URL is:

   ```
   http://<velara-backend-host>:3070/api/plex/webhook/<webhookToken>
   ```

2. In Plex, go to **Settings → Webhooks** (requires Plex Pass) and add the
   URL above.

3. Play a movie or episode to completion in Plex. Velara listens for
   `media.scrobble` events and marks the corresponding title as watched,
   matching it by TMDB, IMDb, or TheTVDB id embedded in the Plex metadata.

Notes:

- The webhook URL contains a secret token and is not otherwise
  authenticated — treat it like a password and rotate it (`POST
  /api/plex/integration` again) if it leaks.
- Remove the integration with `DELETE /api/plex/integration`.
- Since Plex webhooks don't include a real watch history, Velara dedupes
  by user and by day, so repeated or duplicate scrobble events for the same
  title on the same day won't create extra watch history entries.

## Database dump and restore
The database dump and restore commands execute `pg_dump` and `psql` inside the `postgres` container from the repository Docker Compose setup.

```bash
cd packages/backend
npm run db:dump
npm run db:restore
```

The dump file is written to `packages/backend/db/velara.sql`.

## Development

### Flexget

The flexget API documentation can be found at `http://localhost:5050/api/`

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) if present.

## License

See LICENSE.
