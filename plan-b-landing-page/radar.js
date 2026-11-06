(() => {
  const api = window.PLAN_B_API_URL || "http://localhost:8000";
  const $ = (selector) => document.querySelector(selector);
  const safe = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));
  const format = (value, digits = 2) => Number.isFinite(Number(value)) ? Number(value).toLocaleString(undefined, { maximumFractionDigits: digits }) : "—";
  const passportLine = (passport) => {
    if (!passport) return "Passport unavailable";
    const integrity = passport.integrity || {};
    const settlement = passport.settlement;
    const availability = passport.availability && passport.availability.status;
    return `${integrity.status === "verified_contract" ? "Contract verified" : integrity.status === "symbol_resolved" ? "Symbol resolved" : "Contract review"} · ${settlement ? `${settlement.outcome === "price_in_favor" ? "Price in favor" : "Price against"} ${settlement.returnPercent >= 0 ? "+" : ""}${format(settlement.returnPercent)}%` : "Outcome pending"}${availability === "removed" ? " · Post removed" : ""}`;
  };
  async function load() {
    const params = new URLSearchParams();
    if ($("#entry-filter").value) params.set("entryType", $("#entry-filter").value);
    if ($("#freshness-filter").value) params.set("freshness", $("#freshness-filter").value);
    params.set("sort", $("#sort-filter").value);
    try {
      const response = await fetch(`${api}/terminal?${params}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Could not load Radar");
      $("#swarms").innerHTML = (body.swarms || []).map((swarm) => `<article class="swarm-card"><b>${safe(swarm.headline)}</b><span>${safe(swarm.side)} · suggested ${safe(swarm.recommendedOrder)} structure</span></article>`).join("");
      const rows = body.signals || [];
      $("#radar-list").innerHTML = rows.length ? rows.map((row) => {
        const passport = row.passport || {};
        const creator = passport.authorHandle || row.signer || "verified caller";
        const profile = `creator.html?creator=${encodeURIComponent(creator)}`;
        const source = passport.sourceUrl ? `<a href="${safe(passport.sourceUrl)}" target="_blank" rel="noopener">View post ↗</a>` : "";
        const recommendation = row.recommendation || {};
        return `<article class="radar-card"><div class="radar-card-head"><div><span class="signal-state ${safe(row.decay && row.decay.state)}">${safe(row.decay && row.decay.label || "Unknown")}</span><h2>${safe(row.asset.symbol)} <small>· ${safe(row.asset.chain)}</small></h2></div><span class="radar-price">$${format(row.asset.price, 6)}</span></div><p class="radar-strategy">${safe(row.strategy && row.strategy.summary || `${row.draft.side} ${row.draft.entryType}`)}</p><div class="radar-metrics"><span>${safe(row.draft.side)} · ${safe(row.draft.entryType)}</span><span>${Number(row.room && row.room.followers || 0)} following</span><span>${safe(passportLine(passport))}</span></div><div class="radar-recommendation"><b>${safe(recommendation.title || "Review strategy")}</b><span>${safe(recommendation.rationale || row.decay && row.decay.reason || "Review price and protection before signing.")}</span></div><footer><a href="${profile}">Caller record →</a>${source}</footer></article>`;
      }).join("") : '<div class="leaderboard-empty">No signed Caller Cards match those filters yet.</div>';
    } catch (error) { $("#radar-list").innerHTML = `<div class="leaderboard-empty">${safe(error.message)}</div>`; }
  }
  ["#entry-filter", "#freshness-filter", "#sort-filter"].forEach((selector) => $(selector).addEventListener("change", load));
  load();
})();
