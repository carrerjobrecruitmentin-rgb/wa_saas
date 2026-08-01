// Campaign & Contacts API Service
import { API_BASE_URL } from './api';

function getHeaders(): HeadersInit {
  const key = sessionStorage.getItem('openwa_api_key') ?? '';
  return { 'Content-Type': 'application/json', 'X-API-Key': key };
}

function getAuthHeader(): HeadersInit {
  const key = sessionStorage.getItem('openwa_api_key') ?? '';
  return { 'X-API-Key': key };
}

async function handleRes<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status}: ${body || res.statusText}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : undefined;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface ContactGroup {
  id: string;
  name: string;
  description?: string;
  totalContacts: number;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  mobile: string;
  name?: string;
  city?: string;
  state?: string;
  company?: string;
  language?: string;
  custom1?: string;
  custom2?: string;
  custom3?: string;
  groupId?: string;
  group?: ContactGroup;
  isValid: boolean;
  isDuplicate: boolean;
  createdAt: string;
}

export interface ContactsPage {
  data: Contact[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ImportLog {
  id: string;
  filename: string;
  groupId?: string;
  groupName?: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  duplicateRows: number;
  status: 'processing' | 'done' | 'failed';
  errors?: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  sessionId: string;
  groupId?: string;
  messageTemplate: string;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed';
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  totalContacts: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  deliveredCount: number;
  readCount: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignStats {
  campaign: Campaign;
  stats: {
    total: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    pending: number;
    successRate: number;
  };
}

export interface CampaignMessage {
  id: string;
  campaignId: string;
  contactId?: string;
  mobile: string;
  contactName?: string;
  messageText: string;
  status: 'pending' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  failReason?: string;
  retryCount: number;
  waMessageId?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  createdAt: string;
}

export interface CampaignMessagesPage {
  data: CampaignMessage[];
  total: number;
  page: number;
  limit: number;
}

// ── Campaign Contacts API ──────────────────────────────────────────────────

const BASE = API_BASE_URL.replace('/api', '');

export const contactsApi = {
  getGroups: (): Promise<ContactGroup[]> =>
    fetch(`${BASE}/api/campaign-contacts/groups`, { headers: getHeaders() }).then(r => handleRes<ContactGroup[]>(r)),

  createGroup: (name: string, description?: string): Promise<ContactGroup> =>
    fetch(`${BASE}/api/campaign-contacts/groups`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, description }),
    }).then(r => handleRes<ContactGroup>(r)),

  deleteGroup: (id: string): Promise<void> =>
    fetch(`${BASE}/api/campaign-contacts/groups/${id}`, { method: 'DELETE', headers: getHeaders() }).then(r => handleRes<void>(r)),

  getContacts: (params: Record<string, string | number>): Promise<ContactsPage> => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString();
    return fetch(`${BASE}/api/campaign-contacts?${qs}`, { headers: getHeaders() }).then(r => handleRes<ContactsPage>(r));
  },

  deleteContact: (id: string): Promise<void> =>
    fetch(`${BASE}/api/campaign-contacts/${id}`, { method: 'DELETE', headers: getHeaders() }).then(r => handleRes<void>(r)),

  getImportLogs: (): Promise<ImportLog[]> =>
    fetch(`${BASE}/api/campaign-contacts/import-logs`, { headers: getHeaders() }).then(r => handleRes<ImportLog[]>(r)),

  uploadFile: (file: File, groupId?: string, groupName?: string): Promise<ImportLog> => {
    const form = new FormData();
    form.append('file', file);
    const qs = new URLSearchParams();
    if (groupId) qs.set('groupId', groupId);
    if (groupName) qs.set('groupName', groupName);
    return fetch(`${BASE}/api/campaign-contacts/upload?${qs}`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: form,
    }).then(r => handleRes<ImportLog>(r));
  },
};

// ── Campaigns API ──────────────────────────────────────────────────────────

export const campaignsApi = {
  list: (): Promise<Campaign[]> =>
    fetch(`${BASE}/api/campaigns`, { headers: getHeaders() }).then(r => handleRes<Campaign[]>(r)),

  get: (id: string): Promise<Campaign> =>
    fetch(`${BASE}/api/campaigns/${id}`, { headers: getHeaders() }).then(r => handleRes<Campaign>(r)),

  getStats: (id: string): Promise<CampaignStats> =>
    fetch(`${BASE}/api/campaigns/${id}/stats`, { headers: getHeaders() }).then(r => handleRes<CampaignStats>(r)),

  getMessages: (id: string, params: Record<string, string | number>): Promise<CampaignMessagesPage> => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '').map(([k, v]) => [k, String(v)])).toString();
    return fetch(`${BASE}/api/campaigns/${id}/messages?${qs}`, { headers: getHeaders() }).then(r => handleRes<CampaignMessagesPage>(r));
  },

  create: (data: Partial<Campaign>): Promise<Campaign> =>
    fetch(`${BASE}/api/campaigns`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    }).then(r => handleRes<Campaign>(r)),

  update: (id: string, data: Partial<Campaign>): Promise<Campaign> =>
    fetch(`${BASE}/api/campaigns/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    }).then(r => handleRes<Campaign>(r)),

  start: (id: string): Promise<Campaign> =>
    fetch(`${BASE}/api/campaigns/${id}/start`, { method: 'POST', headers: getHeaders() }).then(r => handleRes<Campaign>(r)),

  pause: (id: string): Promise<Campaign> =>
    fetch(`${BASE}/api/campaigns/${id}/pause`, { method: 'POST', headers: getHeaders() }).then(r => handleRes<Campaign>(r)),

  resume: (id: string): Promise<Campaign> =>
    fetch(`${BASE}/api/campaigns/${id}/resume`, { method: 'POST', headers: getHeaders() }).then(r => handleRes<Campaign>(r)),

  delete: (id: string): Promise<void> =>
    fetch(`${BASE}/api/campaigns/${id}`, { method: 'DELETE', headers: getHeaders() }).then(r => handleRes<void>(r)),
};
