const TOKEN_KEY = 'auth_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(err.error || err.message || res.statusText), {
      status: res.status,
      data: err,
    });
  }

  // 204 No Content or empty body
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

function makeEntityClient(basePath) {
  return {
    list: () => apiFetch(basePath),
    get: (id) => apiFetch(`${basePath}/${id}`),
    create: (data) => apiFetch(basePath, { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => apiFetch(`${basePath}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => apiFetch(`${basePath}/${id}`, { method: 'DELETE' }),
    filter: (params) => apiFetch(`${basePath}?${new URLSearchParams(params)}`),
  };
}

export const bragiQTC = {
  auth: {
    login: async (email, password) => {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
      return data;
    },
    me: () => apiFetch('/api/auth/me'),
    logout: () => {
      localStorage.removeItem(TOKEN_KEY);
    },
    redirectToLogin: () => {
      window.location.href = '/login';
    },
  },

  entities: {
    User:                       makeEntityClient('/api/users'),
    Team:                       makeEntityClient('/api/teams'),
    TeamMember:                 makeEntityClient('/api/team-members'),
    WorkArea:                   makeEntityClient('/api/work-areas'),
    WorkAreaType:               makeEntityClient('/api/work-area-types'),
    Sprint:                     makeEntityClient('/api/sprints'),
    Allocation:                 makeEntityClient('/api/allocations'),
    QuarterlyAllocation:        makeEntityClient('/api/quarterly-allocations'),
    QuarterlyWorkAreaSelection: makeEntityClient('/api/quarterly-work-area-selections'),
    QuarterlyPlanHistory:       makeEntityClient('/api/quarterly-plan-history'),
    JiraSyncHistory:            makeEntityClient('/api/jira-sync-history'),
  },

  functions: {
    invoke: (name, payload) =>
      apiFetch(`/api/functions/${name}`, { method: 'POST', body: JSON.stringify(payload) }),
  },
};
