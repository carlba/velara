import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import MoviesPage from '@/pages/movies/MoviesPage';
import MovieDetailsPage from '@/pages/movie-details/MovieDetailsPage';
import TvShowsPage from '@/pages/tv-shows/TvShowsPage';
import TvShowDetailsPage from '@/pages/tv-show-details/TvShowDetailsPage';
import ListsPage from '@/pages/lists/ListsPage';
import ListDetailsPage from '@/pages/lists/ListDetailsPage';
import ProfilePage from '@/pages/profile/ProfilePage';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import TraktCallbackPage from '@/pages/trakt/TraktCallbackPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/movies" replace />} />
        <Route path="movies" element={<MoviesPage />} />
        <Route path="movies/:tmdbId" element={<MovieDetailsPage />} />
        <Route path="tv" element={<TvShowsPage />} />
        <Route path="tv/:seriesId" element={<TvShowDetailsPage />} />
        <Route path="lists" element={<ListsPage />} />
        <Route path="lists/:listId" element={<ListDetailsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="trakt-callback" element={<TraktCallbackPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
      </Route>
    </Routes>
  );
}
