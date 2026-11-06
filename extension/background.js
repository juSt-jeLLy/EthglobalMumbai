// Plan B backend (backend/). Proxies Definitive Flash so the API key stays server-side.
const BACKEND_URL = "http://localhost:8000";

// Fetches run here (with host_permissions) to avoid the host page's CORS and CSP restrictions.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "parsePlan") {
    fetch(`${BACKEND_URL}/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: String(message.text || "").slice(0, 4000) }),
    })
      .then(async (response) => {
        const text = await response.text();
        let body;
        try { body = JSON.parse(text); } catch { body = { message: text }; }
        sendResponse({ ok: response.ok, status: response.status, body });
      })
      .catch((error) => sendResponse({ ok: false, status: 0, body: { message: `Plan B backend not reachable at ${BACKEND_URL} (${error.message})` } }));
    return true;
  }

  if (message.action === "plans") {
    const op = message.op || "list";
    let url = `${BACKEND_URL}/plans`;
    let method = "GET";
    let body;
    if (op === "create") { method = "POST"; body = message.body || {}; }
    else if (op === "social") url = `${BACKEND_URL}/social?${new URLSearchParams(message.body || {})}`;
    else url = `${BACKEND_URL}/plans?${new URLSearchParams(message.body || {})}`;
    fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body && { body: JSON.stringify(body) }),
    })
      .then(async (response) => {
        const text = await response.text();
        let parsed;
        try { parsed = JSON.parse(text); } catch { parsed = { message: text }; }
        sendResponse({ ok: response.ok, status: response.status, body: parsed });
      })
      .catch((error) => sendResponse({ ok: false, status: 0, body: { message: `Plan B backend not reachable at ${BACKEND_URL} (${error.message})` } }));
    return true;
  }

  if (message.action === "flash") {
    const method = message.method || "POST";
    const query = method === "GET" ? `?${new URLSearchParams(message.body || {})}` : "";
    fetch(`${BACKEND_URL}/flash/${message.endpoint}${query}`, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(method !== "GET" && { body: JSON.stringify(message.body || {}) }),
    })
      .then(async (response) => {
        const text = await response.text();
        let body;
        try { body = JSON.parse(text); } catch { body = { message: text }; }
        sendResponse({ ok: response.ok, status: response.status, body });
      })
      .catch((error) => sendResponse({ ok: false, status: 0, body: { message: `Plan B backend not reachable at ${BACKEND_URL} (${error.message})` } }));
    return true;
  }

  // Intercepta security checks. token: GET /intercepta/token/:chainId/:address, transaction: POST /intercepta/transaction/:chainId
  if (message.action === "intercepta") {
    const request = message.check === "token"
      ? fetch(`${BACKEND_URL}/intercepta/token/${Number(message.chainId)}/${encodeURIComponent(message.address)}`)
      : fetch(`${BACKEND_URL}/intercepta/transaction/${Number(message.chainId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(message.body),
        });
    request
      .then(async (response) => {
        const text = await response.text();
        let body;
        try { body = JSON.parse(text); } catch { body = { message: text }; }
        sendResponse({ ok: response.ok, status: response.status, body });
      })
      .catch((error) => sendResponse({ ok: false, status: 0, body: { message: `Plan B backend not reachable at ${BACKEND_URL} (${error.message})` } }));
    return true;
  }

});
