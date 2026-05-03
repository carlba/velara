import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, ExternalLink, Eye, EyeOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import StarRating from '@/components/movies/StarRating';
import ListActionPanel from '@/components/lists/ListActionPanel';
import { useMovieDetails } from '@/hooks/useMovieDetails';
import { useMovieComments } from '@/hooks/useMovieComments';
import { useUserMovieData } from '@/hooks/useUserMovieData';
import { useAuth } from '@/hooks/useAuth';
import { formatDateTime } from '@/lib/utils';

export default function MovieDetailsPage() {
  const { tmdbId } = useParams<{ tmdbId: string }>();
  const id = Number(tmdbId);
  const { user } = useAuth();
  const { movieQuery, userDataQuery } = useMovieDetails(id);
  const { commentsQuery, addComment, removeComment } = useMovieComments(id);
  const mutations = useUserMovieData(id);
  const [reviewText, setReviewText] = useState<string | undefined>(undefined);
  const [commentText, setCommentText] = useState('');

  const movie = movieQuery.data;
  const userData = userDataQuery.data;
  const comments = commentsQuery.data ?? [];

  const currentReview = reviewText ?? userData?.review?.content ?? '';

  if (movieQuery.isLoading) {
    return <MovieDetailSkeleton />;
  }

  if (movieQuery.isError || !movie) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p className="text-lg font-medium">Movie not found</p>
        <Button variant="ghost" asChild className="mt-4">
          <Link to="/movies">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to movies
          </Link>
        </Button>
      </div>
    );
  }

  const isWatched = !!userData?.watchEntry;
  const userRating = userData?.rating?.score ?? null;

  const handleWatchToggle = () => {
    if (isWatched) {
      mutations.unmarkWatched.mutate();
    } else {
      mutations.markWatched.mutate(new Date().toISOString());
    }
  };

  const handleRating = (score: number) => {
    if (userRating === score) {
      mutations.clearRating.mutate();
    } else {
      mutations.setRating.mutate(score);
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

  const year = movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : null;
  const ratingPercent = Math.round(movie.voteAverage * 10);

  return (
    <div className="space-y-8 pb-16">
      {/* Back link */}
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/movies">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to movies
        </Link>
      </Button>

      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden">
        {movie.backdropPath && (
          <img
            src={movie.backdropPath}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-20"
          />
        )}
        <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-start">
          {/* Poster */}
          <div className="shrink-0 w-36 sm:w-48">
            {movie.posterPath ? (
              <img
                src={movie.posterPath}
                alt={movie.title}
                className="rounded-xl shadow-lg w-full"
              />
            ) : (
              <div className="rounded-xl bg-muted aspect-[2/3] flex items-center justify-center text-muted-foreground text-4xl">
                🎬
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-4 flex-1">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{movie.title}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-muted-foreground text-sm">
                {year && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {year}
                  </span>
                )}
                {movie.runtime && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {movie.runtime} min
                  </span>
                )}
              </div>
            </div>

            {/* Genres */}
            {movie.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {movie.genres.map(genre => (
                  <Badge key={genre.id} variant="secondary">
                    {genre.name}
                  </Badge>
                ))}
              </div>
            )}

            {/* Ratings row */}
            <div className="flex flex-wrap gap-3">
              <RatingBadge
                label="TMDB"
                value={`${ratingPercent}%`}
                href={movie.tmdbUrl}
                color="bg-teal-500"
              />
              {movie.externalRatings.imdbRating && (
                <RatingBadge
                  label="IMDb"
                  value={`${movie.externalRatings.imdbRating}/10`}
                  href={movie.imdbUrl ?? undefined}
                  color="bg-yellow-500"
                />
              )}
              {movie.externalRatings.rottenTomatoes && (
                <RatingBadge
                  label="RT"
                  value={movie.externalRatings.rottenTomatoes}
                  href={movie.rtSearchUrl}
                  color="bg-red-500"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Overview */}
      {movie.overview && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Overview</h2>
          <p className="text-muted-foreground leading-relaxed">{movie.overview}</p>
        </div>
      )}

      <Separator />

      {/* User section */}
      {user ? (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Your Tracking</h2>

          {/* Watch status */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              variant={isWatched ? 'default' : 'outline'}
              onClick={handleWatchToggle}
              disabled={mutations.markWatched.isPending || mutations.unmarkWatched.isPending}>
              {isWatched ? (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Watched
                </>
              ) : (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Mark as watched
                </>
              )}
            </Button>
            {isWatched && userData?.watchEntry?.watchedAt && (
              <span className="text-sm text-muted-foreground">
                on {formatDateTime(userData.watchEntry.watchedAt)}
              </span>
            )}
          </div>

          {/* Personal rating */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Your Rating</p>
            <div className="flex items-center gap-3">
              <StarRating value={userRating} onChange={handleRating} size="lg" />
              {userRating && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => mutations.clearRating.mutate()}
                  disabled={mutations.clearRating.isPending}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Review */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Your Review</p>
            <Textarea
              placeholder="Write your thoughts about this movie…"
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

          <ListActionPanel
            itemName="movie"
            itemPayload={{ type: 'movie', movieTmdbId: movie.tmdbId }}
          />
        </div>
      ) : (
        <div className="rounded-xl border bg-muted/50 p-6 text-center space-y-3">
          <p className="font-medium">Track this movie</p>
          <p className="text-sm text-muted-foreground">
            Sign in to mark as watched, rate, and review.
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
            Sign in to comment on this movie.
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

// ── Sub-components ──────────────────────────────────────────────────────────────

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

function MovieDetailSkeleton() {
  return (
    <div className="space-y-8 pb-16">
      <Skeleton className="h-8 w-24 rounded-full" />
      <div className="flex gap-6">
        <Skeleton className="w-36 sm:w-48 aspect-[2/3] rounded-xl" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-5 w-1/3" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
      </div>
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
