import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../config/env';
import { announceRefund, isRefundMessage } from '../utils/refundNotice';

const BASE_URL = API_BASE_URL;

const storage = createAsyncStorage('hrms');
const TOKEN_KEY = 'hrms_token';

export const getToken = async (): Promise<string | null> =>
  storage.getItem(TOKEN_KEY);
export const setToken = (t: string) => storage.setItem(TOKEN_KEY, t);
export const removeToken = () => storage.removeItem(TOKEN_KEY);

const NETWORK_MSG =
  'Cannot reach the server. Please check your internet connection and try again.';
const statusMsg = (s: number) =>
  s === 429
    ? 'Too many attempts. Please wait a minute and try again.'
    : s === 413
      ? 'That file is too large. Please choose a smaller one.'
      : s === 403
        ? 'You do not have permission to do this.'
        : s === 404
          ? 'We could not find what you were looking for.'
          : s >= 500
            ? 'Something went wrong on our side. Please try again in a moment.'
            : 'Something went wrong. Please try again.';

const TIMEOUT_MS = 15_000;
const GET_RETRIES = 2;

async function request<T = any>(
  endpoint: string,
  options: RequestInit = {},
  _retries = GET_RETRIES,
): Promise<T> {
  const token = await getToken();
  const isGet = !options.method || options.method === 'GET';
  // Cache-bust GET requests so server never sends 304 (ETag match returns no body)
  const url = isGet
    ? `${BASE_URL}${endpoint}${
        endpoint.includes('?') ? '&' : '?'
      }_t=${Date.now()}`
    : `${BASE_URL}${endpoint}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Platform': Platform.OS,
        'X-Device-Name': `${Platform.OS === 'ios' ? 'iOS' : 'Android'} ${Platform.Version}`,
        'Cache-Control': 'no-cache, no-store',
        Pragma: 'no-cache',
        'If-None-Match': '',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    clearTimeout(timer);

    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {} // gateway HTML page — fall through to statusMsg

    if (!res.ok) {
      if (isRefundMessage(data.message)) announceRefund(data.message);
      const err: any = new Error(data.message || statusMsg(res.status));
      err.status = res.status;
      throw err;
    }
    return data;
  } catch (err: any) {
    clearTimeout(timer);

    const isNetworkErr =
      err.name === 'AbortError' || err.message === 'Network request failed';

    // Retry GET requests on transient network errors (stale keep-alive,
    // cell-tower switch, brief dropout). Never retry mutations.
    if (isGet && isNetworkErr && _retries > 0) {
      await new Promise<void>(r => setTimeout(() => r(), 1000));
      return request(endpoint, options, _retries - 1);
    }

    if (err.name === 'AbortError') {
      throw new Error(
        'The server is taking too long to respond. Please check your connection and try again.',
      );
    }
    if (err.message === 'Network request failed') {
      throw new Error(NETWORK_MSG);
    }
    throw err;
  }
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
      body: JSON.stringify({
        email,
        password,
        client: 'mobile',
        acceptTerms: true,
      }),
    }),
  register: (body: { name: string; email: string; password: string }) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ ...body, acceptTerms: true }),
    }),
  getMe: () => request('/auth/me'),
  updateProfile: (body: object) =>
    request('/auth/profile', { method: 'PUT', body: JSON.stringify(body) }),
  sendPhoneOtp: (phone: string) =>
    request('/auth/otp/send', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),
  verifyPhoneOtp: (phone: string, otp: string) =>
    request('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, otp, acceptTerms: true }),
    }),
  setup2FA: () =>
    request('/auth/2fa/setup', { method: 'POST', body: JSON.stringify({}) }),
  confirm2FA: (token: string) =>
    request('/auth/2fa/confirm', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  disable2FA: (token: string) =>
    request('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  verify2FA: (pendingToken: string, token: string) =>
    request('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ pendingToken, token, acceptTerms: true }),
    }),
  // Password reset by WhatsApp code / authenticator app
  forgotPasswordMethods: (email: string) =>
    request(`/auth/forgot-password/methods?email=${encodeURIComponent(email)}`),
  forgotPasswordWhatsapp: (email: string) =>
    request('/auth/forgot-password/whatsapp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPasswordWithOtp: (email: string, otp: string, password: string) =>
    request('/auth/reset-password/otp/whatsapp', {
      method: 'POST',
      body: JSON.stringify({ email, otp, password }),
    }),
  resetPasswordWithTotp: (email: string, token: string, password: string) =>
    request('/auth/reset-password/otp/totp', {
      method: 'POST',
      body: JSON.stringify({ email, token, password }),
    }),
  // Prove ownership of the profile phone (separate from the login OTP)
  sendPhoneVerifyOtp: () =>
    request('/auth/phone/send-otp', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  verifyPhoneVerifyOtp: (otp: string) =>
    request('/auth/phone/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ otp }),
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  passkeyLoginOptions: () => request('/auth/passkey/login-options'),
  biometricLogin: (credential: any) =>
    request('/auth/passkey/login', {
      method: 'POST',
      body: JSON.stringify(credential),
    }),
  passkeyRegisterOptions: () =>
    request('/auth/passkey/register-options', { method: 'POST' }),
  passkeyRegister: (payload: any) =>
    request('/auth/passkey/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  passkeyList: () => request('/auth/passkey'),
  passkeyDelete: (id: string) =>
    request(`/auth/passkey/${id}`, { method: 'DELETE' }),

  // Signed-in devices
  sessions: () => request('/auth/sessions'),
  removeSession: (id: string) =>
    request(`/auth/sessions/${id}`, { method: 'DELETE' }),
  removeOtherSessions: () => request('/auth/sessions', { method: 'DELETE' }),
  removeCurrentSession: async () => {
    const list: any = await request('/auth/sessions');
    const cur = (list.data || []).find((s: any) => s.current);
    if (cur) await request(`/auth/sessions/${cur._id}`, { method: 'DELETE' });
  },

  // Backup codes
  backupCodesStatus: () => request('/auth/backup-codes'),
  generateBackupCodes: (password: string) =>
    request('/auth/backup-codes', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  // Email OTP sign-in
  loginSendEmailOtp: (email: string) =>
    request('/auth/login/email-otp/send', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  loginVerifyEmailOtp: (email: string, otp: string) =>
    request('/auth/login/email-otp/verify', {
      method: 'POST',
      body: JSON.stringify({ email, otp, acceptTerms: true }),
    }),

  // Verify the current / a new email with a code sent to it
  sendEmailVerifyOtp: (email: string) =>
    request('/auth/contact/email/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  verifyEmailVerifyOtp: (otp: string) =>
    request('/auth/contact/email/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ otp }),
    }),

  // Password reset via backup code / passkey
  resetWithBackupCode: (email: string, code: string, password: string) =>
    request('/auth/reset/backup', {
      method: 'POST',
      body: JSON.stringify({ email, code, password }),
    }),
  resetPasskeyOptions: () => request('/auth/reset/passkey-options'),
  resetWithPasskey: (payload: any) =>
    request('/auth/reset/passkey', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const dashboardAPI = {
  getStats: () => request('/dashboard/stats'),
  getEmployeeStats: () => request('/dashboard/employee'),
  getPayrollSummary: (range: string) =>
    request(`/dashboard/payroll-summary?range=${range}`),
  getMonthlyPerformance: (month: number, year: number) =>
    request(`/dashboard/payroll-summary?month=${month}&year=${year}`),
};

export const employeeAPI = {
  // The server pages at 20 by default, which silently hid employees beyond the first 20.
  getAll: (params?: Record<string, string>) =>
    request(`/employees${qs({ limit: '5000', ...params })}`),
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
  resetMyFace: () => request('/employees/me/face-enroll', { method: 'DELETE' }),
  enrollMyFace: async (uri: string, type: string, fileName: string) => {
    const token = await getToken();
    const formData = new FormData();
    formData.append('photo', { uri, type, name: fileName } as any);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(`${BASE_URL}/employees/me/face-enroll`, {
        method: 'POST',
        signal: controller.signal,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });
      clearTimeout(timer);
      const text = await res.text();
      let data: any;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        console.error(
          'Face enroll: non-JSON response',
          res.status,
          text.slice(0, 500),
        );
        throw new Error(
          `Server returned an unexpected response (status ${res.status}). ` +
            'This usually means the photo was rejected by the server before reaching the app ' +
            '(e.g. file too large) — try again with better lighting or contact support.',
        );
      }
      if (!res.ok)
        throw new Error(data.message || `Enrollment failed (${res.status})`);
      return data;
    } catch (err: any) {
      clearTimeout(timer);
      // RN reports our own 30s timeout as a bare "Aborted" — say what happened.
      if (err?.name === 'AbortError' || /abort/i.test(err?.message || '')) {
        const e: any = new Error(
          'The server took too long to respond. Check your connection and try again.',
        );
        e.retryable = true;
        throw e;
      }
      if (/network request failed/i.test(err?.message || ''))
        err.retryable = true;
      throw err;
    }
  },
  uploadAvatar: async (
    id: string,
    uri: string,
    type: string,
    fileName: string,
  ) => {
    const token = await getToken();
    const formData = new FormData();
    formData.append('avatar', { uri, type, name: fileName } as any);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(`${BASE_URL}/employees/${id}/avatar`, {
        method: 'POST',
        signal: controller.signal,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });
      clearTimeout(timer);
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {} // gateway HTML page — fall through to statusMsg
      if (!res.ok) throw new Error(data.message || statusMsg(res.status));
      return data;
    } catch (err: any) {
      clearTimeout(timer);
      throw err;
    }
  },
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
  selfMark: async (params: {
    action: 'checkin' | 'checkout';
    lat: number;
    lng: number;
    accuracy?: number;
    selfieUri: string;
    selfieType: string;
    selfieName: string;
  }) => {
    const token = await getToken();
    const formData = new FormData();
    formData.append('action', params.action);
    formData.append('lat', String(params.lat));
    formData.append('lng', String(params.lng));
    if (params.accuracy != null)
      formData.append('accuracy', String(params.accuracy));
    formData.append('selfie', {
      uri: params.selfieUri,
      type: params.selfieType,
      name: params.selfieName,
    } as any);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(`${BASE_URL}/attendance/self-mark`, {
        method: 'POST',
        signal: controller.signal,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });
      clearTimeout(timer);
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {} // gateway HTML page — fall through to statusMsg
      if (!res.ok) throw new Error(data.message || statusMsg(res.status));
      return data;
    } catch (err: any) {
      clearTimeout(timer);
      throw err;
    }
  },
};

// Admin-only spare-device kiosk (wall-mounted phone/tablet): the server recognises WHO is in the photo and toggles
// that employee's check-in / check-out for today.
export const kioskAPI = {
  mark: async (photo: { uri: string; type: string; name: string }) => {
    const token = await getToken();
    const formData = new FormData();
    formData.append('photo', photo as any);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(`${BASE_URL}/attendance/kiosk-face`, {
        method: 'POST',
        signal: controller.signal,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {} // gateway HTML page - fall through to statusMsg
      if (!res.ok) throw new Error(data.message || statusMsg(res.status));
      return data as { success: boolean; locked?: boolean; data: any };
    } finally {
      clearTimeout(timer);
    }
  },
};

export const leaveAPI = {
  getAll: (params?: Record<string, string>) => request(`/leaves${qs(params)}`),
  create: (body: object) =>
    request('/leaves', { method: 'POST', body: JSON.stringify(body) }),
  // Multipart variant used when a supporting document is attached (required
  // for sick/casual leave). Mirrors documentAPI.upload's fetch pattern since
  // FormData can't go through the JSON `request()` helper.
  createWithDocument: async (
    body: Record<string, any>,
    file: {
      uri: string;
      type: string;
      name: string;
    },
  ) => {
    const token = await getToken();
    const formData = new FormData();
    Object.entries(body).forEach(([k, v]) => {
      if (v !== undefined && v !== null) formData.append(k, String(v));
    });
    formData.append('document', file as any);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(`${BASE_URL}/leaves`, {
        method: 'POST',
        signal: controller.signal,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });
      clearTimeout(timer);
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {} // gateway HTML page — fall through to statusMsg
      if (!res.ok) throw new Error(data.message || statusMsg(res.status));
      return data;
    } catch (err: any) {
      clearTimeout(timer);
      throw err;
    }
  },
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
  markSlipReceived: (id: string) =>
    request(`/payroll/${id}/slip-received`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    }),
  bulkMarkPaid: (month: number, year: number) =>
    request('/payroll/bulk-paid', {
      method: 'POST',
      body: JSON.stringify({ month, year }),
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
  // HR/admin: every active employee's month performance in one call
  getOverview: (params?: Record<string, string>) =>
    request(`/performance/overview${qs(params)}`),
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

export const creditsAPI = {
  balance: () => request('/credits/balance'),
  ledger: (page = 1, type = '') =>
    request(`/credits/ledger?page=${page}${type ? `&type=${type}` : ''}`),
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
  request: (body: object) =>
    request('/loans/request', { method: 'POST', body: JSON.stringify(body) }),
  updateStatus: (id: string, body: object) =>
    request(`/loans/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
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

export const attendanceSettingsAPI = {
  get: () => request('/attendance-settings'),
  update: (body: object) =>
    request('/attendance-settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  upsertLateAllowance: (body: {
    mode: 'bulk' | 'custom';
    bulkCount?: number;
    perEmployee?: { employee: string; count: number }[];
  }) =>
    request('/attendance-settings/late-allowance', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  upsertLeaveAllowance: (body: {
    leaveType: string;
    mode: 'bulk' | 'custom';
    bulkDays?: number;
    perEmployee?: { employee: string; days: number }[];
  }) =>
    request('/attendance-settings/leave-allowance', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  getBalanceSummary: () => request('/attendance-settings/balance-summary'),
  getMyBalance: () => request('/attendance-settings/my-balance'),
};

export const lateApprovalAPI = {
  getAll: (params?: Record<string, string>) =>
    request(`/late-approvals${qs(params)}`),
  resolve: (id: string, resolvedStatus: string) =>
    request(`/late-approvals/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolvedStatus }),
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
  // What the hardware device sent and what the server answered (handshakes, punch pushes, commands)
  getDeviceLogs: (params?: Record<string, string>) =>
    request(`/biometric/device-logs${qs(params)}`),
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
  delete: (id: string) => request(`/transactions/${id}`, { method: 'DELETE' }),
};

export const exitAPI = {
  getAll: (params?: Record<string, string>) => request(`/exit${qs(params)}`),
  create: (body: object) =>
    request('/exit', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/exit/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) => request(`/exit/${id}`, { method: 'DELETE' }),
};

export const offerLetterAPI = {
  getAll: (params?: Record<string, string>) =>
    request(`/offer-letters${qs(params)}`),
  create: (body: object) =>
    request('/offer-letters', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/offer-letters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  delete: (id: string) => request(`/offer-letters/${id}`, { method: 'DELETE' }),
};

export const paymentMethodAPI = {
  getAll: () => request('/payment-methods'),
  create: (body: object) =>
    request('/payment-methods', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/payment-methods/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  delete: (id: string) =>
    request(`/payment-methods/${id}`, { method: 'DELETE' }),
  getDefault: () => request('/payment-methods/default'),
};

export const auditAPI = {
  getLogs: (params?: Record<string, string>) => request(`/audit${qs(params)}`),
  getActivity: (params?: Record<string, string>) =>
    request(`/audit/activity${qs(params)}`),
};

export const supportAPI = {
  getAll: () => request('/support'),
  getOne: (id: string) => request(`/support/${id}`),
  create: (body: {
    subject: string;
    issueType: string;
    priority: string;
    description: string;
  }) => request('/support', { method: 'POST', body: JSON.stringify(body) }),
  reply: (id: string, message: string) =>
    request(`/support/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  close: (id: string) => request(`/support/${id}/close`, { method: 'POST' }),
};

export const documentAPI = {
  getAll: (params?: Record<string, string>) =>
    request(`/documents${qs(params)}`),
  // Confidential files: an OTP-issued access token must be sent with every download.
  requestOtp: () => request('/documents/otp/request', { method: 'POST' }),
  verifyOtp: (otp: string) =>
    request('/documents/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ otp }),
    }),
  download: (id: string, docToken: string) =>
    request(`/documents/${id}/download`, {
      headers: { 'X-Doc-Token': docToken },
    }),
  delete: (id: string) => request(`/documents/${id}`, { method: 'DELETE' }),
  upload: async (formData: FormData) => {
    const token = await getToken();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(`${BASE_URL}/documents`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      clearTimeout(timer);
      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {} // gateway HTML page — fall through to statusMsg
      if (!res.ok) throw new Error(data.message || statusMsg(res.status));
      return data;
    } catch (err: any) {
      clearTimeout(timer);
      throw err;
    }
  },
};

export const payrollPreviewAPI = {
  preview: (body: { month: number; year: number; employeeIds?: string[] }) =>
    request('/payroll/preview', { method: 'POST', body: JSON.stringify(body) }),
};

export const assetAPI = {
  getAll: (params?: Record<string, string>) => request(`/assets${qs(params)}`),
  return: (id: string) => request(`/assets/${id}/return`, { method: 'POST' }),
};

export const announcementAPI = {
  getAll: () => request('/announcements'),
  create: (body: {
    title: string;
    content: string;
    category?: string;
    priority?: string;
    pinned?: boolean;
    expiryDate?: string;
    targetAudience?: string;
    departments?: string[];
    roles?: string[];
    acknowledgementRequired?: boolean;
    posterUrl?: string;
  }) =>
    request('/announcements', { method: 'POST', body: JSON.stringify(body) }),
  // Uploads the poster image; resolves with { url } to pass as posterUrl in create().
  uploadPoster: async (uri: string, type: string, name: string) => {
    const token = await getToken();
    const formData = new FormData();
    formData.append('poster', { uri, type, name } as any);
    const res = await fetch(`${BASE_URL}/announcements/poster`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    });
    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {}
    if (!res.ok) throw new Error(data.message || statusMsg(res.status));
    return data as { url: string };
  },
  delete: (id: string) => request(`/announcements/${id}`, { method: 'DELETE' }),
  markRead: (id: string) =>
    request(`/announcements/${id}/read`, { method: 'POST' }),
  acknowledge: (id: string) =>
    request(`/announcements/${id}/acknowledge`, { method: 'POST' }),
};

export const taskAPI = {
  getAll: (params?: Record<string, string>) => request(`/tasks${qs(params)}`),
  getOne: (id: string) => request(`/tasks/${id}`),
  create: (body: {
    title: string;
    description?: string;
    assignedTo: string;
    priority?: string;
    dueDate?: string;
  }) => request('/tasks', { method: 'POST', body: JSON.stringify(body) }),
  update: (
    id: string,
    body: {
      title?: string;
      description?: string;
      assignedTo?: string;
      priority?: string;
      dueDate?: string;
    },
  ) => request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  updateStatus: (id: string, status: string) =>
    request(`/tasks/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  addComment: (id: string, message: string) =>
    request(`/tasks/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  delete: (id: string) => request(`/tasks/${id}`, { method: 'DELETE' }),
};

export const trashAPI = {
  getAll: (modelName?: string) =>
    request(`/trash${modelName ? `?modelName=${modelName}` : ''}`),
  restore: (id: string) => request(`/trash/${id}/restore`, { method: 'POST' }),
  purge: (id: string) => request(`/trash/${id}`, { method: 'DELETE' }),
};

export const attendanceCorrectionAPI = {
  getAll: (params?: Record<string, string>) =>
    request(`/attendance-corrections${qs(params)}`),
  create: (body: {
    date: string;
    type: string;
    checkIn?: string;
    checkOut?: string;
    reason: string;
  }) =>
    request('/attendance-corrections', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

// ── Local notification store ──────────────────────────────────────────────────
export interface LocalNotification {
  id: string;
  title: string;
  body: string;
  ts: number;
  read: boolean;
  /** Optional dedupe key (e.g. `announcement:<id>`): adding the same key twice keeps one entry. */
  key?: string;
}

const NOTIF_KEY = 'hrms_notifications';
const SEEN_ANNOUNCEMENTS_KEY = 'hrms_seen_announcements';

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
    if (n.key && all.some(x => x.key === n.key)) return null;
    const entry: LocalNotification = {
      ...n,
      id: `${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
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

/**
 * Turns announcements posted since the last check into in-app notifications. The first run only records what already
 * exists, so installing the app doesn't flood the bell with old announcements. Returns how many new ones were added.
 * (Delivery while the app is closed needs push - see services/pushNotificationService.ts.)
 */
export async function syncAnnouncementNotifications(): Promise<number> {
  const res: any = await announcementAPI.getAll();
  const list: any[] = Array.isArray(res?.data) ? res.data : [];
  const raw = await storage.getItem(SEEN_ANNOUNCEMENTS_KEY);
  let seen: string[] | null = null;
  try {
    seen = raw ? JSON.parse(raw) : null;
  } catch {
    seen = null;
  }
  const ids = list.map(a => String(a._id));
  if (seen) {
    const known = new Set(seen);
    for (const a of list.filter(x => !known.has(String(x._id))).reverse()) {
      await localNotificationsAPI.add({
        key: `announcement:${a._id}`,
        title: 'New announcement',
        body: String(a.title || 'A new announcement was posted'),
      });
    }
  }
  const added = seen ? ids.filter(id => !seen!.includes(id)).length : 0;
  await storage.setItem(
    SEEN_ANNOUNCEMENTS_KEY,
    JSON.stringify([...new Set([...(seen || []), ...ids])].slice(-200)),
  );
  return added;
}

// Terms & Privacy acceptance (backend /api/legal). Used by components/TermsGate.
export const legalAPI = {
  status: async () => {
    const r: any = await request('/legal/status');
    return r.data ?? r;
  },
  accept: async () => {
    const r: any = await request('/legal/accept', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return r.data ?? r;
  },
};
