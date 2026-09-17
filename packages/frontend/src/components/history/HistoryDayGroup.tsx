import HistoryCard from './HistoryCard';
import type { HistoryItem } from '@/types/history';

interface HistoryDayGroupProps {
  label: string;
  items: HistoryItem[];
}

export default function HistoryDayGroup({ label, items }: HistoryDayGroupProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{label}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {items.map(item => (
          <HistoryCard key={`${item.mediaType}-${item.historyId}`} item={item} />
        ))}
      </div>
    </section>
  );
}
