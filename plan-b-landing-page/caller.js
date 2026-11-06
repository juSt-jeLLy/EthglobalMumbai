(() => {
  const API_URL = window.PLAN_B_API_URL || "http://localhost:8000";
  const form = document.querySelector("#caller-form");
  const status = document.querySelector("#caller-status");
  const result = document.querySelector("#caller-result");
  const tweet = document.querySelector("#caller-tweet");
  const submit = form.querySelector("button[type=submit]");
  const entrySelect = form.querySelector("#caller-entry");
  const sideSelect = form.querySelector('[name="side"]');
  const exitOrderTypes = new Set(["stop-loss", "take-profit", "bracket", "trailing-stop", "trailing-stop-limit"]);

  entrySelect.addEventListener("change", () => {
    if (exitOrderTypes.has(entrySelect.value)) sideSelect.value = "sell";
  });

  const numberOrNull = (value) => {
    const number = Number(value);
    return value.trim() && Number.isFinite(number) && number > 0 ? number : null;
  };
  const toHex = (value) => "0x" + [...new TextEncoder().encode(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const request = async (path, body) => {
    const response = await fetch(`${API_URL}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
    return data;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    result.hidden = true;
    submit.disabled = true;
    status.textContent = "Validating with Flash…";
    try {
      if (!window.ethereum) throw new Error("Install an EVM wallet such as MetaMask to sign a caller card.");
      const values = new FormData(form);
      const plan = {
        token: String(values.get("token") || "").trim().replace(/^\$/, ""),
        chain: values.get("chain"), side: exitOrderTypes.has(String(values.get("entryType"))) ? "sell" : values.get("side"), entryType: values.get("entryType"),
        entryPrice: numberOrNull(String(values.get("entryPrice") || "")),
        triggerPrice: numberOrNull(String(values.get("triggerPrice") || "")),
        triggerDirection: values.get("triggerDirection"),
        stopLoss: numberOrNull(String(values.get("stopLoss") || "")),
        takeProfit: numberOrNull(String(values.get("takeProfit") || "")),
        durationHours: numberOrNull(String(values.get("durationHours") || "")),
        bucketCount: numberOrNull(String(values.get("bucketCount") || "")),
        expiryHours: numberOrNull(String(values.get("expiryHours") || "")),
        trailPercent: numberOrNull(String(values.get("trailPercent") || "")),
        activationPrice: numberOrNull(String(values.get("activationPrice") || "")),
      };
      const prepared = await request("/signals/message", plan);
      status.textContent = "Check your wallet to sign the strategy…";
      const [signer] = await window.ethereum.request({ method: "eth_requestAccounts" });
      const signature = await window.ethereum.request({ method: "personal_sign", params: [toHex(prepared.message), signer] });
      status.textContent = "Creating verified followable strategy…";
      const created = await request("/signals", { plan: prepared.draft, signer, signature });
      tweet.value = created.tweetText;
      document.querySelector("#open-x").href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(created.tweetText)}`;
      result.hidden = false;
      status.textContent = `Verified strategy ready: ${prepared.strategy.summary}.`;
    } catch (error) {
      status.textContent = /reject|denied/i.test(error.message) ? "Signature cancelled in wallet." : error.message;
    } finally { submit.disabled = false; }
  });

  document.querySelector("#copy-tweet").addEventListener("click", async () => {
    await navigator.clipboard.writeText(tweet.value);
    document.querySelector("#copy-tweet").textContent = "Copied";
  });
})();
