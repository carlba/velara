# Rating Scale and Half-Star UI Specification

## Goal
Ensure rating storage and user interactions are consistent across Filmtipset imports, Trakt data, and the app UI.

## Requirements

### 1. Import rating normalization
- Filmtipset ratings are provided as integers in the range `1..5`.
- Imported Filmtipset ratings must be converted to the apps internal scale by multiplying by `2`.
- After conversion, Filmtipset ratings are stored as `2..10`.
- Trakt ratings are already in the range `1..10` and should be stored unchanged.

### 2. Storage and API scale
- All persisted ratings in the backend must use the integer scale `1..10`.
- Both movie and TV rating endpoints must accept `1..10` values.
- The existing rating database fields remain `Int`.

### 3. UI display and interaction
- All rating controls must retain a 5-star visual interface.
- The star input must support half-star precision, meaning the user can select in `0.5` increments.
- Stored values must be mapped to the star scale:
  - `1 -> 0.5` stars
  - `2 -> 1.0` stars
  - `3 -> 1.5` stars
  - ...
  - `10 -> 5.0` stars
- User selections on the 5-star UI must map back to backend scores in the range `1..10`.

### 4. Applicable surfaces
- Movie rating controls
- TV show rating controls
- TV season rating controls
- All other places where a user can rate a movie or TV show

### 5. Validation and tests
- Backend tests must verify Filmtipset import rating normalization.
- Backend tests must verify movie and TV rating endpoints accept `1..10`.
- Frontend behavior should be tested or manually confirmed for half-star rendering and mapping.

## Notes
- The app should continue to use the existing 5-star visual metaphor while allowing half-star precision.
- This change is backward-compatible for stored Trakt values and only adjusts Filmtipset import handling.
