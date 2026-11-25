import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAddListItem } from '@/hooks/useListDetails';
import { useTvSeason } from '@/hooks/useTvSeason';
import { useTvShow } from '@/hooks/useTvShow';
import { buildSeriesItemPayload, getSeasonNumbers, type SeriesResult } from '@/lib/list-items';

// Radix Select does not allow an empty string as an item value.
const ALL_VALUE = 'all';

function parseSelection(value: string): number | undefined {
  return value === ALL_VALUE ? undefined : Number(value);
}

interface EpisodeSelectProps {
  seriesTmdbId: string;
  seasonNumber: number;
  value: number | undefined;
  onChange: (episodeNumber: number | undefined) => void;
}

function EpisodeSelect({ seriesTmdbId, seasonNumber, value, onChange }: EpisodeSelectProps) {
  const seasonQuery = useTvSeason(seriesTmdbId, seasonNumber);

  return (
    <div className="space-y-2">
      <Label htmlFor="picker-episode">Episode</Label>
      <Select
        value={value?.toString() ?? ALL_VALUE}
        onValueChange={selected => onChange(parseSelection(selected))}
        disabled={!seasonQuery.data}>
        <SelectTrigger id="picker-episode">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>Whole season</SelectItem>
          {seasonQuery.data?.episodes.map(episode => (
            <SelectItem key={episode.episodeNumber} value={episode.episodeNumber.toString()}>
              {episode.episodeNumber}. {episode.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {seasonQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading episodes…</p>
      ) : null}
      {seasonQuery.isError ? (
        <p className="text-sm text-destructive">Could not load episodes.</p>
      ) : null}
    </div>
  );
}

interface SeasonEpisodePickerProps {
  listId: number;
  series: SeriesResult;
  onClose: () => void;
}

export default function SeasonEpisodePicker({ listId, series, onClose }: SeasonEpisodePickerProps) {
  const [seasonNumber, setSeasonNumber] = useState<number | undefined>(undefined);
  const [episodeNumber, setEpisodeNumber] = useState<number | undefined>(undefined);
  const showQuery = useTvShow(series.seriesTmdbId);
  const addMutation = useAddListItem(listId);

  const handleSeasonChange = (value: string) => {
    setSeasonNumber(parseSelection(value));
    setEpisodeNumber(undefined);
  };

  const handleAdd = () => {
    const payload = buildSeriesItemPayload({
      seriesTmdbId: series.seriesTmdbId,
      seasonNumber,
      episodeNumber,
    });
    addMutation.mutate(payload, {
      onSuccess: () => {
        toast.success(`Added ${series.title}.`);
        onClose();
      },
    });
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add {series.title}</DialogTitle>
          <DialogDescription>Add the whole series, one season or one episode.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="picker-season">Season</Label>
          <Select
            value={seasonNumber?.toString() ?? ALL_VALUE}
            onValueChange={handleSeasonChange}
            disabled={!showQuery.data}>
            <SelectTrigger id="picker-season">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Whole series</SelectItem>
              {getSeasonNumbers(showQuery.data?.numberOfSeasons ?? 0).map(number => (
                <SelectItem key={number} value={number.toString()}>
                  Season {number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {showQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading seasons…</p>
          ) : null}
          {showQuery.isError ? (
            <p className="text-sm text-destructive">Could not load seasons.</p>
          ) : null}
        </div>

        {seasonNumber !== undefined ? (
          <EpisodeSelect
            seriesTmdbId={series.seriesTmdbId}
            seasonNumber={seasonNumber}
            value={episodeNumber}
            onChange={setEpisodeNumber}
          />
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={addMutation.isPending}>
            {addMutation.isPending ? 'Adding…' : 'Add to list'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
