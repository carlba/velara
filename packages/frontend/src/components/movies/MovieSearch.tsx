import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SortBy } from '@/types/movie';

interface MovieSearchProps {
  onSearch: (value: string) => void;
  onSortChange: (sort: SortBy) => void;
  sortBy: SortBy;
  defaultValue?: string;
}

export default function MovieSearch({
  onSearch,
  onSortChange,
  sortBy,
  defaultValue = '',
}: MovieSearchProps) {
  const [inputValue, setInputValue] = useState(defaultValue);

  const handleChange = (value: string) => {
    setInputValue(value);
    onSearch(value);
  };

  return (
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
        </SelectContent>
      </Select>
    </div>
  );
}
