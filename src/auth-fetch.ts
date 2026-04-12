import { saveCredentials, type StoredCredentials } from "./credentials.js";

export async function fetchWithSession(
  url: string,
  init: RequestInit,
  cred: StoredCredentials,
): Promise<{ response: Response; credentials: StoredCredentials }> {
  let c = cred;
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${c.accessToken}`);
  let res = await fetch(url, { ...init, headers });

  if (res.status === 401 && c.refreshToken) {
    const r = await fetch(`${c.baseUrl}/api/cli/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: c.refreshToken }),
    });
    if (r.ok) {
      const t = (await r.json()) as { access_token?: string; refresh_token?: string };
      if (t.access_token && t.refresh_token) {
        c = {
          ...c,
          accessToken: t.access_token,
          refreshToken: t.refresh_token,
        };
        await saveCredentials(c);
        const h2 = new Headers(init.headers);
        h2.set("authorization", `Bearer ${c.accessToken}`);
        res = await fetch(url, { ...init, headers: h2 });
      }
    }
  }

  return { response: res, credentials: c };
}
