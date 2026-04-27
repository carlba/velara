import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import MoviesPage from '@/pages/movies/MoviesPage';
import MovieDetailsPage from '@/pages/movie-details/MovieDetailsPage';
import ProfilePage from '@/pages/profile/ProfilePage';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/movies" replace />} />
        <Route path="movies" element={<MoviesPage />} />
        <Route path="movies/:tmdbId" element={<MovieDetailsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
      </Route>
    </Routes>
  );
}
