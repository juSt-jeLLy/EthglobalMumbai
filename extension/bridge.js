// Runs in the page's main world, where the wallet injects window.ethereum.
// Executes EIP-1193 requests relayed from the ticker swap panel (x-ticker-swap.js).
(function () {
  let subscribed = false;
  let solanaSubscribed = false;

  function solanaProvider() {
    return (window.phantom && window.phantom.solana) || window.solana || null;
  }

  function bytesToBase58(bytes) {
    const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const digits = [0];
    for (const byte of bytes) {
      let carry = byte;
      for (let i = 0; i < digits.length; i++) {
        const value = digits[i] * 256 + carry;
        digits[i] = value % 58;
        carry = Math.floor(value / 58);
      }
      while (carry) { digits.push(carry % 58); carry = Math.floor(carry / 58); }
    }
    let result = "";
    for (const byte of bytes) { if (byte === 0) result += alphabet[0]; else break; }
    for (let i = digits.length - 1; i >= 0; i--) result += alphabet[digits[i]];
    return result;
  }

  function base64ToBytes(value) {
    const binary = atob(value);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }

  function bytesToBase64(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  }

  function subscribeToWalletEvents() {
    if (subscribed || !window.ethereum || typeof window.ethereum.on !== "function") return;
    subscribed = true;
    ["accountsChanged", "chainChanged", "connect", "disconnect"].forEach((event) => {
      window.ethereum.on(event, (payload) => {
        window.postMessage({ type: "plan-b:bridge-event", event, payload: JSON.parse(JSON.stringify(payload ?? null)) }, window.location.origin);
      });
    });
  }

  function subscribeToSolanaEvents() {
    const provider = solanaProvider();
    if (solanaSubscribed || !provider || typeof provider.on !== "function") return;
    solanaSubscribed = true;
    provider.on("accountChanged", (key) => window.postMessage({ type: "plan-b:bridge-event", event: "solanaAccountChanged", payload: key ? key.toString() : null }, window.location.origin));
    provider.on("disconnect", () => window.postMessage({ type: "plan-b:bridge-event", event: "solanaDisconnect", payload: null }, window.location.origin));
  }

  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.type !== "plan-b:bridge-request") return;

    const respond = (result, error) =>
      window.postMessage({ type: "plan-b:bridge-response", sourceId: data.sourceId, rpcId: data.rpcId, result, error }, window.location.origin);

    try {
      if (data.method.startsWith("solana_")) {
        const provider = solanaProvider();
        if (!provider) return respond(undefined, { code: 4900, message: "No Solana wallet found. Install Phantom or another compatible wallet." });
        subscribeToSolanaEvents();
        if (data.method === "solana_connect") {
          const connected = await provider.connect();
          return respond(connected.publicKey.toString());
        }
        if (data.method === "solana_account") return respond(provider.publicKey ? provider.publicKey.toString() : null);
        if (data.method === "solana_sign_message") {
          const signed = await provider.signMessage(new TextEncoder().encode(data.params[0]), "utf8");
          return respond(bytesToBase58(signed.signature));
        }
        if (data.method === "solana_sign_transaction") {
          if (!window.PlanBSolanaWeb3) throw new Error("Solana transaction support did not load");
          const tx = window.PlanBSolanaWeb3.VersionedTransaction.deserialize(base64ToBytes(data.params[0]));
          const signed = await provider.signTransaction(tx);
          return respond(bytesToBase64(signed.serialize()));
        }
        throw new Error(`Unsupported Solana wallet method: ${data.method}`);
      }
      if (typeof window.ethereum === "undefined") return respond(undefined, { code: 4900, message: "No EVM wallet found. Install MetaMask or another browser wallet." });
      subscribeToWalletEvents();
      const result = await window.ethereum.request({ method: data.method, params: data.params });
      respond(JSON.parse(JSON.stringify(result ?? null)));
    } catch (error) {
      respond(undefined, { code: error.code, message: error.message, data: error.data });
    }
  });
})();
