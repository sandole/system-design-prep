import type { CaseStudy } from "./types";

export const caseStudies1: CaseStudy[] = [
  {
    slug: "url-shortener",
    title: "Design a URL Shortener (bit.ly)",
    difficulty: "Easy",
    summary:
      "Design a service that converts long URLs into short, unique aliases and redirects users who visit the alias to the original URL. The core challenges are generating collision-free short codes at scale, serving redirects with very low latency, and handling a read-heavy workload that can be two orders of magnitude larger than writes.",
    functionalRequirements: [
      "Given a long URL, generate a unique short URL (e.g., short.ly/aB3xZ91).",
      "Redirect users who open a short URL to the original long URL.",
      "Support optional custom aliases chosen by the user.",
      "Support optional expiration times, after which the short URL stops working.",
      "Provide basic click analytics (total clicks, clicks over time) per short URL.",
    ],
    nonFunctionalRequirements: [
      "High availability: redirects are on the critical path for other sites, so target 99.99% uptime.",
      "Low latency: redirect lookups should complete in under 50 ms at p99.",
      "Short codes must be unguessable enough to avoid trivial enumeration, and must never collide.",
      "The system is read-heavy (roughly 100:1 read to write ratio) and must scale reads independently.",
      "Durability: once created, a mapping must never be lost, since links are embedded in emails and documents forever.",
    ],
    backOfEnvelope: [
      {
        label: "Write QPS",
        value: "100M new URLs/month ≈ 40 writes/sec, peak 2x ≈ 80/sec",
        note: "100M / (30 x 86,400) ≈ 38.6",
      },
      {
        label: "Read QPS",
        value: "100:1 read ratio → 4,000 reads/sec, peak 2x ≈ 8,000/sec",
        note: "Reads dominate; cache aggressively",
      },
      {
        label: "Storage (5 years)",
        value: "100M/month x 60 months = 6B rows x 500 bytes ≈ 3 TB",
        note: "Fits on a few sharded machines; storage is not the bottleneck",
      },
      {
        label: "Short code space",
        value: "Base62 with 7 chars = 62^7 ≈ 3.5 trillion codes",
        note: "6B needed over 5 years, so 7 characters is comfortable",
      },
      {
        label: "Cache size",
        value: "20% of daily reads x unique URLs ≈ 70M hot entries x 500 B ≈ 35 GB",
        note: "80/20 rule: cache the hot 20% and serve most traffic from memory",
      },
    ],
    apiDesign: [
      {
        endpoint: "POST /api/urls",
        description:
          "Create a short URL. Body: { longUrl, customAlias?, expiresAt? }. Returns { shortUrl, shortCode }. Idempotency key header recommended to avoid duplicates on retry.",
      },
      {
        endpoint: "GET /{shortCode}",
        description:
          "Redirect endpoint. Looks up the long URL and returns HTTP 301 (permanent, cacheable) or 302 (temporary, lets you keep counting clicks). Returns 404 if unknown or expired.",
      },
      {
        endpoint: "DELETE /api/urls/{shortCode}",
        description: "Delete or deactivate a short URL owned by the authenticated user.",
      },
      {
        endpoint: "GET /api/urls/{shortCode}/stats",
        description: "Return click analytics: total clicks, clicks by day, top referrers.",
      },
    ],
    highLevelDesign: [
      "Clients hit a load balancer that fronts a fleet of stateless API servers. Because the servers hold no session state, we can scale them horizontally behind the balancer and any server can handle any request. Writes (create URL) and reads (redirect) can be served by the same fleet, or split into separate services so the huge read volume never starves writes.",
      "On the write path, the API server obtains a unique ID and encodes it in Base62 to produce the short code. The cleanest approach is a Key Generation Service: an offline worker pre-generates batches of unique codes and stores them in a key database; API servers grab a batch of unused keys into memory and hand them out with zero collision risk and no coordination per request. The mapping (short_code → long_url, owner, expiry) is written to the primary datastore.",
      "On the read path, the server first checks a distributed cache (Redis) keyed by short code. On a hit, it issues the redirect immediately. On a miss, it reads the datastore, populates the cache with a TTL, and redirects. With a 100:1 read ratio and a heavily skewed popularity distribution, cache hit rates above 90% are realistic, which keeps p99 latency low and shields the database.",
      "The datastore itself can be a simple key-value store (DynamoDB, Cassandra) or sharded MySQL, since the access pattern is a single-key lookup with no joins. Shard by hash of the short code for even distribution. Click events are not written synchronously on the redirect path; instead the server emits an event to a message queue, and an analytics consumer aggregates counts in batches, keeping redirects fast.",
    ],
    dataModel: [
      {
        name: "urls",
        fields:
          "id BIGINT PK, short_code VARCHAR(7) UNIQUE, long_url TEXT, user_id BIGINT, created_at TIMESTAMP, expires_at TIMESTAMP NULL",
        note: "Index on short_code; this is the hot lookup path",
      },
      {
        name: "users",
        fields: "id BIGINT PK, email VARCHAR(255) UNIQUE, api_key VARCHAR(64), created_at TIMESTAMP",
      },
      {
        name: "click_events",
        fields: "event_id UUID PK, short_code VARCHAR(7), ts TIMESTAMP, referrer VARCHAR(255), country CHAR(2)",
        note: "Append-only; aggregated asynchronously into daily rollups",
      },
    ],
    deepDives: [
      {
        heading: "Short code generation: hashing vs counter vs key service",
        body:
          "Option 1 is hashing the long URL (MD5/SHA-256) and taking the first 7 Base62 characters. It is simple and deterministic, but truncation causes collisions that you must detect and resolve with retries, and the same URL from two users maps to one code, which breaks per-user analytics and expiry.\n\nOption 2 is a global auto-incrementing counter encoded in Base62. It guarantees uniqueness with no collision checks, but a single counter is a single point of failure and a scaling bottleneck, and sequential codes are enumerable, letting attackers scrape every link. You can mitigate enumeration by multiplying by a large prime modulo the keyspace or applying a bijective scramble.\n\nOption 3, the usual production answer, is a Key Generation Service: pre-generate random unique codes offline, store them partitioned into used and unused, and let each API server lease a block of a few thousand keys into memory. Handing out a key is a local in-memory operation, collisions are impossible by construction, and losing a server merely wastes its leased block, which is acceptable given 3.5 trillion possible codes.",
      },
      {
        heading: "301 vs 302 redirects and caching implications",
        body:
          "HTTP 301 (Moved Permanently) tells browsers and intermediate proxies to cache the mapping, so repeat visits skip your servers entirely. That reduces load dramatically but has two costs: you lose visibility into repeat clicks, so analytics undercount, and you cannot quickly retarget or kill a link because clients keep using the cached destination.\n\nHTTP 302/307 forces every click back through your service, giving accurate analytics and instant control over expiry and abuse takedowns, at the cost of higher traffic. Most commercial shorteners choose 302 because analytics is the product. A middle ground is 301 with a short Cache-Control max-age, which bounds staleness while still shedding some load.",
      },
      {
        heading: "Scaling reads: cache strategy and hot keys",
        body:
          "Use cache-aside with Redis: read cache, on miss read DB and populate with a TTL of hours to a day. Popularity follows a power law, so a modest cache absorbs the vast majority of reads. Evict with LRU and size the cluster around the hot set estimate (tens of GB).\n\nA single viral link can become a hot key that overwhelms one Redis shard. Mitigations: replicate the hot key across several cache nodes and randomize which replica a server reads, add a small in-process cache (a few thousand entries with a 1-5 second TTL) on each API server, and use request coalescing so concurrent misses for the same key trigger only one DB read.\n\nAlso protect against cache penetration: lookups for nonexistent codes always miss the cache and hit the DB. Cache negative results briefly, or keep a Bloom filter of all issued codes in front of the database so unknown codes are rejected in memory.",
      },
    ],
    bottlenecks: [
      "A single SQL instance cannot hold 6B rows with 8K QPS of reads; shard by hash of short_code and scale the cache tier first.",
      "Hot keys from viral links can saturate one cache shard; replicate hot entries and add per-server local caches.",
      "A naive global counter for ID generation is a single point of failure; use a key generation service or range-leased counters (e.g., via ZooKeeper).",
      "Writing click analytics synchronously on the redirect path adds latency; buffer events through a queue and aggregate asynchronously.",
      "Malicious enumeration and spam links require rate limiting on creation and a safe-browsing check pipeline.",
    ],
    keyTakeaways: [
      "Identify the read-to-write ratio early; a 100:1 read-heavy system is designed around its cache, not its database.",
      "Pre-generating keys (Key Generation Service) turns a hard distributed-uniqueness problem into a trivial local one.",
      "The 301 vs 302 choice is a product decision disguised as a technical one: caching efficiency vs analytics and control.",
      "Back-of-envelope math (62^7 ≈ 3.5T codes vs 6B needed) justifies design choices concretely in interviews.",
      "Keep the redirect path minimal: cache lookup plus redirect; push everything else (analytics, expiry cleanup) off the critical path.",
    ],
    relatedTopics: ["caching", "sharding-and-partitioning", "sql-vs-nosql", "load-balancing", "probabilistic-data-structures"],
    rapidImplementation: {
      stack: "Next.js API routes + Postgres + Redis (Upstash free tier) on a $6 VPS or Vercel hobby plan behind Cloudflare",
      steps: [
        "Create a urls table: id BIGSERIAL PK, short_code VARCHAR(7) with a UNIQUE index, long_url TEXT, created_at, expires_at NULL.",
        "Write a base62 encoder that turns the auto-increment id into a short code, offset by a large constant (e.g. 100000000) so codes start at 5-6 chars.",
        "Build POST /api/urls: validate the URL with the URL constructor, insert the row, encode the returned id, update the row with the code, return short URL.",
        "Support custom aliases by inserting the alias directly and catching the Postgres 23505 unique-violation error to return 409.",
        "Build GET /[code]: look up Redis first, fall back to Postgres, SET the code in Redis with a 24h TTL, respond with a 302 redirect.",
        "Fire-and-forget an INCR on clicks:{code} in Redis on each redirect; flush counts to Postgres with a cron every minute.",
        "Add a nightly cron that deletes or deactivates rows where expires_at < now().",
        "Point Cloudflare at the app and enable caching of 404s to blunt enumeration scans.",
      ],
      codeSketches: [
        {
          title: "Base62 encode from auto-increment id",
          language: "typescript",
          code: `const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const OFFSET = 100_000_000n; // avoid tiny 1-2 char codes

export function encodeBase62(id: bigint): string {
  let n = id + OFFSET;
  let out = "";
  while (n > 0n) {
    out = ALPHABET[Number(n % 62n)] + out;
    n = n / 62n;
  }
  return out;
}

export function decodeBase62(code: string): bigint {
  let n = 0n;
  for (const ch of code) {
    n = n * 62n + BigInt(ALPHABET.indexOf(ch));
  }
  return n - OFFSET;
}`,
        },
        {
          title: "Create endpoint: insert, encode, retry on alias collision",
          language: "typescript",
          code: `async function createShortUrl(longUrl: string, alias?: string) {
  new URL(longUrl); // throws on invalid input
  if (alias) {
    try {
      await sql(
        "INSERT INTO urls (short_code, long_url) VALUES ($1, $2)",
        [alias, longUrl]
      );
      return alias;
    } catch (e: any) {
      if (e.code === "23505") throw new Error("alias taken"); // 409
      throw e;
    }
  }
  // id-based codes cannot collide: insert first, derive code from id
  const rows = await sql(
    "INSERT INTO urls (short_code, long_url) VALUES ('pending', $1) RETURNING id",
    [longUrl]
  );
  const code = encodeBase62(BigInt(rows[0].id));
  await sql("UPDATE urls SET short_code = $1 WHERE id = $2", [code, rows[0].id]);
  return code;
}`,
        },
        {
          title: "Redirect handler with cache-aside Redis",
          language: "typescript",
          code: `export async function GET(req: Request, ctx: { params: { code: string } }) {
  const { code } = ctx.params;
  let longUrl = await redis.get("url:" + code);
  if (!longUrl) {
    const rows = await sql(
      "SELECT long_url FROM urls WHERE short_code = $1 AND (expires_at IS NULL OR expires_at > now())",
      [code]
    );
    if (rows.length === 0) return new Response("Not found", { status: 404 });
    longUrl = rows[0].long_url;
    await redis.set("url:" + code, longUrl, { ex: 86400 });
  }
  redis.incr("clicks:" + code); // not awaited, off the hot path
  return Response.redirect(longUrl, 302);
}`,
        },
      ],
    },
  },
  {
    slug: "rate-limiter",
    title: "Design a Distributed Rate Limiter",
    difficulty: "Medium",
    summary:
      "Design a service that limits how many requests a client can make in a time window (e.g., 100 requests per minute per user) across a fleet of many API servers. The core challenges are choosing an algorithm with the right burst and accuracy tradeoffs, sharing counter state across servers with low latency, and deciding how the limiter should fail.",
    functionalRequirements: [
      "Limit requests per client key (user ID, API key, or IP) within configurable time windows.",
      "Support multiple rules per route and per tier (e.g., free users 100/min, paid users 1,000/min).",
      "Return HTTP 429 with headers (X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After) when a client is throttled.",
      "Enforce limits consistently across all API servers, not per server.",
      "Allow operators to update rules dynamically without redeploying services.",
    ],
    nonFunctionalRequirements: [
      "Very low overhead: the limiter check must add no more than 1-2 ms to each request.",
      "High availability: the limiter must not become a single point of failure for the whole API.",
      "Defined failure mode: choose and document fail-open (allow traffic) vs fail-closed (reject traffic) when the limiter is unreachable.",
      "Accuracy: small transient over-admission is acceptable; large systematic over-admission is not.",
      "Memory efficiency: support tens of millions of active client keys with bounded memory.",
    ],
    backOfEnvelope: [
      {
        label: "Request volume",
        value: "10M DAU x 50 requests/day = 500M req/day ≈ 5,800 QPS, peak 3x ≈ 17K QPS",
        note: "Every request performs at least one limiter check",
      },
      {
        label: "Active keys",
        value: "10M users x 3 rules (per-route, per-user, per-IP) = 30M counters",
      },
      {
        label: "Memory per counter",
        value: "Token bucket state ≈ key (40 B) + tokens (8 B) + last_refill (8 B) + overhead ≈ 100 B",
        note: "30M x 100 B ≈ 3 GB, fits in one Redis cluster easily",
      },
      {
        label: "Redis load",
        value: "17K QPS x 1 Lua script call each ≈ 17K Redis ops/sec",
        note: "A single Redis node handles ~100K ops/sec; shard by key for headroom",
      },
      {
        label: "Added latency",
        value: "Same-AZ Redis round trip ≈ 0.5-1 ms",
        note: "Acceptable; cross-region calls (30-100 ms) are not, so keep limiter state regional",
      },
    ],
    apiDesign: [
      {
        endpoint: "POST /api/ratelimit/check",
        description:
          "Internal call from API gateway or middleware. Body: { key, rule }. Returns { allowed: boolean, remaining, retryAfterMs }. Usually implemented as a library plus Redis rather than an HTTP hop.",
      },
      {
        endpoint: "PUT /api/ratelimit/rules/{ruleId}",
        description:
          "Operator endpoint to create or update a rule: { routePattern, keyType, limit, windowSeconds, tierOverrides }. Rules propagate to workers via config push or a watched store.",
      },
      {
        endpoint: "GET /api/ratelimit/rules",
        description: "List all active rules for auditing and debugging.",
      },
      {
        endpoint: "GET /api/ratelimit/usage/{key}",
        description: "Inspect current counter state for a client key, used by support and abuse teams.",
      },
    ],
    highLevelDesign: [
      "Place the rate limiter as middleware in the API gateway, in front of all application services. Every incoming request is mapped to one or more limit keys (user:123:route:/search, ip:1.2.3.4) and each key is checked against its rule before the request is forwarded. Rejected requests get a 429 with Retry-After, so clients can back off instead of hammering.",
      "Counter state cannot live in per-server memory because a load balancer spreads one client across many servers; each server would enforce N times the intended limit. So counters live in a shared, fast store: Redis, sharded by limit key using consistent hashing. Each check is a single Lua script executed atomically on the shard owning that key, which reads the counter, applies the algorithm, and returns allow or deny in one round trip.",
      "Rules live in a configuration store (e.g., a small database or etcd) and are cached in each gateway worker's memory, refreshed on change notification. This keeps the hot path free of rule lookups: the only network call per request is the one Redis operation.",
      "For resilience, each gateway also keeps a small local fallback limiter (an in-memory token bucket with a generous limit). If Redis times out, the gateway applies the local limiter and allows the request (fail-open), emitting metrics so operators see degraded accuracy. Throttling events are logged asynchronously to a queue for abuse analytics and alerting.",
    ],
    dataModel: [
      {
        name: "rules",
        fields:
          "rule_id BIGINT PK, route_pattern VARCHAR(255), key_type VARCHAR(20), limit_count INT, window_seconds INT, tier VARCHAR(20), updated_at TIMESTAMP",
        note: "Small table, cached in every gateway worker",
      },
      {
        name: "counters (Redis)",
        fields: "key STRING (e.g. rl:user:123:search), tokens FLOAT, last_refill_ms BIGINT, TTL = window x 2",
        note: "Token bucket state; TTL evicts idle keys so memory stays bounded",
      },
      {
        name: "throttle_events",
        fields: "event_id UUID PK, key VARCHAR(128), rule_id BIGINT, ts TIMESTAMP, server_id VARCHAR(64)",
        note: "Written asynchronously for abuse detection and dashboards",
      },
    ],
    deepDives: [
      {
        heading: "Algorithm choice: token bucket vs windows",
        body:
          "Token bucket gives each key a bucket of capacity B that refills at rate R per second. A request consumes one token; if the bucket is empty the request is rejected. It allows controlled bursts up to B while enforcing a long-run average of R, uses constant memory per key (two numbers), and refill can be computed lazily from the timestamp, so no background process is needed. This is the default answer for API rate limiting.\n\nFixed window counters (increment a counter per key per minute) are the simplest but suffer the boundary problem: a client can send the full limit at 0:59 and again at 1:01, achieving 2x the limit across the boundary. Sliding window log stores a timestamp per request and is perfectly accurate, but memory grows with the request rate, which is unacceptable for high-volume keys.\n\nSliding window counter is the practical compromise: keep the current and previous fixed-window counts and estimate the sliding count as current + previous x overlap fraction. It smooths the boundary problem with constant memory. Cloudflare famously runs this and reported that the approximation misjudges only a tiny fraction of requests in practice.",
      },
      {
        heading: "Race conditions and atomicity in a shared store",
        body:
          "A naive GET, compute, SET sequence against Redis is racy: two gateway servers can read the same counter value concurrently and both admit a request that should have been the last one. Under high concurrency this systematically over-admits.\n\nThe fix is to make the read-modify-write atomic on the Redis server. A Lua script (or a MULTI/EXEC transaction) that refills the bucket, checks tokens, decrements, and returns the verdict executes as one atomic unit per key. Since all state for one key lives on one shard, no cross-shard coordination is needed, and the algorithm remains one round trip per check.\n\nAn alternative for extreme throughput is local batching: each gateway leases a quota slice (say 10% of a key's limit) from the central store and enforces it locally, re-leasing as it runs out. This cuts Redis traffic by an order of magnitude at the cost of some accuracy when traffic is unevenly spread across gateways.",
      },
      {
        heading: "Failure modes: fail-open vs fail-closed",
        body:
          "When Redis is slow or down, the limiter must decide instantly. Fail-open (allow all traffic) preserves availability for legitimate users but leaves the backend unprotected exactly when an attack might be the cause of the failure. Fail-closed (reject everything) protects the backend but turns a limiter outage into a full API outage.\n\nThe usual production stance: fail-open for user-facing product APIs, because availability is the point, but pair it with per-gateway local fallback limits so a runaway client is still capped. For security-sensitive endpoints such as login and OTP verification, fail-closed is often correct, because unthrottled credential stuffing is worse than a temporary login outage.\n\nWhichever you pick, use tight timeouts (a few ms) on the limiter call, circuit-break to the fallback quickly, and alarm loudly on fallback engagement so degraded enforcement never goes unnoticed.",
      },
    ],
    bottlenecks: [
      "A single Redis node caps throughput and is a single point of failure; shard counters by key and run replicas with automatic failover.",
      "One abusive key checked at extreme rates becomes a hot shard; mitigate with local quota leasing or short-TTL local caching of deny verdicts.",
      "Cross-region synchronization of counters adds 30-100 ms; keep limits regional and accept that a global client gets roughly regions x limit, or route each key to a home region.",
      "Unbounded key cardinality (e.g., limits per IP under a spoofed-IP flood) can exhaust memory; enforce TTLs on counters and cap tracked key count.",
      "Placing the limiter as a separate HTTP service doubles per-request hops; prefer an in-process library talking directly to the counter store.",
    ],
    keyTakeaways: [
      "Token bucket is the go-to algorithm: constant memory, tunable bursts, lazy refill; sliding window counter is the best window-based compromise.",
      "Distributed enforcement requires shared state plus atomic updates; a Lua script on a key-sharded Redis is the standard pattern.",
      "Always state the failure mode explicitly: fail-open with local fallback for product APIs, fail-closed for auth endpoints.",
      "Return 429 with Retry-After so well-behaved clients back off; rate limiting is a contract with clients, not just a defense.",
      "Keep the hot path to exactly one network round trip; rules and configuration belong in local caches.",
    ],
    relatedTopics: ["rate-limiting", "caching", "consistent-hashing", "fault-tolerance", "api-design"],
    rapidImplementation: {
      stack: "Node.js (Express or Next.js middleware) + a single Redis instance (Upstash free tier or Docker on a $6 VPS)",
      steps: [
        "Run Redis locally with docker run -p 6379:6379 redis and connect with ioredis.",
        "Write the token bucket as a Lua script (refill from elapsed time, decrement, return allowed + remaining) and load it once with redis.defineCommand.",
        "Store per-key state in a Redis hash rl:{key} with fields tokens and last_refill_ms, and set PEXPIRE to 2x the refill window so idle keys evict themselves.",
        "Wrap the script call in an Express middleware that builds the key from user id (or req.ip as fallback) plus route, with a 5 ms timeout on the Redis call.",
        "On deny, respond 429 with X-RateLimit-Limit, X-RateLimit-Remaining, and Retry-After headers computed from the script's return values.",
        "On Redis timeout or error, fail open: allow the request, apply a small in-process fallback bucket per key, and increment a limiter_degraded metric.",
        "Keep rules in a rules.json (routePattern, limit, windowSeconds) loaded at boot and hot-reloaded on file change; match longest prefix per request.",
        "Verify atomicity by hammering one key from two processes with autocannon and asserting admitted count never exceeds the limit.",
      ],
      codeSketches: [
        {
          title: "Atomic token bucket as a Redis Lua script",
          language: "typescript",
          code: `// KEYS[1] = bucket key, ARGV = [capacity, refillPerSec, nowMs, cost]
export const TOKEN_BUCKET_LUA = [
  "local capacity = tonumber(ARGV[1])",
  "local rate = tonumber(ARGV[2])",
  "local now = tonumber(ARGV[3])",
  "local cost = tonumber(ARGV[4])",
  "local state = redis.call('HMGET', KEYS[1], 'tokens', 'ts')",
  "local tokens = tonumber(state[1]) or capacity",
  "local ts = tonumber(state[2]) or now",
  "tokens = math.min(capacity, tokens + (now - ts) / 1000 * rate)",
  "local allowed = 0",
  "if tokens >= cost then",
  "  tokens = tokens - cost",
  "  allowed = 1",
  "end",
  "redis.call('HSET', KEYS[1], 'tokens', tokens, 'ts', now)",
  "redis.call('PEXPIRE', KEYS[1], math.ceil(capacity / rate * 2000))",
  "return { allowed, tostring(tokens) }",
].join("\\n");`,
        },
        {
          title: "Express middleware calling the script",
          language: "typescript",
          code: `redis.defineCommand("tokenBucket", { numberOfKeys: 1, lua: TOKEN_BUCKET_LUA });

export function rateLimit(limit: number, windowSeconds: number) {
  const ratePerSec = limit / windowSeconds;
  return async (req: any, res: any, next: any) => {
    const key = "rl:" + (req.user?.id ?? req.ip) + ":" + req.path;
    try {
      const [allowed, tokens] = await withTimeout(
        redis.tokenBucket(key, limit, ratePerSec, Date.now(), 1),
        5 // ms budget; fail open past this
      );
      res.set("X-RateLimit-Limit", String(limit));
      res.set("X-RateLimit-Remaining", String(Math.floor(Number(tokens))));
      if (allowed === 1) return next();
      const retryMs = Math.ceil(((1 - Number(tokens)) / ratePerSec) * 1000);
      res.set("Retry-After", String(Math.ceil(retryMs / 1000)));
      return res.status(429).json({ error: "rate limited" });
    } catch {
      metrics.increment("limiter_degraded");
      return next(); // fail open, backed by a local fallback bucket
    }
  };
}`,
        },
        {
          title: "In-process fallback bucket for Redis outages",
          language: "typescript",
          code: `type Bucket = { tokens: number; ts: number };
const local = new Map<string, Bucket>();

export function localAllow(key: string, capacity: number, ratePerSec: number): boolean {
  const now = Date.now();
  const b = local.get(key) ?? { tokens: capacity, ts: now };
  b.tokens = Math.min(capacity, b.tokens + ((now - b.ts) / 1000) * ratePerSec);
  b.ts = now;
  if (b.tokens < 1) {
    local.set(key, b);
    return false;
  }
  b.tokens -= 1;
  local.set(key, b);
  if (local.size > 50_000) local.clear(); // crude memory cap for an MVP
  return true;
}`,
        },
      ],
    },
  },
  {
    slug: "news-feed",
    title: "Design a News Feed (Twitter/Facebook)",
    difficulty: "Hard",
    summary:
      "Design the system that lets users post content and see a ranked, near-real-time feed of posts from people they follow. The defining challenge is the fan-out problem: how a single post reaches millions of followers' feeds efficiently, and how to blend fan-out on write with fan-out on read to handle celebrity accounts without melting the infrastructure.",
    functionalRequirements: [
      "Users can publish posts (text up to 280 chars, images, video references).",
      "Users can follow and unfollow other users.",
      "Users see a feed of recent posts from accounts they follow, in reverse-chronological or ranked order.",
      "Feed supports infinite scroll with cursor-based pagination.",
      "Users can like and reply to posts, with counts visible in the feed.",
      "New posts from followees appear in the feed within seconds (near real time).",
    ],
    nonFunctionalRequirements: [
      "Feed read latency under 200 ms at p99, since feed load is the app's front door.",
      "High availability (99.99%); a stale feed is acceptable, an error page is not.",
      "Eventual consistency is acceptable: a post may take a few seconds to reach all followers.",
      "Scale: hundreds of millions of DAU, with follower counts ranging from 10 to 100M+.",
      "The write path must absorb extreme skew: one celebrity post triggers work proportional to follower count.",
    ],
    backOfEnvelope: [
      {
        label: "Feed read QPS",
        value: "200M DAU x 10 feed loads/day = 2B reads/day ≈ 23K QPS, peak 2x ≈ 46K QPS",
      },
      {
        label: "Post write QPS",
        value: "200M DAU x 0.5 posts/day = 100M posts/day ≈ 1,200 QPS, peak 5x ≈ 6K QPS",
        note: "Reads outnumber post writes ~20:1, before fan-out amplification",
      },
      {
        label: "Fan-out amplification",
        value: "Avg 200 followers x 100M posts/day = 20B feed-cache inserts/day ≈ 230K writes/sec",
        note: "This is why fan-out is the core design problem",
      },
      {
        label: "Celebrity worst case",
        value: "1 post x 100M followers = 100M inserts; at 100K inserts/sec that is ~17 minutes of lag",
        note: "Motivates the hybrid push/pull approach",
      },
      {
        label: "Feed cache memory",
        value: "200M users x 300 post IDs x 30 B ≈ 1.8 TB",
        note: "Sharded Redis storing only IDs; post bodies hydrated from a separate post cache",
      },
    ],
    apiDesign: [
      {
        endpoint: "POST /api/posts",
        description: "Create a post. Body: { text, mediaIds? }. Returns the post object. Triggers async fan-out.",
      },
      {
        endpoint: "GET /api/feed?cursor={cursor}&limit=20",
        description:
          "Fetch the viewer's home feed page. Cursor encodes (rank_score or timestamp, post_id) of the last item, so pagination is stable as new posts arrive.",
      },
      {
        endpoint: "POST /api/users/{userId}/follow",
        description: "Follow a user. DELETE on the same path unfollows. Updates the social graph service.",
      },
      {
        endpoint: "POST /api/posts/{postId}/like",
        description: "Like a post; counts are aggregated asynchronously and cached.",
      },
    ],
    highLevelDesign: [
      "Clients talk to a gateway that routes to three main services: a post service (create/read posts), a social graph service (follow relationships), and a feed service (assemble the home timeline). Posts are written to a sharded post store and to a post cache, then the post ID is dropped onto a message queue for asynchronous fan-out, so the publish call returns quickly regardless of follower count.",
      "Fan-out workers consume the queue. For a normal user's post, they query the graph service for follower IDs and push the post ID into each follower's feed cache, a Redis sorted set or list per user holding the most recent few hundred post IDs. This is fan-out on write (push): feeds are precomputed, so reading a feed is a single cache fetch, which is what makes 46K read QPS cheap.",
      "For celebrity accounts above a follower threshold (say 100K), workers skip the push entirely. Instead, at read time the feed service pulls: it fetches the viewer's precomputed feed from cache, fetches recent posts from the short list of celebrities the viewer follows, merges the two streams by time or rank, and returns the page. This hybrid keeps write amplification bounded while keeping reads to a handful of cache lookups.",
      "Feed responses hydrate post IDs into full content via the post cache, batch-fetch author profiles and like counts, then apply ranking (a lightweight ML scoring pass over the candidate set) before returning. Everything on the read path is cache-first; the databases (posts store, graph store) are the source of truth and backfill caches on miss.",
      "Storage: posts in a sharded store keyed by post ID (Cassandra or sharded MySQL, partitioned by user_id so an author's posts colocate), the social graph in a store optimized for both follower and followee lookups (two adjacency tables or a graph store), and counters in a separate aggregated counters service fed by events.",
    ],
    dataModel: [
      {
        name: "posts",
        fields:
          "post_id BIGINT PK (snowflake, time-sortable), author_id BIGINT, text VARCHAR(500), media_refs JSON, created_at TIMESTAMP",
        note: "Sharded by author_id; snowflake IDs give free chronological ordering",
      },
      {
        name: "follows",
        fields: "follower_id BIGINT, followee_id BIGINT, created_at TIMESTAMP, PK (follower_id, followee_id)",
        note: "Second index or mirrored table keyed by followee_id for fan-out lookups",
      },
      {
        name: "feed_cache (Redis)",
        fields: "key feed:{user_id}, sorted set of (post_id, score=timestamp or rank), trimmed to ~300 entries",
        note: "Not durable; rebuilt on miss by pulling from followees' recent posts",
      },
      {
        name: "post_counters",
        fields: "post_id BIGINT PK, like_count BIGINT, reply_count BIGINT, updated_at TIMESTAMP",
        note: "Updated by async aggregation, never by synchronous increment on the read path",
      },
    ],
    deepDives: [
      {
        heading: "Fan-out on write vs fan-out on read",
        body:
          "Fan-out on write (push) precomputes every user's feed at post time: when Alice posts, insert her post ID into each of her followers' feed caches. Reads become O(1) cache fetches, latency is excellent, and it fits the read-heavy ratio. The costs: write amplification proportional to follower count, wasted work for inactive users whose feeds are computed but never read, and hot-spot writes when a big account posts.\n\nFan-out on read (pull) computes the feed at request time: fetch the viewer's followee list, fetch each followee's recent posts, merge and rank. Writes are O(1) and no work is wasted on inactive users, but every feed load costs hundreds of reads plus a merge, which at 46K QPS is untenable for latency and load.\n\nNo large feed system uses either extreme. The interview answer is: push by default because reads dominate, pull for the exceptional cases (celebrities, inactive users, cold caches). Also skip pushing to users inactive for, say, 30 days; rebuild their feed on demand via pull when they return.",
      },
      {
        heading: "The celebrity (hot user) problem",
        body:
          "A user with 100M followers breaks pure push: a single post triggers 100M cache inserts, which takes minutes even at 100K inserts/sec, floods the queue ahead of normal users' posts, and briefly doubles global write load. Meanwhile followers see wildly different delivery times, and a burst of celebrity activity (a live event) can back the pipeline up for everyone.\n\nThe hybrid fix: mark accounts above a follower threshold as hot. Their posts are written to the post store and a hot posts cache only, with no fan-out. At read time, the feed service merges the viewer's pushed feed with a pull of recent posts from the (small) set of hot accounts the viewer follows. Since almost everyone follows only a handful of hot accounts, this pull adds only a few cache reads per feed load.\n\nEdge cases worth mentioning: the threshold should have hysteresis so accounts crossing it do not flip-flop between modes; when an account transitions to hot you can simply stop pushing (old entries age out of the 300-entry feeds naturally); and the hot posts cache must itself be replicated because every feed read in the system may touch it.",
      },
      {
        heading: "Feed ranking and pagination",
        body:
          "Reverse-chronological feeds are simple but modern feeds rank by predicted engagement. Architecturally, ranking is a second stage on the read path: gather a candidate set (the ~300 cached IDs plus pulled celebrity posts), hydrate lightweight features (author affinity, recency, engagement counts), score with a fast model under a strict latency budget (~50 ms), and return the top N. Keep the scorer stateless and feature fetches batched so the p99 stays inside 200 ms.\n\nPagination must be cursor-based, not offset-based. Offsets break when new posts prepend to the feed between page fetches, causing duplicates or gaps. A cursor encoding (score, post_id) of the last returned item lets the next page resume deterministically from that point in the sorted set.\n\nConsistency expectations should be stated: it is fine if a follower sees a post 5 seconds late (eventual consistency via async fan-out), but a user must always immediately see their own post, so the client inserts it optimistically or the feed service unions the viewer's own recent posts into the response (read-your-writes).",
      },
      {
        heading: "Keeping counters and the graph fast",
        body:
          "Like counts on viral posts receive tens of thousands of increments per second; doing a synchronous DB increment per like would serialize on one row. Instead, likes are events on a queue; aggregation workers batch increments (or use a sharded counter split across N rows summed on read) and publish totals into cache. Counts shown in feeds are seconds stale, which nobody notices.\n\nThe follow graph needs both directions: who does X follow (feed pull, profile) and who follows X (fan-out). Store both adjacency lists, sharded by the key you query on. Follower lists for hot accounts are huge, so fan-out workers stream them in chunks rather than loading 100M IDs into memory, and the graph service exposes a paginated followers iterator for exactly this purpose.",
      },
    ],
    bottlenecks: [
      "Celebrity fan-out floods the write pipeline; solve with the hybrid push/pull split at a follower threshold.",
      "Feed cache (1.8 TB) must be sharded; a resharding event or shard loss forces expensive feed rebuilds, so plan consistent hashing and replicas.",
      "Hot posts cache is read by nearly every feed request during a viral moment; replicate it and add per-server local caching.",
      "Synchronous counter updates on viral posts serialize on single rows; batch through queues or shard the counters.",
      "Fan-out queue backlog delays delivery for everyone; isolate queues by author tier so a hot account cannot starve normal traffic.",
    ],
    keyTakeaways: [
      "The feed problem is the fan-out problem: push precomputes reads, pull avoids write amplification, and real systems blend both.",
      "Set the threshold explicitly in interviews (e.g., push under 100K followers, pull above) and explain the read-time merge.",
      "Feeds are eventually consistent except read-your-writes: users must see their own posts immediately.",
      "Store IDs in feed caches and hydrate content separately; it keeps caches small and post edits consistent.",
      "Cursor pagination and async counter aggregation are small details that separate senior answers from junior ones.",
    ],
    relatedTopics: ["caching", "message-queues", "sharding-and-partitioning", "event-driven-architecture", "consistency-and-cap"],
    rapidImplementation: {
      stack: "Next.js + Postgres + Redis on one $12 VPS; BullMQ (Redis-backed) as the fan-out queue, no Kafka needed for an MVP",
      steps: [
        "Create tables: posts (id BIGSERIAL, author_id, text, created_at) and follows (follower_id, followee_id, PK on the pair, plus an index on followee_id).",
        "Add a celebrity flag: is_celebrity boolean on users, set true above 10K followers by a nightly job (pick a low threshold so you can demo the hybrid path).",
        "Build POST /api/posts: insert the post, then enqueue a BullMQ fanout job with { postId, authorId } and return immediately.",
        "Write the fan-out worker: skip if the author is a celebrity, else page through follower ids 1000 at a time and LPUSH the post id into feed:{followerId}, LTRIM to 300.",
        "Build GET /api/feed: LRANGE the viewer's feed:{userId} list, pull recent post ids from celebrities the viewer follows via one SQL query, merge by created_at.",
        "Hydrate the merged id list with one SELECT ... WHERE id = ANY($1) and return posts sorted desc with a (created_at, id) cursor for pagination.",
        "Union the viewer's own posts from the last minute into the response so users always see their own post instantly (read-your-writes).",
        "Seed 10K fake users and 100K follows with a script, then verify a celebrity post appears in feeds without any fan-out writes.",
      ],
      codeSketches: [
        {
          title: "Fan-out-on-write worker (skips celebrities)",
          language: "typescript",
          code: `import { Worker } from "bullmq";

new Worker("fanout", async (job) => {
  const { postId, authorId } = job.data;
  const author = await sql("SELECT is_celebrity FROM users WHERE id = $1", [authorId]);
  if (author[0].is_celebrity) return; // pulled at read time instead

  let cursor = 0;
  for (;;) {
    const followers = await sql(
      "SELECT follower_id FROM follows WHERE followee_id = $1 AND follower_id > $2 ORDER BY follower_id LIMIT 1000",
      [authorId, cursor]
    );
    if (followers.length === 0) break;
    const pipe = redis.pipeline();
    for (const f of followers) {
      pipe.lpush("feed:" + f.follower_id, String(postId));
      pipe.ltrim("feed:" + f.follower_id, 0, 299);
    }
    await pipe.exec();
    cursor = followers[followers.length - 1].follower_id;
  }
}, { connection: redis });`,
        },
        {
          title: "Hybrid feed read: cached push feed merged with celebrity pull",
          language: "typescript",
          code: `async function getFeed(userId: number, limit = 20) {
  // 1. precomputed feed from fan-out on write
  const pushedIds = (await redis.lrange("feed:" + userId, 0, 299)).map(Number);

  // 2. pull recent posts from celebrities this user follows
  const pulled = await sql(
    "SELECT p.id FROM posts p " +
    "JOIN follows f ON f.followee_id = p.author_id " +
    "JOIN users u ON u.id = p.author_id " +
    "WHERE f.follower_id = $1 AND u.is_celebrity " +
    "AND p.created_at > now() - interval '48 hours' " +
    "ORDER BY p.id DESC LIMIT 100",
    [userId]
  );

  // 3. merge, dedup, hydrate (snowflake-style ids sort by time)
  const ids = [...new Set([...pushedIds, ...pulled.map((r: any) => Number(r.id))])]
    .sort((a, b) => b - a)
    .slice(0, limit);
  const posts = await sql(
    "SELECT id, author_id, text, created_at FROM posts WHERE id = ANY($1)",
    [ids]
  );
  return ids.map((id) => posts.find((p: any) => Number(p.id) === id));
}`,
        },
      ],
    },
  },
  {
    slug: "chat-system",
    title: "Design a Chat System (WhatsApp/Slack)",
    difficulty: "Hard",
    summary:
      "Design a messaging system supporting one-on-one and group chats with real-time delivery, message ordering, online presence, and read receipts. The core challenges are maintaining millions of long-lived WebSocket connections, routing messages between users connected to different servers, guaranteeing per-conversation ordering, and syncing state across a user's multiple devices.",
    functionalRequirements: [
      "One-on-one chat with real-time delivery when both parties are online.",
      "Group chat supporting up to a few hundred members per group.",
      "Offline delivery: messages sent while a recipient is offline are delivered when they reconnect.",
      "Online presence indicators (online, away, last seen).",
      "Sent, delivered, and read receipts per message.",
      "Multi-device support: the same account on phone and desktop sees a consistent history.",
    ],
    nonFunctionalRequirements: [
      "Delivery latency under 100 ms between online users in the same region.",
      "At-least-once delivery with client-side deduplication; a message must never be silently lost.",
      "Per-conversation ordering: all participants see messages in the same order.",
      "Scale to 50M concurrent connections and billions of messages per day.",
      "Message history durable and available; support end-to-end encryption as a design consideration.",
    ],
    backOfEnvelope: [
      {
        label: "Concurrent connections",
        value: "500M DAU, ~10% concurrently connected ≈ 50M WebSocket connections",
        note: "At ~200K connections per gateway server, ~250-300 servers",
      },
      {
        label: "Message QPS",
        value: "500M DAU x 40 msgs/day = 20B msgs/day ≈ 230K msgs/sec, peak 3x ≈ 700K/sec",
      },
      {
        label: "Storage per day",
        value: "20B msgs x 100 bytes avg ≈ 2 TB/day, ~730 TB/year",
        note: "Write-heavy, append-only: a natural fit for wide-column stores like Cassandra/HBase",
      },
      {
        label: "Group amplification",
        value: "1 msg to a 200-member group = up to 200 deliveries; groups multiply delivery traffic ~5-10x",
      },
      {
        label: "Presence event volume",
        value: "50M users x connect/disconnect + heartbeats every 30s ≈ 1.7M presence events/sec if broadcast naively",
        note: "Motivates lazy, subscription-based presence instead of global broadcast",
      },
    ],
    apiDesign: [
      {
        endpoint: "WSS /ws/connect",
        description:
          "Upgrade to WebSocket after auth. All real-time traffic (send, receive, ack, typing, presence) flows as frames over this connection. Client heartbeats every ~30s.",
      },
      {
        endpoint: "POST /api/messages",
        description:
          "HTTP fallback to send a message: { conversationId, clientMsgId, content }. clientMsgId makes retries idempotent. Primary path is the WebSocket frame equivalent.",
      },
      {
        endpoint: "GET /api/conversations/{id}/messages?before={cursor}&limit=50",
        description: "Fetch message history for a conversation, paginated backwards by (conversation, sequence) cursor.",
      },
      {
        endpoint: "POST /api/groups",
        description: "Create a group: { name, memberIds }. Membership changes go through this service and are broadcast as system messages.",
      },
      {
        endpoint: "POST /api/messages/{id}/receipt",
        description: "Report delivered/read status; typically sent as a batched WebSocket frame rather than per-message HTTP.",
      },
    ],
    highLevelDesign: [
      "Split stateless HTTP services (auth, profile, group management, history fetch) from stateful chat gateways that hold WebSocket connections. A client first calls a service-discovery endpoint that returns the best gateway (by region and load), then opens a WebSocket and authenticates. Gateways are the only stateful tier; everything behind them scales as ordinary services.",
      "A session registry (Redis) maps user_id → { gateway_id, device_ids }. When Alice sends a message to Bob, her gateway persists the message, looks up Bob's gateway in the registry, and forwards the message to it, which pushes the frame down Bob's socket. If Bob is offline, the message rests in storage and a push notification is triggered; on reconnect Bob's client syncs everything after its last received sequence number.",
      "Message flow is persist-then-deliver: the sender's frame goes to a message service that assigns a per-conversation sequence number, writes to the message store (Cassandra, partitioned by conversation_id, clustered by sequence), acks the sender (single check), then routes to recipient gateways (second check on delivery, blue checks when read receipts come back). Persisting before delivery is what makes at-least-once possible.",
      "Group messages route through the same path with a fan-out step: the message service reads the member list, groups members by their current gateway, and sends one inter-server message per gateway rather than per member, letting each gateway deliver locally to its connected members. Offline members rely on the same sync-on-reconnect mechanism as one-on-one chat.",
      "Presence is its own service: gateways report connect/disconnect and heartbeat timeouts into a presence store, and clients subscribe to presence only for the contacts currently visible on screen, fetched lazily and pushed on change. This turns an O(users x friends) broadcast problem into a bounded pub/sub problem.",
    ],
    dataModel: [
      {
        name: "messages",
        fields:
          "conversation_id BIGINT PARTITION KEY, seq BIGINT CLUSTERING KEY, message_id UUID, sender_id BIGINT, content BLOB, created_at TIMESTAMP, type TINYINT",
        note: "Wide-column layout: one partition per conversation, ordered by seq for cheap range scans",
      },
      {
        name: "conversations",
        fields: "conversation_id BIGINT PK, type TINYINT (dm/group), created_at TIMESTAMP, last_seq BIGINT",
      },
      {
        name: "group_members",
        fields: "conversation_id BIGINT, user_id BIGINT, role TINYINT, joined_at TIMESTAMP, last_read_seq BIGINT, PK (conversation_id, user_id)",
        note: "last_read_seq powers read receipts and unread counts",
      },
      {
        name: "session_registry (Redis)",
        fields: "key user:{id}:sessions → set of { gateway_id, device_id, connected_at }, TTL refreshed by heartbeat",
        note: "Ephemeral; the source of truth for where to route real-time frames",
      },
    ],
    deepDives: [
      {
        heading: "WebSockets and the stateful gateway tier",
        body:
          "HTTP polling wastes resources and long polling still reopens connections constantly; chat needs a persistent, bidirectional channel, which is exactly what WebSockets provide. Each gateway holds hundreds of thousands of mostly idle connections; the limits are file descriptors, memory per connection (a few KB), and heartbeat processing, not CPU.\n\nStatefulness is the operational cost. You cannot round-robin frames to any server: Bob's frames must reach the specific gateway holding Bob's socket, hence the session registry. Deploys and failures disconnect every client on a gateway, so clients must reconnect with jittered exponential backoff (to avoid a thundering herd) and then run the sync protocol to fetch anything missed while disconnected.\n\nGateways should do almost nothing: authenticate, maintain heartbeats, forward frames to backend services, and push frames down sockets. All business logic (persistence, sequencing, fan-out) lives in stateless services behind them, so the hard-to-drain stateful tier changes as rarely as possible.",
      },
      {
        heading: "Message ordering and delivery guarantees",
        body:
          "Client timestamps cannot order messages: clocks skew, and two messages can carry the same millisecond. Server receive time across multiple servers is also not globally consistent. The robust answer is a per-conversation monotonically increasing sequence number assigned at write time, e.g., by an atomic counter on the conversation's partition owner. Total ordering per conversation is exactly the guarantee users expect, and it doubles as the sync cursor: a client that knows it has everything up to seq 4711 asks for everything after.\n\nDelivery is at-least-once: the sender retries the frame until acked, and the server retries delivery until the recipient acks. Retries create duplicates, so every message carries a client-generated ID (clientMsgId) and receivers deduplicate on it. Exactly-once transport is not achievable in practice; at-least-once plus idempotent receive is the standard pattern.\n\nGaps are detected by the sequence numbers themselves: if a client holding seq 4711 receives 4713, it knows 4712 is missing and issues a range fetch. This self-healing property is why sequence-based sync beats simply trusting the real-time stream.",
      },
      {
        heading: "Presence and read receipts at scale",
        body:
          "Naive presence, broadcasting every connect and disconnect to all friends, generates millions of events per second and mostly updates screens nobody is looking at. Instead: gateways write status changes to a presence store with a TTL refreshed by heartbeat (missed heartbeats flip a user to offline automatically), and clients subscribe only to the presence of users currently rendered (open chat list, active conversation). Flapping connections are smoothed by debouncing: only publish offline if the user stays disconnected for, say, 30 seconds.\n\nRead receipts in one-on-one chat are simple acks flowing back to the sender. In groups, per-message-per-member receipts would be members x messages rows; instead store one last_read_seq per member per conversation, updated as the member reads. \"Read by all\" for a message is then min(last_read_seq over members) >= message.seq, computed on demand. Receipts should be batched (one frame summarizing many messages) to avoid doubling frame volume.",
      },
      {
        heading: "Multi-device sync and offline delivery",
        body:
          "Each device holds its own connection and its own sync cursor (last seq per conversation). Messages route to a user by fanning out to all registered devices; each device acks independently, so the phone being offline never blocks the desktop. Sent messages must also echo to the sender's other devices, which falls out naturally if you treat the sender's other devices as recipients.\n\nOffline delivery is pull-based on reconnect, not a server-side queue replay: because the message store is the queue (partition per conversation ordered by seq), a reconnecting device just asks each conversation for messages after its cursor. This unifies offline delivery, gap repair, and new-device history backfill into one code path.\n\nEnd-to-end encryption changes the storage contract: the server sees only ciphertext and per-device encrypted copies (each device has its own keys, as in Signal's protocol). Sequencing, receipts, and routing still work since they ride on metadata, but server-side search and history backfill to brand-new devices become client-driven problems.",
      },
    ],
    bottlenecks: [
      "Gateway restarts disconnect ~200K clients at once; the reconnect stampede needs jittered backoff and connection-rate limiting at discovery.",
      "The session registry is on the path of every message; shard it and cache recent routes on gateways.",
      "Very large or hyperactive groups amplify fan-out; batch per-gateway delivery and consider capping group size or switching huge groups to pull.",
      "A hot conversation partition (a massive group) concentrates writes on one node; sub-partition by seq range or time bucket if needed.",
      "Presence heartbeats at 50M connections are a constant background load; lengthen intervals adaptively and process them off the message path.",
    ],
    keyTakeaways: [
      "Separate the stateful WebSocket gateway tier from stateless logic services; keep gateways dumb and rarely redeployed.",
      "Per-conversation sequence numbers solve ordering, gap detection, offline sync, and multi-device cursors with one mechanism.",
      "Guarantee at-least-once delivery plus idempotent receive via client message IDs; never promise exactly-once transport.",
      "Persist before delivering: the message store, not an in-memory queue, is the source of truth for delivery.",
      "Presence must be lazy and subscription-based; broadcasting status changes to all friends does not scale.",
    ],
    relatedTopics: ["realtime-communication", "message-queues", "sql-vs-nosql", "sharding-and-partitioning", "fault-tolerance"],
    rapidImplementation: {
      stack: "Node.js + ws (WebSocket) + Redis pub/sub + Postgres on a $12 VPS; two node processes behind nginx to prove cross-server routing",
      steps: [
        "Create tables: conversations (id, last_seq BIGINT DEFAULT 0), conversation_members (conversation_id, user_id, last_read_seq), messages (conversation_id, seq, client_msg_id UNIQUE, sender_id, content, created_at, PK (conversation_id, seq)).",
        "Stand up a ws server that authenticates a JWT from the connection query string and keeps a Map of userId to socket set.",
        "On each server, SUBSCRIBE to a Redis channel per connected user (chan:user:{id}); publish frames there so any server can reach any user.",
        "Implement send: assign seq via UPDATE conversations SET last_seq = last_seq + 1 RETURNING last_seq, INSERT the message, ack the sender, then PUBLISH to every member's channel.",
        "Make inserts idempotent with the UNIQUE index on client_msg_id: on conflict, re-ack with the existing seq instead of writing a duplicate.",
        "Implement sync: on connect the client sends its last seq per conversation and the server returns SELECT ... WHERE seq > $cursor, which also covers offline delivery.",
        "Add heartbeats: ping every 30s, terminate dead sockets, and SET presence:{userId} in Redis with a 60s TTL for online indicators.",
        "Test by opening two browser tabs pinned to different node processes (nginx ip_hash off) and confirming both directions deliver under 100 ms.",
      ],
      codeSketches: [
        {
          title: "Send path: sequence, persist, then fan out via Redis pub/sub",
          language: "typescript",
          code: `async function handleSend(senderId: number, frame: any) {
  const { conversationId, clientMsgId, content } = frame;
  // atomic per-conversation sequence number
  const seqRow = await sql(
    "UPDATE conversations SET last_seq = last_seq + 1 WHERE id = $1 RETURNING last_seq",
    [conversationId]
  );
  const seq = Number(seqRow[0].last_seq);
  try {
    await sql(
      "INSERT INTO messages (conversation_id, seq, client_msg_id, sender_id, content) VALUES ($1,$2,$3,$4,$5)",
      [conversationId, seq, clientMsgId, senderId, content]
    );
  } catch (e: any) {
    if (e.code !== "23505") throw e; // duplicate retry: fall through and re-ack
  }
  const members = await sql(
    "SELECT user_id FROM conversation_members WHERE conversation_id = $1",
    [conversationId]
  );
  const payload = JSON.stringify({ type: "msg", conversationId, seq, senderId, content });
  for (const m of members) {
    pub.publish("chan:user:" + m.user_id, payload); // reaches whichever server holds the socket
  }
  return { type: "ack", clientMsgId, seq };
}`,
        },
        {
          title: "Gateway: socket registry plus per-user Redis subscription",
          language: "typescript",
          code: `const sockets = new Map<number, Set<WebSocket>>(); // this server's connections

wss.on("connection", async (ws, req) => {
  const userId = verifyJwt(new URL(req.url!, "http://x").searchParams.get("token"));
  if (!sockets.has(userId)) {
    sockets.set(userId, new Set());
    await sub.subscribe("chan:user:" + userId);
  }
  sockets.get(userId)!.add(ws);
  ws.on("close", async () => {
    const set = sockets.get(userId)!;
    set.delete(ws);
    if (set.size === 0) {
      sockets.delete(userId);
      await sub.unsubscribe("chan:user:" + userId);
    }
  });
});

sub.on("message", (channel: string, payload: string) => {
  const userId = Number(channel.split(":")[2]);
  for (const ws of sockets.get(userId) ?? []) ws.send(payload); // all devices
});`,
        },
        {
          title: "Client sync on reconnect: cursor fetch plus gap detection",
          language: "typescript",
          code: `const cursors = new Map<number, number>(); // conversationId -> highest seq seen

async function onReconnect(ws: WebSocket) {
  for (const [conversationId, seq] of cursors) {
    ws.send(JSON.stringify({ type: "sync", conversationId, afterSeq: seq }));
  }
}

function onMessageFrame(msg: { conversationId: number; seq: number }) {
  const have = cursors.get(msg.conversationId) ?? 0;
  if (msg.seq > have + 1) {
    // gap: 4711 -> 4713 means 4712 was missed; fetch the range
    send({ type: "sync", conversationId: msg.conversationId, afterSeq: have });
  }
  cursors.set(msg.conversationId, Math.max(have, msg.seq));
  render(msg);
}`,
        },
      ],
    },
  },
  {
    slug: "video-streaming",
    title: "Design a Video Platform (YouTube/Netflix)",
    difficulty: "Hard",
    summary:
      "Design a platform where creators upload videos and viewers stream them worldwide. The system splits into an asynchronous upload-and-transcode pipeline and a read-dominated streaming path built on adaptive bitrate protocols (HLS/DASH) and a CDN. The core challenges are parallelizing transcoding, serving petabytes of video with low startup latency, and keeping origin traffic tiny relative to what viewers consume.",
    functionalRequirements: [
      "Creators can upload videos up to several GB, with resumable uploads.",
      "Videos are transcoded into multiple resolutions and bitrates automatically after upload.",
      "Viewers can stream videos with adaptive quality on any device and network.",
      "Viewers can search for videos and see metadata (title, views, thumbnails).",
      "Track view counts and watch time per video.",
      "Creators are notified when processing completes and the video is live.",
    ],
    nonFunctionalRequirements: [
      "Streaming startup latency under 1-2 seconds and minimal rebuffering.",
      "High availability for playback (99.99%); uploads may degrade before playback ever does.",
      "Durability: a published video must never be lost (11 nines object storage).",
      "Scale: ~1B DAU watching, ~500 hours of video uploaded per minute.",
      "Cost efficiency: bandwidth and storage dominate; CDN offload and per-title encoding matter at this scale.",
      "Processing pipeline is async with a target publish time of minutes, not a hard latency bound.",
    ],
    backOfEnvelope: [
      {
        label: "Upload volume",
        value: "500 hours/min x 60 x 24 = 720K hours/day; at ~1.5 GB per source hour ≈ 1 PB/day raw ingest",
      },
      {
        label: "Storage after transcoding",
        value: "Each source becomes ~5-8 renditions; roughly 2-3x source size ≈ 2-3 PB/day of new derived storage",
        note: "Cold tiering and per-title encoding are mandatory at this rate",
      },
      {
        label: "Streaming egress",
        value: "1B views/day x 5 min avg x 3 Mbps ≈ 1B x 112 MB ≈ 110 PB/day, ~10 Tbps sustained",
        note: "Physically impossible from origin; CDN must serve 95%+ of bytes",
      },
      {
        label: "Metadata QPS",
        value: "1B DAU x 20 page/metadata hits ≈ 230K QPS on metadata, peak 2x",
        note: "Cache-first: metadata is small and hot",
      },
      {
        label: "Transcode compute",
        value: "720K hours/day ingested x ~2x realtime per rendition x 6 renditions ≈ 8.6M compute-hours/day",
        note: "Chunked parallel transcoding turns hours of latency into minutes",
      },
    ],
    apiDesign: [
      {
        endpoint: "POST /api/videos",
        description:
          "Initialize an upload: { title, description, size, checksum }. Returns a videoId and pre-signed multipart upload URLs pointing directly at object storage, bypassing app servers.",
      },
      {
        endpoint: "PUT {presignedUrl} (chunk upload)",
        description:
          "Client uploads each chunk directly to object storage; ETags per part enable resume after failure. A final complete-upload call assembles parts and fires the processing event.",
      },
      {
        endpoint: "GET /api/videos/{videoId}",
        description: "Fetch metadata: title, duration, status (processing/live), thumbnails, and the manifest URL for playback.",
      },
      {
        endpoint: "GET /manifests/{videoId}/master.m3u8",
        description:
          "CDN-served HLS master playlist listing available renditions; the player picks variants and fetches segment playlists and .ts/.mp4 segments from the CDN.",
      },
      {
        endpoint: "POST /api/videos/{videoId}/events",
        description: "Batched playback telemetry (view start, heartbeats, quality switches) feeding view counts and analytics.",
      },
    ],
    highLevelDesign: [
      "Uploads never pass through application servers. The client requests pre-signed URLs and pushes chunks of the raw file directly into object storage (S3/GCS) using multipart upload, which gives resumability for free: on failure the client re-uploads only missing parts. When the upload completes, storage emits an event onto a message queue, and the video's metadata row flips to 'processing'.",
      "The transcoding pipeline is a DAG of asynchronous workers driven by queues. A splitter breaks the source into ~5-10 second chunks aligned on keyframes (GOP boundaries); a fleet of transcode workers processes chunks in parallel, each producing every target rendition (e.g., 240p through 4K at appropriate bitrates); an assembler stitches results, generates HLS and DASH manifests, thumbnails, and captions; a validator checks output integrity. Parallelizing by chunk means a 2-hour movie transcodes in roughly the time of one chunk times pipeline overhead, minutes instead of hours.",
      "Processed segments and manifests land in object storage, which acts as the CDN origin. Popular content is pushed or pulled into CDN edge caches worldwide. The playback path is: player fetches the master manifest from the CDN, chooses a rendition based on measured bandwidth, and streams small segments over plain HTTPS, switching renditions between segments as conditions change. Because everything is static files over HTTP, standard CDN infrastructure serves it with no special streaming servers.",
      "The metadata path is a conventional read-heavy service: video metadata in a sharded database fronted by cache, search via an inverted index (Elasticsearch) fed by change events, and view counts aggregated from telemetry events through a stream processor rather than synchronous increments.",
      "Netflix-style optimization for a smaller, ultra-popular catalog: precompute per-title encoding ladders (analyze each title's complexity to choose bitrates, saving ~20% bandwidth) and pre-position entire catalogs on appliances inside ISP networks (Open Connect) during off-peak hours, so peak-hour traffic barely touches the backbone. YouTube's long tail instead relies on pull-through caching with popularity-tiered retention.",
    ],
    dataModel: [
      {
        name: "videos",
        fields:
          "video_id BIGINT PK, uploader_id BIGINT, title VARCHAR(255), description TEXT, duration_s INT, status VARCHAR(20), created_at TIMESTAMP, published_at TIMESTAMP NULL",
        note: "Hot metadata; cached aggressively, source of truth for lifecycle state",
      },
      {
        name: "video_renditions",
        fields:
          "video_id BIGINT, rendition VARCHAR(10) (e.g. 720p), bitrate_kbps INT, codec VARCHAR(10), manifest_path VARCHAR(512), segment_prefix VARCHAR(512), PK (video_id, rendition)",
      },
      {
        name: "transcode_jobs",
        fields:
          "job_id UUID PK, video_id BIGINT, chunk_index INT, rendition VARCHAR(10), state VARCHAR(20), attempts INT, worker_id VARCHAR(64), updated_at TIMESTAMP",
        note: "Tracks DAG progress; idempotent retries keyed by (video, chunk, rendition)",
      },
      {
        name: "view_stats",
        fields: "video_id BIGINT, bucket_ts TIMESTAMP, views BIGINT, watch_time_s BIGINT, PK (video_id, bucket_ts)",
        note: "Written by stream aggregation, not per-view increments",
      },
    ],
    deepDives: [
      {
        heading: "The transcoding pipeline as a chunked DAG",
        body:
          "Transcoding one large file serially is slow (often slower than realtime per rendition) and fragile: a failure at 90% wastes all the work. The fix is to split the source on GOP (group of pictures) boundaries into independent chunks, so each chunk can be decoded and re-encoded without neighbors. Chunks fan out across thousands of workers; each (chunk, rendition) task is an idempotent unit tracked in a job table, retried on failure, and safe to run twice.\n\nModel the whole flow as a DAG: split → per-chunk transcode → audio processing → thumbnail and caption generation → manifest assembly → validation → publish. A DAG scheduler (Facebook described theirs as SVE; Temporal-style workflow engines work too) tracks state transitions and resumes from the last completed node after any crash.\n\nTwo practical notes for interviews: use spot/preemptible instances for the enormous but interruption-tolerant transcode fleet to cut cost, and prioritize the ladder so a watchable 360p rendition publishes first, letting the video go live in seconds while higher qualities backfill.",
      },
      {
        heading: "Adaptive bitrate streaming: HLS and DASH",
        body:
          "Naive progressive download of one MP4 at one quality fails on variable networks: too high a bitrate causes rebuffering, too low wastes quality. Adaptive bitrate (ABR) streaming solves this by encoding each video at a ladder of bitrate/resolution pairs and cutting each rendition into small segments (2-10 seconds). A master manifest lists the renditions; per-rendition playlists list the segments.\n\nThe intelligence lives in the client. The player measures download throughput and buffer occupancy and picks the best rendition for each next segment, stepping down instantly when bandwidth drops and up when it recovers. Because segments align across renditions, switches are seamless. HLS (Apple, .m3u8, historically MPEG-TS segments) and DASH (open standard, fragmented MP4) are the two protocols; platforms typically serve both, and CMAF lets one set of media segments back both manifest formats, halving storage.\n\nABR is also what makes CDNs work here: every segment is an immutable static file over HTTP, so ordinary HTTP caches serve it, byte-range requests are unnecessary, and cache keys are stable forever.",
      },
      {
        heading: "CDN strategy and the economics of egress",
        body:
          "The envelope math (roughly 110 PB/day, ~10 Tbps) makes the CDN the system's backbone, not an optimization. Segments flow origin → regional shield cache → edge PoP → viewer, and each layer absorbs misses from the one below, so origin egress ends up under a few percent of delivered bytes. Immutable segment URLs (content-addressed or versioned paths) allow infinite TTLs with zero invalidation logic.\n\nPopularity is extremely skewed: a small fraction of titles produce most watch time. Netflix exploits this with Open Connect appliances placed inside ISP data centers and filled with the regional catalog during off-peak windows, meaning peak streaming traffic never crosses transit links. YouTube's billion-video long tail cannot be pre-positioned, so it uses pull-through caching with tiered retention and serves true cold tail requests from regional storage.\n\nCost levers worth naming: per-title encoding (tuning the ladder to content complexity saves ~20% of bits), newer codecs (VP9/AV1 save 30-50% over H.264 at the price of more encode compute, worth it only for popular titles), and cold-tiering derived renditions of rarely watched videos while keeping only the source, re-deriving on demand.",
      },
      {
        heading: "Resumable uploads and view counting",
        body:
          "Multi-GB uploads on flaky networks will fail mid-way; restarting from zero is unacceptable. Multipart upload solves it: the client splits the file into parts (e.g., 10 MB), uploads each part independently to a pre-signed URL, and storage tracks received parts, so resume means asking which parts exist and sending the rest. Parts also upload in parallel, improving throughput. Pre-signed URLs keep petabytes of ingest off the application tier entirely.\n\nView counting looks trivial but is a classic hot-row problem: a viral video takes thousands of view events per second, and synchronous UPDATE ... SET views = views + 1 serializes on that row. Route playback telemetry through a queue into a stream aggregator (Flink/Kafka Streams) that windows counts and flushes periodic deltas to storage and cache. Counts become near-real-time approximations, deduplicated per (user, video, session) to resist inflation, and exact totals reconcile in batch. Interviewers reward acknowledging that displayed counts are intentionally eventually consistent.",
      },
    ],
    bottlenecks: [
      "Origin bandwidth: serving even a few percent of 110 PB/day from origin is enormous; layered CDN caching with immutable URLs is the fix.",
      "Transcode backlog during upload spikes delays publishing; autoscale workers on queue depth and publish low renditions first.",
      "Hot metadata rows for viral videos (counts, comments) need async aggregation and cache-first reads.",
      "Storage growth of 2-3 PB/day forces lifecycle policies: cold-tier or drop unused renditions for tail content.",
      "A thundering herd on a just-published video from a huge creator can stampede CDN misses to origin; use request coalescing at shields and pre-warm edges for predictable premieres.",
    ],
    keyTakeaways: [
      "Split the design cleanly: an async write pipeline (upload, transcode, publish) and a static-file read path (manifests, segments, CDN); they scale independently.",
      "Chunked parallel transcoding on GOP boundaries turns hours into minutes and makes every unit of work idempotent and retryable.",
      "Adaptive bitrate (HLS/DASH) puts quality decisions in the client and turns streaming into cacheable static HTTP, which is what makes CDNs sufficient.",
      "Pre-signed direct-to-storage multipart uploads give resumability and keep bulk bytes off app servers.",
      "At video scale, cost is architecture: CDN offload, per-title encoding, codec choice, and storage tiering are design decisions, not afterthoughts.",
    ],
    relatedTopics: ["cdn", "message-queues", "storage-and-search", "event-driven-architecture", "caching"],
    rapidImplementation: {
      stack: "Next.js + Postgres + BullMQ worker running ffmpeg, files on S3-compatible storage (Cloudflare R2, zero egress fees) served through Cloudflare CDN, hls.js player",
      steps: [
        "Create tables: videos (id, title, status DEFAULT 'uploading', duration_s, created_at) and renditions (video_id, name, bandwidth, playlist_path).",
        "Build POST /api/videos to insert a row and return a pre-signed R2 multipart PUT URL so the browser uploads the source file directly to storage.",
        "On the upload-complete callback, flip status to 'processing' and enqueue a BullMQ transcode job with the videoId.",
        "In the worker, download the source and run ffmpeg once per rendition (start with 480p and 720p) producing HLS segments and a per-rendition .m3u8.",
        "Generate a master.m3u8 listing both renditions with BANDWIDTH and RESOLUTION attributes, upload all output under videos/{id}/ in R2, set status 'live'.",
        "Serve playback with hls.js pointed at the CDN URL of master.m3u8; the player handles rendition switching for free.",
        "Set Cache-Control: public, max-age=31536000, immutable on segments (they never change) and a short max-age on playlists.",
        "Count views by POSTing a beacon at 10s of playback into a view_events table; roll up per-video counts with a minutely cron, never increment synchronously.",
      ],
      codeSketches: [
        {
          title: "Transcode worker: ffmpeg per rendition to HLS",
          language: "typescript",
          code: `import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);

const LADDER = [
  { name: "480p", height: 480, vBitrate: "1200k", bandwidth: 1400000 },
  { name: "720p", height: 720, vBitrate: "2800k", bandwidth: 3200000 },
];

async function transcode(videoId: string, srcPath: string, outDir: string) {
  for (const r of LADDER) {
    await run("ffmpeg", [
      "-i", srcPath,
      "-vf", "scale=-2:" + r.height,
      "-c:v", "libx264", "-b:v", r.vBitrate, "-preset", "fast",
      "-c:a", "aac", "-b:a", "128k",
      "-g", "48", "-keyint_min", "48", "-sc_threshold", "0", // aligned keyframes
      "-hls_time", "6", "-hls_playlist_type", "vod",
      "-hls_segment_filename", outDir + "/" + r.name + "_%04d.ts",
      outDir + "/" + r.name + ".m3u8",
    ]);
  }
}`,
        },
        {
          title: "Master HLS playlist generation",
          language: "typescript",
          code: `function buildMasterPlaylist(renditions: { name: string; bandwidth: number; height: number }[]): string {
  const lines = ["#EXTM3U", "#EXT-X-VERSION:3"];
  for (const r of renditions) {
    const width = Math.round((r.height * 16) / 9);
    lines.push(
      "#EXT-X-STREAM-INF:BANDWIDTH=" + r.bandwidth +
      ",RESOLUTION=" + width + "x" + r.height
    );
    lines.push(r.name + ".m3u8");
  }
  return lines.join("\\n") + "\\n";
}

// after transcoding, publish everything and go live
async function publish(videoId: string, outDir: string) {
  await uploadDir(outDir, "videos/" + videoId + "/"); // R2 put per file
  await sql("UPDATE videos SET status = 'live' WHERE id = $1", [videoId]);
}`,
        },
        {
          title: "Pre-signed direct-to-storage upload init",
          language: "typescript",
          code: `import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: { accessKeyId: process.env.R2_KEY!, secretAccessKey: process.env.R2_SECRET! },
});

export async function POST(req: Request) {
  const { title, contentType } = await req.json();
  const rows = await sql(
    "INSERT INTO videos (title, status) VALUES ($1, 'uploading') RETURNING id",
    [title]
  );
  const videoId = rows[0].id;
  const uploadUrl = await getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: "videos", Key: "sources/" + videoId, ContentType: contentType }),
    { expiresIn: 3600 }
  );
  return Response.json({ videoId, uploadUrl }); // browser PUTs the file itself
}`,
        },
      ],
    },
  },
  {
    slug: "web-crawler",
    title: "Design a Web Crawler",
    difficulty: "Medium",
    summary:
      "Design a crawler that downloads billions of pages for a search index while being a polite citizen of the web. The core components are a URL frontier that balances priority against per-host politeness, a dedup layer (Bloom filters and content fingerprints), robots.txt compliance, trap avoidance, and a recrawl strategy that keeps the index fresh.",
    functionalRequirements: [
      "Start from seed URLs, download pages, extract links, and enqueue newly discovered URLs.",
      "Respect robots.txt and per-host crawl-delay directives.",
      "Deduplicate both URLs (do not fetch twice) and content (detect mirror/duplicate pages).",
      "Store page content and metadata for downstream indexing.",
      "Re-crawl pages periodically at a frequency based on their change rate (freshness).",
      "Restrict scope configurably: HTML only, obey max depth per site, per-domain quotas.",
    ],
    nonFunctionalRequirements: [
      "Scale: crawl 1B pages within about a week of a full pass.",
      "Politeness: never overload a host; typically at most one in-flight request per host with delays between requests.",
      "Robustness: tolerate malformed HTML, dead servers, slow responses, redirect loops, and spider traps without stalling.",
      "Extensibility: adding new content types or processing stages should not require redesign.",
      "Efficient storage: avoid storing duplicate content; fingerprints and URL sets must fit in practical memory.",
    ],
    backOfEnvelope: [
      {
        label: "Crawl rate",
        value: "1B pages / 7 days ≈ 1,650 pages/sec sustained, design for 2x ≈ 3,300/sec",
      },
      {
        label: "Download bandwidth",
        value: "1,650 pages/sec x 500 KB avg ≈ 825 MB/s ≈ 6.6 Gbps",
        note: "Spread across many workers and network paths",
      },
      {
        label: "Storage per pass",
        value: "1B pages x 500 KB ≈ 500 TB raw HTML per full crawl",
        note: "Compress (~5:1) and store in object storage / HDFS ≈ 100 TB",
      },
      {
        label: "URL-seen structure",
        value: "Bloom filter for 10B URLs at 1% FP rate ≈ 10 bits/URL ≈ 12 GB",
        note: "vs ~1 TB to store raw URL strings in a hash set; this is why Bloom filters",
      },
      {
        label: "DNS lookups",
        value: "3,300 fetches/sec, each needing resolution; public resolvers throttle at this rate",
        note: "Requires a local caching DNS resolver tier",
      },
    ],
    apiDesign: [
      {
        endpoint: "POST /api/crawl/seeds",
        description: "Submit seed URLs or sitemaps with priority and scope rules to bootstrap or expand a crawl.",
      },
      {
        endpoint: "GET /api/crawl/status?domain={domain}",
        description: "Report crawl progress: pages fetched, error rates, queue depth, per-domain quota consumption.",
      },
      {
        endpoint: "PUT /api/crawl/policies/{domain}",
        description: "Override politeness or scope for a domain: custom delay, max depth, exclusion patterns, blocklisting.",
      },
      {
        endpoint: "GET /api/pages/{urlHash}",
        description: "Internal API for downstream consumers (indexer) to fetch stored content and fetch metadata for a URL.",
      },
    ],
    highLevelDesign: [
      "The heart of the system is the URL frontier, which is much more than a FIFO queue. It has two stages: front queues partition URLs by priority (computed from PageRank-like importance, update frequency, depth), and back queues partition strictly by host, with each back queue mapped to exactly one host. A selector pops from back queues only when the host's politeness timer (its next allowed fetch time, kept in a min-heap) has expired. This structure enforces both prioritization and per-host rate limits in one place.",
      "Fetcher workers pull a ready URL from the frontier, resolve DNS through a local caching resolver, check the cached robots.txt for that host (fetching and caching it if absent), and download the page with strict timeouts and size caps. Downloaded content is written to object storage, and the fetch result (status, headers, checksum, timestamp) is recorded in the URL metadata store.",
      "A parsing and extraction stage, decoupled from fetching by a queue so slow parsing never blocks the network, validates the content, computes a content fingerprint for near-duplicate detection, extracts and normalizes outgoing links (resolve relative URLs, strip fragments, canonicalize), and applies URL filters (scheme, blocklists, depth, scope).",
      "Each surviving link passes the URL-seen test: a Bloom filter (backed by an authoritative disk-based store to confirm positives) drops URLs already visited or already queued. New URLs are scored for priority and inserted into the frontier, closing the loop. The frontier itself is mostly on disk with only the head of each queue in memory, since billions of pending URLs cannot fit in RAM.",
      "The whole pipeline shards horizontally: partition the URL space by hash of hostname across crawler nodes, so all URLs for one host land on one node, which makes politeness enforcement local (no cross-node coordination per fetch). A coordinator handles node membership and re-partitioning on failure via consistent hashing.",
    ],
    dataModel: [
      {
        name: "url_metadata",
        fields:
          "url_hash BINARY(16) PK, url TEXT, host VARCHAR(255), status VARCHAR(20), last_fetched_at TIMESTAMP, fetch_count INT, last_change_at TIMESTAMP, content_fingerprint BINARY(8), priority FLOAT, next_fetch_at TIMESTAMP",
        note: "Sharded by url_hash; next_fetch_at drives the recrawl scheduler",
      },
      {
        name: "host_state",
        fields:
          "host VARCHAR(255) PK, robots_txt TEXT, robots_fetched_at TIMESTAMP, crawl_delay_ms INT, next_allowed_fetch_at TIMESTAMP, error_streak INT, pages_crawled BIGINT",
        note: "One row per host; the politeness source of truth",
      },
      {
        name: "page_store (object storage)",
        fields: "key = url_hash/fetch_ts, value = compressed HTML + response headers",
        note: "Append-only, versioned per fetch for change detection and reprocessing",
      },
    ],
    deepDives: [
      {
        heading: "The URL frontier: priority vs politeness",
        body:
          "A naive BFS queue fails in two ways: it fetches junk as eagerly as important pages, and because links on a page mostly point within the same site, it hammers one host with rapid-fire requests, which is how crawlers get IP-banned or mistaken for a DoS attack. The Mercator-style two-stage frontier is the classic answer.\n\nFront queues handle priority: a prioritizer assigns each URL to one of K queues (say 1 = highest), and the mover biases toward high-priority queues when refilling the back stage. Back queues handle politeness: each queue holds URLs for exactly one host, and a heap keyed by next_allowed_fetch_at (last fetch time plus the host's delay, from crawl-delay or an adaptive default like a multiple of observed response time) decides which host is ready. A worker pops the ready host's queue head; the host cannot be fetched again until its timer resets.\n\nSizing detail worth mentioning: keep roughly 3x more back queues than worker threads so workers rarely idle waiting for a polite host, and spill queue tails to disk since billions of pending URLs exceed RAM.",
      },
      {
        heading: "Dedup: Bloom filters for URLs, fingerprints for content",
        body:
          "URL-seen testing happens billions of times, so it must be a memory-speed operation. Storing 10B URLs as strings needs on the order of a terabyte; a Bloom filter with ~10 bits per element and a 1% false-positive rate needs about 12 GB. The tradeoff is that false positives cause the crawler to skip roughly 1% of genuinely new URLs, which is usually acceptable for coverage; if not, treat the Bloom filter as a fast negative check and confirm positives against the disk-based url_metadata store, so the filter merely saves the vast majority of disk lookups. Note that standard Bloom filters do not support deletion, so a fresh filter is built per crawl generation.\n\nContent dedup is a different problem: the same page often lives at many URLs (mirrors, tracking parameters, http/https variants). Exact duplicates are caught with a checksum (MD5/SHA) of the body, stored in url_metadata and checked before wasting parse and storage work. Near-duplicates (same article with different ads or navigation) need locality-sensitive fingerprints: SimHash produces a 64-bit fingerprint where similar documents differ in few bits, and Google reported using it for exactly this at web scale; pages within ~3 bits of Hamming distance are treated as duplicates.\n\nDedup also protects the frontier itself: canonicalize URLs before the seen-test (lowercase host, strip default ports, sort or strip known tracking query parameters, resolve relative paths), or trivially different spellings of one URL will slip past.",
      },
      {
        heading: "Politeness, robots.txt, and trap avoidance",
        body:
          "Robots.txt is fetched once per host, cached with a TTL (typically a day), and consulted before every fetch; disallowed paths are dropped at the filter stage. Crawl-delay, where present, overrides the default politeness interval. Beyond compliance, adaptive politeness is good engineering: back off exponentially on 5xx and 429 responses, and slow down when a host's response time degrades since the crawler may be the cause.\n\nSpider traps are structures that generate unbounded URL spaces: calendar pages with infinite next-month links, session IDs in URLs, and deliberately hostile generators. Defenses are layered: cap URL length, cap path depth, cap pages per domain per crawl cycle, detect cycles of near-identical content fingerprints within a site, and alert on domains whose queue grows without their unique-content count growing. There is no perfect automatic defense; real crawlers pair heuristics with manual blocklists.\n\nA final operational point: crawler traffic must be identifiable (a clear User-Agent with contact info), because unidentifiable high-volume crawlers get blanket-blocked by CDNs and WAFs, which quietly destroys coverage.",
      },
      {
        heading: "Freshness and recrawl scheduling",
        body:
          "A one-shot crawl decays immediately: news pages change hourly, reference pages change yearly. Recrawling everything at one frequency either wastes most of the fetch budget on static pages or serves stale news. The standard model estimates each page's change rate from history: compare the content fingerprint at each fetch, treat changes as a Poisson process, and estimate lambda from observed change/no-change outcomes.\n\nSchedule next_fetch_at per URL from that estimate, weighted by page importance, so a high-value fast-changing page might recrawl hourly while a static tail page waits months. Sitemaps with lastmod, HTTP conditional requests (If-Modified-Since/ETag, where a 304 costs almost nothing), and RSS feeds give cheap change signals that stretch the fetch budget further.\n\nIn steady state the crawler is not a pipeline with an end but a continuous scheduler: the frontier is perpetually refilled by both newly discovered URLs and recrawl-due URLs, and the interesting knob is how the fixed fetch budget is split between discovery (coverage) and recrawl (freshness).",
      },
    ],
    bottlenecks: [
      "Per-host politeness caps parallelism: if the frontier concentrates on few hosts, workers idle; keep breadth in the frontier and more back queues than threads.",
      "DNS resolution at thousands of lookups/sec overwhelms external resolvers; run local caching resolvers and prefetch resolutions.",
      "The URL-seen check is on every extracted link (tens of thousands/sec); a naive DB lookup per link dies, hence the Bloom filter front.",
      "Frontier state (billions of URLs) exceeds memory; hybrid memory/disk queues with only heads in RAM.",
      "Spider traps and crawler-hostile sites silently eat the fetch budget; per-domain quotas and anomaly monitoring are essential.",
    ],
    keyTakeaways: [
      "The frontier is the crawler: a two-stage structure enforcing priority in front queues and per-host politeness in back queues.",
      "Politeness is a hard requirement, not a nicety: impolite crawlers are indistinguishable from DoS attacks and get blocked.",
      "Bloom filters make the billion-scale URL-seen test a ~12 GB in-memory problem, accepting a small false-positive rate.",
      "Dedup twice: URL dedup before fetching (canonicalize first), content dedup after fetching (checksums plus SimHash for near-duplicates).",
      "Shard by hostname so politeness state stays node-local, and treat recrawl as a continuous scheduling problem driven by estimated change rates.",
    ],
    relatedTopics: ["probabilistic-data-structures", "message-queues", "dns", "consistent-hashing", "storage-and-search"],
    rapidImplementation: {
      stack: "Python 3.12 + asyncio + aiohttp + Redis (frontier and dedup) + SQLite for page metadata, gzip HTML to local disk; runs on a laptop or $6 VPS",
      steps: [
        "Model the frontier in Redis: one list frontier:{host} per host, a set of known hosts, and a sorted set host_ready scored by next_allowed_fetch_ms.",
        "Write the URL canonicalizer: lowercase scheme and host, strip fragments and default ports, drop tracking params (utm_*, fbclid), resolve relative paths.",
        "Add dedup: a Bloom filter (pybloom-live, 50M capacity, 1% FP) checked before enqueue, with an INSERT OR IGNORE into a SQLite urls table as the authoritative record.",
        "Implement the politeness scheduler: pop the lowest-scored ready host from host_ready, take one URL from its list, and re-score the host to now + delay after the fetch completes.",
        "Fetch with aiohttp using a 10s timeout, 2 MB size cap, and a descriptive User-Agent; on 429/5xx double the host's delay, on success decay it back toward 1s.",
        "Cache robots.txt per host in Redis for 24h using urllib.robotparser and drop disallowed URLs at enqueue time.",
        "Parse with BeautifulSoup, extract and canonicalize hrefs, cap path depth at 8 and pages per domain at 5000 to dodge spider traps.",
        "Store gzipped HTML keyed by sha256(url) and record status, checksum, and fetch time in SQLite; seed with 10 URLs and watch it hold roughly 1 req/sec/host.",
      ],
      codeSketches: [
        {
          title: "Frontier with per-host politeness delay",
          language: "python",
          code: `import time

DEFAULT_DELAY_MS = 1000

async def get_next_url(redis):
    # host_ready: sorted set of host -> next_allowed_fetch_ms
    now_ms = int(time.time() * 1000)
    ready = await redis.zrangebyscore("host_ready", 0, now_ms, start=0, num=1)
    if not ready:
        return None  # no host is polite to fetch yet; caller sleeps briefly
    host = ready[0]
    url = await redis.lpop("frontier:" + host)
    if url is None:
        await redis.zrem("host_ready", host)  # queue drained
        return None
    # block this host until its delay elapses; adjusted again on response
    delay = int(await redis.hget("host_delay", host) or DEFAULT_DELAY_MS)
    await redis.zadd("host_ready", {host: now_ms + delay})
    return url

async def report_result(redis, host, status, elapsed_ms):
    delay = int(await redis.hget("host_delay", host) or DEFAULT_DELAY_MS)
    if status in (429, 503):
        delay = min(delay * 2, 60_000)      # back off hard
    else:
        delay = max(1000, int(delay * 0.9), elapsed_ms * 3)  # adaptive politeness
    await redis.hset("host_delay", host, delay)`,
        },
        {
          title: "Canonicalize then dedup with a Bloom filter",
          language: "python",
          code: `from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
from pybloom_live import ScalableBloomFilter

seen = ScalableBloomFilter(initial_capacity=50_000_000, error_rate=0.01)
TRACKING = {"fbclid", "gclid", "ref"}

def canonicalize(url: str) -> str | None:
    s = urlsplit(url)
    if s.scheme not in ("http", "https"):
        return None
    host = s.hostname.lower() if s.hostname else None
    if not host or s.path.count("/") > 8:
        return None  # depth cap against calendar-style traps
    query = urlencode(sorted(
        (k, v) for k, v in parse_qsl(s.query)
        if not k.startswith("utm_") and k not in TRACKING
    ))
    return urlunsplit((s.scheme, host, s.path or "/", query, ""))

def enqueue_if_new(db, redis_pipe, url: str):
    canon = canonicalize(url)
    if canon is None or canon in seen:
        return  # Bloom filter: ~10 bits/URL vs storing full strings
    seen.add(canon)
    # authoritative store confirms; INSERT OR IGNORE handles FP double-checks
    db.execute("INSERT OR IGNORE INTO urls (url, status) VALUES (?, 'queued')", (canon,))
    host = urlsplit(canon).hostname
    redis_pipe.rpush("frontier:" + host, canon)
    redis_pipe.zadd("host_ready", {host: 0}, nx=True)`,
        },
        {
          title: "Async fetch worker loop",
          language: "python",
          code: `import asyncio, gzip, hashlib, time
import aiohttp

UA = "MiniCrawler/0.1 (+mailto:you@example.com)"

async def worker(redis, db, session: aiohttp.ClientSession):
    while True:
        url = await get_next_url(redis)
        if url is None:
            await asyncio.sleep(0.05)
            continue
        host = aiohttp.helpers.URL(url).host
        if not await robots_allows(redis, session, host, url):
            continue
        start = time.monotonic()
        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10),
                                   headers={"User-Agent": UA}) as resp:
                body = await resp.content.read(2_000_000)  # 2 MB cap
                elapsed = int((time.monotonic() - start) * 1000)
                await report_result(redis, host, resp.status, elapsed)
                if resp.status == 200 and "text/html" in resp.headers.get("Content-Type", ""):
                    key = hashlib.sha256(url.encode()).hexdigest()
                    open("pages/" + key + ".html.gz", "wb").write(gzip.compress(body))
                    await parse_and_enqueue(redis, db, url, body)
        except (aiohttp.ClientError, asyncio.TimeoutError):
            await report_result(redis, host, 503, 10_000)`,
        },
      ],
    },
  },
];
