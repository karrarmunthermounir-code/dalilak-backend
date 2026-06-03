# ZainCash V2 Integration (OAuth2)

تكامل دليلك مع بوابة ZainCash الإصدار الثاني — يعتمد OAuth2 client_credentials
بدلاً من HS256 JWT signing الذي كان مستخدماً في V1.

## High-level flow

1. الفرونتند يرسل `POST /api/payment/zaincash/init` بـ `{ planId, name, phone, email }`.
2. Backend يحصل على OAuth2 access token (مخزّن في الذاكرة، يتجدد تلقائياً).
3. Backend يستدعي `POST /api/v2/payment-gateway/transaction/init` بـ Bearer auth.
4. ZainCash يُرجع `redirectUrl` (أو `transactionId` لبناء URL يدوياً) — يُمرَّر للفرونتند.
5. المستخدم يدفع في صفحة ZainCash.
6. ZainCash يحوّل المستخدم لـ `successUrl` / `failureUrl` / `cancelUrl` التي يوفرها backend.
7. Backend في `/api/payment/callback` يستدعي **Inquiry API** للتحقق من الدفع
   (لا يثق بـ `status` من query فقط — JWT يمكن تزويره).
8. لو الحالة `COMPLETED` / `SUCCESS` / `PAID` / `SUCCESSFUL` → ينقل لـ `paidOrders`.
9. الفرونتند يستدعي `/api/auth/activate` بـ `{ planId, planName, orderId }`،
   و `authController` يستهلك `orderId` عبر `paymentRouter.consumePaidOrder()`.

## Endpoints

### `POST /api/payment/zaincash/init`
Request:
```json
{
  "planId": "monthly_pro",
  "name": "...",
  "phone": "9647xxxxxxxxx",
  "email": "..."
}
```
Response (success):
```json
{ "success": true, "payUrl": "https://...", "orderId": "ORD_..." }
```
Errors:
- `503` — ZainCash غير مهيأ (env vars ناقصة أو `ZAINCASH_MODE !== production`)
- `400` — خطة غير صحيحة، أو رقم هاتف بصيغة خاطئة
- `500` — فشل في OAuth2 أو فشل في init من ZainCash

### `GET/POST /api/payment/callback`
يستقبل redirect من ZainCash. Query params: `status`, `orderId` (+ ربما `token`).
يتحقق من Inquiry API، ثم يحوّل لـ `/payment/success` أو `/payment/failed` في الفرونتند.

أسباب الفشل الممكنة في `?reason=`:
- `no_order_id` — orderId ناقص في الـ callback
- `unknown_order` — لا يوجد order مطابق في `pendingOrders`
- `no_tx_id` — لم نخزن transactionId من init
- `inquiry_error` — فشل HTTP لـ Inquiry API
- `<TX_STATUS>` — أي حالة من ZainCash غير `COMPLETED`/`SUCCESS`/`PAID`/`SUCCESSFUL`

### `GET /api/payment/zaincash/status`
تشخيصي — يُرجع حالة التكوين + اختبار OAuth2 حي.

مثال على response:
```json
{
  "version": "v2",
  "mode": "production",
  "envMode": "production",
  "hasMerchantId": true,
  "hasApiKey": true,
  "hasMsisdn": true,
  "missing": [],
  "merchantId": { "length": 32, "preview": "abcd...wxyz" },
  "msisdn":     { "length": 13, "preview": "9647...1234", "formatValid": true },
  "apiKey":     { "length": 32 },
  "apiUrl": "https://pg-api.zaincash.iq",
  "callbackBase": "https://dalilak-api.onrender.com/api/payment/callback",
  "pendingOrders": 0,
  "paidOrders": 0,
  "oauth": { "hasToken": true, "lastRefreshAt": "...", "expiresInSec": 3540 },
  "oauthCheck": "success"
}
```

## Env vars (Render)

| المتغير | الوصف |
|---|---|
| `ZAINCASH_MODE` | يجب أن يساوي `production` لتفعيل التكامل |
| `ZAINCASH_API_URL` | `https://pg-api.zaincash.iq` (base URL فقط) |
| `ZAINCASH_MERCHANT_ID` | client_id (32 حرف) |
| `ZAINCASH_API_KEY` | client_secret (32 حرف) |
| `ZAINCASH_MSISDN` | `9647xxxxxxxxx` — للتشخيص فقط، لا يُرسل في V2 |
| `ZAINCASH_SERVICE` | اختياري — البادئة لـ `serviceType` (افتراضي: `دليلك - اشتراك`) |
| `ZAINCASH_SCOPE` | اختياري — افتراضي: `payment:read payment:write reverse:write` |
| `BACKEND_URL` | يُستخدم لبناء callback URLs |
| `FRONTEND_URL` | يُستخدم في redirects النهائية |

## Error handling

كل استدعاء HTTP يطبع `status` + `body` في الـ logs مع prefix `[ZC-V2]`.
أخطاء شائعة:
- `OAuth2 token failed (401)` → تحقق من `ZAINCASH_MERCHANT_ID` / `ZAINCASH_API_KEY`.
- `Init failed (400)` → تحقق من تنسيق `phone` (`9647xxxxxxxxx`) و `amount`.
- `Inquiry failed (404)` → `transactionId` خاطئ أو منتهي الصلاحية.

## Architecture notes

- **No JWKs verification**: نعتمد Inquiry API كمصدر وحيد للحقيقة.
  أبسط، أكثر أماناً، ولا يحتاج JWKs URL.
- **Token caching**: `TokenManager` يحتفظ بـ token حتى 60 ثانية قبل الانتهاء.
- **Concurrent refresh**: `_inflight` promise يمنع race conditions عند طلبات متزامنة.
- **No `req.user` in init**: نفس الـ flow القديم — guest يدفع، ثم يفعّل اشتراكه لاحقاً
  عبر `/api/auth/activate` التي تستهلك `orderId`.
- **Backward-compat API surface**: `paymentRouter.consumePaidOrder()`, `getMode()`,
  `getPendingCount()`, `PLANS` — كلها بقيت بنفس التوقيع لـ `authController.js`
  و `routes/index.js`.

## Migration from V1

ما تغيّر:
| العنصر | V1 | V2 |
|---|---|---|
| Auth | HS256 JWT يوقّعه backend | OAuth2 Bearer token من ZainCash |
| Init URL | `/transaction/init` (form-urlencoded) | `/api/v2/payment-gateway/transaction/init` (JSON) |
| Pay URL | يُبنى يدوياً `?id=...` | يأتي في response كـ `redirectUrl` |
| Callback verify | `jwt.verify(token, SECRET_KEY)` (HS256) | استدعاء Inquiry API |
| `phone` field | غير مُستخدم | `customer.phone` المستخدم |
| `msisdn` التاجر | يُرسل في payload | للتشخيص فقط |
| `jsonwebtoken` dep | مطلوب | غير مطلوب لـ ZainCash (لا يزال مستخدم في auth) |

ما لم يتغيّر:
- Frontend API contract (`{ planId, name, phone, email }` → `{ success, payUrl, orderId }`)
- `consumePaidOrder()` signature
- `pendingOrders` / `paidOrders` flow
- Health endpoint hooks (`getMode`, `getPendingCount`)
