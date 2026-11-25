import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// Mirrors the limits the backend validates.
const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 200;

export interface ListFormValues {
  title: string;
  description: string;
}

interface ListFormDialogProps {
  heading: string;
  summary: string;
  submitLabel: string;
  initialValues?: ListFormValues;
  isPending: boolean;
  errorMessage: string | null;
  onSubmit: (values: ListFormValues) => void;
  onClose: () => void;
}

export default function ListFormDialog({
  heading,
  summary,
  submitLabel,
  initialValues,
  isPending,
  errorMessage,
  onSubmit,
  onClose,
}: ListFormDialogProps) {
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const canSubmit = title.trim() !== '' && !isPending;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    onSubmit({ title: title.trim(), description: description.trim() });
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="list-title">Title</Label>
            <Input
              id="list-title"
              value={title}
              maxLength={MAX_TITLE_LENGTH}
              placeholder="My watchlist"
              onChange={event => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="list-description">Description</Label>
            <Textarea
              id="list-description"
              value={description}
              maxLength={MAX_DESCRIPTION_LENGTH}
              placeholder="A place for movies and shows I want to revisit."
              rows={4}
              onChange={event => setDescription(event.target.value)}
            />
          </div>
          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isPending ? 'Saving…' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
