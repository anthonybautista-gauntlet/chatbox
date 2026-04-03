# AI Cost Analysis

## Development & Testing Costs

### LLM API Costs

All development and testing used **Gemini 3.1 Flash Preview** via OpenRouter as the default model. OpenRouter acts as a unified gateway, so a single API key provides access to all models. The API key is stored server-side in a Supabase Edge Function environment variable and is never exposed to the client.

| Metric | Value |
|---|---|
| Provider | OpenRouter (Gemini 3.1 Flash Preview) |
| Total API Calls | 107 |
| Cost per Call | $0.0003 |
| **Total LLM Spend** | **$0.032** |

### Token Consumption

Based on observed usage patterns across 107 calls during development and testing of all three integrated apps (Drawing Canvas, Chess, Birthday Countdown with Google Calendar):

| Token Type | Estimated per Call | Total (107 calls) |
|---|---|---|
| Input tokens | ~1,000 | ~107,000 |
| Output tokens | ~300 | ~32,100 |
| **Total tokens** | **~1,300** | **~139,100** |

Input tokens include the system prompt, conversation context, tool schemas for registered apps, and user messages. Output tokens cover the model's response text and any tool call arguments.

### Other AI-Related Costs

| Category | Cost | Notes |
|---|---|---|
| Embeddings | $0 | Not used — app routing is handled via tool schemas and function calling |
| Supabase (auth, DB, Edge Functions) | $0 | Free tier covers all dev usage |
| Vercel (hosting) | $0 | Free tier for platform and app deployments |
| Google Calendar API | $0 | Free tier (Birthday Countdown OAuth app) |
| Domain / DNS | $0 | Using Vercel default domains |
| **Total Non-LLM Costs** | **$0** | |

### Total Development Cost

| Category | Amount |
|---|---|
| LLM API calls (107 calls × $0.0003) | $0.032 |
| Infrastructure | $0.00 |
| **Grand Total** | **$0.032** |

---

## Production Cost Projections

### Assumptions

| Parameter | Value | Rationale |
|---|---|---|
| Sessions per user per month | 10 | Moderate engagement for an educational chat platform |
| LLM calls per session | 12 | ~8 user messages per session; some trigger tool calls requiring follow-up processing |
| **LLM calls per user per month** | **120** | 10 sessions × 12 calls |
| Tool invocations per session | 4 | Users interact with 1–2 apps per session, averaging 2 tool calls each |
| Avg input tokens per call | 1,500 | System prompt + context + tool schemas + user message |
| Avg output tokens per call | 350 | Response text + tool call arguments |

**Invocation breakdown by type:**

| Call Type | Share | Input Tokens | Output Tokens | Notes |
|---|---|---|---|---|
| Simple chat | 40% | 800 | 200 | Conversational messages without tool use |
| Tool routing | 25% | 1,500 | 300 | LLM selects and invokes an app tool |
| Tool result processing | 25% | 2,000 | 400 | LLM processes tool output and responds |
| Complex analysis (e.g. chess) | 10% | 2,500 | 500 | Multi-step reasoning over app state |

### Model Pricing

Users choose their own model. The platform supports any model available through OpenRouter. Projections cover three representative tiers:

| Tier | Model | Input Cost (per 1M tokens) | Output Cost (per 1M tokens) | Effective Cost per Call |
|---|---|---|---|---|
| Budget (default) | Gemini 3.1 Flash Preview | ~$0.15 | ~$0.60 | **$0.0003** |
| Standard | GPT-4o | ~$2.50 | ~$10.00 | **$0.0073** |
| Premium | Claude Sonnet 4.5 | ~$3.00 | ~$15.00 | **$0.0098** |

### Infrastructure Costs by Scale

The platform runs on three managed services — Supabase, Vercel, and Google Calendar API — plus OpenRouter as the LLM gateway. Each has its own scaling curve.

---

#### Supabase (Authentication, Database, Edge Functions)

Supabase provides three core services for the platform: Supabase Auth for user login, a Postgres database for chat history sync (`user_store`) and OAuth token storage (`user_oauth_tokens`), and Edge Functions for the LLM proxy and OAuth broker.

| Resource | 100 Users | 1,000 Users | 10,000 Users | 100,000 Users |
|---|---|---|---|---|
| **Plan** | Free | Pro ($25/mo) | Pro ($25/mo) | Team ($599/mo) |
| Auth MAUs | ~100 | ~1,000 | ~10,000 | ~100,000 |
| Auth cost | $0 (50K MAU free) | $0 (included in Pro) | $0 (100K MAU included) | $0 (100K included; overage $0.00325/MAU) |
| Database size | <50 MB | ~200 MB | ~2 GB | ~20 GB |
| Database cost | $0 (500 MB free) | $0 (8 GB included) | $0 (8 GB included) | $0.125/GB overage = ~$1.50 |
| Edge Function invocations/mo | ~12,000 | ~120,000 | ~1,200,000 | ~12,000,000 |
| Edge Function cost | $0 (500K free) | $0 (2M included) | ~$50 (overage at $2/1M) | ~$20/1M = ~$200 |
| Bandwidth | <1 GB | ~5 GB | ~50 GB | ~500 GB |
| Bandwidth cost | $0 (5 GB free) | $0 (250 GB included) | $0 (250 GB included) | $0.09/GB overage = ~$22.50 |
| **Supabase subtotal** | **$0** | **$25/mo** | **$75/mo** | **$823/mo** |

**What drives Supabase costs up:**
- At **100 users**, everything fits within the free tier. 500 MB database, 500K Edge Function invocations, and 50K auth MAUs are more than sufficient.
- At **1,000 users**, the Pro plan ($25/mo) is needed primarily for the 2M Edge Function invocation limit (120K calls/month is well within it) and for production-grade features like daily backups, no project pausing, and email support.
- At **10,000 users**, Edge Function invocations push past the 2M included in Pro. Each LLM call routes through the Edge Function proxy, so 10K users × 120 calls/month = 1.2M invocations. The overage is modest at $2 per million.
- At **100,000 users**, the Team plan ($599/mo) becomes necessary for SOC2 compliance, priority support, and higher concurrency limits on Edge Functions. Database size grows to ~20 GB as chat history syncs accumulate across 100K users. Edge Function overage and bandwidth become meaningful line items.

---

#### Vercel (Platform Hosting + App Deployments)

Vercel hosts the main ChatBridge SPA and all three app deployments (Chess, Drawing Canvas, Birthday Countdown). The SPA and apps are static builds served from Vercel's CDN — compute costs are zero for the frontend.

| Resource | 100 Users | 1,000 Users | 10,000 Users | 100,000 Users |
|---|---|---|---|---|
| **Plan** | Hobby (free) | Pro ($20/mo) | Pro ($20/mo) | Enterprise (~$300/mo) |
| Projects (4 total) | 4 | 4 | 4 | 4 |
| Bandwidth/mo | ~2 GB | ~15 GB | ~100 GB | ~1 TB |
| Bandwidth cost | $0 (100 GB free) | $0 (1 TB included) | $0 (1 TB included) | ~$40/TB overage |
| Builds/mo | ~20 | ~30 | ~50 | ~100 |
| Build cost | $0 | $0 (included) | $0 (included) | $0 (included) |
| Serverless functions | None used | None used | None used | None used |
| **Vercel subtotal** | **$0** | **$20/mo** | **$20/mo** | **$300/mo** |

**What drives Vercel costs up:**
- At **100 users**, the Hobby tier handles everything. Static SPA serving is Vercel's strong suit — the CDN caches aggressively, and 100 users generate negligible bandwidth.
- At **1,000 users**, Pro ($20/mo) is needed for team collaboration features, higher build concurrency, and custom domains. Bandwidth stays well within the 1 TB Pro allowance.
- At **10,000 users**, costs stay flat at $20/mo. The SPA bundle is ~2 MB, cached by browsers after first load. Even 10K active users with 10 sessions/month generate only ~100 GB/month, well within Pro limits.
- At **100,000 users**, Enterprise pricing applies for SLA guarantees, DDoS protection, and advanced caching. Bandwidth approaches 1 TB from initial page loads, asset fetches, and iframe app loads. The apps (Chess, Canvas, Birthday) are lightweight static deployments that benefit from CDN caching, but the volume of unique visitors at this scale justifies the Enterprise tier.

---

#### Google Calendar API (Birthday Countdown OAuth App)

The Birthday Countdown app uses Google Calendar API to read and write calendar events. Google provides a generous free quota.

| Resource | 100 Users | 1,000 Users | 10,000 Users | 100,000 Users |
|---|---|---|---|---|
| API calls/mo | ~400 | ~4,000 | ~40,000 | ~400,000 |
| Quota limit | 1,000,000/day | 1,000,000/day | 1,000,000/day | 1,000,000/day |
| Cost | $0 | $0 | $0 | $0 |
| OAuth consent screen | Free (external, testing) | Free (published) | Free (published) | Free (published) |
| **Google Calendar subtotal** | **$0** | **$0** | **$0** | **$0** |

**Why this stays free:** Google Calendar API has a default quota of 1,000,000 requests per day. Even at 100K users, the Birthday Countdown app makes ~4 API calls per user per session (list events, create event, update event, delete event), totaling ~400K calls/month — well under the daily cap. OAuth consent and token exchange are handled by Google's free infrastructure. There are no per-request charges for Calendar API.

---

#### OpenRouter (LLM API Gateway)

OpenRouter is not infrastructure we host — it is a pay-per-use API gateway that routes LLM calls to the selected provider. There are no base fees, no minimum commitments, and no tiers to upgrade through.

| Resource | 100 Users | 1,000 Users | 10,000 Users | 100,000 Users |
|---|---|---|---|---|
| LLM calls/mo | 12,000 | 120,000 | 1,200,000 | 12,000,000 |
| OpenRouter markup | 0% on most models | 0% | 0% | 0% (volume discounts possible) |
| Rate limits | 200 req/min (free tier) | 200 req/min | Contact for increase | Custom limits |
| Gateway cost | $0 | $0 | $0 | $0 |

**What to watch at scale:** OpenRouter charges no gateway fee — users pay only the underlying model's token price. The constraint is rate limits: the default free-tier limit of ~200 requests/minute handles up to ~10K users without issue (1.2M calls/month = ~28 req/min average). At 100K users (~278 req/min average, with spikes higher), a rate limit increase request to OpenRouter or direct provider API keys would be needed.

---

#### Infrastructure Cost Summary

| Component | 100 Users | 1,000 Users | 10,000 Users | 100,000 Users |
|---|---|---|---|---|
| Supabase | $0 | $25 | $75 | $823 |
| Vercel | $0 | $20 | $20 | $300 |
| Google Calendar API | $0 | $0 | $0 | $0 |
| OpenRouter gateway | $0 | $0 | $0 | $0 |
| **Infrastructure total** | **$0/mo** | **$45/mo** | **$95/mo** | **$1,123/mo** |

### Monthly Cost Projections

#### Budget Tier — Gemini 3.1 Flash Preview (Default)

| | 100 Users | 1,000 Users | 10,000 Users | 100,000 Users |
|---|---|---|---|---|
| LLM calls/month | 12,000 | 120,000 | 1,200,000 | 12,000,000 |
| LLM cost | $3.60 | $36 | $360 | $3,600 |
| Infrastructure | $0 | $45 | $95 | $1,123 |
| **Total** | **$4/month** | **$81/month** | **$455/month** | **$4,723/month** |

#### Standard Tier — GPT-4o

| | 100 Users | 1,000 Users | 10,000 Users | 100,000 Users |
|---|---|---|---|---|
| LLM calls/month | 12,000 | 120,000 | 1,200,000 | 12,000,000 |
| LLM cost | $88 | $876 | $8,760 | $87,600 |
| Infrastructure | $0 | $45 | $95 | $1,123 |
| **Total** | **$88/month** | **$921/month** | **$8,855/month** | **$88,723/month** |

#### Premium Tier — Claude Sonnet 4.5

| | 100 Users | 1,000 Users | 10,000 Users | 100,000 Users |
|---|---|---|---|---|
| LLM calls/month | 12,000 | 120,000 | 1,200,000 | 12,000,000 |
| LLM cost | $118 | $1,176 | $11,760 | $117,600 |
| Infrastructure | $0 | $45 | $95 | $1,123 |
| **Total** | **$118/month** | **$1,221/month** | **$11,855/month** | **$118,723/month** |

### Summary Table

| Scale | Budget (Gemini Flash) | Standard (GPT-4o) | Premium (Claude Sonnet 4.5) |
|---|---|---|---|
| **100 Users** | $4/month | $88/month | $118/month |
| **1,000 Users** | $81/month | $921/month | $1,221/month |
| **10,000 Users** | $455/month | $8,855/month | $11,855/month |
| **100,000 Users** | $4,723/month | $88,723/month | $118,723/month |

---

## Cost Optimization Strategies

At scale, several strategies reduce LLM costs significantly:

| Strategy | Estimated Savings | Applicability |
|---|---|---|
| **Conversation compaction** | 20–30% token reduction | Already implemented in the platform; summarizes older context to shrink input tokens |
| **Tiered model routing** | 40–60% cost reduction | Use a cheap model (Flash) for simple routing decisions, escalate to GPT-4o only for complex analysis |
| **Response caching** | 10–20% call reduction | Cache identical tool invocations (e.g., same weather query within 15 min) |
| **Prompt optimization** | 10–15% token reduction | Minimize system prompt and tool schema verbosity as schemas stabilize |
| **Batch processing** | 5–10% cost reduction | Aggregate non-urgent API calls where latency tolerance allows |

With aggressive optimization at 100K users on the budget tier, LLM costs could drop from ~$3,600/month to approximately **$1,800–$2,500/month**, bringing the total (with $1,123 infrastructure) to roughly **$2,923–$3,623/month**.

---

## Key Takeaways

1. **The default model is extremely cost-effective.** At $0.0003/call, Gemini 3.1 Flash Preview keeps the platform viable even at 100K users for under $5K/month total.
2. **User model choice is the primary cost driver.** A user on Claude Sonnet 4.5 costs ~33× more per call than one on Gemini Flash. In a production billing model, premium model usage should be passed through to users or gated behind a paid tier.
3. **Infrastructure scales gracefully.** At 100 users, infrastructure is $0 (free tiers). At 100K users, infrastructure totals $1,123/month — still only 24% of total costs on the budget tier. The managed services model (Supabase + Vercel) means zero ops burden at every scale; costs step up at plan boundaries rather than scaling linearly.
4. **LLM costs dominate at every scale.** Infrastructure is never the bottleneck. Even on the budget model at 100K users, LLM spend ($3,600) is 3.2× infrastructure ($1,123). On premium models, LLM spend is 100×+ infrastructure. Optimization efforts should focus on token reduction and model routing, not infrastructure savings.
5. **Development was nearly free.** The entire development and testing phase cost $0.032 — validating the choice of a budget-tier default model during iteration.
