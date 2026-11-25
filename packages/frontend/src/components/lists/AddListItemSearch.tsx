import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import SeasonEpisodePicker from './SeasonEpisodePicker';
import { useAddListItem } from '@/hooks/useListDetails';
import { useTitleSearch } from '@/hooks/useTitleSearch';
import type { MovieResult, SeriesResult, TitleResult } from '@/lib/list-items';

function ResultRow({ result }: { result: TitleResult }) {
  return (
    <>
      {result.posterPath ? (
        <img src={result.posterPath} alt="" className="h-12 w-8 rounded object-cover" />
      ) : (
        <div className="h-12 w-8 rounded bg-muted" />
      )}
      <span className="flex-1 truncate">{result.title}</span>
      {result.year ? <span className="text-muted-foreground">{result.year}</span> : null}
    </>
  );
}

export default function AddListItemSearch({ listId }: { listId: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [selectedSeries, setSelectedSeries] = useState<SeriesResult | null>(null);
  const { movies, series, isSearching, hasError } = useTitleSearch(input);
  const addMutation = useAddListItem(listId);
  const hasResults = movies.length > 0 || series.length > 0;

  const handleSelectMovie = (movie: MovieResult) => {
    setIsOpen(false);
    addMutation.mutate(
      { type: 'movie', movieTmdbId: movie.tmdbId },
      { onSuccess: () => toast.success(`Added ${movie.title}.`) }
    );
  };

  const handleSelectSeries = (show: SeriesResult) => {
    setIsOpen(false);
    setSelectedSeries(show);
  };

  const getStatusMessage = () => {
    if (!input.trim()) return 'Type a title to search.';
    if (isSearching) return 'Searching…';
    if (hasError) return 'Search failed. Try again.';
    return hasResults ? null : 'No matching titles.';
  };
  const statusMessage = getStatusMessage();

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button disabled={addMutation.isPending}>
            <Plus className="mr-2 h-4 w-4" /> {addMutation.isPending ? 'Adding…' : 'Add item'}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(28rem,calc(100vw-2rem))] p-0">
          {/* The backend does the matching, so cmdk must not filter the results again. */}
          <Command shouldFilter={false}>
            <CommandInput
              value={input}
              onValueChange={setInput}
              placeholder="Search movies and TV series…"
              aria-label="Search movies and TV series"
            />
            <CommandList>
              {statusMessage ? (
                <p role="status" className="p-3 text-center text-sm text-muted-foreground">
                  {statusMessage}
                </p>
              ) : null}
              {movies.length > 0 ? (
                <CommandGroup heading="Movies">
                  {movies.map(movie => (
                    <CommandItem
                      key={movie.id}
                      value={movie.id}
                      onSelect={() => handleSelectMovie(movie)}>
                      <ResultRow result={movie} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {series.length > 0 ? (
                <CommandGroup heading="TV series">
                  {series.map(show => (
                    <CommandItem
                      key={show.id}
                      value={show.id}
                      onSelect={() => handleSelectSeries(show)}>
                      <ResultRow result={show} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedSeries ? (
        <SeasonEpisodePicker
          listId={listId}
          series={selectedSeries}
          onClose={() => setSelectedSeries(null)}
        />
      ) : null}
    </>
  );
}
