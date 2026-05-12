import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import {
  deleteFlexgetIntegration,
  fetchFlexgetIntegration,
  saveFlexgetIntegration,
  type FlexgetIntegration,
} from '@/services/flexget-api';
import { importMovies, type ImportProvider, type ImportSummary } from '@/services/user-data-api';
import { importTvShows } from '@/services/user-tv-data-api';
import {
  deleteTraktIntegration,
  fetchTraktAuthUrl,
  fetchTraktIntegration,
  type TraktIntegration,
} from '@/services/trakt-api';

export default function ProfilePage() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [content, setContent] = useState('');
  const [provider, setProvider] = useState<ImportProvider>('filmtipset');
  const [importType, setImportType] = useState<'ratings' | 'comments'>('ratings');
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [currentIntegration, setCurrentIntegration] = useState<FlexgetIntegration | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [flexgetUsername, setFlexgetUsername] = useState('');
  const [flexgetPassword, setFlexgetPassword] = useState('');
  const [isIntegrationLoading, setIsIntegrationLoading] = useState(true);
  const [isSavingIntegration, setIsSavingIntegration] = useState(false);
  const [isRemovingIntegration, setIsRemovingIntegration] = useState(false);

  const [traktIntegration, setTraktIntegration] = useState<TraktIntegration | null>(null);
  const [isTraktLoading, setIsTraktLoading] = useState(true);
  const [isFetchingTraktUrl, setIsFetchingTraktUrl] = useState(false);
  const [isDisconnectingTrakt, setIsDisconnectingTrakt] = useState(false);

  const tvFileInputRef = useRef<HTMLInputElement | null>(null);
  const [tvContent, setTvContent] = useState('');
  const [tvIsLoading, setTvIsLoading] = useState(false);
  const [tvSummary, setTvSummary] = useState<ImportSummary | null>(null);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setContent(text);
      toast.success(`Loaded ${file.name}`);
    } catch {
      toast.error('Unable to read selected file');
    }
  };

  const handleImport = async () => {
    if (!content.trim()) {
      toast.error('Please paste or select a file before importing.');
      return;
    }

    setIsLoading(true);
    setSummary(null);

    try {
      const result = await importMovies(
        content,
        provider,
        provider === 'trakt' ? 'ratings' : importType
      );
      setSummary(result);
      if (result.errors.length === 0) {
        toast.success(
          `${
            provider === 'trakt'
              ? 'Trakt ratings and watch history'
              : importType === 'ratings'
                ? 'Ratings'
                : 'Comments'
          } imported successfully`
        );
      } else {
        toast.success('Import completed with some skipped rows');
      }
    } catch {
      toast.error('Import failed. Check the file format and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTvFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setTvContent(text);
      toast.success(`Loaded ${file.name}`);
    } catch {
      toast.error('Unable to read selected file');
    }
  };

  const handleTvImport = async () => {
    if (!tvContent.trim()) {
      toast.error('Please paste or select a file before importing.');
      return;
    }
    setTvIsLoading(true);
    setTvSummary(null);
    try {
      const result = await importTvShows(tvContent);
      setTvSummary(result);
      if (result.errors.length === 0) {
        toast.success('Trakt TV show data imported successfully');
      } else {
        toast.success('Import completed with some skipped rows');
      }
    } catch {
      toast.error('Import failed. Check the file format and try again.');
    } finally {
      setTvIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      return;
    }

    setIsIntegrationLoading(true);
    setIsTraktLoading(true);

    fetchFlexgetIntegration()
      .then(data => {
        setCurrentIntegration(data);
        setBaseUrl(data.baseUrl);
        setFlexgetUsername(data.username);
      })
      .catch(() => {
        setCurrentIntegration(null);
      })
      .finally(() => {
        setIsIntegrationLoading(false);
      });

    fetchTraktIntegration()
      .then(data => {
        setTraktIntegration(data.active ? data : null);
      })
      .catch(() => {
        setTraktIntegration(null);
      })
      .finally(() => {
        setIsTraktLoading(false);
      });
  }, [user]);

  const handleSaveIntegration = async () => {
    setIsSavingIntegration(true);
    try {
      const saved = await saveFlexgetIntegration({
        baseUrl: baseUrl.trim(),
        username: flexgetUsername.trim(),
        password: flexgetPassword,
      });
      setCurrentIntegration(saved);
      setFlexgetPassword('');
      toast.success('Flexget integration saved.');
    } catch {
      toast.error('Unable to save Flexget integration.');
    } finally {
      setIsSavingIntegration(false);
    }
  };

  const handleRemoveIntegration = async () => {
    if (!window.confirm('Remove saved Flexget integration?')) {
      return;
    }

    setIsRemovingIntegration(true);
    try {
      await deleteFlexgetIntegration();
      setCurrentIntegration(null);
      setBaseUrl('');
      setFlexgetUsername('');
      setFlexgetPassword('');
      toast.success('Flexget integration removed.');
    } catch {
      toast.error('Unable to remove Flexget integration.');
    } finally {
      setIsRemovingIntegration(false);
    }
  };

  const handleConnectTrakt = async () => {
    setIsFetchingTraktUrl(true);
    const redirectUri = `${window.location.origin}/trakt-callback`;

    try {
      const response = await fetchTraktAuthUrl(redirectUri);
      window.location.href = response.url;
    } catch {
      toast.error('Unable to start Trakt connection.');
    } finally {
      setIsFetchingTraktUrl(false);
    }
  };

  const handleDisconnectTrakt = async () => {
    if (!window.confirm('Disconnect Trakt from your account?')) {
      return;
    }

    setIsDisconnectingTrakt(true);
    try {
      await deleteTraktIntegration();
      setTraktIntegration(null);
      toast.success('Trakt disconnected.');
    } catch {
      toast.error('Unable to disconnect Trakt.');
    } finally {
      setIsDisconnectingTrakt(false);
    }
  };

  if (!user) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <Card>
          <CardHeader>
            <CardTitle>Sign in to import ratings</CardTitle>
            <CardDescription>
              Import functionality is available for signed in users only.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Please{' '}
              <Link className="text-primary underline" to="/login">
                sign in
              </Link>{' '}
              first.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">
          Import movie ratings, watched entries, or comments from Filmtipset and Trakt to your
          account.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import movie data</CardTitle>
          <CardDescription>
            Paste your Filmtipset CSV or Trakt JSON export below, or choose a file to load. The
            import will create ratings, watch entries, and comments where supported.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="provider">Provider</Label>
            <Select value={provider} onValueChange={value => setProvider(value as ImportProvider)}>
              <SelectTrigger id="provider">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="filmtipset">Filmtipset</SelectItem>
                <SelectItem value="trakt">Trakt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {provider === 'filmtipset' ? (
            <div className="grid gap-2">
              <Label htmlFor="importType">Import type</Label>
              <Select
                value={importType}
                onValueChange={value => setImportType(value as 'ratings' | 'comments')}>
                <SelectTrigger id="importType">
                  <SelectValue placeholder="Select import type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ratings">Ratings</SelectItem>
                  <SelectItem value="comments">Comments</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="file">File upload</Label>
            <Input
              id="file"
              type="file"
              accept=".csv,.json,text/csv,text/plain,application/json"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="content">
              {provider === 'trakt' ? 'Trakt JSON export' : 'Filmtipset CSV content'}
            </Label>
            <Textarea
              id="content"
              value={content}
              onChange={event => setContent(event.target.value)}
              placeholder={
                provider === 'trakt'
                  ? 'Paste your Trakt export JSON here'
                  : 'Paste your Filmtipset export here'
              }
            />
          </div>

          <Button onClick={handleImport} disabled={isLoading}>
            {isLoading
              ? 'Importing…'
              : provider === 'trakt'
                ? 'Import Trakt data'
                : `Import ${importType === 'ratings' ? 'ratings' : 'comments'}`}
          </Button>

          {summary ? (
            <div className="rounded-lg border border-muted p-4">
              <p className="font-semibold">Import summary</p>
              <p>Imported: {summary.importedCount}</p>
              <p>Skipped: {summary.skippedCount}</p>
              {summary.errors.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="font-semibold">Errors</p>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground">
                    {summary.errors.map((message, index) => (
                      <li key={index}>{message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import TV show data</CardTitle>
          <CardDescription>
            Paste your Trakt JSON export below, or choose a file to load. The import will create
            show ratings and episode watch history.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="tv-file">File upload</Label>
            <Input
              id="tv-file"
              type="file"
              accept=".json,text/plain,application/json"
              ref={tvFileInputRef}
              onChange={handleTvFileChange}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tv-content">Trakt JSON export</Label>
            <Textarea
              id="tv-content"
              value={tvContent}
              onChange={event => setTvContent(event.target.value)}
              placeholder="Paste your Trakt export JSON here"
            />
          </div>

          <Button onClick={handleTvImport} disabled={tvIsLoading}>
            {tvIsLoading ? 'Importing…' : 'Import Trakt TV data'}
          </Button>

          {tvSummary ? (
            <div className="rounded-lg border border-muted p-4">
              <p className="font-semibold">Import summary</p>
              <p>Imported: {tvSummary.importedCount}</p>
              <p>Skipped: {tvSummary.skippedCount}</p>
              {tvSummary.errors.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="font-semibold">Errors</p>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground">
                    {tvSummary.errors.map((message, index) => (
                      <li key={index}>{message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trakt integration</CardTitle>
          <CardDescription>
            Connect your Trakt account so Velara can sync your ratings and watch history.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {traktIntegration ? (
            <div className="rounded-lg border border-muted p-4">
              <p className="text-sm text-muted-foreground">Connected account</p>
              <p className="font-medium">
                {traktIntegration.traktUsername || traktIntegration.traktSlug}
              </p>
              <p className="text-sm">
                Last synced:{' '}
                {traktIntegration.lastSyncedAt
                  ? new Date(traktIntegration.lastSyncedAt).toLocaleString()
                  : 'Unknown'}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-muted p-4">
              <p className="text-sm text-muted-foreground">No Trakt account connected</p>
              <p className="text-sm">
                Click connect to authorize your Trakt account and enable automatic sync.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleConnectTrakt} disabled={isFetchingTraktUrl || isTraktLoading}>
              {isFetchingTraktUrl
                ? 'Opening Trakt…'
                : traktIntegration
                  ? 'Reconnect Trakt'
                  : 'Connect Trakt'}
            </Button>
            {traktIntegration ? (
              <Button
                variant="destructive"
                onClick={handleDisconnectTrakt}
                disabled={isDisconnectingTrakt || isTraktLoading}>
                Disconnect Trakt
              </Button>
            ) : null}
          </div>

          <div className="rounded-lg border border-muted p-4 text-sm text-muted-foreground">
            <p>Trakt will redirect back to:</p>
            <p className="font-mono break-all">{window.location.origin}/trakt-callback</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Flexget integration</CardTitle>
          <CardDescription>
            Save your Flexget host and credentials here so this account can connect lists to a
            Flexget entry list.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="flexget-base-url">Flexget URL</Label>
            <Input
              id="flexget-base-url"
              type="url"
              value={baseUrl}
              onChange={event => setBaseUrl(event.target.value)}
              placeholder="https://flexget.local"
              disabled={isIntegrationLoading}
            />
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="flexget-username">Username</Label>
              <Input
                id="flexget-username"
                value={flexgetUsername}
                onChange={event => setFlexgetUsername(event.target.value)}
                disabled={isIntegrationLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="flexget-password">Password</Label>
              <Input
                id="flexget-password"
                type="password"
                value={flexgetPassword}
                onChange={event => setFlexgetPassword(event.target.value)}
                disabled={isIntegrationLoading}
              />
            </div>
          </div>

          {currentIntegration ? (
            <div className="rounded-lg border border-muted p-4">
              <p className="text-sm text-muted-foreground">Saved integration</p>
              <p className="font-medium">{currentIntegration.baseUrl}</p>
              <p className="text-sm">Username: {currentIntegration.username}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleSaveIntegration}
              disabled={isSavingIntegration || isIntegrationLoading}>
              {currentIntegration ? 'Update integration' : 'Save integration'}
            </Button>
            {currentIntegration ? (
              <Button
                variant="destructive"
                onClick={handleRemoveIntegration}
                disabled={isRemovingIntegration || isIntegrationLoading}>
                Remove integration
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
