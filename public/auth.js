export async function login(username, password) {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || "Login failed");
  }

  localStorage.setItem("token", data.token);
  return data;
}

export async function getUser() {
  const token = localStorage.getItem("token");

  if (!token) return null;

  const res = await fetch("/api/me", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    localStorage.removeItem("token");
    return null;
  }

  return await res.json();
}

export function logout() {
  localStorage.removeItem("token");
}
