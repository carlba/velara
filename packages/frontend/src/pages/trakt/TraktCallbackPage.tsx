import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchTraktAuthUrl, connectTraktIntegration } from '@/services/trakt-api';

export default function TraktCallbackPage() {
  const [searchParams] = useSearchParams();
  const [isConnecting, setIsConnecting] = useState(false);
  const navigate = useNavigate();
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  useEffect(() => {
    if (!code) return;

    const redirectUri = `${window.location.origin}/trakt-callback`;
    setIsConnecting(true);

    connectTraktIntegration({ authorizationCode: code, redirectUri })
      .then(() => {
        toast.success('Trakt connected successfully.');
        navigate('/profile');
      })
      .catch(error => {
        console.error(error);
        toast.error('Failed to connect Trakt. Please try again.');
      })
      .finally(() => setIsConnecting(false));
  }, [code, navigate]);

  const handleRetryConnect = async () => {
    const redirectUri = `${window.location.origin}/trakt-callback`;
    setIsConnecting(true);

    try {
      const response = await fetchTraktAuthUrl(redirectUri);
      window.location.href = response.url;
    } catch (error) {
      console.error(error);
      toast.error('Unable to start Trakt connection.');
      setIsConnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Connect Trakt</h1>
        <p className="text-muted-foreground">
          Finish connecting your Trakt account. If Trakt did not redirect back with a code, try
          again from your profile.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trakt authorization</CardTitle>
          <CardDescription>
            {code
              ? 'Completing your Trakt connection…'
              : 'Start the Trakt authorization flow again.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {code ? (
            <p>If the connection takes too long, refresh this page or try again.</p>
          ) : (
            <p>No authorization code was found in the URL.</p>
          )}

          <div className="flex gap-2">
            <Button onClick={handleRetryConnect} disabled={isConnecting}>
              {isConnecting ? 'Connecting…' : 'Retry Trakt connection'}
            </Button>
            <Button variant="secondary" onClick={() => navigate('/profile')}>
              Back to profile
            </Button>
          </div>

          {state ? <p className="text-sm text-muted-foreground">State value: {state}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
