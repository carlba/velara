import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  value: number | null;
  onChange?: (score: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASS = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
} as const;

export default function StarRating({
  value,
  onChange,
  readonly = false,
  size = 'md',
}: StarRatingProps) {
  const starSize = SIZE_CLASS[size];
  const isInteractive = !readonly && !!onChange;

  return (
    <div className="flex items-center gap-1" role={isInteractive ? 'group' : undefined}>
      {[1, 2, 3, 4, 5].map(star => {
        const filled = value !== null && star <= value;
        return (
          <button
            key={star}
            type="button"
            disabled={!isInteractive}
            onClick={() => onChange?.(star)}
            aria-label={isInteractive ? `Rate ${star} out of 5` : undefined}
            className={cn(
              'transition-transform',
              isInteractive &&
                'hover:scale-110 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded',
              !isInteractive && 'cursor-default'
            )}>
            <Star
              className={cn(
                starSize,
                filled ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
