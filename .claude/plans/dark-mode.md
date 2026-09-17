# Dark Mode Implementation

## Context

Velara's frontend (`packages/frontend`) already has the visual groundwork for dark mode fully in
place but dormant: Tailwind is configured with `darkMode: ['class']`
([tailwind.config.js:3](packages/frontend/tailwind.config.js#L3)), and
[src/index.css:29-49](packages/frontend/src/index.css#L29-L49) already defines a complete `.dark`
shadcn CSS variable block. Nothing currently toggles the `dark` class onto the document, so the app
always renders light. This work wires up the missing piece: a theme provider + toggle so users can
switch modes, with a sensible default and persistence.

Per user decisions:

- **Mode selection**: default to OS `prefers-color-scheme`, with a manual override available.
- **Persistence**: override choice saved to `localStorage`.
- **Toggle location**: header/nav bar, visible from anywhere.
- **Palette**: use the existing shadcn `.dark` variables as-is (no new colors needed).

## Approach

No new dependency (e.g. `next-themes`) is needed — the app already has the CSS variables and
Tailwind config; only a small custom provider is required, following the existing `AuthProvider`
context pattern in [src/hooks/useAuth](packages/frontend/src/hooks/useAuth.tsx).

### 1. `useTheme` hook + `ThemeProvider` — new file `packages/frontend/src/hooks/useTheme.tsx`

- `type Theme = 'light' | 'dark' | 'system'`
- Context holds `{ theme: Theme; setTheme: (t: Theme) => void; resolvedTheme: 'light' | 'dark' }`.
- On init, read `localStorage.getItem('theme')`; fall back to `'system'` if absent/invalid.
- Compute `resolvedTheme`: if `theme === 'system'`, use
  `window.matchMedia('(prefers-color-scheme: dark)').matches`; otherwise use `theme` directly.
- `useEffect` that applies/removes the `dark` class on `document.documentElement` whenever
  `resolvedTheme` changes.
- When `theme === 'system'`, subscribe to the `matchMedia` change event so the UI updates live if
  the OS theme changes without a reload; unsubscribe on cleanup.
- `setTheme` updates state and writes to `localStorage` (removing the key, or writing `'system'`,
  when reset to system — either is fine as long as init handles it consistently).
- Export a `useTheme()` hook that throws if used outside the provider (mirrors `useAuth`'s
  existing error-throw pattern).

### 2. Wire the provider — [src/main.tsx](packages/frontend/src/main.tsx)

- Wrap `<AuthProvider>` (or be wrapped by it — order doesn't matter functionally) with
  `<ThemeProvider>` so the whole app tree has access.

### 3. Avoid flash-of-wrong-theme on load

- Add a small inline `<script>` in `packages/frontend/index.html` (before the app mounts) that
  reads `localStorage.getItem('theme')`, falls back to system preference, and synchronously sets
  the `dark` class on `<html>` before React hydrates. This prevents a light→dark flash on first
  paint. The `ThemeProvider` still owns state afterward; this script only sets the initial class.

### 4. Toggle UI — new file `packages/frontend/src/components/layout/ThemeToggle.tsx`

- Add the shadcn `dropdown-menu` component if not already present (check
  `src/components/ui/dropdown-menu.tsx`; if missing, note it should be added via
  `npx shadcn@latest add dropdown-menu` since we own generated shadcn source per project
  convention).
- Button with a sun/moon `lucide-react` icon (swap icon based on `resolvedTheme`) that opens a
  dropdown with three options: Light / Dark / System, calling `setTheme`.
- Keep this component focused only on rendering the control — it reads/writes theme via
  `useTheme()`.

### 5. Add toggle to header — [src/components/layout/Header.tsx](packages/frontend/src/components/layout/Header.tsx)

- Insert `<ThemeToggle />` inside the `<nav>` (around line 41, before the user-menu block) so it's
  visible on every page regardless of auth state.

## Files touched

- `packages/frontend/src/hooks/useTheme.tsx` (new)
- `packages/frontend/src/components/layout/ThemeToggle.tsx` (new)
- `packages/frontend/src/components/layout/Header.tsx` (add toggle)
- `packages/frontend/src/main.tsx` (add provider)
- `packages/frontend/index.html` (add anti-flash inline script)
- Possibly `packages/frontend/src/components/ui/dropdown-menu.tsx` (new, via shadcn CLI, if not
  already present)

No changes needed to `tailwind.config.js` or `index.css` — both are already correctly set up.

## Verification

1. `npm run dev --workspace=packages/frontend` (or `cd packages/frontend && npm run dev`), open the
   app in browser.
2. Confirm default follows OS theme: toggle OS dark mode setting and reload — app should match.
3. Use the header toggle to explicitly pick Light, Dark, and System; confirm the whole app
   (backgrounds, text, cards, buttons, borders) recolors correctly for both light and dark via the
   existing CSS variables.
4. Reload the page after picking an explicit mode — confirm the choice persists (no flash of the
   other theme on load).
5. Clear `localStorage` theme key, reload — confirm it falls back to system preference.
6. Run `npm run lint`, `npm run test`, `npm run build` (or `npm run <script> --workspace=packages/frontend`)
   per repo verification checklist — note this repo uses npm workspaces, not pnpm.
