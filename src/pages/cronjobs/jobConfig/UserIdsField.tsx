import { useState } from 'react';
import { UserMultiSelect } from '../../../components/UserMultiSelect';
import { displayName } from '../../../hooks/useUserSearch';
import { hydrateByKeys, useHydratedOptions } from '../../../hooks/useHydratedOptions';
import userService from '../../../services/userService';
import type { User, UserOption } from '../../../types';

interface UserIdsFieldProps {
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  id?: string;
  error?: boolean;
}

const toOption = (u: User): UserOption => ({ id: u.id, name: displayName(u), email: u.email });

const keyOfUser = (u: UserOption) => u.id;

const fetchUsersByIds =(ids: string[]) =>
  hydrateByKeys<UserOption>(ids, 'id', async ({ advance, perpage }) => {
    const response = await userService.getAll({ page: 1, perpage, advance });
    return {
      data: ((response.data || []) as User[]).map(toOption),
      paginate: response.paginate,
    };
  });

/**
 * Cron job config stores user ids; this adapts them to the server-searched
 * `UserMultiSelect`. Ids that are still loading or can't be found become
 * `{ id, name: '' }` so they stay visible/removable and are never dropped
 * from the emitted array unless the user removes them.
 */
export default function UserIdsField({ value, onChange, disabled, id, error }: UserIdsFieldProps) {
  // Users picked from search results already carry a name — remember them so their chips
  // render at once instead of being re-fetched (and flashing a skeleton) by hydration.
  const [picked, setPicked] = useState<UserOption[]>([]);
  const { byKey, pending } = useHydratedOptions<UserOption>(value, keyOfUser, fetchUsersByIds, { known: picked });
  const options: UserOption[] = value.map((uid) => byKey.get(uid) ?? { id: uid, name: '' });

  return (
    <UserMultiSelect
      id={id}
      value={options}
      pendingIds={pending}
      disabled={disabled}
      error={error}
      onChange={(next) => {
        // keep existing order, append newly added at the end
        const nextIds = new Set(next.map((u) => u.id));
        const kept = value.filter((uid) => nextIds.has(uid));
        const keptSet = new Set(kept);
        const added = next.filter((u) => !keptSet.has(u.id) && u.name);
        if (added.length > 0) {
          setPicked((prev) => {
            const have = new Set(prev.map((u) => u.id));
            const fresh = added.filter((u) => !have.has(u.id));
            return fresh.length > 0 ? [...prev, ...fresh] : prev;
          });
        }
        onChange([...kept, ...next.map((u) => u.id).filter((uid) => !keptSet.has(uid))]);
      }}
    />
  );
}
