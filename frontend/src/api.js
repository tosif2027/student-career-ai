export const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

export const getToken = () => sessionStorage.getItem("accessToken") || "";

export const clearAuth = () => {
  sessionStorage.removeItem("accessToken");
  sessionStorage.removeItem("student");
  sessionStorage.removeItem("userRole");
};

export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers,
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (response.status === 401) {
    clearAuth();
    window.dispatchEvent(new Event("auth-expired"));
  }

  if (!response.ok) {
    const error = new Error(data.message || "Request failed.");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  if (data && typeof data === "object") {
    Object.defineProperty(data, "ok", { value: true, enumerable: false });
    Object.defineProperty(data, "statusCode", { value: response.status, enumerable: false });
    Object.defineProperty(data, "json", { value: async () => data, enumerable: false });
  }

  return data;
}
