# AI Customer Support Bot - MASTER PLAN

## Production-Ready SaaS System

**Token-Efficient | Omnichannel | 100% Free Tier**

---

## Table of Contents

1. [Folder Structure](#1-folder-structure)
2. [ERD + RLS Policies](#2-erd--rls-policies)
3. [Environment Variables](#3-environment-variables)
4. [.env.example](#4-envexample)
5. [Wireframes - Omnichannel Connections](#5-wireframes---omnichannel-connections)
6. [Message Flow Diagram](#6-message-flow-diagram)
7. [API Endpoints](#7-api-endpoints)
8. [Token Saving Flow](#8-token-saving-flow)
9. [Edge Cases + Solutions](#9-edge-cases--solutions)

---

## 1. Folder Structure

```
ai-customer-support-bot/
├── .env.example
├── .gitignore
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
│
├── /public/
│   ├── /fonts/
│   │   └── Cairo.ttf
│   └── /images/
│
├── /messages/
│   ├── en.json
│   ├── ar.json
│   └── ar-SD.json
│
├── /src/
│   ├── /app/
│   │   ├── [locale]/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── register/page.tsx
│   │   │   │
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── client/page.tsx
│   │   │   │   ├── ai-instructions/page.tsx
│   │   │   │   ├── knowledge-base/page.tsx
│   │   │   │   ├── bot-tester/page.tsx
│   │   │   │   ├── connections/page.tsx
│   │   │   │   └── analytics/page.tsx
│   │   │   │
│   │   │   └── admin/
│   │   │       ├── page.tsx
│   │   │       ├── users/page.tsx
│   │   │       ├── ownership/page.tsx
│   │   │       ├── analytics/page.tsx
│   │   │       └── settings/page.tsx
│   │   │
│   │   └── api/
│   │       ├── webhooks/[channel]/route.ts
│   │       ├── ai/chat/route.ts
│   │       ├── credentials/route.ts
│   │       ├── messages/route.ts
│   │       ├── analytics/route.ts
│   │       └── users/route.ts
│   │
│   ├── /components/
│   │   ├── ui/
│   │   ├── Layout/
│   │   ├── Dashboard/
│   │   ├── Channels/
│   │   └── Admin/
│   │
│   ├── /lib/
│   │   ├── supabase/
│   │   ├── queue/
│   │   ├── ai/
│   │   ├── channels/
│   │   └── webhooks/
│   │
│   ├── /styles/
│   └── /types/
│
├── /scripts/
├── /workers/
└── /tests/
```

---

## 2. ERD + RLS Policies

### Entity Relationship Diagram

**Core Tables:**
- tenants
- users
- user_tenants (junction)
- channel_credentials (encrypted)
- conversations
- messages
- documents
- ai_instructions
- ai_settings
- analytics
- rate_limits

**RLS Principles:**
- Enable RLS on ALL tables
- tenant_id on every table for multi-tenant isolation
- Admin CANNOT see conversation content (RLS enforced)
- channel_credentials encrypted with pgcrypto

### channel_credentials Table Schema

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE channel_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('telegram', 'messenger', 'whatsapp')),
  bot_token BYTEA,
  page_id TEXT,
  page_access_token BYTEA,
  phone_number_id TEXT,
  whatsapp_token BYTEA,
  webhook_url TEXT NOT NULL,
  verify_token BYTEA,
  is_active BOOLEAN DEFAULT true,
  last_verified_at TIMESTAMP WITH TIME ZONE,
  verification_error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, channel_type)
);

-- Encryption trigger
CREATE OR REPLACE FUNCTION encrypt_channel_credentials()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bot_token IS NOT NULL AND NOT pgp_is_encrypted(NEW.bot_token::bytea) THEN
    NEW.bot_token := pgp_sym_encrypt(NEW.bot_token::text, current_setting('app.encryption_key'));
  END IF;
  IF NEW.page_access_token IS NOT NULL AND NOT pgp_is_encrypted(NEW.page_access_token::bytea) THEN
    NEW.page_access_token := pgp_sym_encrypt(NEW.page_access_token::text, current_setting('app.encryption_key'));
  END IF;
  IF NEW.whatsapp_token IS NOT NULL AND NOT pgp_is_encrypted(NEW.whatsapp_token::bytea) THEN
    NEW.whatsapp_token := pgp_sym_encrypt(NEW.whatsapp_token::text, current_setting('app.encryption_key'));
  END IF;
  IF NEW.verify_token IS NOT NULL AND NOT pgp_is_encrypted(NEW.verify_token::bytea) THEN
    NEW.verify_token := pgp_sym_encrypt(NEW.verify_token::text, current_setting('app.encryption_key'));
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### RLS Policies

```sql
-- Tenant isolation for all tenant-scoped tables
CREATE POLICY "tenant_isolation"
ON channel_credentials, conversations, messages, documents, ai_instructions, ai_settings, analytics
FOR ALL USING (tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()));

-- Admin can see metadata only, NOT content
CREATE POLICY "admin_metadata_only"
ON conversations FOR SELECT USING (
  auth.jwt() ->> 'role' = 'admin' AND current_query() LIKE '%COUNT%'
);

-- Users can only see their own data
CREATE POLICY "user_self_access"
ON users FOR ALL USING (auth.uid() = id);
```

---

## 3. Environment Variables

### Required Variables

| Variable | Purpose | Sensitive |
|----------|---------|-----------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase URL | No |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anon key | No |
| SUPABASE_SERVICE_ROLE_KEY | Service role key | YES |
| UPSTASH_REDIS_REST_URL | Upstash Redis URL | YES |
| UPSTASH_REDIS_REST_TOKEN | Upstash Redis token | YES |
| GEMINI_API_KEY | Google Gemini API key | YES |
| NEXT_PUBLIC_APP_URL | Application URL | No |
| ENCRYPTION_KEY | Database encryption | YES |
| JWT_SECRET | JWT signing secret | YES |
| META_VERIFY_TOKEN | Meta webhook verify | YES |
| ADMIN_EMAIL | Initial admin email | YES |
| ADMIN_PASSWORD | Initial admin password | YES |

---

## 4. .env.example

```bash
# SUPABASE
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# UPSTASH REDIS
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token

# GEMINI AI
GEMINI_API_KEY=your_gemini_key
NEXT_PUBLIC_GEMINI_MODEL=gemini-1.5-flash-8b

# APP
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# ENCRYPTION
ENCRYPTION_KEY=your_32_byte_key
JWT_SECRET=your_jwt_secret

# META
META_VERIFY_TOKEN=your_verify_token

# ADMIN
ADMIN_EMAIL=admin@your-app.com
ADMIN_PASSWORD=your_password

# LIMITS
NEXT_PUBLIC_FREE_TIER_MAX_MESSAGES=1000
NEXT_PUBLIC_FREE_TIER_MAX_DOCUMENTS=50
```

---

## 5. Wireframes - Omnichannel Connections

### English (LTR)

```
+-----------------------------------------------------+
|  AI Customer Support Bot    [EN][AR] [Logout]      |
+-----------------------------------------------------+
|  Dashboard > Connections                            |
|                                                     |
|  +-----------------------------------------------+  |
|  |  Omnichannel Connections                       |  |
|  |  Connect your bot to messaging platforms        |  |
|  +-----------------------------------------------+  |
|                                                     |
|  +---------------+  +---------------+                |
|  | TELEGRAM     |  | MESSENGER     |                |
|  |               |  |               |                |
|  | Bot Token:    |  | [Connect Page]|                |
|  | [________]    |  |               |                |
|  |               |  | Page:         |                |
|  | [Generate]    |  | [Select]      |                |
|  |               |  |               |                |
|  | Status: D/C  |  | Token:        |                |
|  | [Test]       |  | [________]    |                |
|  | [Disconnect] |  | [Test]       |                |
|  |               |  | Status: D/C  |                |
|  +---------------+  +---------------+                |
|                                                     |
|  +---------------+                                    |
|  | WHATSAPP      |                                    |
|  |               |                                    |
|  | Phone ID:     |                                    |
|  | [________]    |                                    |
|  | Token:       |                                    |
|  | [________]    |                                    |
|  | Verify:      |                                    |
|  | [________]    |                                    |
|  | [Generate]   |                                    |
|  | [Test]       |                                    |
|  | Status: D/C  |                                    |
|  | [Disconnect] |                                    |
|  |               |                                    |
|  | First 1000    |                                    |
|  | conv/month   |                                    |
|  | FREE         |                                    |
|  +---------------+                                    |
+-----------------------------------------------------+
```

### Arabic (RTL)

```
+-----------------------------------------------------+
|  بوت الدعم العميل الذكي    [EN][AR] [تسجيل خروج]   |
+-----------------------------------------------------+
|  لوحة التحكم > اتصالات متعدد القنوات                 |
|                                                     |
|  +-----------------------------------------------+  |
|  |  اتصالات متعدد القنوات                         |  |
|  |  وصل بوتك بمنصات المراسلة                         |  |
|  +-----------------------------------------------+  |
|                                                     |
|                 +---------------+  +---------------+   |
|                 | MESSENGER     |  | TELEGRAM     |   |
|                 |               |  |               |   |
|                 | [اتصل بصفة] |  | رمز البوت:    |   |
|                 |               |  | [________]    |   |
|                 | الصفحة:       |  | [إنشاء]      |   |
|                 | [اختر]       |  | الحالة: D/C  |   |
|                 |               |  | [اختبار]     |   |
|                 | Token:        |  | [فصل]       |   |
|                 | [________]    |  +---------------+   |
|                 | [اختبار]    |                    |
|                 | الحالة: D/C  |                    |
|                 | [فصل]       |                    |
|                 +---------------+                    |
|                                                     |
|  +---------------+                                    |
|  | واتساب       |                                    |
|  | Phone ID:     |                                    |
|  | [________]    |                                    |
|  | Token:       |                                    |
|  | [________]    |                                    |
|  | Verify:      |                                    |
|  | [________]    |                                    |
|  | [إنشاء]     |                                    |
|  | [اختبار]    |                                    |
|  | الحالة: D/C  |                                    |
|  | [فصل]       |                                    |
|  | أول 1000     |                                    |
|  | محادثة/شهر  |                                    |
|  | مجاناً       |                                    |
|  +---------------+                                    |
+-----------------------------------------------------+
```

---

## 6. Message Flow Diagram

```
TELEGRAM USER
    |
    v
[Telegram App] --> [Telegram Bot API] --> [/api/webhooks/telegram]
    |
    v
[Validate] --> [Extract] --> [Identify Tenant] --> [Normalize]
    |
    v
[Check Idempotency] --> [Add to BullMQ Queue]
    |
    v
[Upstash Redis (BullMQ)]
    |
    v
[Worker: message-processor.ts]
    |
    v
[Check Keyword Router] --> (Match) --> [Return Cached Response]
    |
    v (No match)
[Check Q&A Cache (Redis)] --> (Hit) --> [Return Cached Response]
    |
    v (Miss)
[Check RAG (Supabase Vector)] --> (Results) --> [Build Context]
    |
    v (No results)
[Call Gemini 1.5 Flash 8B]
    |
    v
[Generate Response (<3 sentences)]
    |
    v
[Cache Response] --> [Send via SenderService] --> [Telegram Bot API]
    |
    v
TELEGRAM USER (Response in <3s)
```

---

## 7. API Endpoints

### Auth
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me

### Tenants
- POST /api/tenants
- GET /api/tenants
- GET /api/tenants/:id
- PUT /api/tenants/:id
- DELETE /api/tenants/:id

### Admin
- GET /api/admin/users
- PUT /api/admin/users/:id/disable
- PUT /api/admin/users/:id/enable
- DELETE /api/admin/users/:id
- POST /api/admin/transfer-ownership

### AI
- GET /api/ai/settings
- PUT /api/ai/settings
- GET /api/ai/instructions
- PUT /api/ai/instructions
- POST /api/ai/chat

### Knowledge Base
- GET /api/knowledge-base
- POST /api/knowledge-base/upload
- DELETE /api/knowledge-base/:id
- POST /api/knowledge-base/:id/reindex

### Credentials
- GET /api/credentials
- POST /api/credentials/telegram
- POST /api/credentials/messenger
- POST /api/credentials/whatsapp
- DELETE /api/credentials/:id
- POST /api/credentials/:id/test

### Webhooks
- GET /api/webhooks/:channel (verification)
- POST /api/webhooks/:channel (receive)

### Messages
- GET /api/messages
- POST /api/messages/test

### Analytics
- GET /api/analytics
- GET /api/analytics/channels
- GET /api/admin/analytics

---

## 8. Token Saving Flow

```
USER MESSAGE
    |
    v
[Keyword Router: price, shipping, hours...]
    |
    +-- Match --> [Return Pre-defined Response] (0 AI tokens)
    |
    v (No match)
[Q&A Cache (Redis)]
    |
    +-- Hit --> [Return Cached Response] (0 AI tokens)
    |
    v (Miss)
[RAG: TOP 3 chunks, 300 chars max each]
    |
    +-- Results --> [Context: 225 tokens]
    |
    v (No results)
[Gemini 1.5 Flash 8B]
    |
    v
[System: 100 tokens + Context: 225 + User: 150 = 475 input]
[Response: 75 tokens max (3 sentences)]
[TOTAL: ~550 tokens]
    |
    v
[Optimize: Compress system to 50, chunks to 250 chars]
[TOTAL: ~400-450 tokens] ✓
    |
    v
[Cache Response for future use]
    |
    v
RETURN TO USER
```

---

## 9. Edge Cases + Solutions

### Webhook Failures
| Scenario | Solution |
|----------|----------|
| Timeout | Queue retry x3 |
| Invalid payload | Return 400 |
| Missing verify token | Return 403 |
| Network error | Queue retry x5, then alert |
| Rate limit | Return 429, retry with backoff |
| Duplicate | Check idempotency, skip |

### Token Expired
| Channel | Solution |
|---------|----------|
| Telegram | Tokens dont expire, re-save if invalid |
| Messenger | OAuth re-auth, update credentials |
| WhatsApp | Refresh token, re-subscribe webhook |

### Channel Down
| Channel | Solution |
|---------|----------|
| All | Circuit breaker pattern, queue retry |

### Data Consistency
| Scenario | Solution |
|----------|----------|
| Response failed | Store in pending_responses, retry |
| Duplicate | Idempotency check |
| Race condition | Supabase transactions |
| Tenant deletion | Cascade delete |

### RAG Failures
| Scenario | Solution |
|----------|----------|
| Embedding failed | Log, continue without RAG |
| No documents | Fallback to AI |
| Low similarity | Fallback to AI |
| DB error | Queue retry |

### AI Failures
| Scenario | Solution |
|----------|----------|
| API error | Retry with backoff |
| Rate limit | Wait and retry |
| Timeout | Return error message |

### Security
| Scenario | Solution |
|----------|----------|
| Invalid signature | Return 401 |
| SQL injection | RLS blocks |
| Admin access conversation | RLS blocks |
| Brute force | Rate limit + IP ban |

---

Ready to execute. Reply YES to start coding.
