import { useNowPlaying } from '@/hooks/useNowPlaying';
import NowPlayingCard from './NowPlayingCard';

export default function Footer() {
  const { data } = useNowPlaying();

  if (!data?.isPlaying) {
    return null;
  }

  return (
    <footer className="fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur">
      <NowPlayingCard state={data} />
    </footer>
  );
}
