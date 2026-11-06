// Definitive Flash advanced-order panel for X ticker cards.
// X renders a ticker card (icon, name, price, change, sparkline) for cashtags like $ETH.
// This script adds a "Buy" button inside supported cards. Pressing it expands a swap panel,
// styled as part of the card, that quotes and submits market, limit, trigger, TWAP,
// bracket and trailing orders through Flash (proxied by the backend).
(() => {
  const SOURCE_ID = "x-ticker-swap";
  const HOST_ATTR = "data-plan-b-ticker-swap";

  // ---------------------------------------------------------------------------
  // Flash's officially supported networks. Tokens are discovered from /search at
  // runtime so the extension follows Flash's live catalog rather than a stale list.
  // ---------------------------------------------------------------------------
  const CHAINS = {
    8453: { name: "Base", flash: "base", hex: "0x2105", icon: "base", explorer: "https://basescan.org", explorerName: "BaseScan", rpc: "https://mainnet.base.org", native: ["Ether", "ETH"], gasReserveWei: 200000000000000n },
    1: { name: "Ethereum", flash: "ethereum", hex: "0x1", icon: "ethereum", explorer: "https://etherscan.io", explorerName: "Etherscan", rpc: "https://ethereum-rpc.publicnode.com", native: ["Ether", "ETH"], gasReserveWei: 3000000000000000n },
    42161: { name: "Arbitrum", flash: "arbitrum", hex: "0xa4b1", icon: "arbitrum", explorer: "https://arbiscan.io", explorerName: "Arbiscan", rpc: "https://arb1.arbitrum.io/rpc", native: ["Ether", "ETH"], gasReserveWei: 200000000000000n },
    10: { name: "Optimism", flash: "optimism", hex: "0xa", icon: "optimism", explorer: "https://optimistic.etherscan.io", explorerName: "Etherscan", rpc: "https://mainnet.optimism.io", native: ["Ether", "ETH"], gasReserveWei: 200000000000000n },
    43114: { name: "Avalanche", flash: "avalanche", hex: "0xa86a", rpc: "https://api.avax.network/ext/bc/C/rpc", native: ["Avalanche", "AVAX"], explorer: "https://snowtrace.io", explorerName: "Snowtrace", gasReserveWei: 10000000000000000n },
    56: { name: "BNB Chain", flash: "bsc", hex: "0x38", rpc: "https://bsc-dataseed.bnbchain.org", native: ["BNB", "BNB"], explorer: "https://bscscan.com", explorerName: "BscScan", gasReserveWei: 1000000000000000n },
    999: { name: "HyperEVM", flash: "hyperevm", hex: "0x3e7", rpc: "https://rpc.hyperliquid.xyz/evm", native: ["HYPE", "HYPE"], gasReserveWei: 1000000000000000n },
    57073: { name: "Ink", flash: "ink", hex: "0xdef1", rpc: "https://rpc-gel.inkonchain.com", native: ["Ether", "ETH"], explorer: "https://explorer.inkonchain.com", explorerName: "Ink Explorer", gasReserveWei: 200000000000000n },
    143: { name: "Monad", flash: "monad", hex: "0x8f", rpc: "https://rpc.monad.xyz", native: ["Monad", "MON"], gasReserveWei: 1000000000000000n },
    9745: { name: "Plasma", flash: "plasma", hex: "0x2611", rpc: "https://rpc.plasma.to", native: ["XPL", "XPL"], gasReserveWei: 1000000000000000n },
    137: { name: "Polygon", flash: "polygon", hex: "0x89", rpc: "https://polygon-bor-rpc.publicnode.com", native: ["POL", "POL"], explorer: "https://polygonscan.com", explorerName: "PolygonScan", gasReserveWei: 10000000000000000n },
    4663: { name: "Robinhood Chain", flash: "robinhood", hex: "0x1237", rpc: "https://rpc.mainnet.chain.robinhood.com", native: ["Ether", "ETH"], explorer: "https://robinhoodchain.blockscout.com", explorerName: "Blockscout", gasReserveWei: 1000000000000000n },
    5042: { name: "Arc", flash: "arc", hex: "0x13b2", rpc: "https://rpc.drpc.mainnet.arc.io", native: ["USDC", "USDC"], gasReserveWei: 1000000000000000n },
    solana: { name: "Solana", flash: "solana", native: ["Solana", "SOL"], explorer: "https://solscan.io", explorerName: "Solscan" },
  };
  const CHAIN_ORDER = [8453, 1, 42161, 10, 43114, 56, 137, 999, 57073, 143, 9745, 4663, 5042, "solana"];
  const DEFAULT_CHAIN = 8453;
  // Definitive Flash's canonical reference for an EVM chain's native gas asset.
  const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

  const TOKEN_INFO = {
    ETH: { name: "Ether", color: "#627EEA" },
    WETH: { name: "Wrapped Ether", color: "#627EEA" },
    USDC: { name: "USD Coin", color: "#2775CA", stable: true },
    USDT: { name: "Tether", color: "#26A17B", stable: true },
    DAI: { name: "Dai", color: "#F5AC37", stable: true },
    WBTC: { name: "Wrapped BTC", color: "#F7931A" },
    cbBTC: { name: "Coinbase Wrapped BTC", color: "#F7931A" },
    UNI: { name: "Uniswap", color: "#FF007A" },
    LINK: { name: "Chainlink", color: "#2A5ADA" },
    AAVE: { name: "Aave", color: "#B6509E" },
    wstETH: { name: "Wrapped stETH", color: "#00A3FF" },
    cbETH: { name: "Coinbase Wrapped ETH", color: "#0052FF" },
    MORPHO: { name: "Morpho", color: "#2470FF" },
    DEGEN: { name: "Degen", color: "#A36EFD" },
    BRETT: { name: "Brett", color: "#01A7F6" },
    AERO: { name: "Aerodrome", color: "#0433FF" },
    VIRTUAL: { name: "Virtuals Protocol", color: "#34D3D3" },
    TOSHI: { name: "Toshi", color: "#1E6FFF" },
    ZORA: { name: "Zora", color: "#000000" },
    PEPE: { name: "Pepe", color: "#3D8130" },
    SHIB: { name: "Shiba Inu", color: "#E42D04" },
    LDO: { name: "Lido DAO", color: "#F69988" },
    ENS: { name: "ENS", color: "#5298FF" },
    ONDO: { name: "Ondo", color: "#0F1F3D" },
    ARB: { name: "Arbitrum", color: "#28A0F0" },
    OP: { name: "Optimism", color: "#FF0420" },
    PENDLE: { name: "Pendle", color: "#1BE3C2" },
    GMX: { name: "GMX", color: "#2D42FC" },
    VELO: { name: "Velodrome", color: "#FF1100" },
  };

  // [address, decimals] per network
  const TOKEN_ADDRESSES = {
    8453: {
      ETH: [NATIVE, 18],
      WETH: ["0x4200000000000000000000000000000000000006", 18],
      USDC: ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", 6],
      USDT: ["0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", 6],
      DAI: ["0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", 18],
      cbBTC: ["0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", 8],
      UNI: ["0xc3De830EA07524a0761646a6a4e4be0e114a3C83", 18],
      LINK: ["0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196", 18],
      AAVE: ["0x63706e401c06ac8513145b7687A14804d17f814b", 18],
      DEGEN: ["0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed", 18],
      BRETT: ["0x532f27101965dd16442E59d40670FaF5eBB142E4", 18],
      AERO: ["0x940181a94A35A4569E4529A3CDfB74e38FD98631", 18],
      VIRTUAL: ["0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b", 18],
      TOSHI: ["0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4", 18],
      ZORA: ["0x1111111111166b7FE7bd91427724B487980aFc69", 18],
      wstETH: ["0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452", 18],
      cbETH: ["0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", 18],
      MORPHO: ["0xBAa5CC21fd487B8Fcc2F632f3F4E8D37262a0842", 18],
    },
    1: {
      ETH: [NATIVE, 18],
      WETH: ["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 18],
      USDC: ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", 6],
      USDT: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", 6],
      DAI: ["0x6B175474E89094C44Da98b954EedeAC495271d0F", 18],
      WBTC: ["0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", 8],
      cbBTC: ["0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", 8],
      UNI: ["0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", 18],
      LINK: ["0x514910771AF9Ca656af840dff83E8264EcF986CA", 18],
      AAVE: ["0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", 18],
      wstETH: ["0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0", 18],
      cbETH: ["0xBe9895146f7AF43049ca1c1AE358B0541Ea49704", 18],
      MORPHO: ["0x58D97B57BB95320F9a05dC918Aef65434969c2B2", 18],
      PEPE: ["0x6982508145454Ce325dDbE47a25d4ec3d2311933", 18],
      SHIB: ["0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE", 18],
      LDO: ["0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32", 18],
      ENS: ["0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72", 18],
      ONDO: ["0xfAbA6f8e4a5E8Ab82F62fe7C39859FA577269BE3", 18],
      ARB: ["0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1", 18],
    },
    42161: {
      ETH: [NATIVE, 18],
      WETH: ["0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", 18],
      USDC: ["0xaf88d065e77c8cC2239327C5EDb3A432268e5831", 6],
      USDT: ["0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", 6],
      DAI: ["0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", 18],
      WBTC: ["0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", 8],
      UNI: ["0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0", 18],
      LINK: ["0xf97f4df75117a78c1A5a0DBb814Af92458539FB4", 18],
      AAVE: ["0xba5DdD1f9d7F570dc94a51479a000E3BCE967196", 18],
      ARB: ["0x912CE59144191C1204E64559FE8253a0e49E6548", 18],
      PENDLE: ["0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8", 18],
      GMX: ["0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a", 18],
      wstETH: ["0x5979D7b546E38E414F7E9822514be443A4800529", 18],
    },
    10: {
      ETH: [NATIVE, 18],
      WETH: ["0x4200000000000000000000000000000000000006", 18],
      USDC: ["0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", 6],
      USDT: ["0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", 6],
      DAI: ["0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", 18],
      WBTC: ["0x68f180fcCe6836688e9084f035309E29Bf0A2095", 8],
      OP: ["0x4200000000000000000000000000000000000042", 18],
      LINK: ["0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6", 18],
      UNI: ["0x6fd9d7AD17242c41f7131d257212c54A0e816691", 18],
      AAVE: ["0x76FB31fb4af56892A25e32cFC43De717950c9278", 18],
      wstETH: ["0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb", 18],
      VELO: ["0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db", 18],
    },
    130: {
      ETH: [NATIVE, 18],
      WETH: ["0x4200000000000000000000000000000000000006", 18],
      USDC: ["0x078D782b760474a361dDA0AF3839290b0EF57AD6", 6],
      DAI: ["0x20CAb320A855b39F724131C69424240519573f81", 18],
      WBTC: ["0x927B51f251480a681271180DA4de28D44EC4AfB8", 8],
      UNI: ["0x8f187aA05619a017077f5308904739877ce9eA21", 18],
      wstETH: ["0xc02fE7317D4eb8753a02c35fe019786854A92001", 18],
    },
  };

  // X cashtag -> token symbols to use, in order of preference (e.g. $BTC is cbBTC on Base, WBTC elsewhere)
  const TICKER_TO_TOKENS = {
    ETH: ["ETH"], WETH: ["WETH"], BTC: ["cbBTC", "WBTC"], WBTC: ["WBTC"], CBBTC: ["cbBTC"],
    USDC: ["USDC"], USDT: ["USDT"], DAI: ["DAI"], UNI: ["UNI"], LINK: ["LINK"], AAVE: ["AAVE"],
    WSTETH: ["wstETH"], CBETH: ["cbETH"], MORPHO: ["MORPHO"], DEGEN: ["DEGEN"], BRETT: ["BRETT"],
    AERO: ["AERO"], VIRTUAL: ["VIRTUAL"], TOSHI: ["TOSHI"], ZORA: ["ZORA"], PEPE: ["PEPE"], SHIB: ["SHIB"],
    LDO: ["LDO"], ENS: ["ENS"], ONDO: ["ONDO"], ARB: ["ARB"], OP: ["OP"], PENDLE: ["PENDLE"], GMX: ["GMX"], VELO: ["VELO"],
  };
  const QUOTE_TOKENS = ["USDC", "USDT", "ETH", "SOL", "BNB", "AVAX", "POL", "HYPE", "MON", "XPL"];
  function isNativeAddress(address) { return address === NATIVE || /^0x[eE]{40}$/.test(address || ""); }
  function tokenOn(chainId, symbol) {
    const entry = TOKEN_ADDRESSES[chainId] && TOKEN_ADDRESSES[chainId][symbol];
    return entry ? { address: entry[0], decimals: entry[1], ...(entry[2] || {}) } : null;
  }
  function tokenForTicker(ticker, chainId) {
    return (TICKER_TO_TOKENS[ticker] || []).find((symbol) => tokenOn(chainId, symbol)) || null;
  }
  function chainsForTicker(ticker) {
    return CHAIN_ORDER.filter((chainId) => {
      const token = tokenForTicker(ticker, chainId);
      return token && QUOTE_TOKENS.some((quote) => quote !== token && tokenOn(chainId, quote));
    });
  }

  const FLASH_TO_CHAIN = Object.fromEntries(CHAIN_ORDER.map((id) => [CHAINS[id].flash, id]));
  const assetSearches = new Map();
  function registerFlashAsset(asset) {
    const chainId = FLASH_TO_CHAIN[asset.chain];
    if (chainId === undefined || !asset.symbol || !asset.address) return;
    const symbol = asset.symbol;
    TOKEN_ADDRESSES[chainId] ||= {};
    const previous = TOKEN_ADDRESSES[chainId][symbol];
    const previousLiquidity = previous && previous[2] ? Number(previous[2].liquidity || 0) : -1;
    if (!previous || Number(asset.liquidity || 0) >= previousLiquidity) {
      TOKEN_ADDRESSES[chainId][symbol] = [asset.address, asset.decimals ?? (previous && previous[1]), { ...asset }];
    }
    // TOKEN_INFO is only a cross-chain display cache. Do not let a low-liquidity
    // same-symbol result (for example a different chain's ETH) overwrite a
    // liquid canonical asset. Trading always uses the chain-specific record in
    // TOKEN_ADDRESSES; this keeps the card display consistent with that record.
    const currentInfo = TOKEN_INFO[symbol] || {};
    const currentLiquidity = Number(currentInfo.liquidity || 0);
    const incomingLiquidity = Number(asset.liquidity || 0);
    if (!currentInfo.price || incomingLiquidity >= currentLiquidity) {
      TOKEN_INFO[symbol] = {
        ...currentInfo,
        name: asset.name || symbol,
        color: currentInfo.color || "#536471",
        stable: ["USDC", "USDT", "DAI", "USDE", "USDS"].includes(symbol.toUpperCase()),
        imageUrl: asset.imageUrl || currentInfo.imageUrl,
        price: Number(asset.price) > 0 ? Number(asset.price) : currentInfo.price,
        liquidity: incomingLiquidity,
        riskFlagged: !!asset.riskFlagged,
      };
    }
  }

  // Flash search can return different contracts with the same ticker. Keep a
  // selected contract addressable instead of silently swapping it for another
  // same-symbol asset already in the local cache.
  function registerSelectableFlashAsset(asset) {
    const chainId = FLASH_TO_CHAIN[asset && asset.chain];
    if (chainId === undefined || !asset || !asset.symbol || !asset.address) return null;
    let symbol = asset.symbol;
    const existing = tokenOn(chainId, symbol);
    if (existing && String(existing.address).toLowerCase() !== String(asset.address).toLowerCase()) {
      symbol = `${asset.symbol} · ${String(asset.address).slice(2, 6)}`;
    }
    registerFlashAsset({ ...asset, symbol });
    return symbol;
  }

  function searchAssets(query, chain) {
    const key = `${query.toUpperCase()}:${chain || "all"}`;
    if (!assetSearches.has(key)) {
      assetSearches.set(key, flashApi("search", { query, ...(chain && { chain }), limit: 25 }, "GET").then((result) => {
        const exact = (result.assets || []).filter((asset) => asset.symbol.toUpperCase() === query.toUpperCase());
        exact.forEach(registerFlashAsset);
        return exact;
      }).catch((error) => {
        assetSearches.delete(key);
        throw error;
      }));
    }
    return assetSearches.get(key);
  }

  async function discoverTicker(ticker) {
    const key = ticker.toUpperCase();
    const aliases = key === "BTC" ? ["BTC", "WBTC", "cbBTC"] : [key];
    await Promise.allSettled([...new Set([...aliases, ...QUOTE_TOKENS])].map((symbol) => searchAssets(symbol)));
    // Global search is ranked and capped. Fill any omitted network with a scoped
    // lookup so a valid lower-liquidity deployment remains selectable.
    await Promise.allSettled(aliases.flatMap((alias) => CHAIN_ORDER
      .filter((chainId) => !Object.keys(TOKEN_ADDRESSES[chainId] || {}).some((symbol) => symbol.toUpperCase() === alias.toUpperCase()))
      .map((chainId) => searchAssets(alias, CHAINS[chainId].flash))));
    const targetChains = CHAIN_ORDER.filter((chainId) => aliases.some((alias) =>
      Object.keys(TOKEN_ADDRESSES[chainId] || {}).some((symbol) => symbol.toUpperCase() === alias.toUpperCase())
    ));
    await Promise.all(targetChains.map(async (chainId) => {
      if (QUOTE_TOKENS.some((symbol) => tokenOn(chainId, symbol))) return;
      for (const symbol of QUOTE_TOKENS) {
        try { await searchAssets(symbol, CHAINS[chainId].flash); } catch { continue; }
        if (tokenOn(chainId, symbol)) return;
      }
    }));
    TICKER_TO_TOKENS[key] = aliases.flatMap((alias) => {
      const matching = new Set();
      CHAIN_ORDER.forEach((chainId) => Object.keys(TOKEN_ADDRESSES[chainId] || {}).forEach((symbol) => {
        if (symbol.toUpperCase() === alias.toUpperCase()) matching.add(symbol);
      }));
      return [...matching];
    });
    return chainsForTicker(key);
  }

  // ---------------------------------------------------------------------------
  // Wallet access. Inside the extension, requests go through bridge.js (page main
  // world, where the wallet lives). Outside it (pasted as a preview), use window.ethereum.
  // ---------------------------------------------------------------------------
  const inExtension = !!(globalThis.chrome && chrome.runtime && chrome.runtime.id);
  let nextRpcId = 1;
  const pendingRpcs = new Map();
  const wallet = { account: null, chainId: null, solanaAccount: null };
  function isSolana(chainId) { return chainId === "solana"; }
  function accountFor(chainId) { return isSolana(chainId) ? wallet.solanaAccount : wallet.account; }

  function refreshAllPanels() {
    document.querySelectorAll(`[${HOST_ATTR}]`).forEach((host) => host.dispatchEvent(new Event("plan-b:wallet")));
  }

  if (inExtension) {
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data) return;
      if (data.type === "plan-b:bridge-response" && data.sourceId === SOURCE_ID) {
        const pending = pendingRpcs.get(data.rpcId);
        if (!pending) return;
        pendingRpcs.delete(data.rpcId);
        if (data.error) pending.reject(Object.assign(new Error(data.error.message), { code: data.error.code }));
        else pending.resolve(data.result);
      } else if (data.type === "plan-b:bridge-event") {
        if (data.event === "accountsChanged") wallet.account = (data.payload && data.payload[0]) || null;
        if (data.event === "chainChanged") wallet.chainId = parseInt(data.payload, 16);
        if (data.event === "solanaAccountChanged") wallet.solanaAccount = data.payload || null;
        if (data.event === "solanaDisconnect") wallet.solanaAccount = null;
        refreshAllPanels();
      }
    });
  }

  function walletRequest(method, params) {
    if (!inExtension) {
      if (!window.ethereum) return Promise.reject(new Error("No wallet found. Install MetaMask or another browser wallet."));
      return window.ethereum.request({ method, params });
    }
    return new Promise((resolve, reject) => {
      const rpcId = nextRpcId++;
      pendingRpcs.set(rpcId, { resolve, reject });
      window.postMessage({ type: "plan-b:bridge-request", sourceId: SOURCE_ID, rpcId, method, params }, window.location.origin);
    });
  }

  async function connectWallet(chainId) {
    if (isSolana(chainId)) {
      wallet.solanaAccount = await walletRequest("solana_connect");
      refreshAllPanels();
      return;
    }
    const accounts = await walletRequest("eth_requestAccounts");
    wallet.account = accounts[0];
    wallet.chainId = parseInt(await walletRequest("eth_chainId"), 16);
    refreshAllPanels();
  }

  async function ensureChain(chainId) {
    if (isSolana(chainId)) {
      if (!wallet.solanaAccount) await connectWallet(chainId);
      return;
    }
    wallet.chainId = parseInt(await walletRequest("eth_chainId"), 16);
    if (wallet.chainId === chainId) return;
    const chain = CHAINS[chainId];
    try {
      await walletRequest("wallet_switchEthereumChain", [{ chainId: chain.hex }]);
    } catch (error) {
      if (error.code !== 4902) throw error; // 4902: network not added to the wallet yet
      await walletRequest("wallet_addEthereumChain", [{
        chainId: chain.hex,
        chainName: chain.name,
        nativeCurrency: { name: chain.native[0], symbol: chain.native[1], decimals: 18 },
        rpcUrls: [chain.rpc],
        ...(chain.explorer && { blockExplorerUrls: [chain.explorer] }),
      }]);
    }
    wallet.chainId = chainId;
    refreshAllPanels();
  }

  async function waitForReceipt(hash) {
    for (let i = 0; i < 200; i++) {
      const receipt = await walletRequest("eth_getTransactionReceipt", [hash]);
      if (receipt && receipt.blockNumber) {
        if (receipt.status !== "0x1") throw new Error("Transaction reverted on-chain");
        return receipt;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new Error("Timed out waiting for the transaction to confirm");
  }

  function toHexQuantity(value) {
    return "0x" + BigInt(value || 0).toString(16);
  }

  async function sendTransaction(tx) {
    if (!tx || !tx.data || tx.data === "0x") throw new Error("Flash returned an empty transaction");
    const params = { from: wallet.account, to: tx.to, data: tx.data, value: toHexQuantity(tx.value) };

    // The API's gasLimit leaves little headroom: if other trades in the same block move the pool,
    // the swap crosses more ticks and runs out of gas (surfacing as TRANSFER_FROM_FAILED).
    // Use the larger of our own estimate and the API's, plus 30%. Only gas used is paid for.
    let gas = tx.gasLimit ? BigInt(tx.gasLimit) : 0n;
    try {
      const estimate = BigInt(await walletRequest("eth_estimateGas", [params]));
      if (estimate > gas) gas = estimate;
    } catch (error) {
      // Estimation simulates the transaction: failing here means it would revert on-chain
      throw new Error(`Transaction would fail: ${error.message.replace(/^.*execution reverted:?\s*/i, "") || "reverted in simulation"}`);
    }
    params.gas = toHexQuantity((gas * 13n) / 10n);
    return walletRequest("eth_sendTransaction", [params]);
  }

  async function tokenBalance(chainId, symbol) {
    const token = tokenOn(chainId, symbol);
    if (isNativeAddress(token.address)) return BigInt(await walletRequest("eth_getBalance", [wallet.account, "latest"]));
    const data = "0x70a08231" + wallet.account.slice(2).toLowerCase().padStart(64, "0"); // balanceOf(address)
    const result = await walletRequest("eth_call", [{ to: token.address, data }, "latest"]);
    return BigInt(result && result !== "0x" ? result : 0);
  }

  // Restore an existing connection without prompting
  walletRequest("eth_accounts")
    .then(async (accounts) => {
      if (accounts && accounts[0]) {
        wallet.account = accounts[0];
        wallet.chainId = parseInt(await walletRequest("eth_chainId"), 16);
        refreshAllPanels();
      }
    })
    .catch(() => {});
  walletRequest("solana_account").then((account) => { wallet.solanaAccount = account; refreshAllPanels(); }).catch(() => {});

  // ---------------------------------------------------------------------------
  // Definitive Flash API (via the extension background -> backend proxy)
  // ---------------------------------------------------------------------------
  function flashApi(endpoint, body, method = "POST") {
    if (!inExtension) return Promise.reject(new Error("Live quotes need the Plan B extension"));
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: "flash", endpoint, body, method }, (response) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!response.ok) {
          const body = response.body || {};
          const apiError = body.error;
          const message = (apiError && (apiError.message || apiError.code)) || body.detail || body.message || apiError || `Flash API error ${response.status}`;
          return reject(Object.assign(new Error(message), { status: response.status, errorCode: body.errorCode }));
        }
        resolve(response.body);
      });
    });
  }

  function parsePlanApi(text, mode = "tweet") {
    if (!inExtension) return Promise.reject(new Error("Tweet parsing needs the Plan B extension"));
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: "parsePlan", text, mode }, (response) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!response || !response.ok) {
          const body = response && response.body || {};
          return reject(Object.assign(new Error(body.message || `Plan parser error ${response && response.status || 0}`), {
            status: response && response.status,
            code: body.code,
            manualEligible: body.manualEligible === true,
            details: body.details,
          }));
        }
        resolve(response.body);
      });
    });
  }

  function plansApi(op, body = {}) {
    if (!inExtension) return Promise.reject(new Error("Plan tracking needs the Plan B extension"));
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: "plans", op, body }, (response) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!response || !response.ok) return reject(new Error(response && response.body && response.body.message || `Plan API error ${response && response.status || 0}`));
        resolve(response.body);
      });
    });
  }

  function radarApi(path, body = {}, method = "GET") {
    if (!inExtension) return Promise.reject(new Error("Plan B Radar needs the extension"));
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: "radar", path, body, method }, (response) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!response || !response.ok) {
          const payload = response && response.body || {};
          return reject(Object.assign(new Error(payload.message || "Plan B Radar is unavailable"), { status: response && response.status }));
        }
        resolve(response.body);
      });
    });
  }

  function signalApi(path, body = {}, method = "GET") {
    if (!inExtension) return Promise.reject(new Error("Signal evidence needs the Plan B extension"));
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: "signal", path, body, method }, (response) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!response || !response.ok) return reject(Object.assign(new Error(response && response.body && response.body.message || "Signal evidence is unavailable"), { status: response && response.status }));
        resolve(response.body);
      });
    });
  }

  function typedDataPayload(value) {
    return typeof value === "string" ? value : JSON.stringify(value);
  }

  // ---------------------------------------------------------------------------
  // Plan B security checks (Flash + GoPlus + Honeypot where supported)
  // ---------------------------------------------------------------------------
  const tokenRiskCache = new Map(); // `${chainId}:${address}` -> Promise of the verdict

  function securityApi(chainId, address) {
    if (!inExtension) return Promise.reject(new Error("Security checks need the Plan B extension"));
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: "security", chainId, address }, (response) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!response || !response.ok) {
          const body = response && response.body || {};
          return reject(Object.assign(new Error(body.message || body.error || `Security API error ${response && response.status || 0}`), { status: response && response.status }));
        }
        resolve(response.body);
      });
    });
  }

  // -> { action: "block" | "warn" | "info", reasons: [description] }
  function tokenRisk(chainId, address) {
    const key = `${chainId}:${address.toLowerCase()}`;
    if (!tokenRiskCache.has(key)) {
      const request = securityApi(chainId, address);
      request.catch(() => tokenRiskCache.delete(key)); // don't cache failures, so the next open retries
      tokenRiskCache.set(key, request);
    }
    return tokenRiskCache.get(key);
  }

  // The tweet's author (for a repost, the original author)
  function tweetAuthor(article) {
    const link = article.querySelector('[data-testid="User-Name"] a[href^="/"]');
    const match = link && (link.getAttribute("href") || "").match(/^\/([A-Za-z0-9_]{1,15})$/);
    return match ? match[1] : null;
  }

  // ---------------------------------------------------------------------------
  // Units and formatting
  // ---------------------------------------------------------------------------
  function parseUnits(value, decimals) {
    const [whole, fraction = ""] = String(value).split(".");
    const padded = (fraction + "0".repeat(decimals)).slice(0, decimals);
    return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(padded || "0");
  }

  function unitsToNumber(amount, decimals) {
    const base = 10n ** BigInt(decimals);
    const value = BigInt(amount);
    return Number(value / base) + Number(value % base) / Number(base);
  }

  function unitsToInput(amount, decimals) {
    const base = 10n ** BigInt(decimals);
    const value = BigInt(amount);
    const fraction = (value % base).toString().padStart(decimals, "0").slice(0, 6).replace(/0+$/, "");
    return (value / base).toString() + (fraction ? "." + fraction : "");
  }

  function formatAmount(value) {
    if (!isFinite(value) || value <= 0) return "0";
    if (value >= 100000) return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
    if (value >= 100) return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
    if (value >= 1) return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
    return value.toLocaleString("en-US", { maximumSignificantDigits: 4 });
  }

  function formatUsd(value) {
    if (!isFinite(value) || value <= 0) return "$0.00";
    if (value < 0.01) return "<$0.01";
    return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function shortAddress(address) {
    return address.slice(0, 6) + "…" + address.slice(-4);
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function utf8ToHex(text) {
    return "0x" + [...new TextEncoder().encode(text)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  // ---------------------------------------------------------------------------
  // Icons (bundled with the extension: X's CSP could block remote images)
  // ---------------------------------------------------------------------------
  const TOKEN_LOGOS = new Set([
    "ETH", "WETH", "USDC", "USDT", "DAI", "WBTC", "UNI", "LINK", "AAVE", "wstETH", "cbETH", "MORPHO", "DEGEN", "BRETT",
    "AERO", "VIRTUAL", "TOSHI", "PEPE", "SHIB", "LDO", "ENS", "ONDO", "ARB", "OP", "PENDLE", "GMX", "VELO",
  ]);

  function assetUrl(path) {
    return inExtension ? chrome.runtime.getURL(path) : null;
  }

  function tokenLogoHtml(symbol, className = "icon") {
    const info = TOKEN_INFO[symbol] || { name: symbol, color: "#536471" };
    const remoteUrl = info.imageUrl && /^https:\/\//.test(info.imageUrl) ? info.imageUrl : null;
    const url = remoteUrl || (TOKEN_LOGOS.has(symbol) && assetUrl(`icons/tokens/${symbol}.png`));
    if (url) return `<img class="${className}" src="${url}" alt="">`;
    const label = symbol === "ETH" ? "Ξ" : info.stable ? "$" : symbol.replace(/^cb/, "").slice(0, 1);
    return `<span class="${className}" style="background:${info.color}">${label}</span>`;
  }

  function chainLogoHtml(chainId, className = "chain-icon") {
    const chain = CHAINS[chainId];
    const url = chain.icon && assetUrl(`icons/chains/${chain.icon}.png`);
    return url ? `<img class="${className}" src="${url}" alt="${chain.name}">` : `<span class="${className}" style="display:inline-flex;align-items:center;justify-content:center;background:#536471;color:white;font-size:9px;font-weight:700">${chain.name.slice(0, 1)}</span>`;
  }

  // ---------------------------------------------------------------------------
  // Reading X's ticker card
  // ---------------------------------------------------------------------------
  function parseTickerLink(link) {
    const spans = [...link.querySelectorAll("span")].map((span) => ({ span, text: span.textContent.trim() }));
    const price = spans.find((s) => /^\$[\d,]+(\.\d+)?$/.test(s.text));
    const symbol = spans.find((s) => /^[A-Za-z0-9]{1,15}$/.test(s.text) && s.text === s.text.toUpperCase());
    const change = spans.find((s) => /^[+\-−][\d.,]+%$/.test(s.text));
    const name = spans.find((s) => s !== price && s !== symbol && s !== change && s.text && getComputedStyle(s.span).fontWeight >= 700);
    if (!price || !symbol || !link.querySelector("svg")) return null;

    return {
      symbol: symbol.text,
      name: name ? name.text : symbol.text,
      price: parseFloat(price.text.replace(/[$,]/g, "")),
      priceSpan: price.span,
      iconSrc: link.querySelector("img") ? link.querySelector("img").src : null,
      nameSpan: name ? name.span : price.span,
      symbolSpan: symbol.span,
    };
  }

  function readTheme(article, link, ticker) {
    const cashtag = [...article.querySelectorAll('[data-testid="tweetText"] a')].find((a) => a.textContent.trim().startsWith("$"));
    let bg = "rgb(0, 0, 0)";
    for (let el = link; el; el = el.parentElement) {
      const color = getComputedStyle(el).backgroundColor;
      if (color && color !== "rgba(0, 0, 0, 0)" && color !== "transparent") { bg = color; break; }
    }
    const text = getComputedStyle(ticker.nameSpan).color;
    return {
      "--text": text,
      "--muted": getComputedStyle(ticker.symbolSpan).color,
      "--border": getComputedStyle(link).borderTopColor,
      "--bg": bg,
      "--accent": cashtag ? getComputedStyle(cashtag).color : "rgb(29, 155, 240)",
      "--font": getComputedStyle(ticker.nameSpan).fontFamily,
      "--surface": `color-mix(in srgb, ${text} 6%, transparent)`,
      "--hover": `color-mix(in srgb, ${text} 8%, ${bg})`,
      "--shadow": `color-mix(in srgb, ${text} 20%, transparent)`,
    };
  }

  // Set via setProperty: X's font stack contains double quotes, which would break an inline style attribute
  function applyTheme(element, themeVars) {
    Object.entries(themeVars).forEach(([name, value]) => element.style.setProperty(name, value));
  }

  // ---------------------------------------------------------------------------
  // Dropdown (tokens, networks). Rendered as a fixed layer on <body>, like X's own
  // menus: inside the tweet it would be clipped by the panel and covered by the next tweet.
  // ---------------------------------------------------------------------------
  const DROPDOWN_STYLE = `
    :host { all: initial; position: fixed; z-index: 2147483000; }
    .menu {
      font-family: var(--font); -webkit-font-smoothing: antialiased;
      min-width: 220px; max-height: min(560px, calc(100vh - 24px)); padding: 4px 0; overflow: auto;
      background: var(--bg); border-radius: 12px;
      box-shadow: 0 0 15px var(--shadow), 0 0 3px 1px var(--shadow);
      animation: drop .12s ease-out;
    }
    @keyframes drop { from { opacity: 0; transform: translateY(-4px); } }
    .title { font-size: 13px; font-weight: 700; color: var(--muted); padding: 10px 16px 6px; }
    .search { padding: 8px 12px; border-bottom: 1px solid var(--border); }
    .search input { width: 100%; height: 34px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); padding: 0 9px; font: inherit; font-size: 13px; outline: none; }
    .search input:focus { border-color: var(--accent); }
    .search-status { padding: 7px 16px; color: var(--muted); font-size: 12px; }
    .menu button {
      display: flex; align-items: center; gap: 12px; width: 100%;
      font: inherit; color: var(--text); background: none; border: 0;
      padding: 10px 16px; cursor: pointer; text-align: left;
    }
    .menu button:hover:not(:disabled), .menu button:focus-visible { background: var(--hover); outline: none; }
    .menu button:disabled { cursor: default; opacity: .45; }
    .names { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .names b { font-size: 15px; font-weight: 700; line-height: 20px; }
    .names small { font-size: 13px; color: var(--muted); line-height: 16px; }
    .check { width: 18px; height: 18px; fill: var(--accent); flex: none; }
    .icon {
      width: 32px; height: 32px; border-radius: 50%; flex: none; object-fit: cover;
      display: inline-flex; align-items: center; justify-content: center;
      color: #fff; font-size: 14px; font-weight: 700;
    }
    .chain-icon { width: 28px; height: 28px; border-radius: 8px; flex: none; object-fit: cover; }
  `;
  // Plan B logo (images/logo.svg), inlined so it needs no web-accessible resource
  const PLAN_B_LOGO_SVG = `<svg class="logo" viewBox="0 0 128 128" aria-hidden="true"><rect width="128" height="128" rx="30" fill="#0d0b07"/><g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="15"><path d="M36 36 L92 92" stroke="#fff9e8"/><path d="M36 92 L88 40" stroke="#0d0b07" stroke-width="29"/><path d="M36 92 L90 38 M66 38 H90 V62" stroke="#f5c542"/></g></svg>`;
  const CHECK_SVG = `<svg class="check" viewBox="0 0 24 24"><path d="M9.64 18.952l-5.55-4.861 1.317-1.504 3.951 3.459 8.459-10.948L19.4 6.32 9.64 18.952z"/></svg>`;

  const dropdown = (() => {
    let host = null;
    let cleanup = null;

    function close() {
      if (!host) return;
      host.remove();
      host = null;
      if (cleanup) cleanup();
      cleanup = null;
    }

    // items: [{ id, iconHtml, title, subtitle, disabled }]
    function open({ anchor, title, items, selected, themeVars, onSelect, search }) {
      close();
      host = document.createElement("div");
      host.setAttribute("data-plan-b-dropdown", "");
      const root = host.attachShadow({ mode: "open" });
      root.innerHTML = `<style>${DROPDOWN_STYLE}</style><div class="menu" role="menu">
        ${title ? `<div class="title">${escapeHtml(title)}</div>` : ""}
        ${search ? `<div class="search"><input type="search" autocomplete="off" placeholder="${escapeHtml(search.placeholder || "Search")}" aria-label="Search tokens"></div>` : ""}
        <div class="items">${items.map((item) => `
          <button role="menuitem" data-id="${escapeHtml(item.id)}"${item.disabled ? " disabled" : ""}>
            ${item.iconHtml}
            <span class="names"><b>${escapeHtml(item.title)}</b>${item.subtitle ? `<small>${escapeHtml(item.subtitle)}</small>` : ""}</span>
            ${String(item.id) === String(selected) ? CHECK_SVG : ""}
          </button>`).join("")}</div>`;
      const menu = root.querySelector(".menu");
      const itemsHost = root.querySelector(".items");
      applyTheme(menu, themeVars);
      document.body.appendChild(host);

      const renderItems = (nextItems, message = "") => {
        itemsHost.innerHTML = message ? `<div class="search-status">${escapeHtml(message)}</div>` : nextItems.map((item) => `
          <button role="menuitem" data-id="${escapeHtml(item.id)}"${item.disabled ? " disabled" : ""}>
            ${item.iconHtml}<span class="names"><b>${escapeHtml(item.title)}</b>${item.subtitle ? `<small>${escapeHtml(item.subtitle)}</small>` : ""}</span>${String(item.id) === String(selected) ? CHECK_SVG : ""}
          </button>`).join("");
      };

      // Drop down below the anchor, right-aligned with it; flip up only if there's no room below
      const rect = anchor.getBoundingClientRect();
      const width = menu.offsetWidth;
      const height = menu.offsetHeight;
      const below = rect.bottom + 6 + height <= window.innerHeight - 8;
      host.style.top = `${below ? rect.bottom + 6 : Math.max(8, rect.top - 6 - height)}px`;
      host.style.left = `${Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))}px`;

      root.addEventListener("click", (event) => {
        const item = event.target.closest("button[data-id]");
        if (!item || item.disabled) return;
        close();
        onSelect(item.dataset.id);
      });
      if (search) {
        const field = root.querySelector(".search input");
        let searchTimer = null;
        field.addEventListener("input", () => {
          clearTimeout(searchTimer);
          const query = field.value.trim();
          if (!query) { renderItems(items); return; }
          if (query.length < 2) { renderItems([], "Type at least two characters to search Flash assets."); return; }
          searchTimer = setTimeout(async () => {
            renderItems([], "Searching Flash assets…");
            try {
              const found = await search.onSearch(query);
              renderItems(found, found.length ? "" : "No tradeable asset found on this network.");
            } catch (error) { renderItems([], error.message || "Could not search Flash assets."); }
          }, 220);
        });
        setTimeout(() => field.focus({ preventScroll: true }), 0);
      }
      ["mousedown", "pointerdown", "keydown", "keyup"].forEach((type) => host.addEventListener(type, (event) => event.stopPropagation()));

      const onOutside = (event) => { const path = event.composedPath(); if (!path.includes(host) && !path.includes(anchor)) close(); };
      const onKey = (event) => { if (event.key === "Escape") close(); };
      const onScroll = () => close();
      setTimeout(() => document.addEventListener("pointerdown", onOutside, true));
      document.addEventListener("keydown", onKey, true);
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", onScroll);
      cleanup = () => {
        document.removeEventListener("pointerdown", onOutside, true);
        document.removeEventListener("keydown", onKey, true);
        window.removeEventListener("scroll", onScroll, true);
        window.removeEventListener("resize", onScroll);
      };
      const first = root.querySelector("button:not(:disabled)");
      if (first) first.focus({ preventScroll: true });
    }

    return { open, close, isOpen: () => !!host };
  })();

  // ---------------------------------------------------------------------------
  // Panel UI
  // ---------------------------------------------------------------------------
  const VERDICT_STYLE = `
    .ic-mark { width: 11px; height: 15px; fill: currentColor; flex: none; }
    .safe { --verdict: rgb(245, 197, 66); }
    .warn { --verdict: rgb(255, 173, 31); }
    .block { --verdict: #ff4c3f; }
  `;
  const STYLE = `${VERDICT_STYLE}
    :host { all: initial; display: block; }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    .root { width: 100%; max-width: 100%; font-family: var(--font, system-ui, -apple-system, sans-serif); color: var(--text, rgb(231, 233, 234)); -webkit-font-smoothing: antialiased; container-type: inline-size; }

    .collapse { display: none; }
    .open .collapse { display: block; }
    .collapse-inner { width: 100%; max-width: 100%; overflow: hidden; min-height: 0; }

    .panel {
      width: 100%; max-width: 100%; max-height: min(720px, calc(100vh - 96px)); overflow-y: auto;
      background: var(--bg, rgb(0, 0, 0));
      border: 1px solid var(--border, rgb(47, 51, 54));
      border-top: 0;
      border-radius: 0 0 12px 12px;
      padding: 12px;
      display: flex; flex-direction: column; gap: 10px;
      cursor: default;
      scrollbar-width: thin;
    }
    .panel > * { flex: none; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 32px; }
    .seg { display: inline-flex; border: 1px solid var(--border); border-radius: 9999px; padding: 2px; }
    .seg button {
      font: inherit; font-size: 13px; font-weight: 700; color: var(--muted);
      background: none; border: 0; border-radius: 9999px; padding: 4px 14px; cursor: pointer;
      transition: background-color .15s, color .15s;
    }
    .seg button:hover { color: var(--text); }
    .seg button.on { background: var(--text); color: var(--bg); }

    /* Wallet: "Connect wallet" before connecting, then [network icon] address ⌄ */
    .wallet {
      display: inline-flex; align-items: center; gap: 8px;
      font: inherit; font-size: 14px; font-weight: 700; color: var(--text);
      background: none; border: 1px solid var(--border); border-radius: 9999px;
      height: 32px; padding: 0 12px; cursor: pointer; white-space: nowrap;
      transition: background-color .15s;
    }
    .wallet:hover { background: var(--hover); }
    .wallet.connected { padding: 0 8px 0 4px; gap: 6px; }
    .wallet .chain-icon { width: 22px; height: 22px; border-radius: 6px; object-fit: cover; }
    .wallet .caret { width: 16px; height: 16px; fill: var(--muted); }
    .wallet .dot { width: 8px; height: 8px; border-radius: 50%; background: rgb(255, 173, 31); }

    .strategy-card { display: grid; gap: 7px; padding: 11px 12px; border: 1px solid color-mix(in srgb, rgb(245,197,66) 38%, var(--border)); border-radius: 12px; background: color-mix(in srgb, rgb(245,197,66) 9%, var(--bg)); }
    .strategy-kicker { color: rgb(245,197,66); font-size: 10px; font-weight: 800; letter-spacing: .12em; }
    .strategy-title { color: var(--text); font-size: 15px; font-weight: 800; line-height: 19px; }
    .strategy-summary { color: var(--muted); font-size: 12px; line-height: 17px; }
    .strategy-steps { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }
    .strategy-step { padding: 4px 8px; border-radius: 999px; background: var(--bg); border: 1px solid var(--border); color: var(--text); font-size: 11px; font-weight: 700; }
    .strategy-arrow { color: rgb(245,197,66); font-size: 11px; }
    .strategy-warning { color: rgb(255,173,31); font-size: 11px; line-height: 15px; }
    .strategy-room { display:flex; flex-wrap:wrap; gap:6px; align-items:center; color:var(--muted); font-size:11px; line-height:16px; }
    .decay { border-radius:999px; padding:3px 7px; font-weight:800; background:color-mix(in srgb, rgb(245,197,66) 16%, var(--bg)); color:rgb(245,197,66); }
    .decay.chasing,.decay.expired { background:color-mix(in srgb, rgb(244,33,46) 16%, var(--bg)); color:rgb(255,139,145); }
    .decay.aging { background:color-mix(in srgb, rgb(255,173,31) 16%, var(--bg)); color:rgb(255,173,31); }
    .strategy-follow { border:1px solid rgb(245,197,66); border-radius:999px; background:transparent; color:rgb(245,197,66); padding:4px 8px; font:800 10px var(--font); cursor:pointer; }
    .copy-guard { display:grid; grid-template-columns:1fr 1fr; gap:7px; padding:9px 10px; border:1px solid var(--border); border-radius:11px; background:color-mix(in srgb, var(--bg) 72%, rgb(245,197,66) 8%); }
    .copy-guard b { grid-column:1/-1; font-size:11px; color:var(--text); }.copy-guard label { display:grid; gap:4px; color:var(--muted); font-size:10px; font-weight:700; }.copy-guard select,.copy-guard input { min-width:0; width:100%; border:1px solid var(--border); border-radius:7px; background:var(--bg); color:var(--text); padding:6px; font:600 11px var(--font); }

    /* Pay box on top, receive box below, with the switch button on the seam between them */
    .row { display: flex; flex-direction: column; gap: 4px; position: relative; }
    .order-config { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .order-config label { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .order-config label.wide { grid-column: 1 / -1; }
    .order-config span { font-size: 12px; color: var(--muted); }
    .order-config select, .order-config input {
      width: 100%; min-width: 0; height: 34px; padding: 0 10px;
      font: inherit; font-size: 13px; color: var(--text); background: var(--surface);
      border: 1px solid var(--border); border-radius: 9px; outline: none;
    }
    .order-config select:focus, .order-config input:focus { border-color: var(--accent); }
    .order-config .checkline { grid-column: 1 / -1; flex-direction: row; align-items: center; cursor: pointer; }
    .order-config .checkline input { width: 16px; height: 16px; padding: 0; }
    .plan-title { grid-column: 1 / -1; font-size: 12px; font-weight: 700; letter-spacing: .04em; color: var(--text); }
    .plan-warning { grid-column: 1 / -1; margin: 0; padding: 8px 10px; border-radius: 9px; background: var(--surface); color: var(--muted); font-size: 12px; line-height: 17px; }
    .voice-fill { grid-column: 1 / -1; display: grid; gap: 7px; padding: 9px 10px; border: 1px solid color-mix(in srgb, rgb(245,197,66) 38%, var(--border)); border-radius: 10px; background: color-mix(in srgb, rgb(245,197,66) 8%, var(--bg)); }
    .voice-fill-toggle, .voice-fill-actions button { width: fit-content; border: 1px solid rgb(245,197,66); border-radius: 999px; background: transparent; color: rgb(245,197,66); padding: 6px 9px; font: 800 11px var(--font); cursor: pointer; }
    .voice-fill p { margin: 0; color: var(--muted); font-size: 11px; line-height: 15px; }
    .voice-fill textarea { width: 100%; min-height: 54px; resize: vertical; padding: 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); font: 12px var(--font); }
    .voice-fill-actions { display: flex; flex-wrap: wrap; gap: 6px; }
    .voice-fill-actions .voice-apply { background: rgb(245,197,66); color: #1c1503; }
    .voice-fill-actions button:disabled, .voice-fill-toggle:disabled { opacity: .6; cursor: wait; }
    .advanced { grid-column: 1 / -1; border-top: 1px solid var(--border); padding-top: 8px; }
    .advanced summary { cursor: pointer; color: var(--muted); font-size: 12px; font-weight: 700; }
    .advanced-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; padding-top: 8px; }
    .advanced-grid .wide { grid-column: 1 / -1; }
    @container (max-width: 380px) { .order-config { grid-template-columns: 1fr; } .order-config label.wide, .order-config .checkline { grid-column: 1; } }
    .box {
      min-width: 0;
      background: var(--surface);
      border: 1px solid transparent;
      border-radius: 12px;
      padding: 10px 12px;
      display: flex; flex-direction: column; gap: 4px;
      transition: border-color .15s;
    }
    .box.pay:focus-within { border-color: var(--accent); }
    .lbl-row { display: flex; justify-content: space-between; gap: 8px; }
    .lbl, .sub { font-size: 13px; color: var(--muted); line-height: 16px; white-space: nowrap; }
    .sub { min-height: 16px; }
    .balance { font: inherit; font-size: 13px; line-height: 16px; color: var(--muted); background: none; border: 0; padding: 0; cursor: pointer; white-space: nowrap; }
    .balance:hover { color: var(--accent); }
    .line { display: flex; align-items: center; gap: 8px; min-height: 28px; }
    .line input, .line .out {
      flex: 1; min-width: 0;
      font: inherit; font-size: 20px; font-weight: 700; line-height: 24px;
      color: var(--text); background: none; border: 0; outline: none; padding: 0;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .line input::placeholder { color: var(--muted); }
    .out.empty, .out.loading { color: var(--muted); }
    .out.loading { animation: pulse 1s ease-in-out infinite; }
    @keyframes pulse { 50% { opacity: .45; } }

    .chip {
      display: inline-flex; align-items: center; gap: 6px; flex: none;
      font: inherit; font-size: 15px; font-weight: 700; color: var(--text);
      background: var(--bg); border: 1px solid var(--border); border-radius: 9999px;
      padding: 3px 10px 3px 4px; height: 30px;
    }
    button.chip { cursor: pointer; }
    button.chip:hover { background: var(--hover); }
    .caret { width: 14px; height: 14px; fill: var(--muted); margin-left: -2px; flex: none; }
    .token { position: relative; display: inline-flex; flex: none; }
    .icon {
      width: 22px; height: 22px; border-radius: 50%; flex: none;
      display: inline-flex; align-items: center; justify-content: center;
      color: #fff; font-size: 11px; font-weight: 700; object-fit: cover;
    }
    /* Network badge on token icons */
    .badge {
      position: absolute; right: -3px; bottom: -3px; width: 12px; height: 12px;
      border-radius: 4px; border: 1.5px solid var(--bg); object-fit: cover; background: var(--bg);
    }

    .flip {
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
      width: 30px; height: 30px; border-radius: 50%;
      background: var(--bg); border: 1px solid var(--border); color: var(--text);
      display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 1;
      transition: background-color .15s;
    }
    .flip:hover { background: var(--hover); }
    .flip svg { width: 16px; height: 16px; fill: currentColor; }

    .meta { display: flex; align-items: center; justify-content: space-between; gap: 4px 12px; flex-wrap: wrap; font-size: 13px; color: var(--muted); min-height: 16px; }
    .details { display: flex; flex-wrap: wrap; gap: 4px 8px; }
    .details .warn { color: rgb(255, 173, 31); }
    .via { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; margin-left: auto; }
    .via img { width: 14px; height: 14px; border-radius: 50%; }
    .via b { color: var(--text); font-weight: 700; }

    .cta {
      width: 100%; height: 44px;
      font: inherit; font-size: 16px; font-weight: 700;
      color: var(--bg); background: var(--text);
      border: 0; border-radius: 9999px; cursor: pointer;
      transition: opacity .15s;
    }
    .cta:hover { opacity: .9; }
    .cta:disabled { opacity: .5; cursor: default; }
    .status { font-size: 13px; color: var(--muted); line-height: 18px; text-align: center; }
    .powered { display: flex; align-items: center; justify-content: center; gap: 5px; font-size: 12px; line-height: 16px; color: var(--muted); }
    .powered .logo { width: 14px; height: 14px; flex: none; }
    .powered b { color: var(--text); font-weight: 700; }
    .status.error { color: rgb(244, 33, 46); }
    .status.ok { color: rgb(245, 197, 66); }
    .status a { color: var(--accent); text-decoration: none; }
    .status a:hover { text-decoration: underline; }

    /* Plan B multi-source security verdict on the card's token */
    .security { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; line-height: 16px; color: var(--verdict, var(--muted)); }
    .security .ic-mark { width: 10px; height: 14px; margin-top: 1px; }
    .security b { font-weight: 700; }
    .security.loading { animation: pulse 1s ease-in-out infinite; }
    .status .ic-mark { width: 9px; height: 12px; vertical-align: -1px; margin-right: 2px; }
    .social-proof { font-size: 12px; line-height: 16px; color: var(--muted); }
    .social-proof b { color: var(--text); }

    /* Held trade: Plan B found a caution signal, so the user must decide */
    .risk { text-align: left; display: flex; flex-direction: column; gap: 6px; }
    .risk ul { margin: 0; padding-left: 18px; }
    .risk-actions { display: flex; gap: 8px; justify-content: flex-end; }
    .risk-actions button {
      font: inherit; font-size: 13px; font-weight: 700; border-radius: 9999px; height: 30px; padding: 0 14px; cursor: pointer;
      color: var(--text); background: none; border: 1px solid var(--border);
    }
    .risk-actions button:hover { background: var(--hover); }
    .risk-actions button[data-risk="continue"] { color: #ff4c3f; border-color: #ff4c3f; }
  `;

  // The Buy button that sits inside X's ticker card, next to the sparkline
  const TRIGGER_STYLE = `
    :host { all: initial; }
    .toggle {
      display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;
      font-family: var(--font); font-size: 13px; font-weight: 700; line-height: 1;
      color: var(--bg); background: var(--text); border: 1px solid var(--text); border-radius: 9999px;
      height: 28px; padding: 0 12px 0 10px; cursor: pointer;
      -webkit-font-smoothing: antialiased;
      transition: opacity .15s, background-color .15s, color .15s, border-color .15s;
    }
    .toggle:hover { opacity: .9; }
    .toggle svg { width: 14px; height: 14px; fill: currentColor; }
    .toggle.open { background: transparent; color: var(--text); border-color: var(--border); }
    .toggle.open:hover { background: var(--hover); opacity: 1; }
  `;

  const CARET_SVG = `<svg class="caret" viewBox="0 0 24 24"><path d="M3.543 8.96l1.414-1.42L12 14.59l7.043-7.05 1.414 1.42L12 17.41 3.543 8.96z"/></svg>`;
  const ARROW_SVG = `<svg viewBox="0 0 24 24"><path d="M13 3v13.59l5.043-5.05 1.414 1.42L12 20.41l-7.457-7.45 1.414-1.42L11 16.59V3h2z"/></svg>`;
  const SWAP_SVG = `<svg viewBox="0 0 24 24"><path d="M16.293 3.293a1 1 0 0 1 1.414 0l3.5 3.5a1 1 0 0 1 0 1.414l-3.5 3.5-1.414-1.414L18.086 8.5H6V6.5h12.086l-1.793-1.793a1 1 0 0 1 0-1.414zM7.707 12.293l1.414 1.414L7.328 15.5H19.5v2H7.328l1.793 1.793-1.414 1.414-3.5-3.5a1 1 0 0 1 0-1.414l3.5-3.5z"/></svg>`;
  const SHIELD_SVG = `<svg class="ic-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5v6c0 5.2 3.4 9.8 8 11 4.6-1.2 8-5.8 8-11V5l-8-3Zm0 3.1 5 1.9v4c0 3.6-2.1 6.9-5 8-2.9-1.1-5-4.4-5-8V7l5-1.9Z"/></svg>`;
  const CLOSE_SVG = `<svg viewBox="0 0 24 24"><path d="M10.59 12L4.54 5.96l1.42-1.42L12 10.59l6.04-6.05 1.42 1.42L13.41 12l6.05 6.04-1.42 1.42L12 13.41l-6.04 6.05-1.42-1.42L10.59 12z"/></svg>`;

  function createPanel(article, link, ticker, initialPlan = null) {
    const themeVars = readTheme(article, link, ticker);
    const host = document.createElement("div");
    host.setAttribute(HOST_ATTR, ticker.symbol);
    const root = host.attachShadow({ mode: "open" });

    const availableChains = chainsForTicker(ticker.symbol);
    const plannedChain = initialPlan && FLASH_TO_CHAIN[initialPlan.asset && initialPlan.asset.chain];
    const initialChain = plannedChain !== undefined && availableChains.includes(plannedChain)
      ? plannedChain
      : wallet.chainId && availableChains.includes(wallet.chainId)
      ? wallet.chainId
      : availableChains.includes(DEFAULT_CHAIN) ? DEFAULT_CHAIN : availableChains[0];
    const parsed = initialPlan && initialPlan.draft || {};
    const parsedEntryTypes = ["market", "limit", "twap", "stop", "stop-loss", "take-profit", "bracket", "trailing-stop", "trailing-stop-limit"];
    const parsedEntryType = parsedEntryTypes.includes(parsed.entryType) ? parsed.entryType : "market";
    const exitOrder = ["stop-loss", "take-profit", "bracket", "trailing-stop", "trailing-stop-limit"].includes(parsedEntryType);
    const compiledStrategy = initialPlan && initialPlan.strategy || null;
    const atomicBracket = compiledStrategy
      ? compiledStrategy.protection && compiledStrategy.protection.type === "attached-bracket"
      : ["market", "limit", "twap"].includes(parsedEntryType) && parsed.exitType === "bracket";
    const state = {
      open: !!initialPlan,
      chainId: initialChain,
      // These Flash order types protect or exit an existing position, so they
      // must sell the held asset even when a caller left the UI on Buy.
      side: exitOrder || parsed.side === "sell" ? "sell" : "buy",
      quoteToken: "USDC",
      amount: "",
      quote: null, // { amountOut, priceImpact, feeUSD, raw, estimated, error }
      quoting: false,
      balance: null,
      busy: false,
      orderType: parsedEntryType,
      limitPrice: parsed.entryPrice ? String(parsed.entryPrice) : "",
      triggerPrice: parsed.triggerPrice ? String(parsed.triggerPrice) : "",
      triggerDirection: parsed.triggerDirection === "lower" ? "lower" : "upper",
      durationSeconds: parsed.durationHours ? String(Math.max(300, Math.round(Number(parsed.durationHours) * 3600))) : "1800",
      bucketCount: parsed.bucketCount ? String(Math.max(2, Math.round(Number(parsed.bucketCount)))) : "12",
      trailPercent: parsed.trailPercent ? String(parsed.trailPercent) : "5",
      activationPrice: parsed.activationPrice ? String(parsed.activationPrice) : "",
      attachBracket: !!atomicBracket,
      stopPrice: parsed.stopLoss ? String(parsed.stopLoss) : "",
      targetPrice: parsed.takeProfit ? String(parsed.takeProfit) : "",
      expireTime: parsed.expiryHours ? new Date(Date.now() + Number(parsed.expiryHours) * 3600000).toISOString() : null,
      orderId: null,
      security: null, // Plan B verdict: { loading } | { action, reasons, sources } | { error } | { native }
      integrity: initialPlan && initialPlan.integrity || null,
      copyMode: "native",
      maxDrift: "3",
    };
    const author = tweetAuthor(article);
    let quoteSeq = 0;
    let pendingRisk = null; // { resolve, reject } while a security warning waits for the user
    let securityPromise = null;
    let quoteTimer = null;
    const pickerBalances = new Map();

    root.innerHTML = `
      <style>${STYLE}</style>
      <div class="root">
        <div class="collapse">
          <div class="collapse-inner">
            <div class="panel">
              <div class="head">
                <div class="seg" role="tablist">
                  <button data-side="buy" class="on">Buy</button>
                  <button data-side="sell">Sell</button>
                </div>
                <button class="wallet"></button>
              </div>
              <div class="strategy-card" hidden></div>
              <div class="copy-guard" hidden></div>
              <div class="row">
                <label class="box pay">
                  <div class="lbl-row"><span class="lbl">You pay</span><button class="balance" hidden></button></div>
                  <div class="line">
                    <input class="amount" inputmode="decimal" autocomplete="off" placeholder="0" aria-label="Amount to pay">
                    <span class="pay-token"></span>
                  </div>
                  <span class="sub pay-usd">$0.00</span>
                </label>
                <button class="flip" title="Switch buy/sell" aria-label="Switch buy and sell">${ARROW_SVG}</button>
                <div class="box get">
                  <div class="lbl-row"><span class="lbl">You receive</span></div>
                  <div class="line">
                    <span class="out empty">0</span>
                    <span class="get-token"></span>
                  </div>
                  <span class="sub get-usd">$0.00</span>
                </div>
              </div>
              <div class="order-config">
                <div class="plan-title">${initialPlan && initialPlan.manual ? "Manual trade · post is context, not advice" : `Your plan${initialPlan ? initialPlan.verified ? " · Verified caller" : ` · ${Math.round((parsed.confidence || 0) * 100)}% parser confidence` : ""}`}</div>
                <label><span>How do I get in?</span><select class="entry-mode"><option value="market">Market</option><option value="limit">Limit</option><option value="twap">TWAP</option></select></label>
                <label><span>How do I get out?</span><select class="exit-mode"><option value="none">No protection</option><option value="bracket">Stop + target</option></select></label>
                <label class="limit-field" hidden><span>Limit price (USD)</span><input class="limit-price" inputmode="decimal" placeholder="0.00"></label>
                <label class="duration-field" hidden><span>Duration (seconds)</span><input class="duration" inputmode="numeric" value="1800"></label>
                <label class="stop-field" hidden><span>Stop price (USD)</span><input class="stop-price" inputmode="decimal" placeholder="0.00"></label>
                <label class="target-field" hidden><span>Target price (USD)</span><input class="target-price" inputmode="decimal" placeholder="0.00"></label>
                <p class="plan-warning">${initialPlan && initialPlan.manual ? "This post reports market activity; it is not a trade instruction. Review the asset, network, size, and protection yourself. Flash spot orders do not copy leverage." : "First-time token approval costs gas. If price gaps through your entry, protection may activate immediately. Keep bought tokens in this wallet while protection is active."}</p>
                <div class="voice-fill">
                  <button class="voice-fill-toggle" type="button">🎙 Add order details by voice</button>
                  <div class="voice-fill-body" hidden>
                    <p>This stays locked to ${escapeHtml(ticker.symbol)} on ${escapeHtml(chain().name)}. Say the side, entry type, timing, limit/trigger, and protection. Your amount is always manual.</p>
                    <textarea class="voice-fill-text" placeholder="Example: buy via TWAP over 2 hours, stop at 2,120 and target 2,450"></textarea>
                    <div class="voice-fill-actions"><button type="button" data-voice-listen>Start listening</button><button class="voice-apply" type="button" data-voice-apply>Apply to this trade</button></div>
                  </div>
                </div>
                <details class="advanced"><summary>Advanced order types</summary><div class="advanced-grid">
                  <label class="wide"><span>Flash order type</span><select class="order-type">
                    <option value="market">Market</option><option value="limit">Limit</option><option value="twap">TWAP</option><option value="dca">DCA (scheduled TWAP)</option>
                    <option value="stop">Stop</option><option value="stop-loss">Stop loss</option><option value="take-profit">Take profit</option><option value="bracket">Bracket (position exit)</option>
                    <option value="trailing-stop">Trailing stop</option><option value="trailing-stop-limit">Trailing stop limit</option>
                  </select></label>
                  <label class="trigger-field" hidden><span>Trigger price (USD)</span><input class="trigger-price" inputmode="decimal" placeholder="0.00"></label>
                  <label class="trigger-direction-field" hidden><span>Trigger direction</span><select class="trigger-direction"><option value="upper">Price rises above</option><option value="lower">Price falls below</option></select></label>
                  <label class="buckets-field" hidden><span>TWAP buckets</span><input class="buckets" inputmode="numeric" value="12"></label>
                  <label class="trail-field" hidden><span>Trail distance (%)</span><input class="trail" inputmode="decimal" value="5"></label>
                  <label class="activation-field" hidden><span>Activation price (optional)</span><input class="activation" inputmode="decimal" placeholder="Immediate"></label>
                </div></details>
                <label class="checkline bracket-toggle" hidden><input class="attach-bracket" type="checkbox"><span>Add take-profit + stop-loss</span></label>
              </div>
              <div class="meta">
                <div class="details"></div>
                <span class="via"><b>Definitive Flash</b></span>
              </div>
              <div class="security" hidden></div>
              <div class="social-proof" hidden></div>
              <button class="cta"></button>
              <div class="status" hidden></div>
              <div class="powered">Powered by ${PLAN_B_LOGO_SVG}<b>Plan B</b></div>
            </div>
          </div>
        </div>
      </div>`;

    const $ = (selector) => root.querySelector(selector);
    applyTheme($(".root"), themeVars);
    const input = $(".amount");
    const status = $(".status");
    let socialTimer = null;
    let strategyRoom = null;
    function renderStrategyCard() {
      if (!compiledStrategy) return;
      const strategyCard = $(".strategy-card");
      const steps = (compiledStrategy.steps || []).map((step, index) => `${index ? '<span class="strategy-arrow">→</span>' : ''}<span class="strategy-step">${escapeHtml(step.label || step.orderType)}</span>`).join("");
      const warning = (compiledStrategy.warnings || [])[0];
      const integrity = initialPlan.integrity;
      const passport = initialPlan.passport;
      const recommendation = initialPlan.recommendation;
      const decay = strategyRoom && strategyRoom.decay;
      const room = strategyRoom && strategyRoom.room;
      const roomLine = initialPlan.verified
        ? `<div class="strategy-room">${decay ? `<span class="decay ${escapeHtml(decay.state)}" title="${escapeHtml(decay.reason || "")}">${escapeHtml(decay.label)}</span>` : '<span class="decay">Checking freshness</span>'}${room ? `<span>${Number(room.followers) || 0} following · ${Number(room.active) || 0} active</span>` : ""}<button class="strategy-follow" data-follow-strategy>${strategyRoom && strategyRoom.subscribed ? "Alerts on" : "Follow alerts"}</button></div>`
        : "";
      strategyCard.innerHTML = `<span class="strategy-kicker">${initialPlan.verified ? "VERIFIED FOLLOWABLE STRATEGY" : "FLASH STRATEGY COMPILER"}</span><span class="strategy-title">${escapeHtml(compiledStrategy.title || "Compiled strategy")}</span><span class="strategy-summary">${escapeHtml(compiledStrategy.summary || "")}</span><div class="strategy-steps">${steps}</div>${recommendation ? `<span class="strategy-summary"><b>${escapeHtml(recommendation.title)}:</b> ${escapeHtml(recommendation.rationale)}</span>` : ""}${integrity ? `<span class="strategy-${integrity.action === "block" ? "warning" : "summary"}"><b>${integrity.action === "block" ? "Contract mismatch:" : "Contract integrity:"}</b> ${escapeHtml(integrity.message)}</span>` : ""}${passport ? `<span class="strategy-summary">Signal Passport · captured ${new Date(passport.capturedAt).toLocaleString()} · valid until ${new Date(passport.terms.expiresAt).toLocaleString()}</span>` : ""}${warning ? `<span class="strategy-warning">${escapeHtml(warning)}</span>` : ""}${roomLine}`;
      strategyCard.hidden = false;
    }
    if (compiledStrategy) {
      renderStrategyCard();
    }
    if (initialPlan && initialPlan.verified) {
      const guard = $(".copy-guard");
      guard.innerHTML = `<b>YOUR PROTECTED COPY RULES</b><label>Execution<select class="copy-mode"><option value="native">Use caller’s Flash strategy</option><option value="twap">Convert entry to TWAP</option><option value="limit">Guard entry with a limit</option></select></label><label>Max entry drift (%)<input class="max-drift" inputmode="decimal" value="3"></label>`;
      guard.hidden = false;
    }

    async function loadStrategyRoom() {
      if (!initialPlan.verified || !initialPlan.signalId) return;
      try {
        const response = await radarApi(`/rooms/${encodeURIComponent(initialPlan.signalId)}`);
        strategyRoom = response.signal;
        renderStrategyCard();
      } catch { /* Rooms are additive; the signed strategy remains executable offline. */ }
    }

    async function subscribeToStrategy() {
      if (!initialPlan.signalId) return;
      try {
        if (!accountFor(state.chainId)) await connect();
        const funderAddress = accountFor(state.chainId);
        await radarApi("/subscriptions", { funderAddress, signalId: initialPlan.signalId, enabled: true }, "POST");
        strategyRoom ||= {};
        strategyRoom.subscribed = true;
        renderStrategyCard();
        setStatus("Alerts enabled. Plan B Radar will surface this caller’s new strategies.", "ok");
      } catch (error) {
        setStatus(escapeHtml(error.message || "Could not enable alerts."), "error");
      }
    }

    // Buy button inside the card: appended to X's flex row, so the sparkline shrinks to make room
    const triggerHost = document.createElement("span");
    triggerHost.setAttribute("data-plan-b-ticker-trigger", "");
    triggerHost.style.cssText = "display:flex;align-items:center;flex:none;padding:0 12px 0 8px;";
    const triggerRoot = triggerHost.attachShadow({ mode: "open" });
    triggerRoot.innerHTML = `<style>${TRIGGER_STYLE}</style><button class="toggle" aria-expanded="false"></button>`;
    const toggle = triggerRoot.querySelector(".toggle");
    applyTheme(toggle, themeVars);
    function ensureTrigger() {
      if (triggerHost.parentElement !== link) link.appendChild(triggerHost);
    }
    ensureTrigger();
    host.ensureTrigger = ensureTrigger;

    // --- state helpers -------------------------------------------------------
    function chain() { return CHAINS[state.chainId]; }
    function mainToken() { return tokenForTicker(ticker.symbol, state.chainId); }
    // Flash cannot attach a bracket that sells a native EVM gas asset. Quote the
    // wrapped equivalent so the received asset can be protected atomically.
    function quoteTargetToken() {
      return state.attachBracket && !isSolana(state.chainId) && isNativeAddress(tokenOn(state.chainId, mainToken()).address) && tokenOn(state.chainId, "WETH")
        ? "WETH"
        : mainToken();
    }
    function quoteTokens() { return QUOTE_TOKENS.filter((s) => s !== mainToken() && tokenOn(state.chainId, s)); }
    function selectableQuoteTokens() { return Object.keys(TOKEN_ADDRESSES[state.chainId] || {}).filter((symbol) => symbol !== mainToken()); }
    function payToken() { return state.side === "buy" ? state.quoteToken : mainToken(); }
    function getToken() { return state.side === "buy" ? mainToken() : state.quoteToken; }
    function decimalsOf(symbol) { return tokenOn(state.chainId, symbol).decimals; }
    function walletOnChain() { return isSolana(state.chainId) ? !!wallet.solanaAccount : !!wallet.account && wallet.chainId === state.chainId; }
    // X streams price updates into the card, so always read the current value from it
    function tickerPrice() {
      if (!ticker.priceSpan.isConnected) {
        const fresh = parseTickerLink(link);
        if (fresh) ticker.priceSpan = fresh.priceSpan;
      }
      const live = parseFloat(ticker.priceSpan.textContent.replace(/[$,]/g, ""));
      if (isFinite(live) && live > 0) ticker.price = live;
      return ticker.price;
    }
    // USD price for display: stables are $1, the card's token uses the card price
    function usdPrice(symbol) {
      if (TOKEN_INFO[symbol] && TOKEN_INFO[symbol].stable) return 1;
      if (symbol === mainToken()) return tickerPrice();
      return TOKEN_INFO[symbol] && TOKEN_INFO[symbol].price || null;
    }
    function amountIn() {
      return parseFloat(state.amount) > 0 ? parseUnits(state.amount, decimalsOf(payToken())) : 0n;
    }

    function positive(value) { return isFinite(Number(value)) && Number(value) > 0; }

    function orderConfigError() {
      if (state.orderType === "limit" && !positive(state.limitPrice)) return "Enter a limit price";
      if (["stop", "stop-loss", "take-profit"].includes(state.orderType) && !positive(state.triggerPrice)) return "Enter a trigger price";
      if (["twap", "dca"].includes(state.orderType) && Number(state.durationSeconds) < 300) return "Duration must be at least 300 seconds";
      if (["twap", "dca"].includes(state.orderType) && (Number(state.bucketCount) < 2 || Number(state.bucketCount) > 2560)) return "Buckets must be between 2 and 2560";
      if (["trailing-stop", "trailing-stop-limit"].includes(state.orderType) && (Number(state.trailPercent) < 0.5 || Number(state.trailPercent) > 50)) return "Trail distance must be between 0.5% and 50%";
      if ((state.orderType === "bracket" || state.attachBracket) && (!positive(state.stopPrice) || !positive(state.targetPrice))) return "Enter both stop and target prices";
      return "";
    }

    function flashQuoteRequest(funderAddress) {
      const chainName = chain().flash;
      const request = {
        targetChain: chainName,
        contraChain: chainName,
        targetAsset: tokenOn(state.chainId, quoteTargetToken()).address,
        contraAsset: tokenOn(state.chainId, state.quoteToken).address,
        side: state.side,
        qty: state.amount,
        orderType: state.orderType === "dca" ? "twap" : state.orderType,
        maxSlippage: "0.01",
        maxPriceImpact: "0.05",
      };
      if (funderAddress) request.funderAddress = funderAddress;
      if (isSolana(state.chainId) && payToken().toUpperCase() === "SOL") request.svmUseNativeSOL = true;
      if (["limit", "twap", "stop", "stop-loss", "take-profit"].includes(state.orderType) && positive(state.limitPrice)) request.limitNotionalPrice = state.limitPrice;
      if (["twap", "dca"].includes(state.orderType)) {
        request.durationSeconds = Number(state.durationSeconds);
        request.twapBucketCount = Number(state.bucketCount);
      }
      if (["stop", "stop-loss", "take-profit"].includes(state.orderType)) {
        const triggerType = state.orderType === "stop-loss" ? "lower" : state.orderType === "take-profit" ? "upper" : state.triggerDirection;
        request.triggers = [{ notionalPrice: state.triggerPrice, triggerType }];
        if (positive(state.limitPrice)) request.limitNotionalPrice = state.limitPrice;
      }
      if (state.orderType === "bracket") {
        request.triggers = [
          { notionalPrice: state.stopPrice, triggerType: "lower" },
          { notionalPrice: state.targetPrice, triggerType: "upper" },
        ];
      }
      if (["trailing-stop", "trailing-stop-limit"].includes(state.orderType)) {
        request.trailingStop = { trailPercent: String(Number(state.trailPercent) / 100) };
        if (positive(state.activationPrice)) request.trailingStop.activationPrice = state.activationPrice;
      }
      if (["market", "limit", "twap", "dca"].includes(state.orderType) && state.attachBracket) {
        request.attachedBracket = {
          stopLoss: { notionalPrice: state.stopPrice },
          takeProfit: { notionalPrice: state.targetPrice },
        };
        if (state.expireTime) request.attachedBracket.expireTime = state.expireTime;
      }
      if (state.expireTime && state.orderType !== "market") request.expireTime = state.expireTime;
      return request;
    }

    let statusTimer = null;
    function setStatus(html, kind, hideAfterMs) {
      clearTimeout(statusTimer);
      status.hidden = !html;
      status.innerHTML = html || "";
      status.className = "status" + (kind ? " " + kind : "");
      if (hideAfterMs) statusTimer = setTimeout(() => setStatus(""), hideAfterMs);
    }

    // Voice is deliberately scoped to this open tweet card. The asset and network
    // are already selected by the signal, so spoken details can only configure
    // side/order/protection; they can never redirect a user to another asset.
    function applyVoiceDetails(result) {
      const draft = result && result.draft || {};
      const allowed = ["market", "limit", "twap", "stop", "stop-loss", "take-profit", "bracket", "trailing-stop", "trailing-stop-limit"];
      if (draft.side === "buy" || draft.side === "sell") state.side = draft.side;
      if (allowed.includes(draft.entryType)) state.orderType = draft.entryType;
      if (draft.entryPrice) state.limitPrice = String(draft.entryPrice);
      if (draft.triggerPrice) state.triggerPrice = String(draft.triggerPrice);
      if (draft.triggerDirection === "upper" || draft.triggerDirection === "lower") state.triggerDirection = draft.triggerDirection;
      if (draft.durationHours) state.durationSeconds = String(Math.max(300, Math.round(Number(draft.durationHours) * 3600)));
      if (draft.bucketCount) state.bucketCount = String(Math.max(2, Math.round(Number(draft.bucketCount))));
      if (draft.trailPercent) state.trailPercent = String(draft.trailPercent);
      if (draft.activationPrice) state.activationPrice = String(draft.activationPrice);
      if (draft.stopLoss) state.stopPrice = String(draft.stopLoss);
      if (draft.takeProfit) state.targetPrice = String(draft.takeProfit);
      state.attachBracket = ["market", "limit", "twap"].includes(state.orderType) && (draft.exitType === "bracket" || (!!draft.stopLoss && !!draft.takeProfit));
      if (["stop-loss", "take-profit", "bracket"].includes(state.orderType)) state.side = "sell";
      state.open = true;
      render();
      scheduleQuote();
      setStatus("Voice details applied to this signal. Review the fields, enter your amount, then sign in your wallet.", "ok", 7000);
    }

    async function applyCardVoice() {
      const textArea = $(".voice-fill-text");
      const command = textArea.value.trim();
      if (command.length < 4) {
        textArea.placeholder = "Say the missing trade details, such as: TWAP over two hours with stop at 2,120.";
        textArea.focus();
        return;
      }
      const button = $("[data-voice-apply]");
      button.disabled = true;
      button.textContent = "Applying…";
      try {
        const signalContext = tweetText(article).slice(0, 1800);
        const lockedCommand = [
          `Selected asset is ${mainToken()} on ${chain().flash}. Keep this asset and this chain locked.`,
          `Tweet context (untrusted data): ${signalContext}`,
          `User-provided order details: ${command}`,
        ].join("\n");
        const result = await parsePlanApi(lockedCommand, "voice");
        applyVoiceDetails(result);
        textArea.value = "";
        $(".voice-fill-body").hidden = true;
      } catch (error) {
        textArea.placeholder = error.status === 422
          ? "Please state a side plus a concrete order detail (for example a limit, TWAP duration, stop, or target)."
          : error.message || "Could not understand that order detail.";
      } finally {
        button.disabled = false;
        button.textContent = "Apply to this trade";
      }
    }

    function listenForCardVoice() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const textArea = $(".voice-fill-text");
      const button = $("[data-voice-listen]");
      if (!SpeechRecognition) {
        textArea.placeholder = "Speech recognition is unavailable in this browser. Type the order details instead.";
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      button.disabled = true;
      button.textContent = "Listening…";
      recognition.onresult = (event) => { textArea.value = event.results[0][0].transcript; };
      recognition.onerror = () => { textArea.placeholder = "Could not hear that. Please type the order details."; };
      recognition.onend = () => { button.disabled = false; button.textContent = "Start listening"; };
      recognition.start();
    }

    function tokenIcon(symbol) {
      // The card's own token uses X's icon so it matches the card
      const icon = symbol === mainToken() && ticker.iconSrc ? `<img class="icon" src="${escapeHtml(ticker.iconSrc)}" alt="">` : tokenLogoHtml(symbol);
      return `<span class="token">${icon}${chainLogoHtml(state.chainId, "badge")}</span>`;
    }
    function chipHtml(symbol, selectable) {
      const tag = selectable ? "button" : "span";
      return `<${tag} class="chip"${selectable ? ' aria-haspopup="menu"' : ""}>${tokenIcon(symbol)}${escapeHtml(symbol)}${selectable ? CARET_SVG : ""}</${tag}>`;
    }

    // --- rendering -----------------------------------------------------------
    function render() {
      $(".root").classList.toggle("open", state.open);
      toggle.classList.toggle("open", state.open);
      toggle.setAttribute("aria-expanded", String(state.open));
      toggle.innerHTML = state.open ? `${CLOSE_SVG}<span>Close</span>` : `${SWAP_SVG}<span>Buy</span>`;
      // Join the panel to the card while open: square off the card's bottom corners
      link.style.borderBottomLeftRadius = state.open ? "0" : "";
      link.style.borderBottomRightRadius = state.open ? "0" : "";

      // Wallet button
      const walletButton = $(".wallet");
      const activeAccount = accountFor(state.chainId);
      walletButton.classList.toggle("connected", !!activeAccount);
      walletButton.disabled = state.busy;
      if (activeAccount) {
        walletButton.title = `Network: ${chain().name}`;
        walletButton.innerHTML = `${chainLogoHtml(state.chainId)}<span>${shortAddress(activeAccount)}</span>${walletOnChain() ? "" : '<span class="dot" title="Wallet is on another network"></span>'}${CARET_SVG}`;
      } else {
        walletButton.title = "";
        walletButton.innerHTML = "Connect wallet";
      }

      root.querySelectorAll(".seg button").forEach((b) => b.classList.toggle("on", b.dataset.side === state.side));
      $(".order-type").value = state.orderType;
      $(".entry-mode").value = ["market", "limit", "twap"].includes(state.orderType) ? state.orderType : "market";
      $(".exit-mode").value = state.attachBracket ? "bracket" : "none";
      $(".trigger-direction").value = state.triggerDirection;
      $(".limit-price").value = state.limitPrice;
      $(".trigger-price").value = state.triggerPrice;
      $(".duration").value = state.durationSeconds;
      $(".buckets").value = state.bucketCount;
      $(".trail").value = state.trailPercent;
      $(".activation").value = state.activationPrice;
      $(".stop-price").value = state.stopPrice;
      $(".target-price").value = state.targetPrice;
      const triggerOrder = ["stop", "stop-loss", "take-profit"].includes(state.orderType);
      const trailingOrder = ["trailing-stop", "trailing-stop-limit"].includes(state.orderType);
      const standaloneBracket = state.orderType === "bracket";
      const exitOnly = ["stop-loss", "take-profit", "bracket"].includes(state.orderType);
      const bracketAllowed = ["market", "limit", "twap", "dca"].includes(state.orderType);
      $(".limit-field").hidden = state.orderType !== "limit" && !triggerOrder && !(state.orderType === "twap" && positive(state.limitPrice));
      $(".trigger-field").hidden = !triggerOrder;
      $(".trigger-direction-field").hidden = !triggerOrder || ["stop-loss", "take-profit"].includes(state.orderType);
      $(".duration-field").hidden = !["twap", "dca"].includes(state.orderType);
      $(".buckets-field").hidden = !["twap", "dca"].includes(state.orderType);
      $(".trail-field").hidden = !trailingOrder;
      $(".activation-field").hidden = !trailingOrder;
      $(".bracket-toggle").hidden = true;
      $(".attach-bracket").checked = state.attachBracket;
      $(".stop-field").hidden = !standaloneBracket && !(bracketAllowed && state.attachBracket);
      $(".target-field").hidden = !standaloneBracket && !(bracketAllowed && state.attachBracket);
      root.querySelector('[data-side="buy"]').disabled = exitOnly;
      const canPickToken = quoteTokens().length > 1;
      $(".pay-token").innerHTML = chipHtml(payToken(), state.side === "buy" && canPickToken);
      $(".get-token").innerHTML = chipHtml(getToken(), state.side === "sell" && canPickToken);

      const payAmount = parseFloat(state.amount) || 0;
      const payPrice = usdPrice(payToken());
      $(".pay-usd").textContent = payPrice === null ? "" : formatUsd(payAmount * payPrice);

      // Balance of the pay token (click for max)
      const balanceButton = $(".balance");
      balanceButton.hidden = state.balance === null;
      if (state.balance !== null) balanceButton.textContent = `Wallet balance ${formatAmount(unitsToNumber(state.balance, decimalsOf(payToken())))}`;

      // Output
      const out = $(".out");
      const received = state.quote && state.quote.amountOut !== null ? unitsToNumber(state.quote.amountOut, decimalsOf(getToken())) : 0;
      out.classList.toggle("loading", state.quoting);
      out.classList.toggle("empty", !(received > 0));
      out.textContent = received > 0 ? (state.quote.estimated ? "~" : "") + formatAmount(received) : "0";
      out.style.fontSize = out.textContent.length > 9 ? "16px" : "";
      input.style.fontSize = input.value.length > 9 ? "16px" : "";
      const getPrice = usdPrice(getToken());
      $(".get-usd").textContent = getPrice === null ? "" : formatUsd(received * getPrice);

      // Quote details
      const parts = [];
      if (state.attachBracket && quoteTargetToken() !== mainToken()) parts.push(`${escapeHtml(mainToken())} entry is received as ${escapeHtml(quoteTargetToken())} so Flash can protect it`);
      if (state.quote && !state.quote.estimated && received > 0) {
        const rate = state.side === "buy" ? payAmount / received : received / payAmount;
        parts.push(`1 ${escapeHtml(mainToken())} = ${formatAmount(rate)} ${escapeHtml(state.quoteToken)}`);
        if (state.quote.feeUSD) parts.push(`Fee ${formatUsd(parseFloat(state.quote.feeUSD))}`);
        if (state.quote.priceImpact !== null && state.quote.priceImpact !== undefined) {
          const impact = Number(state.quote.priceImpact) * 100;
          parts.push(`<span class="${impact > 2 ? "warn" : ""}">Impact ${impact < 0.01 ? "<0.01" : impact.toFixed(2)}%</span>`);
        }
      } else if (state.quote && state.quote.error) {
        parts.push(`<span class="warn">${escapeHtml(state.quote.error)}${state.quote.estimated ? " · estimate from card price" : ""}</span>`);
      } else {
        parts.push(`1 ${escapeHtml(mainToken())} ≈ ${formatUsd(tickerPrice())}`);
      }
      $(".details").innerHTML = parts.join("<span>·</span>");

      renderSecurity();

      // Main button
      const cta = $(".cta");
      const insufficient = state.balance !== null && amountIn() > state.balance;
      const configError = orderConfigError();
      if (state.busy) {
        cta.disabled = true;
      } else if (state.side === "buy" && state.security && state.security.loading) {
        cta.textContent = "Running safety checks…";
        cta.disabled = true;
      } else if (buyBlocked()) {
        cta.textContent = `${mainToken()} flagged as unsafe`;
        cta.disabled = true;
      } else if (state.integrity && state.integrity.action === "block") {
        cta.textContent = "Contract mismatch — trade blocked";
        cta.disabled = true;
      } else if (!activeAccount) {
        cta.textContent = initialPlan && initialPlan.verified ? "Connect wallet to follow" : "Connect wallet";
        cta.disabled = false;
      } else if (!walletOnChain()) {
        cta.textContent = `Switch to ${chain().name}`;
        cta.disabled = false;
      } else if (!(payAmount > 0)) {
        cta.textContent = "Enter an amount";
        cta.disabled = true;
      } else if (configError) {
        cta.textContent = configError;
        cta.disabled = true;
      } else if (insufficient) {
        cta.textContent = `Not enough ${payToken()}`;
        cta.disabled = true;
      } else {
        cta.textContent = initialPlan && initialPlan.verified ? "Follow strategy" : compiledStrategy ? "Execute compiled strategy" : `${state.orderType === "market" ? "Trade" : "Place"} ${state.orderType.replaceAll("-", " ")} order`;
        cta.disabled = !state.quote || state.quote.amountOut === null || state.quoting || !!state.quote.estimated;
      }
    }

    // Buying a token with a critical verdict is refused. Selling remains possible
    // so a user is never trapped by the safety layer.
    function buyBlocked() {
      return state.side === "buy" && !!state.security && state.security.action === "block";
    }

    function renderSecurity() {
      const row = $(".security");
      const security = state.security;
      const symbol = escapeHtml(mainToken());
      const sourceNames = Object.entries(security && security.sources || {})
        .filter(([, source]) => source && source.available)
        .map(([name]) => name === "goplus" ? "GoPlus" : name === "honeypot" ? "Honeypot" : "Flash")
        .join(" + ");
      row.hidden = !security || !!security.native;
      if (row.hidden) return;
      row.removeAttribute("title");
      if (security.loading) {
        row.className = "security loading";
        row.innerHTML = `${SHIELD_SVG}<span>Running Plan B safety checks for ${symbol}…</span>`;
      } else if (security.error) {
        row.className = "security warn";
        row.title = security.error;
        row.innerHTML = `${SHIELD_SVG}<span><b>Safety check incomplete:</b> execution requires confirmation</span>`;
      } else if (security.action === "info") {
        row.className = "security safe";
        row.innerHTML = `${SHIELD_SVG}<span>No known critical risks for ${symbol}${sourceNames ? ` · ${sourceNames}` : ""}</span>`;
      } else {
        const reasons = security.reasons.length ? security.reasons.map(escapeHtml).join(" · ") : `${security.action === "block" ? "Unsafe" : "Risky"} token`;
        row.className = `security ${security.action}`;
        row.innerHTML = `${SHIELD_SVG}<span><b>Plan B ${security.action === "block" ? "blocked" : "flagged"} ${symbol}:</b> ${reasons}</span>`;
      }
    }

    async function loadSocialProof() {
      const id = tweetId(article);
      if (!id && !author) return;
      try {
        const proof = await plansApi("social", id ? { tweetId: id } : { authorHandle: author });
        const row = $(".social-proof");
        row.hidden = !(proof.followed || proof.hitTarget || proof.stoppedOut || proof.active);
        row.innerHTML = `<b>${Number(proof.followed) || 0} followed</b> · ${Number(proof.hitTarget) || 0} hit target · ${Number(proof.stoppedOut) || 0} stopped out${proof.active ? ` · ${Number(proof.active)} active` : ""}`;
      } catch { /* Social proof is additive; trading remains available if it is offline. */ }
    }

    function checkSecurity() {
      const chainId = state.chainId;
      const token = tokenOn(chainId, mainToken());
      if (!token) {
        state.security = { error: "The selected token contract could not be resolved." };
        render();
        return Promise.resolve(state.security);
      }
      // Native assets have no contract to scan, so use wrapped native when available.
      const scanned = !isSolana(chainId) && isNativeAddress(token.address) ? tokenOn(chainId, "WETH") : token;
      if (!scanned) {
        state.security = { native: true };
        render();
        return Promise.resolve(state.security);
      }
      state.security = { loading: true };
      render();
      securityPromise = tokenRisk(chainId, scanned.address)
        .then((risk) => risk, (error) => ({ error: error.message }))
        .then((security) => {
          if (chainId !== state.chainId) return security;
          state.security = security;
          render();
          return security;
        });
      return securityPromise;
    }

    // Hold a caution/unknown verdict until the user cancels or explicitly continues.
    // Critical verdicts never reach this prompt: they are always blocked.
    function confirmRisk(reasons) {
      return new Promise((resolve, reject) => {
        pendingRisk = { resolve, reject };
        setStatus(`<div class="risk"><b>Plan B safety warning</b><ul>${reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>
          <div class="risk-actions"><button data-risk="cancel">Cancel</button><button data-risk="continue">Continue anyway</button></div></div>`, "error");
      });
    }

    function answerRisk(proceed) {
      const pending = pendingRisk;
      pendingRisk = null;
      if (!pending) return;
      setStatus("");
      if (proceed) pending.resolve();
      else pending.reject(Object.assign(new Error("Cancelled after Plan B's safety warning."), { code: "RISK_CANCELLED" }));
    }

    async function enforceSecurityGate() {
      if (state.side !== "buy") return;
      let security = state.security;
      if (!security || security.loading) security = await (securityPromise || checkSecurity());
      if (security && security.action === "block") {
        throw Object.assign(new Error(`Trade blocked: ${(security.reasons || []).join(" · ") || "critical token risk detected"}`), { code: "SECURITY_BLOCKED" });
      }
      if (!security || security.error) {
        await confirmRisk(["The token security scan could not be completed. Risk status is unknown."]);
      } else if (security.action === "warn") {
        await confirmRisk(security.reasons || ["Elevated token risk indicators were found."]);
      }
    }

    // --- quotes --------------------------------------------------------------
    function estimateQuote() {
      const payPrice = usdPrice(payToken());
      const getPrice = usdPrice(getToken());
      if (payPrice === null || getPrice === null) return null;
      const out = (parseFloat(state.amount) * payPrice) / getPrice;
      const decimals = decimalsOf(getToken());
      return parseUnits(out.toFixed(Math.min(decimals, 12)), decimals);
    }

    function scheduleQuote() {
      clearTimeout(quoteTimer);
      const seq = ++quoteSeq;
      if (!(amountIn() > 0n) || orderConfigError()) {
        state.quote = null;
        state.quoting = false;
        render();
        return;
      }
      state.quoting = true;
      render();
      quoteTimer = setTimeout(async () => {
        try {
          const response = await flashApi("quote", flashQuoteRequest(accountFor(state.chainId) || undefined));
          if (seq !== quoteSeq) return;
          state.quote = {
            amountOut: response.to && positive(response.to.amount) ? parseUnits(response.to.amount, decimalsOf(getToken())) : null,
            priceImpact: response.estimatedPriceImpact,
            feeUSD: response.fees && response.fees.estimatedFeeNotional,
            raw: response,
            estimated: false,
          };
        } catch (error) {
          if (seq !== quoteSeq) return;
          const estimate = estimateQuote();
          state.quote = { amountOut: estimate, estimated: estimate !== null, error: error.message };
        }
        state.quoting = false;
        render();
      }, 400);
    }

    async function refreshBalance() {
      if (!walletOnChain()) {
        state.balance = null;
        render();
        return;
      }
      const chainId = state.chainId;
      const symbol = payToken();
      try {
        let balance;
        if (isSolana(chainId)) {
          const response = await flashApi("balances", { address: wallet.solanaAccount }, "GET");
          const wanted = tokenOn(chainId, symbol).address;
          const rows = (response.balances || []).filter((item) => item.chain === chain().flash && item.address === wanted);
          const row = symbol.toUpperCase() === "SOL" ? rows.find((item) => item.isNative) || rows[0] : rows[0];
          balance = parseUnits(row ? row.balance : "0", decimalsOf(symbol));
        } else {
          balance = await tokenBalance(chainId, symbol);
        }
        if (chainId === state.chainId && symbol === payToken()) state.balance = balance;
      } catch {
        state.balance = null;
      }
      render();
    }

    async function loadPickerBalances(symbols) {
      pickerBalances.clear();
      if (!walletOnChain()) return;
      const chainId = state.chainId;
      const address = accountFor(chainId);
      try {
        // Flash returns the wallet inventory across supported chains. It lets the
        // picker display what the user actually holds, rather than a fake list
        // of hard-coded balance assumptions.
        const response = await flashApi("balances", { address }, "GET");
        const rows = (response.balances || []).filter((row) => row.chain === chain().flash);
        for (const symbol of symbols) {
          const token = tokenOn(chainId, symbol);
          if (!token) continue;
          const row = rows.find((item) => String(item.address || "").toLowerCase() === String(token.address).toLowerCase())
            || (isNativeAddress(token.address) && rows.find((item) => item.isNative));
          if (row && row.balance !== undefined) pickerBalances.set(symbol, parseUnits(String(row.balance), token.decimals));
        }
      } catch {
        // EVM wallets can still read an ERC-20 balance directly if inventory
        // lookup is unavailable for a particular Flash key or network.
        await Promise.allSettled(symbols.slice(0, 16).map(async (symbol) => {
          try { pickerBalances.set(symbol, await tokenBalance(chainId, symbol)); } catch { /* unavailable token remains unlabelled */ }
        }));
      }
    }

    function pickerSubtitle(symbol) {
      const balance = pickerBalances.get(symbol);
      const name = (TOKEN_INFO[symbol] || {}).name || symbol;
      return balance === undefined ? name : `${name} · Wallet ${formatAmount(unitsToNumber(balance, decimalsOf(symbol)))}`;
    }

    // --- actions -------------------------------------------------------------
    // Switching sides keeps the trade the same size: what you'd receive becomes what you pay
    function setSide(side) {
      if (["stop-loss", "take-profit", "bracket"].includes(state.orderType) && side !== "sell") return;
      if (side === state.side) return;
      // A quote still loading belongs to an older amount, so estimate from the card price instead
      const out = !state.quoting && state.quote && state.quote.amountOut !== null ? state.quote.amountOut : (amountIn() > 0n ? estimateQuote() : null);
      const outDecimals = decimalsOf(getToken());
      state.side = side;
      if (["stop", "stop-loss"].includes(state.orderType)) state.triggerDirection = side === "buy" ? "upper" : "lower";
      if (state.orderType === "take-profit") state.triggerDirection = side === "buy" ? "lower" : "upper";
      state.amount = out ? unitsToInput(out, outDecimals) : "";
      input.value = state.amount;
      state.balance = null;
      setStatus("");
      scheduleQuote();
      refreshBalance();
    }

    function setChain(chainId) {
      if (chainId === state.chainId || !availableChains.includes(chainId)) return;
      // Keep the amount only if the token being paid stays the same
      const previousPay = payToken();
      state.chainId = chainId;
      if (!tokenOn(chainId, state.quoteToken) || state.quoteToken === mainToken()) state.quoteToken = quoteTokens()[0];
      if (payToken() !== previousPay) { state.amount = ""; input.value = ""; }
      state.balance = null;
      state.quote = null;
      checkSecurity();
      setStatus("");
      scheduleQuote();
      refreshBalance();
    }

    // When the wallet changes network, follow it if the card's token exists there
    function followWalletChain() {
      if (!state.busy && wallet.chainId && wallet.chainId !== state.chainId && availableChains.includes(wallet.chainId)) setChain(wallet.chainId);
    }

    function closeMenu() {
      dropdown.close();
    }

    async function openTokenMenu(anchor) {
      const known = selectableQuoteTokens();
      await loadPickerBalances(known);
      const toItem = (symbol) => ({ id: symbol, iconHtml: tokenLogoHtml(symbol), title: symbol, subtitle: pickerSubtitle(symbol) });
      dropdown.open({
        anchor,
        themeVars,
        title: "Choose payment / receive asset",
        selected: state.quoteToken,
        items: known.map(toItem),
        search: {
          placeholder: `Search Flash assets on ${chain().name}`,
          onSearch: async (query) => {
            const response = await flashApi("search", { query, chain: chain().flash, limit: 10 }, "GET");
            const matches = (response.assets || []).filter((asset) => asset.address && asset.symbol && Number.isInteger(Number(asset.decimals)));
            const symbols = matches.map(registerSelectableFlashAsset).filter((symbol) => symbol && symbol !== mainToken());
            await loadPickerBalances(symbols);
            return symbols.map((symbol) => ({ id: symbol, iconHtml: tokenLogoHtml(symbol), title: symbol, subtitle: pickerSubtitle(symbol) }));
          },
        },
        onSelect: (symbol) => {
          if (symbol === state.quoteToken) return;
          state.quoteToken = symbol;
          state.balance = null;
          scheduleQuote();
          refreshBalance();
        },
      });
    }

    function openNetworkMenu(anchor) {
      dropdown.open({
        anchor,
        themeVars,
        title: "Network",
        selected: state.chainId,
        items: CHAIN_ORDER.map((chainId) => {
          const available = availableChains.includes(chainId);
          return {
            id: chainId,
            iconHtml: chainLogoHtml(chainId),
            title: CHAINS[chainId].name,
            subtitle: !available ? `${ticker.symbol} not available` : wallet.chainId === chainId ? "Wallet network" : "",
            disabled: !available,
          };
        }),
        onSelect: async (id) => {
          const chainId = id === "solana" ? id : Number(id);
          setChain(chainId);
          try {
            await ensureChain(chainId);
          } catch (error) {
            const rejected = error.code === 4001 || /reject|denied/i.test(error.message);
            if (!rejected) setStatus(escapeHtml(error.message), "error");
          }
          refreshBalance();
        },
      });
    }

    async function sendSetupAction(tx, label, step) {
      const action = { to: tx.to, data: tx.data, value: tx.value || "0" };
      step(`${label} in wallet…`);
      const hash = await sendTransaction(action);
      await waitForReceipt(hash);
      return hash;
    }

    async function freshFlashQuote(step) {
      const funder = accountFor(state.chainId);
      let quote = await flashApi("quote", flashQuoteRequest(funder));
      if (isSolana(state.chainId)) {
        for (const setupTx of quote.setupTxs || []) {
          step("Sign Solana setup…");
          const signedSetupTx = await walletRequest("solana_sign_transaction", [setupTx]);
          step("Confirming Solana setup…");
          await flashApi("setup-transaction", { signedSetupTx });
        }
        if ((quote.setupTxs || []).length) quote = await flashApi("quote", flashQuoteRequest(funder));
        return quote;
      }
      const actions = [];
      if (quote.wrap && quote.wrap.evmTx) actions.push([quote.wrap.evmTx, `Wrap ${payToken()}`]);
      if (quote.evm && quote.evm.approveTx) actions.push([quote.evm.approveTx, `Approve ${payToken()}`]);
      if (quote.attachedBracket && quote.attachedBracket.evm && quote.attachedBracket.evm.approveTx) {
        actions.push([quote.attachedBracket.evm.approveTx, `Approve ${getToken()} for bracket exits`]);
      }
      for (const [tx, label] of actions) await sendSetupAction(tx, label, step);
      if (actions.length) quote = await flashApi("quote", flashQuoteRequest(wallet.account));
      if (quote.setupTxs && quote.setupTxs.length && !(quote.evm && quote.evm.orderTypedData)) {
        throw new Error("Flash returned setup transactions that this wallet cannot sign. Refresh the quote or use an EOA wallet with transaction signing enabled.");
      }
      return quote;
    }

    async function signFlashOrder(quote, step) {
      if (isSolana(state.chainId)) {
        if (!quote.svm || !quote.svm.orderMessage) throw new Error("Flash did not return Solana order signing data");
        step("Sign Flash order…");
        const userSignature = await walletRequest("solana_sign_message", [quote.svm.orderMessage]);
        let sponsoredDelegateTx;
        if (quote.svm.sponsoredDelegateTx) {
          step("Sign sponsored token delegation…");
          sponsoredDelegateTx = await walletRequest("solana_sign_transaction", [quote.svm.sponsoredDelegateTx]);
        }
        return { userSignature, sponsoredDelegateTx };
      }
      if (!quote.evm || !quote.evm.orderTypedData) throw new Error("Flash did not return EVM order signing data");
      let permitSignature;
      if (quote.evm.permitTypedData) {
        step("Sign token permit…");
        permitSignature = await walletRequest("eth_signTypedData_v4", [wallet.account, typedDataPayload(quote.evm.permitTypedData)]);
      }
      step("Sign Flash order…");
      const userSignature = await walletRequest("eth_signTypedData_v4", [wallet.account, typedDataPayload(quote.evm.orderTypedData)]);
      return { userSignature, permitSignature };
    }

    async function executeOrder() {
      const chainId = state.chainId;
      const explorer = CHAINS[chainId];
      const step = (text) => { $(".cta").textContent = text; };

      state.busy = true;
      render();
      try {
        step("Running safety checks…");
        await enforceSecurityGate();
        step("Getting Flash quote…");
        const quote = await freshFlashQuote(step);
        const signatures = await signFlashOrder(quote, step);
        const funder = accountFor(chainId);
        const submit = {
          ...flashQuoteRequest(funder),
          quoteId: quote.quoteId,
          userSignature: signatures.userSignature,
        };
        // These fields shape the quote/setup phase only and are not part of
        // SubmitOrderRequest. The signed quote already binds their result.
        delete submit.durationSeconds;
        delete submit.svmUseNativeSOL;
        if (isSolana(chainId)) {
          submit.svmNonce = quote.svm.nonce;
          submit.svmDeadline = quote.svm.deadline;
          if (signatures.sponsoredDelegateTx) submit.svmSponsoredDelegateTx = signatures.sponsoredDelegateTx;
        } else {
          submit.evmOrderTypedData = quote.evm.orderTypedData;
        }
        if (quote.bridgeQuoteId) submit.bridgeQuoteId = quote.bridgeQuoteId;
        if (quote.evm && quote.evm.permitTypedData) {
          submit.evmPermitTypedData = quote.evm.permitTypedData;
          submit.evmPermitSignature = signatures.permitSignature;
        }
        if (quote.attachedBracket) {
          const bracket = quote.attachedBracket;
          const signingData = isSolana(chainId) ? bracket.svm : bracket.evm;
          if (!signingData || !(signingData.orderMessage || signingData.orderTypedData)) throw new Error("Flash did not return bracket signing data");
          step("Sign bracket exits…");
          const bracketSignature = isSolana(chainId)
            ? await walletRequest("solana_sign_message", [signingData.orderMessage])
            : await walletRequest("eth_signTypedData_v4", [wallet.account, typedDataPayload(signingData.orderTypedData)]);
          submit.attachedBracket = {
            ...submit.attachedBracket,
            userSignature: bracketSignature,
            deadline: bracket.deadline,
            signedMaxFromAmount: bracket.signedMaxFromAmount,
          };
          if (isSolana(chainId)) submit.attachedBracket.svmNonce = bracket.svm.nonce;
          else submit.attachedBracket.salt = bracket.salt;
          if (bracket.evm && bracket.evm.permitTypedData) {
            step("Sign bracket permit…");
            submit.attachedBracket.evmPermitTypedData = bracket.evm.permitTypedData;
            submit.attachedBracket.evmPermitSignature = await walletRequest("eth_signTypedData_v4", [wallet.account, typedDataPayload(bracket.evm.permitTypedData)]);
          }
        }

        step("Submitting order…");
        const placed = await flashApi("order", submit);
        state.orderId = placed.orderId;
        plansApi("create", {
          orderId: placed.orderId,
          signalId: initialPlan && initialPlan.signalId || null,
          strategyVersion: initialPlan && initialPlan.strategyVersion || compiledStrategy && compiledStrategy.version || 1,
          tweetId: tweetId(article),
          authorHandle: author,
          funderAddress: funder,
          token: mainToken(),
          chain: chain().flash,
          planType: `${state.orderType}${state.attachBracket ? "+bracket" : ""}`,
          strategyType: compiledStrategy && compiledStrategy.strategyType || null,
          strategy: compiledStrategy,
          stopLoss: state.attachBracket ? state.stopPrice : null,
          takeProfit: state.attachBracket ? state.targetPrice : null,
          receipt: {
            quotedAt: new Date().toISOString(),
            quoteId: quote.quoteId,
            estimatedPriceImpact: quote.estimatedPriceImpact,
            estimatedFeeNotional: quote.fees && quote.fees.estimatedFeeNotional,
            quotedFromAmount: quote.from && quote.from.amount,
            quotedToAmount: quote.to && quote.to.amount,
          },
        }).then(loadSocialProof, (error) => console.warn("[Plan B] Could not record social plan:", error.message));
        let statusText = "submitted";
        let txLink = "";
        if (state.orderType === "market") {
          step("Waiting for fill…");
          for (let attempt = 0; attempt < 30; attempt++) {
            const detail = await flashApi("order-detail", { orderId: placed.orderId, funderAddress: funder }, "GET");
            const order = detail.order || {};
            statusText = String(order.status || "submitted").replace(/^ORDER_STATUS_/, "").toLowerCase().replaceAll("_", " ");
            const fill = detail.fills && detail.fills.at(-1);
            if (fill && fill.transactionId && explorer.explorer) txLink = ` · <a href="${explorer.explorer}/tx/${fill.transactionId}" target="_blank" rel="noopener">View on ${explorer.explorerName}</a>`;
            if (["ORDER_STATUS_FILLED", "ORDER_STATUS_CANCELLED", "ORDER_STATUS_REJECTED", "ORDER_STATUS_TERMINATED"].includes(order.status)) break;
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
        setStatus(`✓ Flash order ${escapeHtml(statusText)} · <b>${escapeHtml(placed.orderId)}</b>${txLink}`, "ok");
        state.amount = "";
        input.value = "";
        state.quote = null;
      } catch (error) {
        const rejected = error.code === 4001 || /reject|denied/i.test(error.message);
        if (error.code === "RISK_CANCELLED") setStatus(escapeHtml(error.message));
        else setStatus(rejected ? "Cancelled in wallet." : escapeHtml(error.message), rejected ? "" : "error");
      } finally {
        state.busy = false;
        refreshBalance();
        render();
      }
    }

    async function connect() {
      setStatus("Check your wallet to connect…");
      await connectWallet(state.chainId);
      setStatus("");
      if (!isSolana(state.chainId) && availableChains.includes(wallet.chainId)) setChain(wallet.chainId);
      else await ensureChain(state.chainId);
      scheduleQuote(); // re-quote for the connected wallet
      refreshBalance();
    }

    async function onCta() {
      try {
        if (!accountFor(state.chainId)) await connect();
        else if (!walletOnChain()) await ensureChain(state.chainId);
        else await executeOrder();
      } catch (error) {
        const rejected = error.code === 4001 || /reject|denied/i.test(error.message);
        setStatus(rejected ? "Cancelled in wallet." : escapeHtml(error.message), rejected ? "" : "error");
      }
      render();
    }

    // --- events --------------------------------------------------------------
    // Keep X from treating clicks/keys inside the panel as tweet clicks or keyboard shortcuts
    ["click", "mousedown", "mouseup", "pointerdown", "pointerup", "keydown", "keyup", "keypress", "touchstart", "touchend"].forEach((type) =>
      host.addEventListener(type, (event) => event.stopPropagation())
    );

    function toggleMenu(open) {
      if (dropdown.isOpen()) closeMenu();
      else open();
    }

    root.addEventListener("click", (event) => {
      const target = event.target;
      const riskButton = target.closest("[data-risk]");
      if (riskButton) { answerRisk(riskButton.dataset.risk === "continue"); return; }
      if (target.closest("[data-follow-strategy]")) { subscribeToStrategy(); return; }
      if (target.closest(".voice-fill-toggle")) {
        const body = $(".voice-fill-body");
        body.hidden = !body.hidden;
        if (!body.hidden) $(".voice-fill-text").focus();
        return;
      }
      if (target.closest("[data-voice-listen]")) { listenForCardVoice(); return; }
      if (target.closest("[data-voice-apply]")) { applyCardVoice(); return; }
      if (state.busy) return;
      const walletButton = target.closest(".wallet");
      if (walletButton) {
        if (!accountFor(state.chainId)) onCta();
        else toggleMenu(() => openNetworkMenu(walletButton));
        return;
      }
      const sideButton = target.closest(".seg button");
      if (sideButton) { setSide(sideButton.dataset.side); closeMenu(); return; }
      if (target.closest(".flip")) { setSide(state.side === "buy" ? "sell" : "buy"); closeMenu(); return; }
      if (target.closest(".balance") && state.balance !== null) {
        event.preventDefault();
        let max = state.balance;
        if (!isSolana(state.chainId) && isNativeAddress(tokenOn(state.chainId, payToken()).address)) max = max > chain().gasReserveWei ? max - chain().gasReserveWei : 0n;
        state.amount = unitsToInput(max, decimalsOf(payToken()));
        input.value = state.amount;
        scheduleQuote();
        return;
      }
      const chip = target.closest("button.chip");
      if (chip) { event.preventDefault(); toggleMenu(() => openTokenMenu(chip)); return; }
      if (target.closest(".cta")) { onCta(); return; }
    });

    // The trigger lives inside X's <a> card link: stop both the navigation and X's own handlers
    ["mousedown", "mouseup", "pointerdown", "pointerup", "keydown", "keyup", "keypress", "touchstart", "touchend"].forEach((type) =>
      triggerHost.addEventListener(type, (event) => event.stopPropagation())
    );
    triggerHost.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      state.open = !state.open;
      closeMenu();
      render();
      if (state.open) {
        setTimeout(() => input.focus({ preventScroll: true }), 150);
        refreshBalance();
        if (!state.security || state.security.error) checkSecurity();
      }
    });

    input.addEventListener("input", () => {
      // Allow only a positive decimal number, with at most the token's decimals
      let value = input.value.replace(/,/g, ".").replace(/[^\d.]/g, "");
      const dot = value.indexOf(".");
      if (dot !== -1) value = value.slice(0, dot + 1) + value.slice(dot + 1).replace(/\./g, "").slice(0, decimalsOf(payToken()));
      if (value !== input.value) input.value = value;
      state.amount = value;
      setStatus("");
      scheduleQuote();
    });

    root.addEventListener("change", (event) => {
      const target = event.target;
      if (target.matches(".entry-mode")) {
        state.orderType = target.value;
        state.attachBracket = $(".exit-mode").value === "bracket";
      } else if (target.matches(".exit-mode")) {
        state.attachBracket = target.value === "bracket";
      } else if (target.matches(".order-type")) {
        state.orderType = target.value;
        if (["stop-loss", "take-profit", "bracket"].includes(state.orderType) && state.side !== "sell") setSide("sell");
        if (!["market", "limit", "twap", "dca"].includes(state.orderType)) state.attachBracket = false;
        if (["stop", "stop-loss"].includes(state.orderType)) state.triggerDirection = state.side === "buy" ? "upper" : "lower";
        if (state.orderType === "take-profit") state.triggerDirection = state.side === "buy" ? "lower" : "upper";
      } else if (target.matches(".trigger-direction")) {
        state.triggerDirection = target.value;
      } else if (target.matches(".attach-bracket")) {
        state.attachBracket = target.checked;
      } else if (target.matches(".copy-mode")) {
        state.copyMode = target.value;
        if (state.copyMode === "twap") {
          state.orderType = "twap";
          state.durationSeconds = state.durationSeconds || "3600";
          state.bucketCount = state.bucketCount || "12";
        } else if (state.copyMode === "limit") {
          state.orderType = "limit";
          const current = tickerPrice();
          const drift = Math.max(0.1, Number(state.maxDrift) || 3) / 100;
          if (current > 0) state.limitPrice = String(state.side === "buy" ? current * (1 + drift) : current * (1 - drift));
        } else if (compiledStrategy && compiledStrategy.entry && compiledStrategy.entry.orderType) {
          state.orderType = compiledStrategy.entry.orderType;
        }
      } else {
        return;
      }
      setStatus("");
      scheduleQuote();
      render();
    });

    root.addEventListener("input", (event) => {
      const fields = new Map([
        ["limit-price", "limitPrice"], ["trigger-price", "triggerPrice"], ["duration", "durationSeconds"],
        ["buckets", "bucketCount"], ["trail", "trailPercent"], ["activation", "activationPrice"],
        ["stop-price", "stopPrice"], ["target-price", "targetPrice"],
        ["max-drift", "maxDrift"],
      ]);
      const className = [...fields.keys()].find((name) => event.target.classList && event.target.classList.contains(name));
      if (!className) return;
      state[fields.get(className)] = event.target.value.trim();
      if (className === "max-drift" && state.copyMode === "limit") {
        const current = tickerPrice();
        const drift = Math.max(0.1, Number(state.maxDrift) || 3) / 100;
        if (current > 0) state.limitPrice = String(state.side === "buy" ? current * (1 + drift) : current * (1 - drift));
      }
      setStatus("");
      scheduleQuote();
      render();
    });

    if (!quoteTokens().includes(state.quoteToken)) state.quoteToken = quoteTokens()[0];

    host.addEventListener("plan-b:wallet", () => { followWalletChain(); refreshBalance(); render(); });
    checkSecurity(); // verdicts are cached per token (here and in the backend), so cards scrolling by stay cheap
    loadSocialProof();
    loadStrategyRoom();
    socialTimer = setInterval(() => host.isConnected ? loadSocialProof() : clearInterval(socialTimer), 15000);
    // Keep the card-price line current while no quote is shown
    new MutationObserver(() => { if (!state.quote && !state.busy) render(); }).observe(link, { childList: true, characterData: true, subtree: true });
    render();
    return host;
  }

  // ---------------------------------------------------------------------------
  // Finding ticker cards in the timeline (X re-renders tweets, so keep scanning)
  // ---------------------------------------------------------------------------
  function tweetId(article) {
    const link = article.querySelector('a[href*="/status/"] time')?.closest('a[href*="/status/"]');
    const match = link && (link.getAttribute("href") || "").match(/\/status\/(\d+)/);
    return match ? match[1] : null;
  }

  function tweetText(article) {
    return (article.querySelector('[data-testid="tweetText"]')?.innerText || "").trim();
  }

  function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Avoid putting a trading action on ordinary posts. Cashtags and contract
  // addresses are unambiguous; bare symbols must preserve their market casing
  // (ETH/cbBTC) so words such as "link" or "op" do not become false positives.
  function tweetHasTokenMention(text) {
    if (/\$[A-Za-z][A-Za-z0-9]{1,14}\b/.test(text)) return true;
    if (/\b0x[a-fA-F0-9]{40}\b/.test(text)) return true;
    if (/(?:^|\s)[1-9A-HJ-NP-Za-km-z]{32,44}(?=$|\s|[.,;:!?])/.test(text)) return true;

    const symbols = Object.keys(TICKER_TO_TOKENS);
    if (symbols.some((symbol) => new RegExp(`(?:^|[^A-Za-z0-9])${escapeRegex(symbol)}(?=$|[^A-Za-z0-9])`).test(text))) return true;

    const names = [...new Set([
      ...Object.values(TOKEN_INFO).map((token) => token.name),
      "Ethereum", "Bitcoin", "Solana", "Avalanche", "BNB", "Polygon", "Hyperliquid",
    ].filter((name) => name && name.length >= 3))];
    return names.some((name) => new RegExp(`(?:^|[^A-Za-z0-9])${escapeRegex(name)}(?=$|[^A-Za-z0-9])`, "i").test(text));
  }

  function tweetHasTradeIntent(text) {
    // Never offer a mainnet trade action on distribution/test posts even when
    // they contain a valid ticker or contract address.
    if (/\b(?:testnet|faucet|airdrop|giveaway|claim|drip)\b/i.test(text)) return false;

    // Ignore handles, hashtags and URLs when looking for intent. This prevents
    // names such as @faucet_trade or faucet.trade from looking like signals.
    const semantic = text
      .replace(/https?:\/\/\S+/gi, " ")
      .replace(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/gi, " ")
      .replace(/@[A-Za-z0-9_]+|#[A-Za-z0-9_]+/g, " ");

    // A price prediction alone is commentary, not a signal. Require a clear
    // direction that a user could choose to follow: "Buy ETH", "short SOL",
    // "trim BTC", etc. The parser can subsequently decide whether it has
    // enough entry/protection detail to produce a plan.
    return /\b(?:buy|sell|long|short|enter|exit|accumulate|accumulating|trim|close|reduce|ape|aping)\b/i.test(semantic);
  }

  function hasVerifiedCallerCard(text) {
    return /\bplanb:[a-f0-9-]{36}\b/i.test(text);
  }

  function tweetIsTradeCandidate(text) {
    // A signed Plan B card is deliberately allowed even if the visible tweet
    // text is short; its stored, signed strategy is the source of truth.
    return hasVerifiedCallerCard(text) || (tweetHasTokenMention(text) && tweetHasTradeIntent(text));
  }

  // Manual mode is deliberately deterministic. It only carries across the
  // asset (and an explicitly named network), never a direction, size, leverage,
  // entry price, or target inferred from an informational post.
  function manualTickerFromTweet(text) {
    const cashtag = text.match(/\$([A-Za-z][A-Za-z0-9]{1,14})\b/);
    if (cashtag) return cashtag[1].toUpperCase();
    const known = Object.keys(TICKER_TO_TOKENS).find((symbol) =>
      new RegExp(`(?:^|[^A-Za-z0-9])${escapeRegex(symbol)}(?=$|[^A-Za-z0-9])`).test(text)
    );
    if (known) return known;
    const names = { ethereum: "ETH", bitcoin: "BTC", solana: "SOL", avalanche: "AVAX", polygon: "POL", "bnb chain": "BNB", bnb: "BNB", hyperliquid: "HYPE" };
    const name = Object.keys(names).find((value) => new RegExp(`(?:^|[^A-Za-z0-9])${escapeRegex(value)}(?=$|[^A-Za-z0-9])`, "i").test(text));
    return name ? names[name] : null;
  }

  function manualChainFromTweet(text) {
    const hints = ["base", "ethereum", "arbitrum", "optimism", "avalanche", "bsc", "polygon", "solana", "monad", "hyperevm", "ink", "plasma", "robinhood", "arc"];
    const hint = hints.find((value) => new RegExp(`(?:^|[^A-Za-z0-9])${escapeRegex(value)}(?=$|[^A-Za-z0-9])`, "i").test(text));
    return hint && FLASH_TO_CHAIN[hint];
  }

  async function createManualTradeCard(article, text) {
    const requestedTicker = manualTickerFromTweet(text);
    if (!requestedTicker) throw new Error("Choose a token from the Plan B order panel to trade manually.");
    await discoverTicker(requestedTicker);
    const availableChains = chainsForTicker(requestedTicker);
    if (!availableChains.length) throw new Error(`${requestedTicker} is not available through Flash right now.`);
    const hintedChain = manualChainFromTweet(text);
    const chainId = hintedChain && availableChains.includes(hintedChain)
      ? hintedChain
      : availableChains.includes(DEFAULT_CHAIN) ? DEFAULT_CHAIN : availableChains[0];
    const selectedToken = tokenForTicker(requestedTicker, chainId);
    // Read the exact Flash result selected for this chain—not the global symbol
    // cache—so ETH on Base cannot inherit price/liquidity from an unrelated ETH.
    const selectedAsset = tokenOn(chainId, selectedToken);
    const tokenInfo = { ...(TOKEN_INFO[selectedToken] || TOKEN_INFO[requestedTicker] || {}), ...(selectedAsset && selectedAsset.liquidity !== undefined ? selectedAsset : {}) };
    const price = Number(tokenInfo.price) || 0;

    article.querySelector('[data-plan-b-draft]')?.remove();
    const wrap = document.createElement("div");
    wrap.setAttribute("data-plan-b-draft", "");
    wrap.style.cssText = "margin:10px 0 2px;max-width:100%;";
    const card = document.createElement("div");
    card.style.cssText = "display:flex;align-items:center;gap:9px;padding:10px 12px;border:1px solid color-mix(in srgb,currentColor 18%,transparent);border-radius:12px;font:inherit;";
    const icon = tokenInfo.imageUrl && /^https:\/\//.test(tokenInfo.imageUrl)
      ? `<img src="${escapeHtml(tokenInfo.imageUrl)}" alt="" style="width:30px;height:30px;border-radius:50%;object-fit:cover">`
      : `<span style="width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#536471;color:white;font-weight:700">${escapeHtml(selectedToken.slice(0, 1))}</span>`;
    card.innerHTML = `${icon}<span style="display:flex;flex-direction:column;min-width:0"><b class="plan-name">${escapeHtml(tokenInfo.name || selectedToken)}</b><span class="plan-symbol" style="opacity:.65;font-size:13px">${escapeHtml(selectedToken)} · ${escapeHtml(CHAINS[chainId].name)} · Manual review</span></span><span class="plan-price" style="margin-left:auto;font-weight:700">${price ? formatUsd(price) : "Flash asset"}</span>`;
    wrap.appendChild(card);
    const actionBar = article.querySelector('[data-testid="reply"]')?.closest('[role="group"]');
    (actionBar || article.lastElementChild || article).after(wrap);
    try {
      const panel = createPanel(article, card, {
        symbol: requestedTicker,
        name: tokenInfo.name || selectedToken,
        price,
        priceSpan: card.querySelector(".plan-price"),
        iconSrc: tokenInfo.imageUrl || null,
        nameSpan: card.querySelector(".plan-name"),
        symbolSpan: card.querySelector(".plan-symbol"),
      }, { manual: true, asset: { chain: CHAINS[chainId].flash }, draft: { side: "buy", entryType: "market" } });
      wrap.appendChild(panel);
    } catch (error) {
      wrap.remove();
      throw error;
    }
  }

  function createParsedPlanCard(article, result) {
    article.querySelector('[data-plan-b-draft]')?.remove();
    registerFlashAsset(result.asset);
    const symbol = result.asset.symbol;
    TICKER_TO_TOKENS[symbol.toUpperCase()] = [symbol];

    const wrap = document.createElement("div");
    wrap.setAttribute("data-plan-b-draft", "");
    wrap.style.cssText = "margin:10px 0 2px;max-width:100%;";
    const card = document.createElement("div");
    const price = Number(result.asset.price) || 0;
    card.style.cssText = "display:flex;align-items:center;gap:9px;padding:10px 12px;border:1px solid color-mix(in srgb,currentColor 18%,transparent);border-radius:12px;font:inherit;";
    const icon = result.asset.imageUrl && /^https:\/\//.test(result.asset.imageUrl)
      ? `<img src="${escapeHtml(result.asset.imageUrl)}" alt="" style="width:30px;height:30px;border-radius:50%;object-fit:cover">`
      : `<span style="width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#1d9bf0;color:white;font-weight:700">${escapeHtml(symbol.slice(0, 1))}</span>`;
    card.innerHTML = `${icon}<span style="display:flex;flex-direction:column;min-width:0"><b class="plan-name">${escapeHtml(result.asset.name || symbol)}</b><span class="plan-symbol" style="opacity:.65;font-size:13px">${escapeHtml(symbol)} · ${escapeHtml(CHAINS[FLASH_TO_CHAIN[result.asset.chain]]?.name || result.asset.chain)}</span></span><span class="plan-price" style="margin-left:auto;font-weight:700">${price ? formatUsd(price) : "Flash asset"}</span>`;
    wrap.appendChild(card);
    const actionBar = article.querySelector('[data-testid="reply"]')?.closest('[role="group"]');
    (actionBar || article.lastElementChild || article).after(wrap);
    const ticker = {
      symbol: symbol.toUpperCase(),
      name: result.asset.name || symbol,
      price,
      priceSpan: card.querySelector(".plan-price"),
      iconSrc: result.asset.imageUrl || null,
      nameSpan: card.querySelector(".plan-name"),
      symbolSpan: card.querySelector(".plan-symbol"),
    };
    try {
      const panel = createPanel(article, card, ticker, {
        ...result,
        context: { tweetId: tweetId(article), authorHandle: tweetAuthor(article) },
      });
      wrap.appendChild(panel);
    } catch (error) {
      wrap.remove();
      throw error;
    }
    return wrap;
  }

  function attachPlanButton(article) {
    const text = tweetText(article);
    const actionBar = article.querySelector('[data-testid="reply"]')?.closest('[role="group"]');
    const existing = actionBar && actionBar.querySelector('[data-plan-b-make-plan]');
    if (!text || !tweetIsTradeCandidate(text)) { existing?.remove(); return; }
    if (!actionBar || existing) return;

    const host = document.createElement("span");
    host.setAttribute("data-plan-b-make-plan", "");
    host.style.cssText = "display:inline-flex;align-items:center;flex:0 0 auto;margin-left:8px;";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>
      :host{all:initial}.make{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 15px;border:1px solid rgb(245,197,66);border-radius:999px;background:rgb(245,197,66);color:#1c1503;box-shadow:0 4px 14px rgba(245,197,66,.24);font:750 13px system-ui,-apple-system,sans-serif;letter-spacing:-.01em;white-space:nowrap;cursor:pointer;transition:transform .15s ease,filter .15s ease,box-shadow .15s ease}.make:hover{filter:brightness(1.08);transform:translateY(-1px);box-shadow:0 6px 18px rgba(245,197,66,.32)}.make:active{transform:translateY(0)}.make:disabled{opacity:.72;cursor:wait;transform:none}.mark{width:16px;height:16px;display:grid;place-items:center;border-radius:5px;background:#1c1503;color:rgb(245,197,66);font:900 11px/1 system-ui}
    </style><button class="make" type="button" title="Parse this signal into an editable plan. Nothing is submitted yet."><span class="mark">↗</span><span>${hasVerifiedCallerCard(text) ? "Follow strategy" : "Parse trade"}</span></button>`;
    const button = root.querySelector("button");
    host.addEventListener("click", (event) => event.stopPropagation());
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled) return;
      button.disabled = true;
      button.lastElementChild.textContent = "Parsing signal…";
      try {
        const result = await parsePlanApi(text);
        if (result.verified && result.signalId) {
          try {
            const attached = await signalApi(`/signals/${encodeURIComponent(result.signalId)}/source`, {
              context: { tweetId: tweetId(article), authorHandle: tweetAuthor(article), text },
            }, "POST");
            result.passport = attached.passport || result.passport;
          } catch { /* A source link is evidence metadata, never a trade prerequisite. */ }
        }
        if (!result.verified) {
          // Evidence capture is best-effort; a temporary ledger outage never
          // prevents a user from reviewing a validated Flash strategy.
          try {
            const captured = await signalApi("/signals/capture", {
              plan: result.draft,
              context: { tweetId: tweetId(article), authorHandle: tweetAuthor(article), text },
            }, "POST");
            result.signalId = captured.signal && captured.signal.id;
            result.passport = captured.passport || captured.signal && captured.signal.passport;
          } catch { /* Trade review remains available without persistence. */ }
        }
        await discoverTicker(result.asset.symbol);
        createParsedPlanCard(article, result);
        button.lastElementChild.textContent = "Ready to review";
      } catch (error) {
        if (error.status === 422 && error.manualEligible) {
          // A contextual post still deserves a useful next step. Open manual
          // mode on this same click, with no model-inferred order parameters.
          button.lastElementChild.textContent = "Opening manual trade…";
          try {
            await createManualTradeCard(article, text);
            button.lastElementChild.textContent = "Manual trade ready";
            button.title = "Manual trade: this post was context, not an executable signal.";
            button.disabled = false;
            return;
          } catch (manualError) {
            button.lastElementChild.textContent = "Manual trade unavailable";
            button.title = manualError.message || "Plan B could not open this trade.";
          }
        } else {
          button.lastElementChild.textContent = "Could not analyze";
          button.title = error.message || "Plan B could not open this trade.";
        }
        setTimeout(() => {
          button.disabled = false;
          button.lastElementChild.textContent = hasVerifiedCallerCard(text) ? "Follow strategy" : "Parse trade";
        }, 3500);
        return;
      }
      button.disabled = false;
    });
    actionBar.appendChild(host);
  }

  function ensureOrderDashboard() {
    if (document.querySelector('[data-plan-b-orders]')) return;
    const host = document.createElement("div");
    host.setAttribute("data-plan-b-orders", "");
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>
      :host{all:initial;font-family:system-ui;color:#fff9e8}.launcher{position:fixed;z-index:2147483645;border:0;border-radius:999px;font:700 13px system-ui;box-shadow:0 10px 35px #0008;cursor:pointer;right:22px;bottom:22px;background:#f5c542;color:#1c1503;padding:11px 16px}.drawer{position:fixed;right:18px;bottom:72px;z-index:2147483646;width:min(390px,calc(100vw - 24px));max-height:min(680px,calc(100vh - 100px));display:none;flex-direction:column;background:#0d0b07;border:1px solid #413713;border-radius:18px;box-shadow:0 24px 70px #000b;overflow:hidden}.drawer.open{display:flex}.head{display:flex;align-items:center;justify-content:space-between;padding:16px;border-bottom:1px solid #292513}.head b{font-size:17px}.close{border:0;background:none;color:#aaa28d;font-size:22px;cursor:pointer}.tabs{display:grid;grid-template-columns:repeat(3,1fr);padding:8px;border-bottom:1px solid #292513}.tab{border:0;background:none;color:#aaa28d;padding:9px;font:700 12px system-ui;cursor:pointer;border-radius:9px}.tab.on{background:#2b250b;color:#f5c542}.list{overflow:auto;padding:10px;display:flex;flex-direction:column;gap:8px}.empty{padding:30px 18px;text-align:center;color:#aaa28d;font-size:13px}.row{border:1px solid #292513;border-radius:12px;padding:12px;display:grid;gap:8px}.top{display:flex;justify-content:space-between;gap:10px}.token{font-weight:800}.state{font-size:11px;text-transform:uppercase;color:#f5c542}.meta{color:#aaa28d;font-size:12px}.actions{display:flex;gap:7px;flex-wrap:wrap}.actions button,.actions a{border:1px solid #51461d;background:none;color:#fff9e8;border-radius:999px;padding:7px 10px;font:700 11px system-ui;text-decoration:none;cursor:pointer}.actions .danger{border-color:#713b3b;color:#ff8d8d}.actions .share{border-color:#80681a;color:#f5c542}.notice{padding:10px 16px;color:#aaa28d;font-size:12px;border-top:1px solid #292513}.error{color:#ff8d8d}
    </style><button class="launcher">Plan B orders</button><section class="drawer" aria-label="Plan B orders"><div class="head"><b>Your plans</b><button class="close" aria-label="Close">×</button></div><div class="tabs"><button class="tab on" data-tab="open">Open</button><button class="tab" data-tab="filled">Filled</button><button class="tab" data-tab="cancelled">Cancelled</button></div><div class="list"></div><div class="notice">Connect a wallet in a Plan B card to load its orders.</div></section>`;
    document.body.appendChild(host);
    const drawer = root.querySelector(".drawer");
    const list = root.querySelector(".list");
    const notice = root.querySelector(".notice");
    let activeTab = "open";
    let rows = [];

    const stateGroup = (plan) => {
      if (["cancelled", "failed"].includes(plan.state)) return "cancelled";
      if (["hit_target", "stopped_out"].includes(plan.state)) return "filled";
      return "open";
    };
    const stateLabel = (state) => ({ waiting: "Waiting", filled: "Entry filled", hit_target: "Hit target", stopped_out: "Stopped out", cancelled: "Cancelled", failed: "Failed" }[state] || state);
    const renderRows = () => {
      root.querySelectorAll(".tab").forEach((button) => button.classList.toggle("on", button.dataset.tab === activeTab));
      const visible = rows.filter((plan) => stateGroup(plan) === activeTab);
      list.innerHTML = visible.length ? visible.map((plan) => {
        const resolved = ["hit_target", "stopped_out"].includes(plan.state);
        const shareText = `${plan.token} plan ${plan.state === "hit_target" ? "hit its target" : "was stopped out"} via Plan B. Order ${plan.orderId}`;
        const canReviseLimit = /^limit(?:\+bracket)?$/.test(plan.planType || "");
        const canReviseProtection = Boolean(plan.bracketOrderId);
        const receipt = plan.receipt && (plan.receipt.estimatedPriceImpact !== null || plan.receipt.estimatedFeeNotional !== null)
          ? `<div class="meta">Flash quote · ${plan.receipt.estimatedPriceImpact !== null ? `${(Number(plan.receipt.estimatedPriceImpact) * 100).toFixed(2)}% impact` : "impact unavailable"}${plan.receipt.estimatedFeeNotional !== null ? ` · ~$${Number(plan.receipt.estimatedFeeNotional).toFixed(2)} fees` : ""}</div>` : "";
        return `<article class="row" data-id="${escapeHtml(plan.orderId)}"><div class="top"><span class="token">${escapeHtml(plan.token)} · ${escapeHtml(plan.planType)}</span><span class="state">${escapeHtml(stateLabel(plan.state))}</span></div><div class="meta">${escapeHtml(plan.chain)} · ${new Date(plan.createdAt).toLocaleString()}</div>${receipt}<div class="actions">${activeTab === "open" ? `${canReviseLimit ? '<button data-revise="limit">Revise limit</button>' : ""}${canReviseProtection ? '<button data-revise="protection">Revise stop / target</button>' : ""}<button class="danger" data-cancel="entry">Cancel entry</button>${plan.bracketOrderId ? '<button class="danger" data-cancel="both">Cancel entry + protection</button>' : ""}` : ""}${resolved ? `<a class="share" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}">Share receipt on X ↗</a>` : ""}</div></article>`;
      }).join("") : `<div class="empty">No ${activeTab} plans for this wallet.</div>`;
    };
    const load = async () => {
      const funderAddress = wallet.account || wallet.solanaAccount;
      if (!funderAddress) { rows = []; notice.textContent = "Connect a wallet in a Plan B card to load its orders."; renderRows(); return; }
      try {
        const response = await plansApi("list", { funderAddress });
        rows = response.plans || [];
        notice.textContent = "Live states are supplied by Definitive Flash.";
        renderRows();
      } catch (error) {
        notice.textContent = error.message;
        notice.classList.add("error");
      }
    };
    const signCancel = async (orderId, chain) => {
      const message = `Definitive Flash v1 — Cancel Order\nOrder: ${orderId}`;
      const userSignature = chain === "solana"
        ? await walletRequest("solana_sign_message", [message])
        : await walletRequest("personal_sign", [utf8ToHex(message), wallet.account]);
      await flashApi("cancel-order", { orderId, cancelMessage: message, userSignature });
    };
    const reviseLimit = async (plan) => {
      const price = window.prompt("New limit notional price", "");
      if (!price || !(Number(price) > 0)) return;
      const issuedAt = new Date().toISOString();
      const message = `Definitive Flash — Update Order\nOrder: ${plan.orderId}\nIssued At: ${issuedAt}\nLimit Notional Price: ${price}`;
      const isSvm = plan.chain === "solana";
      const userSignature = isSvm
        ? await walletRequest("solana_sign_message", [message])
        : await walletRequest("personal_sign", [utf8ToHex(message), wallet.account]);
      await flashApi("update-order", { orderId: plan.orderId, limitNotionalPrice: price, updateMessage: message, userSignature });
    };
    const reviseProtection = async (plan) => {
      const stop = window.prompt("New stop-loss notional price", plan.stopLoss || "");
      if (!stop || !(Number(stop) > 0)) return;
      const target = window.prompt("New take-profit notional price", plan.takeProfit || "");
      if (!target || !(Number(target) > 0)) return;
      const issuedAt = new Date().toISOString();
      const message = `Definitive Flash — Update Order\nOrder: ${plan.bracketOrderId}\nIssued At: ${issuedAt}\nTrigger Lower Notional Price: ${stop}\nTrigger Upper Notional Price: ${target}`;
      const isSvm = plan.chain === "solana";
      const userSignature = isSvm
        ? await walletRequest("solana_sign_message", [message])
        : await walletRequest("personal_sign", [utf8ToHex(message), wallet.account]);
      await flashApi("update-order", {
        orderId: plan.bracketOrderId,
        triggers: [
          { notionalPrice: stop, triggerType: "lower" },
          { notionalPrice: target, triggerType: "upper" },
        ],
        updateMessage: message,
        userSignature,
      });
    };
    root.querySelector(".launcher").addEventListener("click", () => { drawer.classList.toggle("open"); if (drawer.classList.contains("open")) load(); });
    root.querySelector(".close").addEventListener("click", () => drawer.classList.remove("open"));
    root.querySelector(".tabs").addEventListener("click", (event) => { const tab = event.target.closest("[data-tab]"); if (tab) { activeTab = tab.dataset.tab; renderRows(); } });
    list.addEventListener("click", async (event) => {
      const revision = event.target.closest("[data-revise]");
      if (revision) {
        const plan = rows.find((row) => row.orderId === revision.closest("[data-id]").dataset.id);
        if (!plan) return;
        revision.disabled = true; revision.textContent = "Check wallet…";
        const isProtection = revision.dataset.revise === "protection";
        try {
          await (isProtection ? reviseProtection(plan) : reviseLimit(plan));
          notice.textContent = `Flash ${isProtection ? "protection" : "limit"} update submitted. Flash keeps the same order ID via cancel-and-replace.`;
          await load();
        }
        catch (error) { revision.textContent = /reject|denied/i.test(error.message) ? "Cancelled in wallet" : isProtection ? "Revise stop / target" : "Revise limit"; notice.textContent = error.message; }
        return;
      }
      const button = event.target.closest("[data-cancel]");
      if (!button) return;
      const plan = rows.find((row) => row.orderId === button.closest("[data-id]").dataset.id);
      if (!plan) return;
      button.disabled = true;
      button.textContent = "Check wallet…";
      try {
        const orderIds = button.dataset.cancel === "both" && plan.bracketOrderId
          ? [plan.orderId, plan.bracketOrderId]
          : [plan.orderId];
        const failures = [];
        for (const orderId of orderIds) {
          try { await signCancel(orderId, plan.chain); }
          catch (error) { failures.push(error); }
        }
        if (failures.length === orderIds.length) throw failures[0];
        if (failures.length) notice.textContent = "One order was already closed; the other cancellation was submitted.";
        await load();
      } catch (error) {
        button.textContent = /reject|denied/i.test(error.message) ? "Cancelled in wallet" : error.message;
        button.disabled = false;
      }
    });
    setInterval(() => drawer.classList.contains("open") && load(), 5000);
  }

  async function attachToCard(article, list) {
    // The card container is the element wrapping X's ScrollSnap carousel <nav>
    const nav = list.closest("nav");
    const container = nav && nav.parentElement;
    if (!container) return;
    const existing = container.nextElementSibling;
    if (existing && existing.hasAttribute(HOST_ATTR)) {
      if (existing.ensureTrigger) existing.ensureTrigger(); // X may re-render the card's contents
      return;
    }

    if (container.dataset.planBResolving === "true") return;
    container.dataset.planBResolving = "true";
    try { for (const link of list.querySelectorAll('a[role="link"]')) {
      const ticker = parseTickerLink(link);
      if (!ticker) continue;
      ticker.symbol = ticker.symbol.toUpperCase();
      try { await discoverTicker(ticker.symbol); } catch (error) { console.warn("[Plan B] Flash asset search failed:", error.message); }
      if (!chainsForTicker(ticker.symbol).length) continue;

      const host = createPanel(article, link, ticker);
      container.after(host);

      const align = () => {
        const containerRect = container.getBoundingClientRect();
        const linkRect = link.getBoundingClientRect();
        host.style.width = `${linkRect.width}px`;
        host.style.marginLeft = `${linkRect.left - containerRect.left}px`;
      };
      align();
      new ResizeObserver(align).observe(link);
      return; // One panel per card, for the first supported ticker
    }} finally { delete container.dataset.planBResolving; }
  }

  function scan() {
    ensureOrderDashboard();
    document.querySelectorAll('article[data-testid="tweet"]').forEach((article) => {
      attachPlanButton(article);
      article.querySelectorAll('[data-testid="ScrollSnap-List"]').forEach((list) => attachToCard(article, list));
    });
  }

  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; scan(); });
  }).observe(document.body, { childList: true, subtree: true });
  scan();
})();
