import api from './api';
import type { AiProvider, AiProviderInput } from '../types';

const BASE = '/api-system/ai-providers';
// gateway ห่อ envelope { data } — ตาม src/services/CLAUDE.md
const unwrap = <T>(res: { data: unknown }): T => {
  const body = res.data as { data?: T } | T;
  return ((body as { data?: T })?.data ?? body) as T;
};

const aiProviderService = {
  // รวมแถวที่ปิดอยู่ด้วย
  list: async (): Promise<AiProvider[]> => {
    const inner = unwrap<AiProvider[] | { data: AiProvider[] }>(await api.get(BASE));
    return Array.isArray(inner) ? inner : inner?.data ?? [];
  },
  create: async (data: AiProviderInput): Promise<{ id: string }> => unwrap(await api.post(BASE, data)),
  // PATCH ต้องส่ง doc_version และห้ามส่ง code
  update: async (id: string, data: Partial<Omit<AiProviderInput, 'code'>> & { doc_version: number }) =>
    unwrap<{ id: string; doc_version: number }>(await api.patch(`${BASE}/${id}`, data)),
  remove: async (id: string): Promise<void> => {
    await api.delete(`${BASE}/${id}`);
  },
};

export default aiProviderService;
