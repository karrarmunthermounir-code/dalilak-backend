// ════════════════════════════════════════════════════════════════
// ZainCash V2 Service Layer (OAuth2 + Transaction APIs)
// ────────────────────────────────────────────────────────────────
// منعزل عن Express — يحتوي على:
//   • TokenManager: OAuth2 client_credentials مع caching + refresh تلقائي
//   • initTransaction(): POST /api/v2/payment-gateway/transaction/init
//   • inquireTransaction(): GET /api/v2/payment-gateway/transaction/:id
// ════════════════════════════════════════════════════════════════

function cleanEnv(v) {
  if (v == null) return '';
  let s = String(v).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s.replace(/\s+/g, '');
}

const API_URL = (cleanEnv(process.env.ZAINCASH_API_URL) || 'https://pg-api.zaincash.iq')
  .replace(/\/+$/, '');

const ZC = {
  MERCHANT_ID: cleanEnv(process.env.ZAINCASH_MERCHANT_ID),
  SECRET_KEY:  cleanEnv(process.env.ZAINCASH_API_KEY),
  SCOPE:       (process.env.ZAINCASH_SCOPE || 'payment:read payment:write reverse:write').trim(),
};

// ─── OAuth2 Token Manager ───
class TokenManager {
  constructor() {
    this.token = null;
    this.expiresAt = 0;
    this.lastRefreshAt = 0;
    this._inflight = null; // promise — coalesces concurrent refresh
  }

  async getToken() {
    // returned cached if valid (60s safety margin)
    if (this.token && Date.now() < this.expiresAt - 60_000) {
      return this.token;
    }
    // coalesce concurrent calls into a single refresh
    if (this._inflight) return this._inflight;
    this._inflight = this._refresh().finally(() => { this._inflight = null; });
    return this._inflight;
  }

  async _refresh() {
    const url = `${API_URL}/oauth2/token`;
    const body = new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     ZC.MERCHANT_ID,
      client_secret: ZC.SECRET_KEY,
      scope:         ZC.SCOPE,
    });

    console.log(`[ZC-V2] OAuth2 refresh → ${url} scope="${ZC.SCOPE}"`);
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const text = await res.text();
    if (!res.ok) {
      console.error(`[ZC-V2] OAuth2 failed status=${res.status} body=${text.slice(0, 500)}`);
      throw new Error(`OAuth2 token failed (${res.status}): ${text.slice(0, 300)}`);
    }

    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error(`OAuth2 returned non-JSON: ${text.slice(0, 200)}`); }

    if (!data.access_token) {
      throw new Error(`OAuth2 missing access_token in response: ${JSON.stringify(data).slice(0, 200)}`);
    }

    this.token = data.access_token;
    this.expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    this.lastRefreshAt = Date.now();
    console.log(`[ZC-V2] ✅ OAuth2 refreshed, expires_in=${data.expires_in}s`);
    return this.token;
  }

  diag() {
    return {
      hasToken:      !!this.token,
      lastRefreshAt: this.lastRefreshAt ? new Date(this.lastRefreshAt).toISOString() : null,
      expiresInSec:  this.token ? Math.max(0, Math.floor((this.expiresAt - Date.now()) / 1000)) : 0,
    };
  }
}

const tokenManager = new TokenManager();

// ─── Transaction Init ───
async function initTransaction({
  orderId, externalReferenceId, amount, serviceType, customerPhone,
  language = 'ar', successUrl, failureUrl, cancelUrl,
}) {
  const token = await tokenManager.getToken();
  const url = `${API_URL}/api/v2/payment-gateway/transaction/init`;

  const body = {
    language,
    externalReferenceId,
    orderId,
    serviceType,
    amount:   { value: String(amount), currency: 'IQD' },
    customer: { phone: customerPhone },
    successUrl,
    failureUrl,
    cancelUrl,
  };

  console.log(`[ZC-V2] init → ${url} order=${orderId} amount=${amount} phone=${customerPhone}`);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`[ZC-V2] init failed status=${res.status} body=${text.slice(0, 500)}`);
    throw new Error(`Init failed (${res.status}): ${text.slice(0, 300)}`);
  }

  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error(`Init returned non-JSON: ${text.slice(0, 200)}`); }

  console.log(`[ZC-V2] init ok response=${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

// ─── Transaction Inquiry ───
async function inquireTransaction(transactionId) {
  const token = await tokenManager.getToken();
  const url = `${API_URL}/api/v2/payment-gateway/transaction/${encodeURIComponent(transactionId)}`;

  console.log(`[ZC-V2] inquiry → ${url}`);
  const res = await fetch(url, {
    method:  'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`[ZC-V2] inquiry failed status=${res.status} body=${text.slice(0, 500)}`);
    throw new Error(`Inquiry failed (${res.status}): ${text.slice(0, 300)}`);
  }

  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error(`Inquiry returned non-JSON: ${text.slice(0, 200)}`); }

  console.log(`[ZC-V2] inquiry ok status=${data.status || data.state || 'unknown'}`);
  return data;
}

module.exports = { tokenManager, initTransaction, inquireTransaction, API_URL };
