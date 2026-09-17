import { Button } from '@/components/ui/button';
import type { HistoryTypeFilter } from '@/types/history';

interface HistoryTypeToggleProps {
  value: HistoryTypeFilter;
  onChange: (value: HistoryTypeFilter) => void;
}

const OPTIONS: { value: HistoryTypeFilter; label: string }[] = [
  { value: 'movies', label: 'Movies' },
  { value: 'shows', label: 'Shows' },
];

export default function HistoryTypeToggle({ value, onChange }: HistoryTypeToggleProps) {
  const handleClick = (option: HistoryTypeFilter) => {
    const isActive = value === option;
    if (isActive) return;
    const otherIsActive = value !== 'both' && value !== option;

    if (value === 'both') {
      onChange(option);
    } else if (otherIsActive) {
      onChange('both');
    } else {
      onChange(option);
    }
  };

  return (
    <div className="flex gap-2">
      {OPTIONS.map(option => {
        const isActive = value === option.value || value === 'both';
        return (
          <Button
            key={option.value}
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleClick(option.value)}>
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
