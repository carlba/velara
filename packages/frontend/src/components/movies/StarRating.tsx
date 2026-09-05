import { useState, type MouseEvent } from 'react';
import { Star, StarHalf } from 'lucide-react';
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
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const starSize = SIZE_CLASS[size];
  const isInteractive = !readonly && !!onChange;
  const normalizedValue = value ?? 0;
  const activeValue = hoverValue ?? normalizedValue;

  const computeStarValue = (star: number, event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const isRightHalf = event.clientX - rect.left >= rect.width / 2;
    return (star * 2 - (isRightHalf ? 0 : 1)) / 2;
  };

  const handleClick = (star: number, event: MouseEvent<HTMLButtonElement>) => {
    if (!onChange) return;
    onChange(computeStarValue(star, event));
  };

  const handleMouseMove = (star: number, event: MouseEvent<HTMLButtonElement>) => {
    if (!isInteractive) return;
    setHoverValue(computeStarValue(star, event));
  };

  const handleMouseLeave = () => {
    if (!isInteractive) return;
    setHoverValue(null);
  };

  return (
    <div
      className="flex items-center gap-1"
      role={isInteractive ? 'group' : undefined}
      onMouseLeave={handleMouseLeave}>
      {[1, 2, 3, 4, 5].map(star => {
        const filled = activeValue >= star;
        const half = activeValue >= star - 0.5 && activeValue < star;

        return (
          <button
            key={star}
            type="button"
            disabled={!isInteractive}
            onClick={event => handleClick(star, event)}
            onMouseMove={event => handleMouseMove(star, event)}
            aria-label={isInteractive ? `Rate ${star * 2 - 1} or ${star * 2} out of 10` : undefined}
            className={cn(
              'transition-transform',
              isInteractive &&
                'hover:scale-110 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded',
              !isInteractive && 'cursor-default'
            )}>
            {filled ? (
              <Star className={cn(starSize, 'fill-yellow-400 text-yellow-400')} />
            ) : half ? (
              <StarHalf className={cn(starSize, 'fill-yellow-400 text-yellow-400')} />
            ) : (
              <Star className={cn(starSize, 'text-muted-foreground')} />
            )}
          </button>
        );
      })}
    </div>
  );
}
