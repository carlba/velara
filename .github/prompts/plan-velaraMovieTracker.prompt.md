# Plan: Velara Movie Tracker App

**TL;DR:** Transform the existing TypeScript template into a full-stack monorepo. Backend: Fastify +
Prisma + PostgreSQL (migrated from the existing `src/`). Frontend: React + Vite + shadcn/ui +
Tailwind. TMDB as primary data source, OMDb API for RT scores and IMDb ratings (server-side only —
key never exposed). JWT auth in httpOnly cookies for multi-user support.

---

## Monorepo Structure

```
velara/
  package.json              ← workspaces: ["packages/*"]
  docker-compose.yml
  .env.example
  packages/
    backend/                ← migrated from root src/
      prisma/schema.prisma
      src/
        index.ts            ← Fastify server
        registry.ts / schema.ts / lib/  ← kept, schema extended
        auth/               ← routes, service, middleware, types
        movies/             ← routes, service, tmdb-client, omdb-client
        reviews/            ← routes, service
        ratings/            ← routes, service
        watch/              ← routes, service
    frontend/               ← new Vite + React app
      src/
        components/ui/      ← shadcn/ui
        components/layout/  ← Header, Layout
        components/movies/  ← MovieCard, MovieGrid, MovieSearch, StarRating
        pages/movies/       ← MoviesPage
        pages/movie-details/ ← MovieDetailsPage
        pages/auth/         ← LoginPage, RegisterPage
        hooks/              ← useAuth, useMovies, useMovieDetails, useUserMovieData
        services/           ← api-client, movies-api, auth-api, user-data-api
```

---

## Database Schema (Prisma + PostgreSQL)

4 models: `User` · `Review` (tmdbId+userId unique) · `Rating` (score 1–5, unique per user/movie) ·
`WatchEntry` (with `watchedAt` timestamp)

```prisma
model User {
  id           Int          @id @default(autoincrement())
  email        String       @unique
  username     String       @unique
  passwordHash String
  createdAt    DateTime     @default(now())
  reviews      Review[]
  watchEntries WatchEntry[]
  ratings      Rating[]
}

model Review {
  id        Int      @id @default(autoincrement())
  tmdbId    Int
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  content   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([tmdbId, userId])
}

model WatchEntry {
  id        Int      @id @default(autoincrement())
  tmdbId    Int
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  watchedAt DateTime
  createdAt DateTime @default(now())
  @@unique([tmdbId, userId])
}

model Rating {
  id        Int      @id @default(autoincrement())
  tmdbId    Int
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  score     Int      // 1-5
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([tmdbId, userId])
}
```

---

## API Contract

| Method | Path                                          | Auth | Description                    |
| ------ | --------------------------------------------- | ---- | ------------------------------ |
| POST   | `/api/auth/register`                          | —    | Create account, set JWT cookie |
| POST   | `/api/auth/login`                             | —    | Sign in, set JWT cookie        |
| POST   | `/api/auth/logout`                            | —    | Clear cookie                   |
| GET    | `/api/auth/me`                                | ✓    | Current user                   |
| GET    | `/api/movies?search=&tmdb_id=&page=&sort_by=` | —    | TMDB search/discover           |
| GET    | `/api/movies/:tmdbId`                         | —    | Merged TMDB + OMDb detail      |
| GET    | `/api/movies/:tmdbId/user-data`               | ✓    | Watch + rating + review        |
| PUT    | `/api/movies/:tmdbId/watch`                   | ✓    | Upsert watch entry             |
| PUT    | `/api/movies/:tmdbId/rating`                  | ✓    | Upsert score 1–5               |
| PUT    | `/api/movies/:tmdbId/review`                  | ✓    | Upsert review text             |
| DELETE | `/api/movies/:tmdbId/watch`                   | ✓    | Remove watch entry             |
| DELETE | `/api/movies/:tmdbId/rating`                  | ✓    | Remove rating                  |
| DELETE | `/api/movies/:tmdbId/review`                  | ✓    | Remove review                  |

---

## Implementation Phases

### Phase 1 — Monorepo Restructure _(no dependencies)_

1. Update root `package.json` with `"workspaces": ["packages/*"]`; remove individual deps (they move
   to `packages/backend/`)
2. Move all existing files (`src/`, `tsconfig.json`, `eslint.config.js`, `vitest.config.ts`,
   `Dockerfile`) into `packages/backend/`; update internal paths
3. Scaffold `packages/frontend/` with Vite + React + TypeScript
4. Add `docker-compose.yml` at root (postgres + backend services)
5. Create `.env.example` at root

### Phase 2 — Backend: Infrastructure _(depends on Phase 1)_

6. Add backend deps: `fastify`, `@fastify/jwt`, `@fastify/cookie`, `@fastify/cors`,
   `@fastify/helmet`, `@prisma/client`, `prisma` (dev), `bcryptjs`, `@types/bcryptjs`, `got`
7. Extend `packages/backend/src/schema.ts` — add `DATABASE_URL`, `TMDB_API_KEY`, `OMDB_API_KEY`,
   `JWT_SECRET`, `PORT`
8. Create `packages/backend/src/lib/prisma.ts` — Prisma client singleton
9. Write `packages/backend/prisma/schema.prisma` — 4-model schema (User, Review, Rating, WatchEntry)
10. Rewrite `packages/backend/src/index.ts` as Fastify server entry with plugin registration (cors,
    helmet, jwt, cookie, routes)
11. Run `npx prisma generate` inside `packages/backend`

### Phase 3 — Backend: Auth Domain _(depends on Phase 2)_

12. `auth/auth-types.ts` — `JwtPayload` interface
13. `auth/auth-service.ts` — `register` (hash pw, create user), `login` (verify pw, sign JWT),
    `getMe`
14. `auth/auth-middleware.ts` — Fastify `preHandler` hook to verify JWT from httpOnly cookie
15. `auth/auth-routes.ts` — Fastify plugin: POST register/login/logout, GET me

### Phase 4 — Backend: Movies Domain _(parallel with Phase 3)_

16. `movies/tmdb-client.ts` —
    `got.extend({ prefixUrl: TMDB_BASE, headers: { Authorization: 'Bearer ...' } })`
17. `movies/omdb-client.ts` — `got.extend({ prefixUrl: OMDB_BASE, searchParams: { apikey } })`
18. `movies/movie-service.ts` — `searchMovies()`, `discoverMovies()`, `getMovieDetails()` (merges
    TMDB detail + external_ids + OMDb)
19. `movies/movie-types.ts` — `MovieListItem`, `MovieDetail`, `ExternalRatings` interfaces
20. `movies/movie-routes.ts` — GET `/api/movies`, GET `/api/movies/:tmdbId`

### Phase 5 — Backend: User Data Domains _(depends on Phase 3)_

21. `reviews/` — service + routes: PUT/DELETE `/api/movies/:tmdbId/review`
22. `ratings/` — service + routes: PUT/DELETE `/api/movies/:tmdbId/rating` (score 1–5)
23. `watch/` — service + routes: PUT/DELETE `/api/movies/:tmdbId/watch` (with `watchedAt`)
24. Combined GET `/api/movies/:tmdbId/user-data` — fetches all three in parallel

### Phase 6 — Frontend: Setup _(parallel with Phases 3–5)_

25. Install frontend deps: `react-router-dom`, `@tanstack/react-query`, `react-hook-form`,
    `@hookform/resolvers`, `zod`, `lucide-react`
26. Init Tailwind CSS in `packages/frontend`
27. Init shadcn/ui; add components: `Button`, `Input`, `Card`, `CardContent`, `Badge`, `Dialog`,
    `Textarea`, `Skeleton`, `Sonner`, `Form`, `Label`, `Separator`
28. Set up `App.tsx` with React Router routes: `/`, `/movies`, `/movies/:tmdbId`, `/login`,
    `/register`
29. `services/api-client.ts` — base fetch wrapper with `credentials: 'include'` and base URL from
    `VITE_API_URL` env
30. `hooks/useAuth.ts` — React context + hook for auth state

### Phase 7 — Frontend: Auth Pages _(depends on Phase 6)_

31. `pages/auth/LoginPage.tsx` — form with react-hook-form + zod validation
32. `pages/auth/RegisterPage.tsx` — similar
33. `components/layout/Header.tsx` — nav with auth state (username + logout button)
34. `components/layout/Layout.tsx` — wraps all pages with Header

### Phase 8 — Frontend: Movies List Page _(depends on Phase 6)_

35. `services/movies-api.ts` — `fetchMovies(search, tmdbId, page, sortBy)`
36. `hooks/useMovies.ts` — TanStack Query wrapper with pagination
37. `components/movies/MovieSearch.tsx` — search input + sort dropdown (by rating)
38. `components/movies/MovieCard.tsx` — TMDB poster (`image.tmdb.org/t/p/w500/…`), title overlay,
    TMDB vote badge
39. `components/movies/MovieGrid.tsx` — responsive grid of MovieCards
40. `pages/movies/MoviesPage.tsx` — composes search + grid + pagination

### Phase 9 — Frontend: Movie Details Page _(depends on Phase 6, Phases 4–5 ready)_

41. `services/user-data-api.ts` — `fetchUserData`, `updateWatch`, `deleteWatch`, `updateRating`,
    `updateReview`
42. `hooks/useMovieDetails.ts` — fetches movie detail + user data in parallel via TanStack Query
43. `hooks/useUserMovieData.ts` — mutations for watch/rating/review with optimistic updates
44. `components/movies/StarRating.tsx` — interactive 1–5 stars (display + clickable mode)
45. `pages/movie-details/MovieDetailsPage.tsx`:
    - **Hero section:** backdrop image, poster thumbnail, title, genres, runtime
    - **Ratings row:** TMDB score · IMDb score · RT score (badges with icons)
    - **Links row:** link to TMDB page, IMDb page, Rotten Tomatoes page
    - **Overview section:** movie synopsis
    - **User section:** watch toggle + date picker · personal star rating (1–5) · review textarea
      with save button

### Phase 10 — Polish & Verification _(depends on all)_

46. Add loading `Skeleton` components for movie grid and details hero
47. Add `Sonner` toast notifications for save/delete actions
48. Update root `README.md`
49. `npm run lint` in both packages — fix any issues
50. `npm run build` in both packages — fix any issues

---

## Key Technical Decisions

- **JWT in httpOnly cookies** — not localStorage; protects against XSS token theft
- **OMDb called server-side only** — API key never reaches the browser
- **RT score from OMDb** — parsed from `Ratings` array:
  `{ Source: "Rotten Tomatoes", Value: "94%" }`
- **IMDb ID from TMDB** — `/movie/{id}/external_ids` → `imdb_id` → passed to OMDb `?i=tt...`
- **Search by TMDB ID** — hits `/movie/{id}` directly; name search uses `/search/movie`
- **TMDB image CDN** — `https://image.tmdb.org/t/p/w500/{poster_path}`
- **sort_by=rating** — maps to TMDB `vote_average.desc` on `/discover/movie`
- **Prisma migrations** — `npx prisma migrate dev` inside `packages/backend`

## Environment Variables

```env
# packages/backend
DATABASE_URL=postgresql://velara:velara@localhost:5432/velara
TMDB_API_KEY=your_tmdb_bearer_token
OMDB_API_KEY=your_omdb_api_key
JWT_SECRET=change_me_in_production
PORT=3000
NODE_ENV=development

# packages/frontend
VITE_API_URL=http://localhost:3000
```

## Out of Scope

- Social features (following users, public profiles)
- Movie recommendations
- Email verification / password reset
- Watchlist/favorites beyond watch status
