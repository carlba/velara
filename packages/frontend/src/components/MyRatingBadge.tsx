import { UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface MyRatingBadgeProps {
  score: number;
}

export function MyRatingBadge({ score }: MyRatingBadgeProps) {
  const label = `My rating: ${score}/10`;

  // Mirrors the public rating badge styling; only the icon differs so it reads as "mine".
  return (
    <Badge
      variant="secondary"
      title={label}
      aria-label={label}
      className="flex items-center gap-1 bg-black/70 text-yellow-400 border-0 backdrop-blur-sm">
      <UserRound className="h-3 w-3 fill-yellow-400" aria-hidden="true" />
      {score.toFixed(1)}
    </Badge>
  );
}
