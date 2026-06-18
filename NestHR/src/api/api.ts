import { createAsyncStorage } from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://hrms-backend.pixelatenest.com/api';

const storage = createAsyncStorage('hrms');
const TOKEN_KEY = 'hrms_token';

export const getToken = async (): Promise<string | null> =>
  storage.getItem(TOKEN_KEY);
export const setToken = (t: string) => storage.setItem(TOKEN_KEY, t);
export const removeToken = () => storage.removeItem(TOKEN_KEY);

async function request<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const isGet = !options.method || options.method === 'GET';
  // Cache-bust GET requests so server never sends 304 (ETag match returns no body)
  const url = isGet
    ? `${BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}_t=${Date.now()}`
    : `${BASE_URL}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store',
      Pragma: 'no-cache',
      'If-None-Match': '',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    const err: any = new Error(
      data.message || `Request failed (${res.status})`,
    );
    err.status = res.status;
    throw err;
  }
  return data;
}

function qs(params?: Record<string, string>) {
  if (!params) return '';
  const s = new URLSearchParams(params).toString();
  return s ? `?${s}` : '';
}

export const authAPI = {
  login: (email: string, password: string) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (body: { name: string; email: string; password: string }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  getMe: () => request('/auth/me'),
  updateProfile: (body: object) =>
    request('/auth/profile', { method: 'PUT', body: JSON.stringify(body) }),
};

export const dashboardAPI = {
  getStats: () => request('/dashboard/stats'),
};

export const employeeAPI = {
  getAll: (params?: Record<string, string>) =>
    request(`/employees${qs(params)}`),
  getMe: () => request('/employees/me'),
  getOne: (id: string) => request(`/employees/${id}`),
  create: (body: object) =>
    request('/employees', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) => request(`/employees/${id}`, { method: 'DELETE' }),
  resetPassword: (id: string, password: string) =>
    request(`/employees/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
};

export const attendanceAPI = {
  getAll: (params?: Record<string, string>) =>
    request(`/attendance${qs(params)}`),
  mark: (body: object) =>
    request('/attendance', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/attendance/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  bulkMark: (body: object) =>
    request('/attendance/bulk', { method: 'POST', body: JSON.stringify(body) }),
  getSummary: (params: Record<string, string>) =>
    request(`/attendance/summary${qs(params)}`),
};

export const leaveAPI = {
  getAll: (params?: Record<string, string>) => request(`/leaves${qs(params)}`),
  create: (body: object) =>
    request('/leaves', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/leaves/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  updateStatus: (id: string, body: object) =>
    request(`/leaves/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) => request(`/leaves/${id}`, { method: 'DELETE' }),
};

export const payrollAPI = {
  getAll: (params?: Record<string, string>) => request(`/payroll${qs(params)}`),
  getMy: (params?: Record<string, string>) =>
    request(`/payroll/my${qs(params)}`),
  process: (body: object) =>
    request('/payroll/process', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/payroll/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  markPaid: (id: string) => request(`/payroll/${id}/paid`, { method: 'PUT' }),
  bulkMarkPaid: (month: number, year: number) =>
    request('/payroll/bulk-paid', {
      method: 'POST',
      body: JSON.stringify({ month, year }),
    }),
};

export const recruitmentAPI = {
  getAll: (params?: Record<string, string>) =>
    request(`/recruitment${qs(params)}`),
  create: (body: object) =>
    request('/recruitment', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/recruitment/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  addCandidate: (id: string, body: object) =>
    request(`/recruitment/${id}/candidates`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateCandidateStage: (id: string, candidateId: string, body: object) =>
    request(`/recruitment/${id}/candidates/${candidateId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
};

export const departmentAPI = {
  getAll: () => request('/departments'),
  create: (body: object) =>
    request('/departments', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  delete: (id: string) => request(`/departments/${id}`, { method: 'DELETE' }),
};

export const performanceAPI = {
  getAll: (params?: Record<string, string>) =>
    request(`/performance${qs(params)}`),
  create: (body: object) =>
    request('/performance', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/performance/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
};

export const settingsAPI = {
  get: () => request('/settings'),
  update: (settings: any) =>
    request('/settings', { method: 'PUT', body: JSON.stringify(settings) }),
};

export const billingAPI = {
  getPlans: () => request('/billing/plans'),
  getSubscription: () => request('/billing/subscription'),
  getInvoices: () => request('/billing/invoices'),
  createOrder: (planId: string, billingCycle: string, gateway = 'razorpay') =>
    request('/billing/create-order', {
      method: 'POST',
      body: JSON.stringify({ plan: planId, billingCycle, gateway }),
    }),
  verifyRazorpay: (payload: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) =>
    request('/billing/verify-razorpay', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const holidayAPI = {
  getAll: (params?: Record<string, string>) =>
    request(`/holidays${qs(params)}`),
  create: (body: object) =>
    request('/holidays', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/holidays/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) => request(`/holidays/${id}`, { method: 'DELETE' }),
};

export const loanAPI = {
  getAll: (params?: Record<string, string>) => request(`/loans${qs(params)}`),
  create: (body: object) =>
    request('/loans', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/loans/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) => request(`/loans/${id}`, { method: 'DELETE' }),
};

export const departmentShiftAPI = {
  getAll: () => request('/departments'),
};

export const companyAPI = {
  getMe: () => request('/company/me'),
  update: (body: object) =>
    request('/company', { method: 'PUT', body: JSON.stringify(body) }),
};

export const reportAPI = {
  getSummary: () => request('/dashboard/stats'),
  generate: (type: string) =>
    request(`/reports/${type}`, { method: 'POST', body: JSON.stringify({}) }),
};

export const shiftAPI = {
  getAll: () => request('/shifts'),
  create: (body: object) =>
    request('/shifts', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/shifts/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) => request(`/shifts/${id}`, { method: 'DELETE' }),
};

export const salaryHeadAPI = {
  getAll: () => request('/salary-heads'),
  create: (body: object) =>
    request('/salary-heads', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/salary-heads/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  delete: (id: string) => request(`/salary-heads/${id}`, { method: 'DELETE' }),
};

export const designationAPI = {
  getAll: () => request('/designations'),
  create: (body: object) =>
    request('/designations', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/designations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  delete: (id: string) => request(`/designations/${id}`, { method: 'DELETE' }),
};

export const payrollConfigAPI = {
  get: () => request('/payroll-config'),
  update: (body: object) =>
    request('/payroll-config', { method: 'PUT', body: JSON.stringify(body) }),
  getDeductionRules: () => request('/payroll-config/deduction-rules'),
  updateDeductionRules: (body: object) =>
    request('/payroll-config/deduction-rules', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
};

export const biometricAPI = {
  getLocations: () => request('/biometric/locations'),
  createLocation: (body: object) =>
    request('/biometric/locations', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateLocation: (id: string, body: object) =>
    request(`/biometric/locations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteLocation: (id: string) =>
    request(`/biometric/locations/${id}`, { method: 'DELETE' }),
  getDevices: () => request('/biometric/devices'),
  createDevice: (body: object) =>
    request('/biometric/devices', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateDevice: (id: string, body: object) =>
    request(`/biometric/devices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteDevice: (id: string) =>
    request(`/biometric/devices/${id}`, { method: 'DELETE' }),
  getLogs: (params?: Record<string, string>) =>
    request(`/biometric/logs${qs(params)}`),
  assignNfc: (deviceId: string, body: object) =>
    request(`/biometric/devices/${deviceId}/nfc`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  removeNfc: (deviceId: string, uid: string) =>
    request(`/biometric/devices/${deviceId}/nfc/${uid}`, { method: 'DELETE' }),
  syncAll: (deviceId: string) =>
    request(`/biometric/devices/${deviceId}/sync-all`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  syncEmployee: (deviceId: string, employeeId: string) =>
    request(`/biometric/devices/${deviceId}/sync-employee/${employeeId}`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  setDeviceSerial: (deviceId: string, serialNumber: string) =>
    request(`/biometric/devices/${deviceId}/serial`, {
      method: 'PUT',
      body: JSON.stringify({ serialNumber }),
    }),
  getDeviceCommands: (deviceId: string) =>
    request(`/biometric/devices/${deviceId}/commands`),
  syncEmployeeToDevice: (
    deviceId: string,
    employeeId: string,
    rfidCard?: string,
  ) =>
    request(`/biometric/devices/${deviceId}/sync-employee`, {
      method: 'POST',
      body: JSON.stringify({ employeeId, rfidCard }),
    }),
  syncAllToDevice: (deviceId: string) =>
    request(`/biometric/devices/${deviceId}/sync-all`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  enrollFpOnDevice: (
    deviceId: string,
    employeeId: string,
    fingerIndex?: number,
  ) =>
    request(`/biometric/devices/${deviceId}/enroll-fingerprint`, {
      method: 'POST',
      body: JSON.stringify({ employeeId, fingerIndex: fingerIndex ?? 0 }),
    }),
  enrollFaceOnDevice: (deviceId: string, employeeId: string) =>
    request(`/biometric/devices/${deviceId}/enroll-face-device`, {
      method: 'POST',
      body: JSON.stringify({ employeeId }),
    }),
  pushFaceTemplate: (deviceId: string, employeeId: string) =>
    request(`/biometric/devices/${deviceId}/push-face-template`, {
      method: 'POST',
      body: JSON.stringify({ employeeId }),
    }),
  saveRfidCard: (employeeId: string, rfidCard: string) =>
    request(`/biometric/employees/${employeeId}/rfid`, {
      method: 'POST',
      body: JSON.stringify({ rfidCard }),
    }),
};

export const authAPI_extras = {
  forgotPassword: (email: string) =>
    request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
};

// ── Offline cache (AsyncStorage-backed) ───────────────────────────────────────
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function cachedRequest<T = any>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<{ data: T; fromCache: boolean }> {
  try {
    const fresh = await fetcher();
    storage.setItem(
      `cache_${key}`,
      JSON.stringify({ ts: Date.now(), data: fresh }),
    );
    return { data: fresh, fromCache: false };
  } catch (_err) {
    const raw = await storage.getItem(`cache_${key}`);
    if (raw) {
      try {
        const { data } = JSON.parse(raw);
        return { data, fromCache: true };
      } catch {}
    }
    throw _err;
  }
}

export async function getCached<T = any>(key: string): Promise<T | null> {
  const raw = await storage.getItem(`cache_${key}`);
  if (!raw) return null;
  try {
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts < CACHE_TTL_MS) return data as T;
  } catch {}
  return null;
}

// ── Audit Log ─────────────────────────────────────────────────────────────────
export const transactionAPI = {
  getAll: (params?: Record<string, string>) =>
    request(`/transactions${qs(params)}`),
  create: (body: object) =>
    request('/transactions', { method: 'POST', body: JSON.stringify(body) }),
};

export const auditAPI = {
  getLogs: (params?: Record<string, string>) => request(`/audit${qs(params)}`),
};

// ── Local notification store ──────────────────────────────────────────────────
export interface LocalNotification {
  id: string;
  title: string;
  body: string;
  ts: number;
  read: boolean;
}

const NOTIF_KEY = 'hrms_notifications';

export const localNotificationsAPI = {
  getAll: async (): Promise<LocalNotification[]> => {
    const raw = await storage.getItem(NOTIF_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },
  add: async (n: Omit<LocalNotification, 'id' | 'ts' | 'read'>) => {
    const all = await localNotificationsAPI.getAll();
    const entry: LocalNotification = {
      ...n,
      id: Date.now().toString(),
      ts: Date.now(),
      read: false,
    };
    const updated = [entry, ...all].slice(0, 50);
    await storage.setItem(NOTIF_KEY, JSON.stringify(updated));
    return entry;
  },
  markRead: async (id: string) => {
    const all = await localNotificationsAPI.getAll();
    const updated = all.map(n => (n.id === id ? { ...n, read: true } : n));
    await storage.setItem(NOTIF_KEY, JSON.stringify(updated));
  },
  markAllRead: async () => {
    const all = await localNotificationsAPI.getAll();
    await storage.setItem(
      NOTIF_KEY,
      JSON.stringify(all.map(n => ({ ...n, read: true }))),
    );
  },
  clear: async () => {
    await storage.setItem(NOTIF_KEY, '[]');
  },
};
