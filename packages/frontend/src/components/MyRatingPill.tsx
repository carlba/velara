import { UserRound } from 'lucide-react';

interface MyRatingPillProps {
  score: number;
}

/** Matches the TMDB/IMDb/RT pills in the detail-page ratings row, marked as the user's own. */
export function MyRatingPill({ score }: MyRatingPillProps) {
  const label = `My rating: ${score}/10`;
  return (
    <div
      className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium"
      title={label}
      aria-label={label}>
      <UserRound className="h-3 w-3 fill-yellow-400 text-yellow-400" aria-hidden="true" />
      <span className="text-muted-foreground">Me</span>
      <span className="font-semibold">{score}/10</span>
    </div>
  );
}
