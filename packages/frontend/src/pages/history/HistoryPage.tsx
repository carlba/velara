import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useHistory } from '@/hooks/useHistory';
import { parseUrlSortParam } from '@/lib/query-params';
import HistoryTypeToggle from '@/components/history/HistoryTypeToggle';
import HistoryDayGroup from '@/components/history/HistoryDayGroup';
import type { HistoryItem, HistoryTypeFilter } from '@/types/history';

const ALLOWED_TYPES = ['movies', 'shows', 'both'] as const;
const DEFAULT_TYPE: HistoryTypeFilter = 'both';

function dayKey(watchedAt: string): string {
  const date = new Date(watchedAt);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(watchedAt: string): string {
  const date = new Date(watchedAt);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (dayKey(watchedAt) === dayKey(today.toISOString())) return 'Today';
  if (dayKey(watchedAt) === dayKey(yesterday.toISOString())) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

function groupByDay(items: HistoryItem[]): { key: string; label: string; items: HistoryItem[] }[] {
  const groups: { key: string; label: string; items: HistoryItem[] }[] = [];
  const indexByKey = new Map<string, number>();

  for (const item of items) {
    const key = dayKey(item.watchedAt);
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, groups.length);
      groups.push({ key, label: dayLabel(item.watchedAt), items: [item] });
    } else {
      groups[existingIndex].items.push(item);
    }
  }

  return groups;
}

export default function HistoryPage() {
  const { user, isLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const type = parseUrlSortParam(searchParams, 'type', ALLOWED_TYPES, DEFAULT_TYPE);

  const { data, isLoading: isLoadingHistory, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useHistory(type);

  const items = useMemo(() => data?.pages.flatMap(page => page.items) ?? [], [data]);
  const dayGroups = useMemo(() => groupByDay(items), [items]);

  const handleTypeChange = (nextType: HistoryTypeFilter) => {
    const nextParams = new URLSearchParams(searchParams);
    if (nextType === DEFAULT_TYPE) {
      nextParams.delete('type');
    } else {
      nextParams.set('type', nextType);
    }
    setSearchParams(nextParams, { replace: true });
  };

  if (!isLoading && !user) {
    return (
      <div className="space-y-6 pb-16">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">History</h1>
          <p className="text-muted-foreground">
            A chronological view of everything you&apos;ve watched.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Sign in to view your history</CardTitle>
            <CardDescription>
              Track your watch history across movies and shows once you&apos;re signed in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">History</h1>
        <p className="text-muted-foreground">
          A chronological view of everything you&apos;ve watched.
        </p>
      </div>

      <HistoryTypeToggle value={type} onChange={handleTypeChange} />

      {isLoadingHistory ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="aspect-[2/3] rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : dayGroups.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-sm text-muted-foreground">No watch history yet.</div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {dayGroups.map(group => (
            <HistoryDayGroup key={group.key} label={group.label} items={group.items} />
          ))}
        </div>
      )}

      {dayGroups.length > 0 ? (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={() => void fetchNextPage()}
            disabled={!hasNextPage || isFetchingNextPage}>
            {isFetchingNextPage ? 'Loading…' : 'Load older history'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
