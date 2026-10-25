import api from './api';

const superAdminService = {
  list: async () => {
    const r = await api.get('/api-system/backstage/super-admins');
    return r.data;
  },
  add: async (user_id: string) => {
    const r = await api.post('/api-system/backstage/super-admins', { user_id });
    return r.data;
  },
  remove: async (id: string) => {
    const r = await api.delete(`/api-system/backstage/super-admins/${id}`);
    return r.data;
  },
};

export default superAdminService;
