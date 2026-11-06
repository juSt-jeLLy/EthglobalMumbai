// Plan B backend (backend/). Proxies Definitive Flash so the API key stays server-side.
const BACKEND_URL = "http://localhost:8000";

const RADAR_ALARM = "plan-b-radar";
chrome.alarms.create(RADAR_ALARM, { periodInMinutes: 1 });

async function pollRadar() {
  const { radarWallet, radarSeen = [] } = await chrome.storage.local.get(["radarWallet", "radarSeen"]);
  if (!radarWallet) return;
  try {
    const response = await fetch(`${BACKEND_URL}/radar?${new URLSearchParams({ funderAddress: radarWallet })}`);
    if (!response.ok) return;
    const payload = await response.json();
    const seen = new Set(radarSeen);
    const fresh = (payload.signals || []).filter((signal) => !seen.has(signal.id));
    for (const signal of fresh.slice(0, 3)) {
      const decay = signal.decay && signal.decay.label ? ` · ${signal.decay.label}` : "";
      chrome.notifications.create(`signal:${signal.id}`, {
        type: "basic",
        iconUrl: "images/icon128.png",
        title: `New ${signal.asset.symbol} strategy`,
        message: `${signal.strategy && signal.strategy.summary || "Verified Plan B strategy"}${decay}`,
      });
      seen.add(signal.id);
    }
    for (const swarm of (payload.swarms || []).slice(0, 2)) {
      const key = `swarm:${swarm.id}:${new Date().toISOString().slice(0, 13)}`;
      if (seen.has(key)) continue;
      chrome.notifications.create(key, { type: "basic", iconUrl: "images/icon128.png", title: "Plan B Signal Swarm", message: swarm.headline });
      seen.add(key);
    }
    await chrome.storage.local.set({ radarSeen: [...seen].slice(-200) });
  } catch { /* Alerts retry on the next interval; trading does not depend on them. */ }
}

chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === RADAR_ALARM) pollRadar(); });

// Fetches run here (with host_permissions) to avoid the host page's CORS and CSP restrictions.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "parsePlan") {
    fetch(`${BACKEND_URL}/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: String(message.text || "").slice(0, 4000), ...(message.mode === "voice" && { mode: "voice" }) }),
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

  if (message.action === "radar") {
    const method = message.method || "GET";
    const path = String(message.path || "/radar");
    const query = method === "GET" && message.body ? `?${new URLSearchParams(message.body)}` : "";
    fetch(`${BACKEND_URL}${path}${query}`, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(method !== "GET" && { body: JSON.stringify(message.body || {}) }),
    })
      .then(async (response) => {
        const text = await response.text();
        let body;
        try { body = JSON.parse(text); } catch { body = { message: text }; }
        if (response.ok && method === "POST" && path === "/subscriptions" && message.body && message.body.funderAddress) {
          await chrome.storage.local.set({ radarWallet: message.body.funderAddress });
          pollRadar();
        }
        sendResponse({ ok: response.ok, status: response.status, body });
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

  // Plan B token-security gate. The backend combines Flash, GoPlus and
  // Honeypot simulation where the selected network is supported.
  if (message.action === "security") {
    const chain = message.chainId === "solana" ? "solana" : Number(message.chainId);
    fetch(`${BACKEND_URL}/security/token/${chain}/${encodeURIComponent(message.address)}`)
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
