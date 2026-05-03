export function parseUrlFilterParam<T extends string>(
  searchParams: URLSearchParams,
  filterKey: string,
  allowedValues: readonly T[]
): T[] {
  const rawValue = searchParams.get(filterKey);
  if (!rawValue?.trim()) {
    return [];
  }

  const allowed = new Set(allowedValues);
  const values = rawValue
    .split(',')
    .map(value => value.trim())
    .filter((value): value is T => allowed.has(value as T));

  return Array.from(new Set(values));
}

export function parseUrlSortParam<T extends string>(
  searchParams: URLSearchParams,
  sortKey: string,
  allowedValues: readonly T[],
  defaultValue: T
): T {
  const rawValue = searchParams.get(sortKey)?.trim();
  if (!rawValue) {
    return defaultValue;
  }

  const firstValue = rawValue.split(',')[0].trim();
  const normalized = firstValue.startsWith('-') ? firstValue.slice(1) : firstValue;
  return allowedValues.includes(normalized as T) ? (normalized as T) : defaultValue;
}

export function buildUrlSearchParams(
  currentSearchParams: URLSearchParams,
  filterKey: string,
  sortKey: string,
  filters: string[],
  sort: string,
  defaultSort: string
): URLSearchParams {
  const nextParams = new URLSearchParams(currentSearchParams);
  nextParams.delete(filterKey);
  nextParams.delete(sortKey);

  if (filters.length > 0) {
    nextParams.set(filterKey, filters.join(','));
  }

  if (sort !== defaultSort) {
    nextParams.set(sortKey, sort);
  }

  return nextParams;
}
