import ListFormDialog from './ListFormDialog';
import { useCreateList } from '@/hooks/useListsOverview';

export default function CreateListDialog({ onClose }: { onClose: () => void }) {
  const createMutation = useCreateList();

  return (
    <ListFormDialog
      heading="Create new list"
      summary="Give your collection a name and optional description."
      submitLabel="Create list"
      isPending={createMutation.isPending}
      errorMessage={createMutation.isError ? 'Could not create list.' : null}
      onSubmit={({ title, description }) =>
        createMutation.mutate(
          { title, description: description || undefined },
          { onSuccess: onClose }
        )
      }
      onClose={onClose}
    />
  );
}
