# 📧 Resilient Email Delivery Service (Node.js + TypeScript)

This project implements a robust email delivery microservice that uses **circuit breakers**, **fallback providers**, **rate limiting**, and **idempotency** to ensure high reliability and fault tolerance.

> ⚠️ Logging, persistent queue system, and unit tests were not implemented due to time constraints but are documented as future improvements.

---

## 🚀 Features

- ✅ Primary and fallback email provider support (Mock Providers)
- ✅ Circuit breaker for each provider
- ✅ Retry mechanism with exponential backoff
- ✅ Rate limiting (basic in-memory)
- ✅ Idempotency via requestId
- ❌ (Not Implemented) Logging system
- ❌ (Not Implemented) Queue system
- ❌ (Not Implemented) Unit tests

---

## 🛠 Tech Stack

- **Node.js** with **TypeScript**
- **Express.js** for API layer
- Custom implementations of:
  - Circuit Breaker
  - Rate Limiter
  - Retry Handler
  - Idempotency Checker

---

## 🧠 Circuit Breaker Logic

Each provider (SendGrid & Mailgun) is protected by an independent circuit breaker:

- 🔄 **Failure Threshold**: 3
- ⏱ **Monitoring Window**: 60 seconds
- 💤 **Recovery Timeout**: 30 seconds

### 🔌 Flow:

1. Each failed send attempt is recorded.
2. After 3 failures in a 60s window → **circuit opens**.
3. When open, provider is **skipped for 30s**.
4. After 30s → **half-open**, one test request is allowed.
5. If it succeeds → breaker closes. If it fails → stays open.

This ensures we **fail fast** and avoid overwhelming external providers.

---

## 📨 Email Sending Logic

1. Validates the email request (to, subject, body, requestId)
2. Checks idempotency: If already sent → rejects immediately.
3. Checks rate limiting: If exceeded → rejects.
4. Tries **SendGrid** (primary):
   - Up to 3 retries with exponential backoff (1s, 2s, 4s)
   - If fails, logs failure in circuit breaker
5. If SendGrid fails or is unavailable:
   - Tries **Mailgun** (fallback), with same retry/backoff logic
6. Final response contains success/failure status and metadata.

---

## 🧪 API Endpoints

### `POST /send-email`

Send an email with retry + fallback logic.

#### Request Body:
```json
{
  "to": "user@example.com",
  "subject": "Welcome!",
  "body": "Thanks for signing up!",
  "requestId": "abc123"
}
```

#### Response (Success):
```json
{
  "success": true,
  "providerUsed": "SendGrid",
  "attempts": 2,
  "timestamp": 1717765112485,
  "requestId": "abc123"
}
```

---

### `GET /health`

Health check of service and circuit breakers.

#### Response:
```json
{
  "status": "OK",
  "service": { ... },
  "rateLimit": { ... },
  "availableProviders": ["SendGrid"]
}
```

---

### `GET /circuit-breakers`

Get the internal state of circuit breakers.

---

### `POST /admin/reset-circuit-breakers`

Reset all circuit breakers manually (for recovery/debugging).

---

### `GET /providers/status`

Returns status of all providers + circuit breaker states.

---

## 🚧 Limitations

- ❌ No persistent queue system implemented
- ❌ No logging (console only)
- ❌ No unit or integration tests
- ❌ In-memory rate limiter and idempotency (non-scalable)

---

## 🧱 Project Structure

```
src/
│
├── index.ts                   # Entry point (Express server)
├── models/
│   ├── EmailRequest.ts
│   └── EmailStatus.ts
│
├── services/
│   └── EmailService.ts        # Core email sending logic
│
├── providers/
│   ├── SendGridProvider.ts
│   └── MailGunProvider.ts
│
├── utils/
│   ├── CircuitBreaker.ts      # Custom implementation
│   ├── RateLimiterCheck.ts
│   └── IdempotencyCheck.ts
```

---

## 🧪 Usage (Dev)

```bash
# Install dependencies
npm install

# Run the service
npm start

# Send a test request
curl -X POST http://localhost:3000/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "example@example.com",
    "subject": "Test Email",
    "body": "Hello World!",
    "requestId": "abc-123"
  }'
```

---

## 📌 Future Improvements

- ✅ Logging with Winston or Pino
- ✅ Persistent queue (e.g., Redis + BullMQ)
- ✅ Structured unit tests (Jest)
- ✅ Config-driven retry and thresholds
- ✅ Provider metrics and monitoring
- ✅ API authentication for admin routes

---

## 👨‍💻 Author Notes

This project was implemented as part of a backend internship challenge. While time constraints limited full scope (logging, queue, tests), the **circuit breaker with fallback retry logic** was implemented and fully functional. All the Core Key Features were implemented and are working.
