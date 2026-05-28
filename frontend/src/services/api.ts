const BASE_URL = import.meta.env.VITE_API_URL;

export const getToken = () => localStorage.getItem("hrms_token");
export const setToken = (t: string) => localStorage.setItem("hrms_token", t);
export const removeToken = () => localStorage.removeItem("hrms_token");

async function request(endpoint: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    const err: any = new Error(data.message || "Request failed");
    err.status = res.status;
    throw err;
  }
  return data;
}

export const authAPI = {
  login: (email: string, password: string) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (body: { name: string; email: string; password: string }) =>
    request("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  getMe: () => request("/auth/me"),
  updateProfile: (body: object) =>
    request("/auth/profile", { method: "PUT", body: JSON.stringify(body) }),
};

export const dashboardAPI = {
  getStats: () => request("/dashboard/stats"),
};

export const employeeAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/employees${q}`);
  },
  getOne: (id: string) => request(`/employees/${id}`),
  create: (body: object) =>
    request("/employees", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/employees/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) => request(`/employees/${id}`, { method: "DELETE" }),
};

export const attendanceAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/attendance${q}`);
  },
  mark: (body: object) =>
    request("/attendance", { method: "POST", body: JSON.stringify(body) }),
  bulkMark: (body: object) =>
    request("/attendance/bulk", { method: "POST", body: JSON.stringify(body) }),
  getSummary: (params: Record<string, string>) =>
    request(`/attendance/summary?${new URLSearchParams(params).toString()}`),
};

export const leaveAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/leaves${q}`);
  },
  create: (body: object) =>
    request("/leaves", { method: "POST", body: JSON.stringify(body) }),
  updateStatus: (id: string, body: object) =>
    request(`/leaves/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) => request(`/leaves/${id}`, { method: "DELETE" }),
};

export const payrollAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/payroll${q}`);
  },
  process: (body: object) =>
    request("/payroll/process", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/payroll/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  markPaid: (id: string) => request(`/payroll/${id}/paid`, { method: "PUT" }),
};

export const recruitmentAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/recruitment${q}`);
  },
  create: (body: object) =>
    request("/recruitment", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/recruitment/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  addCandidate: (id: string, body: object) =>
    request(`/recruitment/${id}/candidates`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateCandidateStage: (id: string, candidateId: string, body: object) =>
    request(`/recruitment/${id}/candidates/${candidateId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};

export const departmentAPI = {
  getAll: () => request("/departments"),
  create: (body: object) =>
    request("/departments", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/departments/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  delete: (id: string) => request(`/departments/${id}`, { method: "DELETE" }),
};

export const performanceAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/performance${q}`);
  },
  create: (body: object) =>
    request("/performance", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/performance/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};

export const settingsAPI = {
  get: () => request<{ success: boolean; data: any }>("/settings"),
  update: (settings: any) =>
    request<{ success: boolean; data: any }>("/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
};

export const billingAPI = {
  getPlans: () => request<{ success: boolean; data: any }>("/billing/plans"),
  getSubscription: () =>
    request<{ success: boolean; data: any }>("/billing/subscription"),
  getInvoices: () =>
    request<{ success: boolean; data: any }>("/billing/invoices"),
  createOrder: (plan: string, billingCycle: "monthly" | "yearly") =>
    request<{ success: boolean; data: any }>("/billing/create-order", {
      method: "POST",
      body: JSON.stringify({ plan, billingCycle }),
    }),
  verifyPayment: (payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    plan: string;
    billingCycle: string;
  }) =>
    request<{ success: boolean; message: string; data: any }>(
      "/billing/verify-payment",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),
  // Payment Methods
  getPaymentMethods: () =>
    request<{ success: boolean; data: any }>("/payment-methods"),
  addPaymentMethod: (body: object) =>
    request<{ success: boolean; data: any }>("/payment-methods", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updatePaymentMethod: (id: string, body: object) =>
    request<{ success: boolean; data: any }>(`/payment-methods/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deletePaymentMethod: (id: string) =>
    request<{ success: boolean; data: any }>(`/payment-methods/${id}`, {
      method: "DELETE",
    }),
  getDefaultPaymentMethod: () =>
    request<{ success: boolean; data: any }>("/payment-methods/default"),
};

export const holidayAPI = {
  getAll: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/holidays${q}`);
  },
  create: (body: object) =>
    request("/holidays", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: object) =>
    request(`/holidays/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  delete: (id: string) => request(`/holidays/${id}`, { method: "DELETE" }),
};

export const biometricAPI = {
  // Locations
  getLocations: () => request("/biometric/locations"),
  createLocation: (body: object) =>
    request("/biometric/locations", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateLocation: (id: string, body: object) =>
    request(`/biometric/locations/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteLocation: (id: string) =>
    request(`/biometric/locations/${id}`, { method: "DELETE" }),

  // Devices
  getDevices: () => request("/biometric/devices"),
  createDevice: (body: object) =>
    request("/biometric/devices", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateDevice: (id: string, body: object) =>
    request(`/biometric/devices/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteDevice: (id: string) =>
    request(`/biometric/devices/${id}`, { method: "DELETE" }),
  regenerateDeviceToken: (id: string) =>
    request(`/biometric/devices/${id}/regenerate-token`, { method: "POST" }),

  // NFC Cards
  assignNfcCard: (deviceId: string, body: object) =>
    request(`/biometric/devices/${deviceId}/nfc`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  removeNfcCard: (deviceId: string, uid: string) =>
    request(`/biometric/devices/${deviceId}/nfc/${uid}`, { method: "DELETE" }),

  // Device public endpoints (no auth token needed)
  getDeviceInfo: (token: string) =>
    fetch(`${BASE_URL}/biometric/device/${token}`).then(async (r) => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Device error");
      return d;
    }),
  recordBiometric: (body: object) =>
    fetch(`${BASE_URL}/biometric/record`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(async (r) => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Record failed");
      return d;
    }),

  // Logs
  getLogs: (params?: Record<string, string>) => {
    const q = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/biometric/logs${q}`);
  },
};

export const companyAPI = {
  create: (body: object) =>
    request<{ success: boolean; data: any }>("/company", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getMe: () => request<{ success: boolean; data: any }>("/company/me"),
  update: (body: object) =>
    request<{ success: boolean; data: any }>("/company", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};
