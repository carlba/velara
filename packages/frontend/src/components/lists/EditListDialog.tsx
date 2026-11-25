import ListFormDialog from './ListFormDialog';
import { useUpdateList } from '@/hooks/useListDetails';
import type { ListDetails } from '@/types/list';

interface EditListDialogProps {
  list: ListDetails;
  onClose: () => void;
}

export default function EditListDialog({ list, onClose }: EditListDialogProps) {
  const updateMutation = useUpdateList(list.id);

  return (
    <ListFormDialog
      heading="Edit details"
      summary="Change the title and description of this list."
      submitLabel="Save details"
      initialValues={{ title: list.title, description: list.description ?? '' }}
      isPending={updateMutation.isPending}
      errorMessage={updateMutation.isError ? 'Could not save list details.' : null}
      onSubmit={values => updateMutation.mutate(values, { onSuccess: onClose })}
      onClose={onClose}
    />
  );
}
