import api from './api';
import { buildQuery } from '../utils/buildQuery';
import type {
  PaginateParams,
  BackstageUserScope,
  BackstageUsersResponse,
} from '../types';

const defaultSearchFields = ['username', 'email'];

const userBackstageService = {
  /**
   * Users holding at least one platform role. Users with none are excluded server-side.
   * The response's `summary` block is the registry-wide aggregate (see
   * `BackstageUserRegistrySummary`) and is optional — it is absent until the backend
   * deploys the change that adds it, so callers must not assume its presence.
   */
  getAll: async (paginate: PaginateParams = {}): Promise<BackstageUsersResponse> => {
    const response = await api.get(
      `/api-system/backstage/users?${buildQuery(paginate, defaultSearchFields)}`,
    );
    return response.data;
  },

  /** Grant several roles at one shared scope. Atomic — the backend writes all or none. */
  assignBulk: async (
    userId: string,
    payload: { role_ids: string[]; scope: BackstageUserScope },
  ) => {
    const response = await api.post(
      `/api-system/backstage/users/${userId}/roles/bulk`,
      payload,
    );
    return response.data;
  },
};

export default userBackstageService;
