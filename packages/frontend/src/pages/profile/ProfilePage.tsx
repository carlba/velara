import { type ChangeEvent, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { importRatings, type ImportSummary } from '@/services/user-data-api';

export default function ProfilePage() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

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
      const result = await importRatings(content);
      setSummary(result);
      if (result.errors.length === 0) {
        toast.success('Ratings imported successfully');
      } else {
        toast.success('Import completed with some skipped rows');
      }
    } catch (error) {
      toast.error('Import failed. Check the file format and try again.');
    } finally {
      setIsLoading(false);
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
          Import movie ratings from filmtipset.se to your account.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import ratings</CardTitle>
          <CardDescription>
            Paste your Filmtipset CSV content below or choose a file to load. The import will create
            ratings and watched entries automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="file">File upload</Label>
            <Input
              id="file"
              type="file"
              accept=".csv,text/csv,text/plain"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="content">Filmtipset CSV content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={event => setContent(event.target.value)}
              placeholder="Paste your Filmtipset export here"
            />
          </div>

          <Button onClick={handleImport} disabled={isLoading}>
            {isLoading ? 'Importing…' : 'Import ratings'}
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
    </div>
  );
}
