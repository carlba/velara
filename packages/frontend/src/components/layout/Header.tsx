import { Link, useNavigate } from 'react-router-dom';
import { Film, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/movies');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/movies" className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <Film className="h-6 w-6 text-primary" />
          <span>Velara</span>
        </Link>

        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link
                  to="/profile"
                  className="flex items-center gap-1.5 text-sm text-muted-foreground"
                >
                  <User className="h-4 w-4" />
                  {user.username}
                </Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void handleLogout()}>
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/register">Sign up</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
