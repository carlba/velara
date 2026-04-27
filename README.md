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
- Sort by popularity or rating

## Installation

Requires Node.js 24+, Docker (for PostgreSQL), and API keys for
[TMDB](https://www.themoviedb.org/settings/api) and
[OMDb](https://www.omdbapi.com/apikey.aspx).

```bash
cp .env.example .env
# Fill in DATABASE_URL, TMDB_API_KEY, OMDB_API_KEY, JWT_SECRET
npm install
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
# Build all packages
npm run build

# Lint all packages
npm run lint

# Run tests
npm test
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) if present.

## License

See LICENSE.
