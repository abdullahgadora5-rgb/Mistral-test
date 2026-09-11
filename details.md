# AI Customer Support Bot - Research Details

## Agent 1-4: Technology Stack Research

### 1. Next.js 14 + next-intl + RTL Research

**Key Findings for Arabic/English i18n:**

- **next-intl** is the recommended library for Next.js App Router i18n
- Supports dynamic routing with `[locale]` segments
- Built-in RTL support through `Intl.Locale.getTextInfo().direction`
- Type-safe translations with TypeScript
- Server-first approach: translations don't bloat client bundle
- ICU MessageFormat support for pluralization rules (critical for Arabic)

**RTL Implementation Patterns:**
```typescript
// app/[locale]/layout.tsx
const { locale } = await params;
const dir = new Intl.Locale(locale).getTextInfo().direction;
// Returns 'ltr' or 'rtl'

// In Tailwind: use logical properties
// ltr:-ml-3 rtl:-mr-3 instead of margin-left/margin-right
```

**Cairo Font for Arabic:**
- Google Fonts: `font-family: 'Cairo', sans-serif;`
- Self-hosted option: Download from Google Fonts or use CDN
- Arabic-specific typography considerations needed

**Language Detection:**
- Use `accept-language` header with `@formatjs/intl-localematcher`
- Support: `en` (English), `ar` (Modern Standard Arabic), `ar-SD` (Sudanese Colloquial)
- Fallback chain: browser preference -> default locale

**Sources:**
- [Next.js Internationalization with next-intl](https://noqta.tn/en/tutorials/nextjs-next-intl-i18n-app-router-guide-2026)
- [Next.js Official i18n Guide](https://nextjs.org/docs/app/guides/internationalization)
- [RTL Support Guide](https://next-international.vercel.app/docs/rtl-support)

---

### 2. Supabase RLS Research

**Multi-Tenant SaaS Patterns:**

**Core Principles:**
- Enable RLS on EVERY table in exposed schemas
- Use `tenant_id` column for multi-tenant isolation
- Use `auth.uid()` for user-scoped data
- Service role key bypasses RLS (server-side only)
- Anon key respects RLS (client-side)

**Policy Patterns:**

```sql
-- Tenant isolation pattern
CREATE POLICY "tenant_isolation_policy"
ON messages 
FOR ALL 
USING (tenant_id = auth.jwt() ->> 'tenant_id');

-- User ownership pattern
CREATE POLICY "user_ownership_policy"
ON user_settings 
FOR ALL 
USING (user_id = auth.uid());

-- Admin access pattern (with custom claims)
CREATE POLICY "admin_access_policy"
ON all_tables 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM admin_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);
```

**Performance Optimization:**
- Create indexes on columns used in RLS policies (tenant_id, user_id)
- Use `EXPLAIN ANALYZE` to diagnose slow queries
- Consider security definer functions for complex policies
- Avoid expensive operations in policies

**Encryption for channel_credentials:**
- Use Supabase's `pgcrypto` extension
- Encrypt sensitive fields with `pgp_sym_encrypt()`
- Decrypt with `pgp_sym_decrypt()` in policies

**Sources:**
- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Multi-Tenant SaaS with Supabase RLS](https://jawadhassan.dev/blog/supabase-rls-multi-tenant-saas)
- [Supabase RLS Best Practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)

---

### 3. BullMQ + Upstash Redis Research

**Queue Architecture:**

**Setup:**
```typescript
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

const connection = new Redis({
  host: process.env.UPSTASH_REDIS_HOST,
  port: parseInt(process.env.UPSTASH_REDIS_PORT || '6379'),
  password: process.env.UPSTASH_REDIS_PASSWORD,
  tls: {},
});

const messageQueue = new Queue('messages', { connection });
```

**Job Types:**
- `telegram_message` - Process Telegram messages
- `messenger_message` - Process Messenger messages  
- `whatsapp_message` - Process WhatsApp messages
- `ai_processing` - AI response generation

**Worker Pattern:**
```typescript
const worker = new Worker('messages', async (job) => {
  const { channel_type, message, tenant_id } = job.data;
  
  // Process message
  const response = await processMessage(message, tenant_id);
  
  // Send response
  await sendResponse(channel_type, response, message);
}, { connection });
```

**Upstash Free Tier:**
- 10,000 commands/day free
- 100MB storage
- Perfect for MVP/testing

**Error Handling:**
- Automatic retries with exponential backoff
- Dead letter queue for failed jobs
- Job timeout configuration

**Sources:**
- [BullMQ with Upstash Redis](https://upstash.com/docs/redis/integrations/bullmq)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Next.js + BullMQ Guide](https://medium.com/@asanka_l/integrating-bullmq-with-nextjs-typescript-f41cca347ef8)

---

### 4. Gemini 1.5 Flash 8B Research

**Model Specifications:**
- **Context Window:** 1M tokens (128K for free tier)
- **Input Price:** $0.0375 per 1M tokens (prompts <128K)
- **Output Price:** $0.15 per 1M tokens (prompts <128K)
- **Cached Prompts:** $0.01 per 1M tokens

**Free Tier:**
- Flash-family models (including 1.5 Flash 8B) have free tier
- Rate limits: 15 RPM, 250,000 TPM, 1,500 RPD
- Generous for MVP development
- No credit card required

**Token Efficiency:**
- Target: <500 tokens per message
- Strategies:
  1. Cache frequent Q&A pairs
  2. Keyword router for common queries
  3. RAG: Top 3 chunks only, max 300 chars each
  4. Force response: "Max 3 sentences"
  5. Use system prompt optimization

**Response Format:**
```json
{
  "response": "Brief answer in 3 sentences max",
  "tokens_used": 150,
  "cached": true/false,
  "rag_chunks": 3
}
```

**Sources:**
- [Gemini 1.5 Flash 8B Announcement](https://developers.googleblog.com/en/gemini-15-flash-8b-is-now-generally-available-for-use/)
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini Free Tier Rate Limits](https://aipromptshub.co/blog/gemini-api-free-tier-rate-limits)

---

## Agent 5-8: Omnichannel Webhook Research

### 5. Telegram Webhook Implementation

**Webhook Setup:**
```typescript
// POST /api/webhooks/telegram
app.post('/api/webhooks/telegram', async (req, res) => {
  const { message, chat, from } = req.body;
  
  // Validate webhook
  if (!message) return res.status(400).send('Invalid payload');
  
  // Queue message
  await messageQueue.add('telegram_message', {
    channel_type: 'telegram',
    message: message.text,
    chat_id: chat.id,
    user_id: from.id,
    tenant_id: getTenantId(chat.id),
  });
  
  res.status(200).send('OK');
});
```

**Telegram Bot API:**
- Webhook URL: `https://api.telegram.org/bot<TOKEN>/setWebhook`
- Required: `url` parameter pointing to your endpoint
- Optional: `max_connections`, `allowed_updates`

**Message Types:**
- Text messages
- Photos
- Documents
- Voice messages
- Commands (/start, /help)

**Sources:**
- [Telegram Bot API](https://core.telegram.org/bots/api)

---

### 6. Messenger Webhook Implementation

**Webhook Setup:**
```typescript
// GET /api/webhooks/messenger (verification)
app.get('/api/webhooks/messenger', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  
  if (mode === 'subscribe' && token === process.env.MESSENGER_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
});

// POST /api/webhooks/messenger
app.post('/api/webhooks/messenger', async (req, res) => {
  const { entry, object } = req.body;
  
  if (object === 'page') {
    for (const change of entry[0].changes) {
      if (change.field === 'messages') {
        const message = change.value.messages[0];
        
        await messageQueue.add('messenger_message', {
          channel_type: 'messenger',
          message: message.message.text,
          sender_id: message.from.id,
          page_id: change.value.page_id,
          tenant_id: getTenantId(change.value.page_id),
        });
      }
    }
  }
  
  res.status(200).send('EVENT_RECEIVED');
});
```

**OAuth Flow:**
1. User clicks "Connect Facebook Page"
2. Redirect to Facebook OAuth URL
3. Exchange code for access token
4. Store token in encrypted `channel_credentials` table
5. Subscribe to webhook

**Required Permissions:**
- `pages_messaging`
- `pages_read_engagement`

**Sources:**
- [Messenger Platform Documentation](https://developers.facebook.com/docs/messenger-platform)
- [Webhook Setup Guide](https://developers.facebook.com/docs/messenger-platform/webhooks)

---

### 7. WhatsApp Cloud API Webhook Implementation

**Webhook Setup:**
```typescript
// GET /api/webhooks/whatsapp (verification)
app.get('/api/webhooks/whatsapp', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
});

// POST /api/webhooks/whatsapp
app.post('/api/webhooks/whatsapp', async (req, res) => {
  const { entry, object } = req.body;
  
  if (object === 'whatsapp_business_account') {
    for (const change of entry[0].changes) {
      if (change.field === 'messages') {
        const message = change.value.messages[0];
        
        await messageQueue.add('whatsapp_message', {
          channel_type: 'whatsapp',
          message: message.message.text,
          from: message.from,
          to: message.to,
          phone_number_id: change.value.metadata.phone_number_id,
          tenant_id: getTenantId(change.value.metadata.phone_number_id),
        });
      }
    }
  }
  
  res.status(200).send('EVENT_RECEIVED');
});
```

**Meta Setup Steps:**
1. Create WhatsApp Business Account
2. Create App in Meta Developer Portal
3. Add WhatsApp to App
4. Get Phone Number ID
5. Get Access Token
6. Set up Webhook
7. Subscribe to `messages` field

**Free Tier:**
- First 1,000 conversations/month are free
- Conversation = 24-hour session
- Rate limits: 80 messages/second

**Sources:**
- [WhatsApp Cloud API Documentation](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Webhook Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks)
- [Node.js SDK](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/)

---

### 8. Single Webhook Router Design

**Unified Router:**
```typescript
// api/webhooks/[channel]/route.ts
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: { channel: string } }
) {
  const { channel } = params;
  const body = await request.json();
  
  // Validate channel
  const validChannels = ['telegram', 'messenger', 'whatsapp'];
  if (!validChannels.includes(channel)) {
    return NextResponse.json({ error: 'Invalid channel' }, { status: 400 });
  }
  
  // Extract common data
  let messageData;
  
  switch (channel) {
    case 'telegram':
      messageData = extractTelegramData(body);
      break;
    case 'messenger':
      messageData = extractMessengerData(body);
      break;
    case 'whatsapp':
      messageData = extractWhatsAppData(body);
      break;
  }
  
  // Queue for processing
  await messageQueue.add(`${channel}_message`, {
    ...messageData,
    channel_type: channel,
    timestamp: new Date().toISOString(),
  });
  
  return NextResponse.json({ status: 'queued' }, { status: 200 });
}
```

**Message Normalization:**
```typescript
interface NormalizedMessage {
  channel_type: 'telegram' | 'messenger' | 'whatsapp';
  message: string;
  sender_id: string;
  conversation_id: string;
  tenant_id: string;
  metadata: Record<string, any>;
  timestamp: string;
}
```

**Sender Service:**
```typescript
class SenderService {
  async send(channel_type: string, response: string, message: NormalizedMessage) {
    switch (channel_type) {
      case 'telegram':
        return this.sendTelegram(response, message);
      case 'messenger':
        return this.sendMessenger(response, message);
      case 'whatsapp':
        return this.sendWhatsApp(response, message);
    }
  }
  
  private async sendTelegram(response: string, message: NormalizedMessage) {
    // Use Telegram Bot API
  }
  
  private async sendMessenger(response: string, message: NormalizedMessage) {
    // Use Messenger Send API
  }
  
  private async sendWhatsApp(response: string, message: NormalizedMessage) {
    // Use WhatsApp Cloud API
  }
}
```

---

## Agent 9-12: Token Efficiency & Performance Research

### 9. Cache Layer Design

**Cache Strategy:**
- **Q&A Cache:** Redis key-value store
  - Key: `cache:qa:{tenant_id}:{hash(query)}`
  - Value: `{ response, tokens_used, cached_at }`
  - TTL: 24 hours
  
- **Keyword Router:** In-memory map
  ```typescript
  const keywordRouter = {
    'price': { response: 'Our prices start at $X...', tokens: 50 },
    'shipping': { response: 'Free shipping on orders over $Y...', tokens: 40 },
    'hours': { response: 'We are open 9AM-5PM...', tokens: 30 },
    // Arabic keywords
    'السعر': { response: 'اسعارنا تبدأ من X...', tokens: 50 },
    'الشحن': { response: 'الشحن مجاني للطلبات فوق Y...', tokens: 40 },
  };
  ```

**Cache Check Flow:**
1. Check keyword router (fastest)
2. Check Q&A cache (Redis)
3. Check RAG (if enabled)
4. Fallback to AI

---

### 10. RAG Implementation

**Hybrid Search:**
- Use Supabase Vector + pgvector
- Embeddings: `text-embedding-ada-002` (free via OpenAI)
- Index: HNSW with 1024 dimensions

**Chunk Strategy:**
- Split documents into 300-character chunks
- Max 3 chunks per query
- Similarity threshold: 0.7

**Query:**
```sql
SELECT content, similarity
FROM documents
ORDER BY embedding <=> query_embedding
LIMIT 3;
```

**Chunk Selection:**
- Filter by tenant_id
- Filter by similarity score > 0.7
- Return top 3

---

### 11. Token Counting & Optimization

**Token Budget:**
- System prompt: 100 tokens
- Context (RAG): 3 chunks * 300 chars * 0.25 tokens/char = 225 tokens
- User message: 150 tokens avg
- **Total input: ~475 tokens**
- Response: Max 3 sentences = ~75 tokens
- **Total: ~550 tokens** (optimize to <500)

**Optimization Techniques:**
1. Compress system prompt
2. Truncate RAG chunks to 250 chars
3. Use keyword extraction for context
4. Pre-process common queries

---

### 12. Performance Optimization

**Response Time Target:** <3 seconds

**Breakdown:**
- Webhook processing: 50ms
- Queue add: 10ms
- Worker pickup: 50ms
- Cache check: 20ms
- RAG query: 200ms
- AI inference: 1500ms (Gemini 1.5 Flash 8B)
- Response send: 100ms
- **Total: ~1930ms**

**Optimizations:**
- Parallel cache/RAG checks
- Connection pooling for Supabase
- Redis pipelining
- Edge caching for static responses

---

## Agent 13-16: Security Research

### 13. Privacy & Data Isolation

**Admin Cannot See Conversations:**
- RLS policies prevent admin access to message content
- Admin can only see metadata: count, channel, timestamp
- Conversations table has strict tenant isolation

**Supabase RLS Policies:**
```sql
-- Conversations table
CREATE POLICY "conversation_tenant_isolation"
ON conversations 
FOR ALL 
USING (tenant_id = auth.jwt() ->> 'tenant_id');

-- Admin can only see counts, not content
CREATE POLICY "admin_conversation_access"
ON conversations 
FOR SELECT 
USING (
  auth.jwt() ->> 'role' = 'admin' AND 
  -- Only allow COUNT queries, not SELECT *
  current_query() LIKE '%COUNT%'
);
```

---

### 14. Channel Credentials Encryption

**Schema:**
```sql
CREATE TABLE channel_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  channel_type TEXT NOT NULL, -- 'telegram', 'messenger', 'whatsapp'
  
  -- Encrypted fields
  token BYTEA, -- pgp_sym_encrypt
  webhook_url TEXT,
  verify_token BYTEA,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(tenant_id, channel_type)
);

-- Encryption function
CREATE OR REPLACE FUNCTION encrypt_credentials()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.token IS NOT NULL THEN
    NEW.token := pgp_sym_encrypt(NEW.token, 'secret_key');
  END IF;
  IF NEW.verify_token IS NOT NULL THEN
    NEW.verify_token := pgp_sym_encrypt(NEW.verify_token, 'secret_key');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- RLS Policy
CREATE POLICY "credentials_tenant_access"
ON channel_credentials 
FOR ALL 
USING (tenant_id = auth.jwt() ->> 'tenant_id');
```

**Access Pattern:**
```typescript
// Server-side only (service role)
async function getCredentials(tenant_id: string, channel_type: string) {
  const { data } = await supabase
    .from('channel_credentials')
    .select('*')
    .eq('tenant_id', tenant_id)
    .eq('channel_type', channel_type)
    .single();
  
  // Decrypt on server
  return {
    ...data,
    token: pgp_sym_decrypt(data.token, 'secret_key'),
    verify_token: pgp_sym_decrypt(data.verify_token, 'secret_key'),
  };
}
```

---

### 15. Rate Limiting & Abuse Prevention

**Per-Tenant Rate Limits:**
- Messages: 100/minute per tenant
- AI calls: 60/minute per tenant
- Webhook calls: 200/minute per tenant

**Implementation:**
```typescript
// Using Upstash Redis for rate limiting
const rateLimiter = new RateLimiter({
  store: new RedisStore(redis),
  points: 100, // requests
  duration: 60, // seconds
});

// In API routes
const res = await rateLimiter.consume(tenant_id);
if (!res.remainingPoints) {
  return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
}
```

---

### 16. Webhook Security

**Validation:**
- Verify webhook signatures
- Validate verify tokens
- Check IP allowlists (optional)

**Telegram:**
- No signature validation (Telegram doesn't provide)
- Validate bot token

**Messenger/WhatsApp:**
```typescript
// Verify signature (Meta provides X-Hub-Signature-256 header)
const signature = req.headers['x-hub-signature-256'];
const expected = crypto
  .createHmac('sha256', process.env.META_APP_SECRET)
  .update(JSON.stringify(req.body))
  .digest('hex');

if (signature !== `sha256=${expected}`) {
  return res.status(401).send('Invalid signature');
}
```

---

## Agent 17-20: Edge Cases & Solutions

### 17. Webhook Failure Scenarios

| Scenario | Solution |
|----------|----------|
| Webhook timeout | Queue retry with exponential backoff |
| Invalid payload | Return 400, log error |
| Missing verify token | Return 403 |
| Network error | Queue retry, alert monitoring |
| Rate limit exceeded | Return 429, retry after delay |

---

### 18. Token Expired Scenarios

| Channel | Detection | Solution |
|---------|-----------|----------|
| Telegram | API returns 401 | Refresh token (Telegram tokens don't expire) |
| Messenger | API returns 190 | Re-authenticate, update credentials |
| WhatsApp | API returns 401 | Refresh access token, re-subscribe webhook |

**Token Refresh Flow:**
```typescript
async function sendWithRetry(channel: string, data: any, retries = 3) {
  try {
    return await sendToChannel(channel, data);
  } catch (error) {
    if (error.code === 401 && retries > 0) {
      // Refresh token
      await refreshChannelToken(data.tenant_id, channel);
      // Retry
      return sendWithRetry(channel, data, retries - 1);
    }
    throw error;
  }
}
```

---

### 19. Channel Down Scenarios

| Channel | Detection | Solution |
|---------|-----------|----------|
| Telegram | API timeout/error | Queue for retry, alert after 5 failures |
| Messenger | API timeout/error | Queue for retry, alert after 5 failures |
| WhatsApp | API timeout/error | Queue for retry, alert after 5 failures |

**Circuit Breaker Pattern:**
```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.failures >= 5 && Date.now() - this.lastFailureTime < 60000) {
      throw new Error('Circuit open');
    }
    
    try {
      return await fn();
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      throw error;
    }
  }
}
```

---

### 20. Data Consistency Scenarios

| Scenario | Solution |
|----------|----------|
| Message processed but response failed | Store in `pending_responses` table, retry |
| Duplicate webhook | Check message ID before processing |
| Race condition on credentials | Use Supabase transactions |
| Tenant deletion | Cascade delete all tenant data |

**Idempotency:**
```typescript
// Use message_id as idempotency key
const existing = await supabase
  .from('messages')
  .select('id')
  .eq('message_id', message_id)
  .eq('channel_type', channel_type)
  .maybeSingle();

if (existing) {
  return; // Already processed
}
```

---

## Summary

This document contains comprehensive research for building the AI Customer Support Bot SaaS system. It covers:

1. **Technology Stack**: Next.js 14, next-intl, Supabase, BullMQ, Upstash, Gemini 1.5 Flash 8B
2. **i18n**: Arabic/English/RTL support patterns
3. **Multi-Tenant**: RLS policies, data isolation
4. **Omnichannel**: Telegram, Messenger, WhatsApp webhook implementations
5. **Queue System**: BullMQ + Upstash Redis architecture
6. **Token Efficiency**: Cache, keyword router, RAG strategies
7. **Security**: Encryption, rate limiting, webhook validation
8. **Edge Cases**: Comprehensive error handling patterns

**All agents should reference this file for implementation details.**
