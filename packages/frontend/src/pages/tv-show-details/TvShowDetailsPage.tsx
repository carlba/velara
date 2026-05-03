import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, ExternalLink, Trash2, Tv } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import StarRating from '@/components/movies/StarRating';
import ListActionPanel from '@/components/lists/ListActionPanel';
import SeasonSection from '@/components/tv-shows/SeasonSection';
import { useTvShowDetails } from '@/hooks/useTvShowDetails';
import { useTvComments } from '@/hooks/useTvComments';
import { useUserTvData } from '@/hooks/useUserTvData';
import { useTvSeason } from '@/hooks/useTvSeason';
import { useAuth } from '@/hooks/useAuth';
import { formatDateTime } from '@/lib/utils';
import type { TvShowDetail, TvEpisode } from '@/types/tv-show';

export default function TvShowDetailsPage() {
  const { seriesId } = useParams<{ seriesId: string }>();
  const id = seriesId ?? '';
  const { user } = useAuth();
  const { showQuery, userDataQuery } = useTvShowDetails(id);
  const { commentsQuery, addComment, removeComment } = useTvComments(id);
  const mutations = useUserTvData(id);
  const [reviewText, setReviewText] = useState<string | undefined>(undefined);
  const [commentText, setCommentText] = useState('');

  const show = showQuery.data;
  const userData = userDataQuery.data;
  const comments = commentsQuery.data ?? [];

  const currentReview = reviewText ?? userData?.review?.content ?? '';

  const watchedKeys = useMemo<Set<string>>(() => {
    if (!userData?.watchEntries) return new Set();
    return new Set(userData.watchEntries.map(e => `s${e.seasonNumber}e${e.episodeNumber}`));
  }, [userData?.watchEntries]);

  if (showQuery.isLoading) {
    return <TvShowDetailSkeleton />;
  }

  if (showQuery.isError || !show) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p className="text-lg font-medium">TV show not found</p>
        <Button variant="ghost" asChild className="mt-4">
          <Link to="/tv">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to TV shows
          </Link>
        </Button>
      </div>
    );
  }

  const userShowRating = userData?.showRating?.score ?? null;
  const seasonRatings = userData?.seasonRatings ?? {};

  const handleShowRating = (score: number) => {
    if (userShowRating === score) {
      mutations.clearShowRating.mutate();
    } else {
      mutations.setShowRating.mutate(score);
    }
  };

  const handleSaveReview = () => {
    if (currentReview.trim()) {
      mutations.saveReview.mutate(currentReview.trim());
    } else {
      mutations.deleteReviewMutation.mutate();
    }
    setReviewText(undefined);
  };

  const handlePostComment = () => {
    const trimmed = commentText.trim();
    if (!trimmed) return;
    addComment.mutate(trimmed);
    setCommentText('');
  };

  const handleEpisodeToggle = (seasonNumber: number, episode: TvEpisode) => {
    const key = `s${seasonNumber}e${episode.episodeNumber}`;
    if (watchedKeys.has(key)) {
      mutations.unwatchEpisode.mutate({
        seasonNumber,
        episodeNumber: episode.episodeNumber,
      });
    } else {
      mutations.watchEpisode.mutate({
        seasonNumber,
        episodeNumber: episode.episodeNumber,
      });
    }
  };

  const year = show.firstAirDate ? new Date(show.firstAirDate).getFullYear() : null;
  const ratingPercent = Math.round(show.voteAverage * 10);

  return (
    <div className="space-y-8 pb-16">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/tv">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to TV shows
        </Link>
      </Button>

      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden">
        {show.backdropPath && (
          <img
            src={show.backdropPath}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-20"
          />
        )}
        <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-start">
          <div className="shrink-0 w-36 sm:w-48">
            {show.posterPath ? (
              <img src={show.posterPath} alt={show.name} className="rounded-xl shadow-lg w-full" />
            ) : (
              <div className="rounded-xl bg-muted aspect-[2/3] flex items-center justify-center text-muted-foreground text-4xl">
                📺
              </div>
            )}
          </div>

          <div className="space-y-4 flex-1">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{show.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-muted-foreground text-sm">
                {year && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {year}
                  </span>
                )}
                {show.status && (
                  <Badge variant={show.status === 'Ended' ? 'secondary' : 'outline'}>
                    {show.status}
                  </Badge>
                )}
                {show.numberOfSeasons && (
                  <span className="flex items-center gap-1">
                    <Tv className="h-3.5 w-3.5" />
                    {show.numberOfSeasons} season{show.numberOfSeasons !== 1 ? 's' : ''}
                  </span>
                )}
                {show.networks && show.networks.length > 0 && (
                  <span className="text-muted-foreground">{show.networks[0].name}</span>
                )}
              </div>
            </div>

            {show.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {show.genres.map(genre => (
                  <Badge key={genre.id} variant="secondary">
                    {genre.name}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <RatingBadge
                label="TMDB"
                value={`${ratingPercent}%`}
                href={show.tmdbUrl}
                color="bg-teal-500"
              />
              {show.externalRatings?.imdbRating && (
                <RatingBadge
                  label="IMDb"
                  value={`${show.externalRatings.imdbRating}/10`}
                  href={show.imdbUrl ?? undefined}
                  color="bg-yellow-500"
                />
              )}
              {show.externalRatings?.rottenTomatoes && (
                <RatingBadge
                  label="RT"
                  value={show.externalRatings.rottenTomatoes}
                  href={show.rtSearchUrl}
                  color="bg-red-500"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {show.overview && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Overview</h2>
          <p className="text-muted-foreground leading-relaxed">{show.overview}</p>
        </div>
      )}

      <Separator />

      {/* User tracking section */}
      {user ? (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Your Tracking</h2>

          <div className="space-y-2">
            <p className="text-sm font-medium">Your Rating</p>
            <div className="flex items-center gap-3">
              <StarRating value={userShowRating} onChange={handleShowRating} size="lg" />
              {userShowRating && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => mutations.clearShowRating.mutate()}
                  disabled={mutations.clearShowRating.isPending}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Your Review</p>
            <Textarea
              placeholder="Write your thoughts about this show…"
              rows={4}
              value={currentReview}
              onChange={e => setReviewText(e.target.value)}
              className="resize-none"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveReview}
                disabled={
                  mutations.saveReview.isPending || mutations.deleteReviewMutation.isPending
                }>
                {mutations.saveReview.isPending ? 'Saving…' : 'Save review'}
              </Button>
              {userData?.review && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => mutations.deleteReviewMutation.mutate()}
                  disabled={mutations.deleteReviewMutation.isPending}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              )}
            </div>
          </div>

          <ListActionPanel itemName="show" itemPayload={{ type: 'series', seriesTmdbId: id }} />
        </div>
      ) : (
        <div className="rounded-xl border bg-muted/50 p-6 text-center space-y-3">
          <p className="font-medium">Track this show</p>
          <p className="text-sm text-muted-foreground">
            Sign in to rate, review, and track episode progress.
          </p>
          <div className="flex justify-center gap-2">
            <Button asChild size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/register">Create account</Link>
            </Button>
          </div>
        </div>
      )}

      <Separator />

      {/* Seasons */}
      {show.numberOfSeasons && show.numberOfSeasons > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Seasons</h2>
          <SeasonsList
            seriesId={id}
            numberOfSeasons={show.numberOfSeasons}
            watchedKeys={watchedKeys}
            seasonRatings={seasonRatings}
            isAuthenticated={!!user}
            onEpisodeToggle={handleEpisodeToggle}
            onSeasonRating={(seasonNumber, score) =>
              mutations.setSeasonRating.mutate({ seasonNumber, score })
            }
            onClearSeasonRating={seasonNumber => mutations.clearSeasonRating.mutate(seasonNumber)}
          />
        </div>
      )}

      <Separator />

      {/* Comments */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Comments</h2>
            <p className="text-sm text-muted-foreground">
              Comments are visible to everyone. Only signed in users can post.
            </p>
          </div>
          <span className="text-sm text-muted-foreground">
            {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
          </span>
        </div>

        {user ? (
          <div className="space-y-2 rounded-2xl border p-4">
            <Textarea
              placeholder="Add a comment…"
              rows={3}
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              className="resize-none"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handlePostComment}
                disabled={addComment.isPending || !commentText.trim()}>
                {addComment.isPending ? 'Posting…' : 'Post comment'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border bg-muted/50 p-6 text-sm text-muted-foreground">
            Sign in to comment on this show.
          </div>
        )}

        <div className="space-y-3">
          {commentsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading comments…</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            comments.map(comment => (
              <div key={comment.id} className="rounded-2xl border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{comment.user.username}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(comment.createdAt)}
                    </p>
                  </div>
                  {user?.id === comment.user.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeComment.mutate(comment.id)}
                      disabled={removeComment.isPending}
                      aria-label="Delete comment">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="mt-3 whitespace-pre-line text-sm leading-6">{comment.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Seasons list (each season fetched individually) ──────────────────────────

interface SeasonsListProps {
  seriesId: string;
  numberOfSeasons: number;
  watchedKeys: Set<string>;
  seasonRatings: Record<number, number>;
  isAuthenticated: boolean;
  onEpisodeToggle: (seasonNumber: number, episode: TvEpisode) => void;
  onSeasonRating: (seasonNumber: number, score: number) => void;
  onClearSeasonRating: (seasonNumber: number) => void;
}

function SeasonsList({
  seriesId,
  numberOfSeasons,
  watchedKeys,
  seasonRatings,
  isAuthenticated,
  onEpisodeToggle,
  onSeasonRating,
  onClearSeasonRating,
}: SeasonsListProps) {
  const seasonNumbers = Array.from({ length: numberOfSeasons }, (_, i) => i + 1);

  return (
    <div className="space-y-3">
      {seasonNumbers.map(n => (
        <SeasonLoader
          key={n}
          seriesId={seriesId}
          seasonNumber={n}
          watchedKeys={watchedKeys}
          seasonRating={seasonRatings[n] ?? null}
          isAuthenticated={isAuthenticated}
          onEpisodeToggle={onEpisodeToggle}
          onSeasonRating={onSeasonRating}
          onClearSeasonRating={onClearSeasonRating}
        />
      ))}
    </div>
  );
}

interface SeasonLoaderProps {
  seriesId: string;
  seasonNumber: number;
  watchedKeys: Set<string>;
  seasonRating: number | null;
  isAuthenticated: boolean;
  onEpisodeToggle: (seasonNumber: number, episode: TvEpisode) => void;
  onSeasonRating: (seasonNumber: number, score: number) => void;
  onClearSeasonRating: (seasonNumber: number) => void;
}

function SeasonLoader({
  seriesId,
  seasonNumber,
  watchedKeys,
  seasonRating,
  isAuthenticated,
  onEpisodeToggle,
  onSeasonRating,
  onClearSeasonRating,
}: SeasonLoaderProps) {
  const { data: season, isLoading } = useTvSeason(seriesId, seasonNumber);

  if (isLoading || !season) {
    return <Skeleton className="h-16 rounded-xl" />;
  }

  return (
    <SeasonSection
      season={season}
      watchedEpisodeKeys={watchedKeys}
      seasonRating={seasonRating}
      isAuthenticated={isAuthenticated}
      onToggleEpisode={episode => onEpisodeToggle(seasonNumber, episode)}
      onSeasonRating={onSeasonRating}
      onClearSeasonRating={onClearSeasonRating}
    />
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

interface RatingBadgeProps {
  label: string;
  value: string;
  href?: string;
  color: string;
}

function RatingBadge({ label, value, href, color }: RatingBadgeProps) {
  const inner = (
    <div className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium hover:bg-accent transition-colors">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
      {href && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
    </div>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }

  return inner;
}

function TvShowDetailSkeleton() {
  return (
    <div className="space-y-8 pb-16">
      <Skeleton className="h-8 w-24 rounded-full" />
      <div className="flex gap-6">
        <Skeleton className="w-36 sm:w-48 aspect-[2/3] rounded-xl" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-8 w-40" />
        </div>
      </div>
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

// Re-export for clarity
export type { TvShowDetail };
