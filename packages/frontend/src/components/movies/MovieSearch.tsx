import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SortBy, UserFilter } from '@/types/movie';

const USER_FILTER_LABELS: Record<UserFilter, string> = {
  rated: 'Rated by me',
  watched: 'Watched by me',
  reviewed: 'Reviewed by me',
};

interface MovieSearchProps {
  onSearch: (value: string) => void;
  onSortChange: (sort: SortBy) => void;
  sortBy: SortBy;
  defaultValue?: string;
  userFilters?: UserFilter[];
  onFilterChange?: (filter: UserFilter) => void;
}

export default function MovieSearch({
  onSearch,
  onSortChange,
  sortBy,
  defaultValue = '',
  userFilters = [],
  onFilterChange,
}: MovieSearchProps) {
  const [inputValue, setInputValue] = useState(defaultValue);

  const handleChange = (value: string) => {
    setInputValue(value);
    onSearch(value);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search movies by title or TMDB ID…"
            className="pl-9"
            value={inputValue}
            onChange={e => handleChange(e.target.value)}
          />
        </div>

        <Select value={sortBy} onValueChange={v => onSortChange(v as SortBy)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="popularity">Most Popular</SelectItem>
            <SelectItem value="rating">Highest Rated</SelectItem>
            <SelectItem value="watched_date" disabled={!userFilters.includes('watched')}>
              My Watched Date
            </SelectItem>
            <SelectItem value="my_rating" disabled={!userFilters.includes('rated')}>
              My Highest Rated
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {onFilterChange && (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(USER_FILTER_LABELS) as UserFilter[]).map(filter => (
            <Button
              key={filter}
              variant={userFilters.includes(filter) ? 'default' : 'outline'}
              size="sm"
              onClick={() => onFilterChange(filter)}>
              {USER_FILTER_LABELS[filter]}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
