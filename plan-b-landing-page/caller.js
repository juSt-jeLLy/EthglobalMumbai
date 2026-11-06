(() => {
  const API_URL = window.PLAN_B_API_URL || "http://localhost:8000";
  const form = document.querySelector("#caller-form");
  const status = document.querySelector("#caller-status");
  const result = document.querySelector("#caller-result");
  const tweet = document.querySelector("#caller-tweet");
  const submit = form.querySelector("button[type=submit]");
  const entrySelect = form.querySelector("#caller-entry");
  const humanTitle = document.querySelector("#human-title");
  const humanCopy = document.querySelector("#human-copy");
  const primaryAction = document.querySelector("#primary-action");
  const worldConnector = document.querySelector("#world-connector");
  const worldQr = document.querySelector("#world-qr");
  const worldOpen = document.querySelector("#world-open");
  const worldSimulator = document.querySelector("#world-simulator");
  const worldCopy = document.querySelector("#world-copy");
  const worldConnectorTitle = document.querySelector("#world-connector-title");
  const worldConnectorCopy = document.querySelector("#world-connector-copy");
  let currentSignal = null;
  let worldState = { configured: false, required: false, humanVerification: null, signer: null };
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
  const request = async (path, body, method = "POST") => {
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
    return data;
  };

  const connectedSigner = async () => {
    if (!window.ethereum) throw new Error("Install an EVM wallet such as MetaMask to create a caller card.");
    const [signer] = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (!signer) throw new Error("Connect a wallet to continue.");
    return signer.toLowerCase();
  };

  function renderWorldState() {
    const verified = worldState.humanVerification;
    worldConnector.hidden = true;
    if (verified) {
      const production = verified.environment === "production";
      humanTitle.textContent = production ? "Verified Human Caller" : "Simulator-verified caller";
      humanCopy.textContent = production
        ? `World Proof of Human verified ${new Date(verified.verifiedAt).toLocaleDateString()}. Your wallet still signs every strategy.`
        : `World staging proof verified ${new Date(verified.verifiedAt).toLocaleDateString()}. This confirms the integration flow, not a production human credential.`;
      primaryAction.textContent = "Validate and sign strategy";
      primaryAction.type = "submit";
      primaryAction.disabled = false;
      return;
    }
    if (worldState.required && !worldState.configured) {
      humanTitle.textContent = "World verification is required";
      humanCopy.textContent = "The server is missing its World Developer Portal configuration. Publishing is safely blocked until it is configured.";
      primaryAction.textContent = "World verification unavailable";
      primaryAction.type = "button";
      primaryAction.disabled = true;
      return;
    }
    if (worldState.configured) {
      humanTitle.textContent = worldState.required ? "Proof of Human required" : "Add a Verified Human badge";
      humanCopy.textContent = worldState.required
        ? "Verify once with World ID before publishing. It proves uniqueness, not your identity or X-handle ownership."
        : "Optionally verify with World ID to add unique-human authenticity to your Caller Cards.";
      primaryAction.textContent = worldState.required ? "Verify humanity to continue" : "Validate and sign strategy";
      primaryAction.type = worldState.required ? "button" : "submit";
      primaryAction.disabled = false;
      return;
    }
    humanTitle.textContent = "Wallet-signed caller";
    humanCopy.textContent = "World Proof of Human is not configured for this local demo. A wallet signature still binds every strategy to its creator.";
    primaryAction.textContent = "Validate and sign strategy";
    primaryAction.type = "submit";
    primaryAction.disabled = false;
  }

  async function refreshWorldState(signer = null) {
    const query = signer ? `?signer=${encodeURIComponent(signer)}` : "";
    worldState = { ...worldState, ...(await request(`/world/status${query}`, undefined, "GET")), signer };
    renderWorldState();
    return worldState;
  }

  function showWorldQr(uri, environment) {
    if (typeof window.qrcode !== "function") throw new Error("The World ID QR helper did not load.");
    const code = window.qrcode(0, "M");
    code.addData(uri);
    code.make();
    worldQr.innerHTML = code.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    worldOpen.href = uri;
    const staging = environment === "staging";
    worldConnectorTitle.textContent = staging ? "Use the World staging simulator" : "Scan with World App";
    worldConnectorCopy.textContent = staging
      ? "This is a test-only proof. Open the simulator on this computer; no phone or real World ID is needed."
      : "Approve the Proof of Human request for this connected wallet.";
    worldSimulator.href = `https://simulator.worldcoin.org/?connect_url=${encodeURIComponent(uri)}`;
    worldSimulator.hidden = !staging;
    worldCopy.hidden = !staging;
    worldConnector.hidden = false;
  }

  worldCopy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(worldSimulator.href);
      worldCopy.textContent = "Simulator link copied";
    } catch { worldCopy.textContent = "Copy unavailable — use Open staging simulator"; }
  });

  async function beginHumanVerification() {
    try {
      const signer = await connectedSigner();
      const current = await refreshWorldState(signer);
      if (current.humanVerification) return;
      if (!current.configured) throw new Error("World ID is not configured on this backend.");
      if (!window.IDKit) throw new Error("The World ID SDK did not load.");
      primaryAction.disabled = true;
      humanCopy.textContent = "Preparing your privacy-preserving Proof of Human request…";
      const config = await request("/world/rp-context", { signer });
      const proofRequest = await window.IDKit.request({
        app_id: config.app_id,
        action: config.action,
        rp_context: config.rp_context,
        allow_legacy_proofs: false,
        environment: config.environment,
      }).preset(window.IDKit.proofOfHuman({ signal: config.signal }));
      showWorldQr(proofRequest.connectorURI, config.environment);
      humanCopy.textContent = config.environment === "staging"
        ? "Open the staging simulator below and approve the test proof."
        : "Scan the QR code in World App, then approve the Proof of Human request.";
      const completion = await proofRequest.pollUntilCompletion({ pollInterval: 1800, timeout: 300000 });
      if (!completion.success) throw new Error(completion.error === "user_rejected" ? "World verification was declined." : `World verification did not complete: ${completion.error || "unknown error"}`);
      humanCopy.textContent = "Sign once to bind this World proof to your caller wallet…";
      const enrollmentMessage = ["Plan B — World ID Caller Enrollment", `Wallet: ${signer}`, `Action: ${config.action}`, `World nonce: ${completion.result.nonce || ""}`].join("\n");
      const walletSignature = await window.ethereum.request({ method: "personal_sign", params: [toHex(enrollmentMessage), signer] });
      humanCopy.textContent = "Verifying your proof with World…";
      const verified = await request("/world/verify", { signer, result: completion.result, walletSignature });
      worldState = { ...worldState, signer, humanVerification: verified.humanVerification };
      renderWorldState();
    } catch (error) {
      worldConnector.hidden = true;
      humanCopy.textContent = error.message;
    } finally {
      renderWorldState();
    }
  }

  // A verification CTA must not be a form submit button: browser constraint
  // validation would otherwise focus the empty Token field before World starts.
  primaryAction.addEventListener("click", async (event) => {
    if (primaryAction.type !== "button" || primaryAction.disabled) return;
    event.preventDefault();
    await beginHumanVerification();
  });

  refreshWorldState().catch(() => {
    humanTitle.textContent = "Caller authenticity unavailable";
    humanCopy.textContent = "The local backend is not running, so World verification status cannot be checked.";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    result.hidden = true;
    submit.disabled = true;
    status.textContent = "Validating with Flash…";
    try {
      const signer = await connectedSigner();
      const world = await refreshWorldState(signer);
      if (world.required && !world.humanVerification) {
        status.textContent = "";
        await beginHumanVerification();
        return;
      }
      const values = new FormData(form);
      const plan = () => ({
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
      });
      const prepared = await request("/signals/message", plan());
      status.textContent = "Check your wallet to sign the strategy…";
      const signature = await window.ethereum.request({ method: "personal_sign", params: [toHex(prepared.message), signer] });
      status.textContent = "Creating verified followable strategy…";
      const created = await request("/signals", { plan: prepared.draft, signer, signature });
      currentSignal = created.signal;
      tweet.value = created.tweetText;
      document.querySelector("#open-x").href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(created.tweetText)}`;
      result.hidden = false;
      const callerStatus = world.humanVerification
        ? world.humanVerification.environment === "production" ? "Verified Human Caller" : "Simulator-verified caller"
        : "Wallet-signed caller";
      status.textContent = `${callerStatus} strategy ready: ${prepared.strategy.summary}.`;
    } catch (error) {
      status.textContent = /reject|denied/i.test(error.message) ? "Signature cancelled in wallet." : error.message;
    } finally { submit.disabled = false; }
  });

  document.querySelector("#copy-tweet").addEventListener("click", async () => {
    await navigator.clipboard.writeText(tweet.value);
    document.querySelector("#copy-tweet").textContent = "Copied";
  });

  document.querySelector("#publish-revision").addEventListener("click", async () => {
    const status = document.querySelector("#revision-status");
    if (!currentSignal) return;
    try {
      const values = new FormData(form);
      const currentPlan = {
        token: String(values.get("token") || "").trim().replace(/^\$/, ""), chain: values.get("chain"), side: exitOrderTypes.has(String(values.get("entryType"))) ? "sell" : values.get("side"), entryType: values.get("entryType"),
        entryPrice: numberOrNull(String(values.get("entryPrice") || "")), triggerPrice: numberOrNull(String(values.get("triggerPrice") || "")), triggerDirection: values.get("triggerDirection"), stopLoss: numberOrNull(String(values.get("stopLoss") || "")), takeProfit: numberOrNull(String(values.get("takeProfit") || "")), durationHours: numberOrNull(String(values.get("durationHours") || "")), bucketCount: numberOrNull(String(values.get("bucketCount") || "")), expiryHours: numberOrNull(String(values.get("expiryHours") || "")), trailPercent: numberOrNull(String(values.get("trailPercent") || "")), activationPrice: numberOrNull(String(values.get("activationPrice") || "")),
      };
      const reason = document.querySelector("#revision-reason").value.trim();
      status.textContent = "Validating revision…";
      const prepared = await request(`/signals/${currentSignal.id}/revisions/message`, { plan: currentPlan, reason });
      const [signer] = await window.ethereum.request({ method: "eth_requestAccounts" });
      status.textContent = "Check your wallet to sign the revision…";
      const signature = await window.ethereum.request({ method: "personal_sign", params: [toHex(prepared.message), signer] });
      const created = await request(`/signals/${currentSignal.id}/revisions`, { plan: prepared.draft, reason, signature });
      status.textContent = `Revision ${created.revision.revision} recorded. Share a new post that references planb:${currentSignal.id}; followers will see the immutable revision history.`;
    } catch (error) { status.textContent = error.message; }
  });
})();
