# Advancia Pay Ledger — Financial Engine

Advancia Pay Ledger is a robust, security-first financial backend designed for high-volume transactions, automated fund routing, and institutional crypto/fiat processing. This system acts as the underlying ledger and orchestrator for facility payouts, user wallets, AI trading pools, and external payment network integration (Stripe/Solana/EVM).

## Features

- **Multi-Currency Wallets**: Manage fiat and crypto balances per user/facility.
- **Transaction Ledger**: Immutable double-entry ledger for exchanges, transfers, and billing.
- **Crypto Withdrawals**: Secure on-chain settlements (Solana, Ethereum, Polygon, Base) with AML screening integration, Totp 2FA, and Fireblocks support.
- **Stripe Billing**: Subscriptions, payment methods, and automated webhook handling.
- **AI Agent Orchestrator**: 8 intelligent background processes (Fraud Shield, Payment Optimizer, Content Creator, Revenue Analyst, Churn Predictor, Compliance Monitor, Support Handler, Email Composer) that provide actionable insights directly to the platform via the `features` API.
- **Automated Scheduling**: Cron-driven jobs continuously manage security, compliance, and revenue monitoring asynchronously.
- **Branded Email System**: Full `Nodemailer/SMTP` integration for automated Welcome, Security Alert, and Invoice emails.
- **Compliance & Security**: Role-based access (admin/cfo), strict JWT auth, request rate-limiting, comprehensive response sanitization, and audit logging.
- **Zero-Localhost Guarantee**: Fully environment-variable driven for drop-in production deployment.

## Tech Stack

- **Backend**: Express.js (TypeScript), Prisma ORM
- **Database**: PostgreSQL (via Docker)
- **Caching/Streaming**: Redis (via Docker)
- **Blockchain**: `@solana/web3.js`, `ethers.js`, `fireblocks-sdk`
- **Security**: `speakeasy` (TOTP), `bcryptjs`, `jsonwebtoken`
- **Communication**: `nodemailer`
- **Automation**: `node-cron`
- **Frontend**: Next.js (React) dashboards under `/frontend`

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites

- Docker and Docker Compose
- Node.js v18+

### 2. Environment Setup

Copy the example environment file and fill in your keys:

```bash
cp .env.example .env
```

Ensure the following critical variables are set in `.env`:

```env
# Infrastructure
DATABASE_URL="postgresql://postgres:password@localhost:5432/advancia"
REDIS_URL="redis://localhost:6379"

# Core Secrets
JWT_SECRET="your_secure_jwt_secret"
ADMIN_PIN_HASH="bcrypt_hash_of_admin_pin"

# Integrations
STRIPE_SECRET_KEY="sk_test_..."
FIREBLOCKS_API_KEY="..."
SMTP_HOST="..."
SMTP_PORT=587
SMTP_USER="..."
SMTP_PASS="..."
```

### 3. Start Infrastructure

Spin up PostgreSQL and Redis:

```bash
docker-compose up -d
```

### 4. Database Setup

Apply the Prisma schema and seed test data:

```bash
npm install
npm run prisma:push
npm run seed
```

### 5. Start Backend Service

```bash
npm run dev
```

### 6. Frontend

A Next.js frontend scaffolding is provided under `/frontend` which hosts the **Trading Engine**, **Super Admin**, and **Withdrawal Portal** React components. To run the frontend, navigate to `/frontend` and run its respective start commands (requires setting `NEXT_PUBLIC_API_URL` to your backend).

---

## 🛡️ Security Architecture

1. **No Secrets in Code**: All API keys, wallets, and credentials are read from the environment.
2. **Response Sanitization**: Middleware (`responseSanitizer.ts`) intercepts every response to scrub internal LLM prompts, agent metadata, database keys, and sensitive environment variables to prevent accidental data leaks.
3. **Admin Streaming Auth**: The SSE endpoint (`/api/admin/stream`) demands a valid super-admin JWT token.
4. **Withdrawal 2FA**: The `POST /api/withdrawals/crypto` endpoint forces TOTP verification.
5. **Fireblocks Integration**: Designed to execute external transactions without exposing raw private keys.

## 🤖 AI Features Orchestrator

The platform hides raw LLM/Agent execution behind polished user features. Clients can hit `/api/features/*` routes which map to:

- **Security System**: Payment anomaly detection (`FraudShieldAgent`)
- **Smart Routing**: Network optimization (`PaymentOptimizerAgent`)
- **Revenue Intelligence**: Financial reporting (`RevenueAnalystAgent`)
- **Support Center**: Automated Q&A processing (`SupportHandlerAgent`)

_Note: Internally these trigger the unified `AgentOrchestrator` which enforces timing and metadata standards._

## 📡 Live Stream Events (Redis Pub/Sub)

System workers can publish events to Redis using `src/lib/live-events.ts`. The backend streams these to the frontend `/api/admin/stream` route. Available channels:

- `TRANSACTIONS` (new, updated, flagged)
- `AGENTS` (status, metrics)
- `ALERTS` (new, resolved)
- `FACILITIES` (actions)
- `SYSTEM` (global metrics)

## 📦 Deployment (Production)

1. Deploy the backend Express app to your container service (e.g., AWS ECS, Render, Railway).
2. Provision managed PostgreSQL and Redis clusters.
3. Supply all variables in `.env.example` to the production environment securely.
4. Deploy the `frontend/` directory to Vercel/Netlify. Ensure `NEXT_PUBLIC_API_URL` points to the deployed backend.

\*For manual demo viewing, standalone UI builds exist in `demo/`.

## API Endpoints

| Method | Route                            | Auth  | Description               |
| ------ | -------------------------------- | ----- | ------------------------- |
| POST   | `/api/auth/login`                | No    | Login, returns JWT        |
| POST   | `/api/auth/register`             | No    | Create account            |
| GET    | `/api/auth/me`                   | Yes   | Current user profile      |
| GET    | `/api/wallet`                    | Yes   | List wallets + balances   |
| POST   | `/api/wallet/create`             | Yes   | Create new wallet         |
| POST   | `/api/wallet/deposit`            | Yes   | Deposit funds             |
| GET    | `/api/wallet/rates`              | No    | Exchange rates            |
| POST   | `/api/exchange`                  | Yes   | Quote or execute exchange |
| GET    | `/api/exchange/rates`            | No    | Live market rates         |
| POST   | `/api/transfer`                  | Yes   | Send funds                |
| GET    | `/api/transactions`              | Yes   | Transaction history       |
| GET    | `/api/transactions/:id`          | Yes   | Single transaction        |
| POST   | `/api/withdrawals/crypto`        | Admin | On-chain withdrawal (2FA) |
| GET    | `/api/withdrawals/history`       | Admin | Withdrawal history        |
| GET    | `/api/withdrawals/daily-summary` | Admin | Daily limit status        |
| GET    | `/health`                        | No    | Health check              |

## Demo Accounts

| Role     | Email                         | Password    |
| -------- | ----------------------------- | ----------- |
| Admin    | admin@advanciapayledger.com   | Admin@2025! |
| CFO      | cfo@advanciapayledger.com     | Demo@2025!  |
| Provider | amaka@advanciapayledger.com   | Demo@2025!  |
| Patient  | patient@advanciapayledger.com | Demo@2025!  |

CFO wallet: $309,950 USD · C$245K · BTC 5.12 · ETH 42.6 · $120K USDT · €210K · £155K · SOL 1,840

## VPS Deployment

```bash
# 1. Build
npm run build

# 2. Upload to VPS
scp -r dist/ prisma/ package.json .env root@76.13.77.8:/var/www/advancia-banking/

# 3. SSH and run deploy script
scp deploy/DEPLOY_ALL.sh root@76.13.77.8:/tmp/
ssh root@76.13.77.8
chmod +x /tmp/DEPLOY_ALL.sh && /tmp/DEPLOY_ALL.sh
```

### Live URLs

- **Site**: https://advanciapayledger.com
- **Demo**: https://advanciapayledger.com/demo
- **API**: https://api.advanciapayledger.com
- **Banking**: https://advanciapayledger.com/api/banking

## API Quick Test

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3005/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cfo@advanciapayledger.com","password":"Demo@2025!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# Get wallets
curl -s http://localhost:3005/api/wallet \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Get exchange quote
curl -s -X POST http://localhost:3005/api/exchange \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"quote","fromCurrency":"USD","toCurrency":"BTC","fromAmount":5000}'

# Execute transfer
curl -s -X POST http://localhost:3005/api/transfer \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fromCurrency":"USD","toRecipient":"amaka@advanciapayledger.com","amount":500}'
```

## Security

- JWT authentication on all protected routes
- TOTP 2FA required for crypto withdrawals
- Daily withdrawal limits ($50K default, configurable)
- Rate limiting (100 req/15min)
- Helmet security headers
- CORS restricted to frontend origin
- All transactions logged to audit table
- Prisma parameterized queries (no SQL injection)
- Private keys in environment variables only

## Environment Variables

See `.env.example` for the full list. Critical variables:

- `JWT_SECRET` — Required for auth
- `DATABASE_URL` — SQLite (dev) or PostgreSQL (prod)
- `SOLANA_TREASURY_PRIVATE_KEY` — For on-chain Solana withdrawals
- `EVM_TREASURY_PRIVATE_KEY` — For Ethereum/Polygon/Base withdrawals
- `WITHDRAWAL_DAILY_LIMIT_USD` — Daily withdrawal cap (default: 50000)
