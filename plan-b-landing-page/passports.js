(() => {
  const api = window.PLAN_B_API_URL || "http://localhost:8000";
  const safe = (value) => String(value ?? "—").replace(/[&<>'"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
  const money = (value) => Number.isFinite(Number(value)) ? `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 6 })}` : "—";
  const pct = (value) => Number.isFinite(Number(value)) ? `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(2)}%` : "Pending";
  const short = (value, count = 10) => value ? `${String(value).slice(0, count)}…${String(value).slice(-6)}` : "—";
  const load = async (scope) => { const response = await fetch(`${api}/terminal?scope=${scope}&sort=newest`); const body = await response.json(); if (!response.ok) throw new Error(body.message || "Could not load Signal Passports"); return (body.signals || []).map((signal) => ({ ...signal, passportScope: scope })); };
  Promise.all([load("verified"), load("observed")]).then(([verified, observed]) => {
    const rows = [...verified, ...observed].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    document.querySelector("#passport-list").innerHTML = rows.length ? rows.map((row) => {
      const p = row.passport || {}; const terms = p.terms || {}; const asset = p.asset || row.asset || {}; const settlement = p.settlement;
      const source = p.sourceUrl ? `<a href="${safe(p.sourceUrl)}" target="_blank" rel="noopener">Open source post ↗</a>` : "No public post linked";
      const creator = p.authorHandle || row.signer || "unknown";
      const observed = row.passportScope === "observed";
      return `<article class="passport-card"><header><div><span class="signal-state ${observed ? "expired" : ""}">${observed ? "Observed · not caller-signed" : "Signed Passport"}</span><h2>${safe(asset.symbol)} <small>· ${safe(asset.chain)}</small></h2><p>${safe(terms.side)} · ${safe(terms.entryType)} · captured ${new Date(p.capturedAt || row.createdAt).toLocaleString()}</p></div><strong class="passport-outcome">${settlement ? pct(settlement.returnPercent) : "Pending"}</strong></header><dl><div><dt>Exact contract</dt><dd title="${safe(asset.address)}">${safe(short(asset.address))}</dd></div><div><dt>Flash capture price</dt><dd>${money(p.entryPrice)}</dd></div><div><dt>Valid until</dt><dd>${terms.expiresAt ? safe(new Date(terms.expiresAt).toLocaleString()) : "—"}</dd></div><div><dt>Contract integrity</dt><dd>${safe(p.integrity && p.integrity.status)}</dd></div><div><dt>Source status</dt><dd>${safe(p.availability && p.availability.status)}</dd></div><div><dt>Source verification</dt><dd>${safe(p.sourceVerification && p.sourceVerification.status)}</dd></div><div><dt>Text evidence hash</dt><dd title="${safe(p.textHash)}">${safe(short(p.textHash))}</dd></div><div><dt>Follower outcomes</dt><dd>${Number(row.room && row.room.followers || 0)} following · ${Number(row.room && row.room.hitTarget || 0)} targets · ${Number(row.room && row.room.stoppedOut || 0)} stopped</dd></div></dl><footer><span>${settlement ? `${safe(settlement.outcome)} at ${money(settlement.markPrice)}` : "Outcome will settle after expiry"}</span>${source}${observed ? "" : `<a href="creator.html?creator=${encodeURIComponent(creator)}">Caller record →</a>`}</footer></article>`;
    }).join("") : '<div class="leaderboard-empty">No signed Signal Passports have been created yet.</div>';
  }).catch((error) => { document.querySelector("#passport-list").innerHTML = `<div class="leaderboard-empty">${safe(error.message)}</div>`; });
})();
