import { usePagedSearch, type PagedPage, type PagedSearchResult } from './usePagedSearch';
import userService from '../services/userService';
import type { User, UserOption } from '../types';

const displayName = (u: User): string => {
  const parts = [u.firstname, u.middlename, u.lastname].filter(Boolean);
  return parts.length ? parts.join(' ') : (u.name || u.email || u.id);
};

// ระดับ module = referentially stable (usePagedSearch ต้องการ)
const fetchUserPage = async (args: {
  search: string;
  page: number;
  perpage: number;
}): Promise<PagedPage<UserOption>> => {
  const response = await userService.getAll({
    page: args.page,
    perpage: args.perpage,
    search: args.search,
  });
  return {
    data: ((response.data || []) as User[]).map((u) => ({
      id: u.id,
      name: displayName(u),
      email: u.email,
    })),
    paginate: response.paginate,
  };
};

/**
 * Turns a free-text query into a list of matching users, 20 at a time.
 *
 * Search runs server-side: `userService.getAll` declares
 * `defaultSearchFields = ['username', 'email']`, so this finds users by either
 * regardless of how many users exist — the caller never needs a full user list.
 * `loadMore` appends the next page (see `usePagedSearch`).
 *
 * `enabled` is normally "the dropdown is open". While it is false no request
 * goes out and the previous results are kept rather than cleared, so reopening
 * a dropdown shows what it showed before instead of flashing empty.
 */
export function useUserSearch(query: string, enabled: boolean): PagedSearchResult<UserOption> {
  return usePagedSearch<UserOption>(query, enabled, fetchUserPage);
}
