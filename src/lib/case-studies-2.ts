import type { CaseStudy } from "./types";

export const caseStudies2: CaseStudy[] = [
  {
    slug: "typeahead",
    title: "Design Search Autocomplete (Typeahead)",
    difficulty: "Medium",
    summary:
      "Design a service that suggests the top search queries as a user types each character, like Google Search or Amazon's search box. The core challenge is returning ranked suggestions for any prefix in well under 100ms while keeping the suggestion corpus fresh as query popularity shifts.",
    functionalRequirements: [
      "As the user types each character, return the top 5-10 most popular query completions for the current prefix.",
      "Suggestions are ranked by historical query frequency, optionally boosted by recency and personalization signals.",
      "The suggestion corpus updates as new queries trend (e.g., breaking news terms appear within hours, not weeks).",
      "Support case-insensitive matching and basic normalization (trim whitespace, lowercase, strip accents).",
      "Filter out blocked or inappropriate terms before they are ever suggested.",
    ],
    nonFunctionalRequirements: [
      "P99 end-to-end latency under 100ms; ideally the backend responds in under 20ms since network eats the rest.",
      "Extremely high read throughput: every keystroke from every active searcher is a request.",
      "High availability: autocomplete failing should degrade gracefully (search still works without suggestions).",
      "Eventual consistency is fine; a trending query appearing 30 minutes late is acceptable.",
      "Scale to billions of queries per day across a corpus of hundreds of millions of distinct queries.",
    ],
    backOfEnvelope: [
      {
        label: "Search queries per day",
        value: "5 billion",
        note: "Roughly Google scale; use it to size the ingestion pipeline.",
      },
      {
        label: "Autocomplete QPS",
        value: "~350K average, ~700K peak",
        note: "5B searches/day x ~6 keystrokes each = 30B requests/day; 30B / 86,400s ≈ 347K QPS, double for peak.",
      },
      {
        label: "Distinct queries stored",
        value: "~200 million",
        note: "After deduping and dropping the long tail below a frequency threshold.",
      },
      {
        label: "Trie storage",
        value: "~100 GB",
        note: "200M queries x ~30 bytes avg + node overhead and precomputed top-k lists; fits in RAM across a small shard fleet.",
      },
      {
        label: "Log ingestion",
        value: "~2.5 TB/day",
        note: "5B queries x ~500 bytes per log record, feeding the offline aggregation pipeline.",
      },
    ],
    apiDesign: [
      {
        endpoint: "GET /v1/suggest?q={prefix}&limit=10&locale=en-US",
        description:
          "Returns ranked suggestions for the prefix. Response is a small JSON array of {query, score}; served with aggressive edge caching for hot prefixes.",
      },
      {
        endpoint: "POST /v1/queries (internal, async)",
        description:
          "Search service logs completed queries to the analytics pipeline (typically via Kafka, not a synchronous call) so frequencies can be aggregated.",
      },
      {
        endpoint: "PUT /v1/admin/blocklist",
        description:
          "Admin endpoint to add or remove blocked terms; propagated to serving nodes so filtered suggestions disappear within minutes.",
      },
    ],
    highLevelDesign: [
      "The client debounces keystrokes (e.g., 50-100ms) and issues a suggest request per settled prefix. Requests hit a CDN or edge cache first: prefixes follow a steep Zipfian distribution, so the top few thousand prefixes (single letters, common words) absorb a huge share of traffic and can be served straight from the edge with a short TTL.",
      "Cache misses go through a load balancer to stateless API gateways, which route the prefix to the correct trie serving shard. Sharding is by prefix range (e.g., 'a'-'aq' on shard 1) with weights adjusted so hot letters do not overload one shard; a lookup table maintained by a coordinator maps prefix ranges to shards.",
      "Each serving node holds its shard of the trie entirely in memory. Critically, each trie node stores a precomputed list of its top-k completions, so a lookup is O(len(prefix)) to walk to the node plus O(1) to read the cached top-k list, rather than a DFS over the subtree at query time.",
      "On the write path, search logs flow through Kafka into an aggregation job (Flink for streaming or Spark for batch) that computes query frequencies over sliding windows. A builder service constructs a new trie snapshot every 30-60 minutes, applies the blocklist, and ships it to serving nodes, which swap the new snapshot in atomically and warm it before taking traffic.",
      "Snapshots are also persisted to blob storage so a restarted node can bootstrap in minutes instead of rebuilding from raw logs. Weekly full rebuilds reconcile any drift from incremental updates.",
    ],
    dataModel: [
      {
        name: "query_frequency (aggregated)",
        fields:
          "query VARCHAR PK, frequency BIGINT, decayed_score DOUBLE, last_seen TIMESTAMP, locale CHAR(5)",
        note: "Output of the aggregation pipeline; input to the trie builder. Decayed score applies exponential time decay so stale queries fade.",
      },
      {
        name: "trie_node (in-memory)",
        fields:
          "children MAP<char, ptr>, top_k ARRAY<{query, score}>[10], is_terminal BOOLEAN",
        note: "top_k is precomputed at build time; this trades build cost and memory for O(1) reads.",
      },
      {
        name: "shard_map",
        fields:
          "prefix_range_start VARCHAR, prefix_range_end VARCHAR, shard_id INT, replica_hosts ARRAY<VARCHAR>",
        note: "Maintained by the coordinator; consulted by gateways for routing.",
      },
    ],
    deepDives: [
      {
        heading: "Trie with precomputed top-k vs. alternatives",
        body: "A naive trie answers 'top completions of prefix P' by walking to P's node and running a DFS over the entire subtree, collecting terminal nodes and sorting by frequency. For a short prefix like 'a' that subtree contains millions of queries, making the query path far too slow. The standard fix is to precompute and store the top-k completions at every node during the build, so reads become a pointer walk plus a memory read.\n\nThe cost is build time and memory: every query updates the top-k lists of all its ancestor nodes, and lists are duplicated down the tree. This is why the trie is rebuilt offline as a snapshot rather than mutated in place under live traffic. An alternative for smaller corpora is a sorted array of queries with binary search on prefix boundaries plus a precomputed sparse index; some teams also use finite state transducers (as in Lucene) which compress shared prefixes and suffixes dramatically.\n\nUpdating frequencies in real time inside the serving trie is usually not worth the complexity. Instead, treat the trie as immutable and rebuild frequently. If sub-minute trend detection matters (breaking news), layer a small secondary 'trending' index built from the last few minutes of stream data and merge its results with the main trie at query time.",
      },
      {
        heading: "Sharding and hotspot management",
        body: "Sharding purely by first letter is tempting but badly skewed: prefixes starting with 's' or 'c' vastly outnumber 'x' or 'z'. A better approach is weighted range partitioning informed by historical prefix traffic: the coordinator analyzes the frequency distribution and cuts ranges so each shard serves a comparable QPS and memory footprint, e.g., shard 1 = 'a'-'ap', shard 2 = 'aq'-'b'.\n\nEven within a balanced scheme, single-character prefixes are extreme hotspots. These are best handled outside the trie fleet entirely: there are only ~36 single-character prefixes per locale, so their top-k lists can be pushed to every edge cache and refreshed on each snapshot. The same applies to the top few thousand multi-character prefixes.\n\nEach shard runs multiple replicas behind the router for both throughput and availability. Because snapshots are immutable, replicas are trivially consistent: they all load the same snapshot version, and the router can drain a replica, let it load the next snapshot, and re-add it with zero coordination.",
      },
      {
        heading: "Freshness, decay, and the ingestion pipeline",
        body: "Raw query logs land in Kafka. A streaming aggregator maintains per-query counts over windows (e.g., hourly tumbling windows rolled into daily aggregates). Pure lifetime frequency is a poor ranking signal because it never lets new queries surface, so scores use exponential time decay: score = sum(count_in_window x decay^age). A decay half-life of a few days balances stability against trend responsiveness.\n\nCounting hundreds of millions of distinct strings exactly in a streaming job is memory-heavy. Many systems use approximate counting: a count-min sketch for frequencies combined with a heavy-hitters structure to track the top candidates per prefix bucket, accepting small overcounts in exchange for bounded memory.\n\nThe builder consumes the aggregated scores, filters the blocklist, drops queries below a minimum score, and emits a versioned snapshot to blob storage. Serving nodes poll for new versions and hot-swap. If a snapshot is bad (e.g., a pipeline bug zeroes scores), nodes can roll back to the previous version, which is why keeping the last N snapshots in blob storage is standard practice.",
      },
    ],
    bottlenecks: [
      "Hot prefixes (single letters, trending terms) can overwhelm a single shard; mitigate with edge caching of hot prefixes and weighted shard ranges.",
      "Trie rebuild time grows with corpus size; a full rebuild taking hours limits freshness, pushing you toward incremental builds or a separate trending layer.",
      "Memory footprint: the full trie with top-k lists must fit in RAM across shards; uncontrolled corpus growth forces threshold pruning or compression (radix trie / FST).",
      "Client keystroke storms without debouncing multiply QPS several-fold for no user benefit.",
      "Snapshot rollout thundering herd: all replicas loading a 100 GB snapshot from blob storage simultaneously can saturate the network; stagger rollouts.",
    ],
    keyTakeaways: [
      "Precompute top-k at every trie node so read latency is O(prefix length), independent of subtree size.",
      "Treat the serving index as an immutable, versioned snapshot rebuilt offline; do not mutate it under live reads.",
      "Exploit the Zipfian prefix distribution: cache hot prefixes at the edge and weight your shards by traffic, not alphabet.",
      "Use time-decayed scores (and optionally a small real-time trending layer) so suggestions stay fresh without rebuilding constantly.",
      "Autocomplete is an optional enhancement; design every failure mode to degrade to 'no suggestions' rather than blocking search.",
    ],
    relatedTopics: [
      "caching",
      "cdn",
      "sharding-and-partitioning",
      "storage-and-search",
      "probabilistic-data-structures",
    ],
    rapidImplementation: {
      stack:
        "Node.js + Fastify, one Redis instance for prefix buckets, and a nightly cron for score decay, all on a single $12/mo VPS.",
      steps: [
        "Scaffold a Fastify server with GET /suggest?q= and an internal POST /queries hook that fires whenever a search is actually submitted.",
        "Write the ingester: for each prefix (up to 20 chars) of a submitted query, ZINCRBY the query in that prefix's Redis sorted set, then trim the set to its top 50 members to bound memory.",
        "Implement /suggest as a single ZREVRANGE on the prefix's sorted set, returning the top 10 as JSON.",
        "Seed the corpus with a bulk import script from a public query log (e.g., AOL dataset) or your own site's search history.",
        "Add a frontend input with a 75ms debounce that calls /suggest per settled keystroke and renders the dropdown.",
        "Add a Redis SET blocklist checked at ingest time so banned terms never enter a bucket.",
        "Add a nightly cron that walks all buckets and multiplies scores by 0.9 (ZUNIONSTORE with a weight) so stale queries decay.",
        "Load test hot prefixes with autocannon and confirm p99 stays under 20ms.",
      ],
      codeSketches: [
        {
          title: "Redis ZSET prefix buckets: ingest and lookup",
          language: "typescript",
          code: `import Redis from "ioredis";
const redis = new Redis();
const MAX_PREFIX = 20;
const BUCKET_SIZE = 50;

export async function recordQuery(raw: string) {
  const q = raw.trim().toLowerCase();
  if (!q || (await redis.sismember("blocklist", q))) return;
  for (let i = 1; i <= Math.min(q.length, MAX_PREFIX); i++) {
    const key = "sug:" + q.slice(0, i);
    await redis.zincrby(key, 1, q);
    // keep only the best N per bucket so memory stays bounded
    await redis.zremrangebyrank(key, 0, -(BUCKET_SIZE + 1));
  }
}

export async function suggest(prefix: string, limit = 10) {
  const key = "sug:" + prefix.trim().toLowerCase();
  return redis.zrevrange(key, 0, limit - 1); // O(log n + limit)
}`,
        },
        {
          title: "In-memory trie with precomputed top-k per node",
          language: "python",
          code: `class TrieNode:
    def __init__(self):
        self.children = {}
        self.top_k = []  # (score, query) pairs, best first, max 10

def build_trie(query_scores):
    root = TrieNode()
    for query, score in query_scores.items():
        node = root
        for ch in query:
            node = node.children.setdefault(ch, TrieNode())
            # maintain the top-k list at every ancestor node
            node.top_k.append((score, query))
            node.top_k.sort(reverse=True)
            del node.top_k[10:]
    return root

def suggest(root, prefix):
    node = root
    for ch in prefix.strip().lower():
        if ch not in node.children:
            return []
        node = node.children[ch]
    return [q for _, q in node.top_k]  # O(len(prefix)) total`,
        },
      ],
    },
  },
  {
    slug: "notification-system",
    title: "Design a Notification System",
    difficulty: "Medium",
    summary:
      "Design a platform service that delivers notifications to users across push (iOS/Android), email, and SMS on behalf of many internal product teams. The interesting problems are fan-out at scale, deduplication, per-user rate limiting and preferences, and reliable integration with flaky third-party providers like APNs, FCM, and SMS gateways.",
    functionalRequirements: [
      "Internal services can send a notification to one user, a list of users, or a segment (e.g., all users in a city) via a single API.",
      "Support push notification, email, and SMS channels, with per-notification channel selection and fallbacks (e.g., SMS if push unread after 30 min).",
      "Users can set preferences and opt-outs per channel and per notification category (marketing vs. transactional).",
      "Deduplicate notifications so a user never receives the same logical event twice, even under producer retries.",
      "Support scheduled and delayed delivery (e.g., send at 9am in the user's timezone).",
      "Track delivery status (sent, delivered, failed, opened) and expose it to producing teams.",
    ],
    nonFunctionalRequirements: [
      "At-least-once delivery into the pipeline with dedup at the edge, so users effectively see at-most-once per event.",
      "Soft real-time: transactional notifications (OTP, payment alerts) delivered within seconds; bulk campaigns can take minutes.",
      "Scale to ~1 billion notifications/day across all channels.",
      "Rate limit per user (avoid spamming) and per provider (respect APNs/FCM/SMS gateway quotas).",
      "High availability: the ingestion API must accept sends even when downstream providers are degraded.",
    ],
    backOfEnvelope: [
      {
        label: "Notifications per day",
        value: "1 billion",
        note: "~800M push, 150M email, 50M SMS; push dominates because it is cheap.",
      },
      {
        label: "Average / peak send rate",
        value: "~12K/s avg, ~120K/s peak",
        note: "1B / 86,400s ≈ 11.6K/s; marketing campaigns create 10x bursts, which is exactly why queues sit in the middle.",
      },
      {
        label: "SMS cost",
        value: "~$375K/day",
        note: "50M SMS x ~$0.0075 each; cost alone justifies aggressive channel fallback ordering (push first, SMS last).",
      },
      {
        label: "Device token storage",
        value: "~150 GB",
        note: "500M users x ~2 devices x ~150 bytes per token record.",
      },
      {
        label: "Delivery log storage",
        value: "~500 GB/day raw",
        note: "1B events x ~500 bytes; keep 30 days hot (~15 TB), archive the rest to cold storage.",
      },
    ],
    apiDesign: [
      {
        endpoint: "POST /v1/notifications",
        description:
          "Producer API: accepts {idempotency_key, recipient(s) or segment_id, category, channels, template_id, payload, schedule_time}. Returns 202 with a notification_id immediately; delivery is async.",
      },
      {
        endpoint: "GET /v1/notifications/{id}/status",
        description:
          "Returns per-recipient, per-channel delivery status (queued, sent, delivered, failed, opened) for producer teams and support tooling.",
      },
      {
        endpoint: "PUT /v1/users/{userId}/preferences",
        description:
          "Sets per-channel, per-category opt-in/opt-out and quiet hours; enforced centrally so every producing team gets compliance for free.",
      },
      {
        endpoint: "POST /v1/devices",
        description:
          "Registers or refreshes a device push token (APNs/FCM) for a user; called by mobile clients on app start and token rotation.",
      },
    ],
    highLevelDesign: [
      "Producing services call the notification API with an idempotency key. The API validates the request, checks the key against a dedup store (Redis with TTL, backed by a persistent table), persists the notification record, and drops a message onto a Kafka topic. Returning 202 here decouples producer latency from provider latency entirely.",
      "A fan-out service consumes the topic. For a single recipient it is a passthrough; for a segment it queries the user service to expand membership into batches of individual sends. Fan-out output is written to per-channel queues (push, email, SMS), which lets each channel scale, throttle, and fail independently.",
      "Before enqueueing per-channel work, a preference-and-policy layer runs: check the user's opt-outs for the category, apply quiet hours and timezone scheduling, run per-user rate limiting (e.g., max 5 marketing pushes/day via a Redis token bucket), and select the channel per the fallback policy.",
      "Channel workers pull from their queue and call the third-party provider: APNs and FCM for push, an ESP like SES/SendGrid for email, Twilio or a direct carrier gateway for SMS. Workers batch where providers allow it, apply per-provider rate limits, and retry with exponential backoff on transient failures; poison messages go to a dead-letter queue for inspection.",
      "Provider callbacks and receipts (APNs feedback, ESP webhooks, SMS DLRs) flow into a delivery-tracking service that updates the notification status store and prunes invalid device tokens. Analytics jobs aggregate open and failure rates per template and per provider, which feeds alerting and provider failover decisions.",
    ],
    dataModel: [
      {
        name: "notification",
        fields:
          "id BIGINT PK, idempotency_key VARCHAR UNIQUE, producer_id VARCHAR, category VARCHAR, template_id VARCHAR, payload JSONB, schedule_time TIMESTAMP, created_at TIMESTAMP",
        note: "One row per logical send request; the unique idempotency key is the dedup backstop behind the Redis cache.",
      },
      {
        name: "delivery",
        fields:
          "id BIGINT PK, notification_id BIGINT FK, user_id BIGINT, channel VARCHAR, provider VARCHAR, status VARCHAR, provider_message_id VARCHAR, updated_at TIMESTAMP",
        note: "One row per recipient per channel attempt; partitioned by time, this is the highest-volume table.",
      },
      {
        name: "device_token",
        fields:
          "user_id BIGINT, token VARCHAR, platform VARCHAR, app_version VARCHAR, last_active TIMESTAMP, valid BOOLEAN, PK (user_id, token)",
        note: "Pruned when APNs/FCM report the token invalid; stale tokens are the top cause of push 'failures'.",
      },
      {
        name: "user_preference",
        fields:
          "user_id BIGINT, category VARCHAR, channel VARCHAR, opted_in BOOLEAN, quiet_hours_start TIME, quiet_hours_end TIME, timezone VARCHAR, PK (user_id, category, channel)",
      },
    ],
    deepDives: [
      {
        heading: "Deduplication and idempotency end to end",
        body: "Duplicates enter from two directions: producers retrying the API call, and the pipeline redelivering messages (Kafka consumers are at-least-once). Producer-side duplicates are handled by requiring an idempotency key per logical event (e.g., 'order-1234-shipped'); the API checks Redis first and falls back to a unique constraint on the notifications table, so a crashed Redis never lets a duplicate through.\n\nPipeline-side duplicates need a second check close to the send: before a channel worker calls the provider, it does a conditional write on the delivery row (status queued -> sending). If the row is already in sending/sent, another worker won the race and this attempt is dropped. This is a classic transactional outbox pattern in reverse: the state transition in the DB is the source of truth for whether a send may happen.\n\nNote what this does not solve: if the worker crashes after calling APNs but before recording 'sent', a retry can still double-send. True exactly-once to an external provider is impossible; you minimize the window by recording the attempt before the provider call and treating an ambiguous outcome as sent for user-facing notifications (a missed notification is usually worse than nothing, but a duplicate OTP is harmless while a duplicate marketing push is annoying, so per-category policy applies).",
      },
      {
        heading: "Rate limiting: users, providers, and campaigns",
        body: "Three distinct rate limits coexist. Per-user limits protect the user experience: a Redis token bucket keyed by (user_id, category) caps marketing sends per day while exempting transactional messages like OTPs. Enforcing this centrally in the policy layer is a major selling point of a shared platform, since no individual product team can spam users past the global cap.\n\nPer-provider limits protect your standing with APNs, FCM, ESPs, and carriers. Channel workers share a distributed rate limiter per provider connection pool; exceeding SMS carrier throughput, for instance, gets messages silently queued or dropped by the carrier. Provider limits also drive worker autoscaling: there is no point scaling SMS workers past the gateway's throughput ceiling.",
      },
      {
        heading: "Third-party provider integration and failover",
        body: "APNs uses HTTP/2 with long-lived connections and token-based (JWT) auth; FCM has its own HTTP v1 API. Both return per-message errors that must be interpreted: an 'Unregistered'/'BadDeviceToken' response means the token is dead and must be pruned, while 5xx or throttling responses mean back off and retry. Conflating the two either spams dead tokens forever or drops live users.\n\nFor email and SMS, run at least two providers with weighted routing and health-based failover: if SendGrid's error rate spikes, shift traffic to SES. The abstraction that makes this clean is a provider-agnostic send interface per channel with adapters per vendor, plus delivery-receipt normalization so downstream tracking does not care which vendor sent the message.\n\nWebhooks from providers (bounces, complaints, DLRs) are ingested through a public callback endpoint into the same Kafka backbone. Email bounce and complaint handling is not optional: ESPs will suspend accounts with high complaint rates, so hard bounces must automatically suppress the address.",
      },
    ],
    bottlenecks: [
      "Segment fan-out: expanding 'all users in California' into 20M individual sends can flood the pipeline; batch the expansion and rate-limit campaign injection so transactional traffic keeps priority.",
      "Third-party provider throttling or outages; mitigated by per-provider queues, backoff, and multi-provider failover for email/SMS.",
      "The delivery status table grows by ~1B rows/day; requires time-based partitioning, async writes, and tiered retention.",
      "Hot users (e.g., a celebrity's followers all notified at once) are fine, but hot producers misconfiguring a loop can self-DDoS the platform; per-producer quotas at the API are essential.",
      "Priority inversion: bulk marketing campaigns queued ahead of OTPs; solve with separate priority queues or topics per traffic class.",
    ],
    keyTakeaways: [
      "Accept fast, deliver async: a 202 plus a queue decouples producer latency from the slowest SMS gateway.",
      "Per-channel queues and workers let push, email, and SMS scale and fail independently under one API.",
      "Idempotency keys at the API plus conditional state transitions at the send step give effective at-most-once user experience over an at-least-once pipeline.",
      "Centralized preferences, quiet hours, and per-user rate limits are the real product of a notification platform, not just message plumbing.",
      "Treat providers as unreliable dependencies: normalize their errors, prune dead tokens, and keep a second vendor warm.",
    ],
    relatedTopics: [
      "message-queues",
      "rate-limiting",
      "event-driven-architecture",
      "fault-tolerance",
      "api-design",
    ],
    rapidImplementation: {
      stack:
        "Node.js + Postgres as a transactional outbox, Redis for rate caps, Expo push + Resend email in free tiers, one Fly.io machine.",
      steps: [
        "Create Postgres tables outbox and user_preferences; the unique index on idempotency_key is your producer-side dedup.",
        "Build POST /notifications: INSERT into outbox with ON CONFLICT (idempotency_key) DO NOTHING and return 202 with the row id either way.",
        "Write the worker loop: every second, claim a batch of due rows with FOR UPDATE SKIP LOCKED so concurrent workers never grab the same row.",
        "In the worker, check the user's opt-outs and quiet hours, then apply a per-user daily marketing cap via a Redis counter with a 24h TTL.",
        "Wire two providers behind a common send(userId, payload) interface: Expo for push, Resend for email; add SMS later only if you must pay for it.",
        "On provider failure, bump attempts and push send_after forward with exponential backoff; after 5 attempts mark the row dead for inspection.",
        "Expose GET /notifications/:id/status reading straight off the outbox row, and a webhook endpoint that records provider delivery receipts.",
      ],
      codeSketches: [
        {
          title: "Outbox table and atomic batch claim",
          language: "sql",
          code: `CREATE TABLE outbox (
  id BIGSERIAL PRIMARY KEY,
  idempotency_key TEXT UNIQUE NOT NULL,
  user_id BIGINT NOT NULL,
  channel TEXT NOT NULL,          -- 'push' | 'email' | 'sms'
  category TEXT NOT NULL,         -- 'transactional' | 'marketing'
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INT NOT NULL DEFAULT 0,
  send_after TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON outbox (status, send_after);

-- Worker claims a batch atomically; SKIP LOCKED means
-- concurrent workers never double-send the same row.
UPDATE outbox SET status = 'sending', attempts = attempts + 1
WHERE id IN (
  SELECT id FROM outbox
  WHERE status = 'queued' AND send_after <= now()
  ORDER BY id LIMIT 100
  FOR UPDATE SKIP LOCKED
)
RETURNING *;`,
        },
        {
          title: "Worker with per-user rate cap and backoff",
          language: "typescript",
          code: `const DAILY_MARKETING_CAP = 5;

async function processBatch(rows: OutboxRow[]) {
  for (const row of rows) {
    // transactional messages (OTP, receipts) are exempt from caps
    if (row.category === "marketing") {
      const key = "cap:" + row.user_id + ":" + isoDate();
      const n = await redis.incr(key);
      if (n === 1) await redis.expire(key, 86400);
      if (n > DAILY_MARKETING_CAP) {
        await setStatus(row.id, "suppressed");
        continue;
      }
    }
    try {
      await providers[row.channel].send(row.user_id, row.payload);
      await setStatus(row.id, "sent");
    } catch {
      if (row.attempts >= 5) {
        await setStatus(row.id, "dead"); // poison row, inspect later
      } else {
        const delayMs = Math.min(2 ** row.attempts * 1000, 3600_000);
        await requeue(row.id, delayMs); // status back to queued
      }
    }
  }
}`,
        },
      ],
    },
  },
  {
    slug: "ride-sharing",
    title: "Design Ride Sharing (Uber/Lyft)",
    difficulty: "Hard",
    summary:
      "Design the core of a ride-sharing service: riders request trips, nearby drivers are found and matched in seconds, and both parties track each other live on a map. The hard parts are geospatial indexing of constantly moving drivers, a low-latency matching engine, a massive location-update write load, and dynamic (surge) pricing.",
    functionalRequirements: [
      "Riders request a ride with pickup and destination; the system returns an ETA and fare estimate up front.",
      "Match the rider to a suitable nearby driver within a few seconds, considering distance/ETA, driver status, and vehicle type.",
      "Drivers stream location updates; riders see the assigned driver moving on the map in near real time.",
      "Drivers can accept or decline offers; declines trigger re-matching to the next candidate.",
      "Track trip lifecycle (requested, matched, en route, in progress, completed) and compute the final fare including surge.",
      "Support surge pricing per area based on real-time supply and demand.",
    ],
    nonFunctionalRequirements: [
      "Matching latency under ~3 seconds end to end; nearby-driver queries under ~100ms.",
      "Handle millions of concurrent drivers each sending a location update every ~4 seconds.",
      "High availability for the request/match path; a rider unable to hail is lost revenue and trust.",
      "Location data can be slightly stale (seconds) but trip state and payments must be strongly consistent.",
      "A driver must never be assigned to two trips at once (no double dispatch).",
    ],
    backOfEnvelope: [
      {
        label: "Active drivers at peak",
        value: "2 million concurrent",
        note: "Out of ~10M registered drivers globally.",
      },
      {
        label: "Location update write QPS",
        value: "~500K/s",
        note: "2M drivers x 1 update / 4s = 500K writes/s; this single number rules out a relational DB for live locations and mandates in-memory storage.",
      },
      {
        label: "Ride requests",
        value: "~350/s avg, ~2K/s peak",
        note: "30M trips/day / 86,400s ≈ 347/s; Friday-night peaks in dense cities dominate capacity planning.",
      },
      {
        label: "Live location memory",
        value: "~100 GB",
        note: "2M drivers x ~50 bytes (id, lat, lng, heading, status, ts); trivially fits in a Redis cluster, sharded by geo region.",
      },
      {
        label: "Location history storage",
        value: "~2 TB/day",
        note: "500K/s x ~50 bytes ≈ 25 MB/s raw; with metadata ~2 TB/day into an append-only store (Cassandra) for trip replay, fare disputes, and ML.",
      },
    ],
    apiDesign: [
      {
        endpoint: "POST /v1/rides",
        description:
          "Rider requests a trip: {pickup, destination, vehicle_type}. Returns ride_id, fare estimate with surge multiplier, and ETA; matching proceeds async with status pushed over the rider's WebSocket.",
      },
      {
        endpoint: "POST /v1/drivers/me/location (or WebSocket/gRPC stream)",
        description:
          "Driver app streams {lat, lng, heading, ts} every ~4s. In practice this is a persistent connection, not per-update HTTP, to cut handshake overhead at 500K updates/s.",
      },
      {
        endpoint: "POST /v1/rides/{rideId}/offer-response",
        description:
          "Driver accepts or declines a dispatch offer within the offer TTL (~10s); accept transitions the trip to matched atomically or fails if another driver already took it.",
      },
      {
        endpoint: "GET /v1/rides/{rideId}",
        description:
          "Trip state, assigned driver, and live ETA; the same data is pushed to both parties over WebSocket so this is mainly for reconnection recovery.",
      },
    ],
    highLevelDesign: [
      "Both apps hold persistent WebSocket (or gRPC streaming) connections to a gateway fleet; a connection registry maps user -> gateway node so backend services can push to any client. Driver location updates arrive over these connections and are dropped onto a Kafka topic, giving one durable stream that fans out to every consumer that needs positions.",
      "The location service consumes the stream and maintains the live index: for each geographic cell (geohash prefix or H3 cell), a Redis structure holds the set of available drivers with their latest coordinates. Updates overwrite in place, so the index stores only current state; a parallel consumer appends the full history to Cassandra for offline use.",
      "When a ride is requested, the matching service computes the pickup's cell plus its neighbor ring (to avoid boundary misses), fetches candidate drivers from the index, filters by status and vehicle type, ranks by road-network ETA from the routing service rather than straight-line distance, and offers the trip to the best candidate with a ~10s TTL, cascading to the next on decline or timeout.",
      "Trip state lives in a strongly consistent transactional store. Acceptance is an atomic conditional update (trip: matching -> matched, driver: available -> on_trip); whichever accept lands first wins and the loser gets a clean 'already taken' failure. This is the guardrail against double dispatch regardless of how racy the surrounding pipeline is.",
      "The surge service consumes the same location stream plus the request stream, computes supply/demand ratios per cell per minute, and publishes multipliers to a cache read by the pricing service at quote time. The multiplier shown at request time is locked into the trip record so the fare cannot drift mid-ride.",
    ],
    dataModel: [
      {
        name: "trip",
        fields:
          "id BIGINT PK, rider_id BIGINT, driver_id BIGINT, status VARCHAR, pickup_lat DECIMAL(9,6), pickup_lng DECIMAL(9,6), dest_lat DECIMAL(9,6), dest_lng DECIMAL(9,6), surge_multiplier DECIMAL(3,2), quoted_fare DECIMAL(10,2), final_fare DECIMAL(10,2), requested_at TIMESTAMP, completed_at TIMESTAMP",
        note: "Source of truth for state transitions; conditional updates on status enforce the trip state machine.",
      },
      {
        name: "driver_live_location (Redis)",
        fields:
          "key geo_cell_id, member driver_id, value {lat, lng, heading, status, updated_at}",
        note: "Sharded by region; entries expire if not refreshed within ~15s so crashed drivers vanish from matching automatically.",
      },
      {
        name: "location_history (Cassandra)",
        fields:
          "driver_id BIGINT, bucket DATE, ts TIMESTAMP, lat DECIMAL(9,6), lng DECIMAL(9,6), trip_id BIGINT, PK ((driver_id, bucket), ts)",
        note: "Append-only, time-bucketed partitions; powers trip replay, fare disputes, and ETA model training.",
      },
      {
        name: "surge_cell",
        fields:
          "cell_id VARCHAR, window_start TIMESTAMP, open_requests INT, available_drivers INT, multiplier DECIMAL(3,2), PK (cell_id, window_start)",
      },
    ],
    deepDives: [
      {
        heading: "Geospatial indexing: geohash vs. quadtree vs. H3",
        body: "Geohash encodes lat/lng into a base-32 string where shared prefixes imply proximity, so 'find nearby drivers' becomes a prefix lookup at a chosen precision (geohash-6 cells are roughly 1.2km x 0.6km, a sensible dispatch radius in cities). It is simple and maps directly onto Redis keys. Its weaknesses: cells are rectangles of uneven aspect ratio, cell sizes jump discretely between precision levels, and two adjacent points can have completely different prefixes across a cell boundary, so you must always query the 8 neighboring cells too.\n\nA quadtree adapts to density by splitting cells that exceed a driver-count threshold, giving small cells in Manhattan and huge ones in Wyoming. That adaptivity is attractive, but a mutable in-memory tree under 500K writes/s needs careful concurrency control and is harder to shard than a flat cell keyspace. Static grids with density-appropriate precision per region capture most of the benefit with far less machinery.\n\nH3, Uber's own hexagonal hierarchical index, is what they actually use: hexagons have near-uniform distance to all neighbors (no corner-distance distortion like squares), every cell has exactly 6 neighbors at the same resolution, and the hierarchy supports clean aggregation for surge heatmaps. In an interview, geohash + neighbor queries on Redis is a perfectly defensible baseline; name H3 and explain the hexagon advantage as the production-grade refinement.",
      },
      {
        heading: "The matching engine and double-dispatch prevention",
        body: "Ranking candidates by straight-line distance is the classic rookie mistake: a driver 200m away across a river or a divided highway may be 10 minutes away by road. The matcher should fetch a generous candidate set (say 20 drivers) from the geo index cheaply, then call the routing service for real ETAs on that shortlist, then rank by ETA blended with driver acceptance rate and fairness signals. This two-phase filter keeps expensive routing calls off the hot path for all but a handful of candidates.\n\nDispatch is offer-based: lock the top candidate softly (mark them 'offered' in the index so concurrent matches skip them), push the offer with a ~10s TTL, and cascade to the next candidate on decline or timeout. The hard guarantee against double dispatch does not live in the index, which is eventually consistent by design; it lives in the trip store, where acceptance is a compare-and-set on both the trip row and the driver's status. Even if two matching workers somehow offer the same driver two trips, only one accept can commit.\n\nBatching is a meaningful optimization at scale: instead of matching each request greedily the instant it arrives, collect requests in a small window (1-2s) per area and solve the assignment jointly, which measurably lowers aggregate pickup ETA during peaks. Mention it as an evolution, not the v1.",
      },
      {
        heading: "Handling 500K location updates per second",
        body: "The write path is the throughput monster, so keep it dumb and fast: persistent connections at the gateway, minimal validation, straight into Kafka partitioned by region or driver_id. Kafka acts as the shock absorber and as the single source for multiple consumers (live index, history writer, surge, ETA models) without duplicating the ingest path.\n\nThe live index consumer does last-write-wins upserts into region-sharded Redis. Two details matter. First, cell transitions: when a driver moves from cell A to B, the update must remove them from A and add to B; keeping a driver -> current-cell reverse mapping makes this a cheap two-key operation. Second, TTLs: every entry expires in ~15s unless refreshed, so drivers whose app died or who lost signal drop out of matching automatically instead of appearing as phantom supply.\n\nBandwidth and battery push toward adaptive update rates: a driver on a highway between trips can report every 10-15s, one approaching a pickup every 1-2s. The client can also batch and delta-encode points. On the read side, the rider map does not need every raw point; interpolating/snapping the driver's position along the known route between 4-second updates yields smoother UX than higher update frequency would.",
      },
      {
        heading: "Surge pricing mechanics",
        body: "Surge exists to fix a marketplace imbalance in real time: when open requests exceed available drivers in an area, raising price both suppresses marginal demand and pulls drivers toward the hot zone. Compute it per cell per short window (e.g., 1-5 minutes) as a function of the request/driver ratio, smoothed over recent windows so the multiplier does not oscillate wildly, and use coarser cells (H3 res 7-8) than dispatch to avoid noisy micro-zones and cliff effects at cell borders.\n\nOperationally the crucial property is quote consistency: the multiplier is evaluated once at quote time, shown to the rider, and frozen into the trip record on acceptance. Recomputing surge at trip end, or letting the quote silently expire mid-flow, is both a UX disaster and a regulatory risk. Quotes carry a short validity window (a couple of minutes) after which the rider must re-request.\n\nSurge is also a feedback loop with the dispatch system: publishing a surge heatmap to driver apps redistributes supply, which lowers surge, which is exactly the intended equilibrium. Guard against pathological loops (drivers chasing surge that vanishes on arrival) by smoothing and by showing predicted rather than instantaneous multipliers.",
      },
    ],
    bottlenecks: [
      "Location write throughput (~500K/s) makes any disk-backed synchronous store on the hot path a non-starter; Kafka + in-memory index is the load-bearing decision.",
      "Dense-city hotspots: one geohash cell in midtown Manhattan can hold thousands of drivers while rural cells are empty; use finer precision or adaptive cells in dense regions.",
      "Routing-service ETA calls during matching are expensive; without the two-phase candidate filter they become the matching latency bottleneck.",
      "Event spikes (concert lets out, airport surge) multiply requests in one cell by 50x in minutes; matching workers and the routing service need regional burst headroom.",
      "WebSocket gateway fleet holds millions of long-lived connections; connection rebalancing during deploys must not drop trips mid-dispatch.",
    ],
    keyTakeaways: [
      "Separate the firehose from the truth: locations flow through Kafka into an ephemeral in-memory geo index, while trip state lives in a small, strongly consistent store.",
      "Geo indexing is a cell-mapping problem: geohash/H3 prefix buckets plus neighbor-ring queries turn 'nearby drivers' into O(1) key lookups.",
      "Prevent double dispatch with atomic conditional state transitions in the trip store, never with the eventually consistent index.",
      "Rank by road ETA, not straight-line distance, using a cheap-filter-then-expensive-rank two-phase match.",
      "Freeze the surge multiplier at quote time; pricing consistency is a correctness requirement, not a nicety.",
    ],
    relatedTopics: [
      "realtime-communication",
      "message-queues",
      "caching",
      "sharding-and-partitioning",
      "event-driven-architecture",
    ],
    rapidImplementation: {
      stack:
        "Node.js + Socket.IO for live connections, Redis hashes keyed by geohash cell, Postgres for trips, haversine ranking (OSRM later), one Hetzner VM.",
      steps: [
        "Scaffold Express + Socket.IO with separate driver and rider namespaces; the driver app emits {lat, lng} every 4 seconds.",
        "Store live locations in geohash-6 cell hashes in Redis with a 15s freshness window, plus a driver-to-cell reverse key so cell moves are a cheap two-key update.",
        "Create a Postgres trips table with a status state machine: requested, matching, matched, in_progress, completed, cancelled.",
        "Build POST /rides: quote fare as distance x rate x surge, insert the trip in 'matching', then query the pickup's cell plus its 8 neighbors for candidate drivers.",
        "Rank candidates by haversine distance for the MVP, push an offer with a 10s TTL to the top driver's socket, and cascade to the next on decline or timeout.",
        "Implement accept as a conditional UPDATE ... WHERE status = 'matching'; zero rows updated means someone else won, so tell the driver it is taken.",
        "During the trip, relay the driver's position to the rider's socket and mark completion, computing the final fare from the frozen quote.",
        "Surge MVP: a per-cell counter of open requests vs. available drivers per minute; multiplier = clamp(requests / max(drivers, 1), 1, 3), frozen into the quote.",
      ],
      codeSketches: [
        {
          title: "Geohash bucket index: update and neighbor query",
          language: "typescript",
          code: `import geohash from "ngeohash";

const PRECISION = 6; // roughly 1.2km x 0.6km cells
const FRESH_MS = 15_000;

export async function updateDriver(id: string, lat: number, lng: number) {
  const cell = geohash.encode(lat, lng, PRECISION);
  const prev = await redis.getset("drv:" + id, cell);
  if (prev && prev !== cell) await redis.hdel("cell:" + prev, id);
  await redis.hset(
    "cell:" + cell, id,
    JSON.stringify({ lat, lng, t: Date.now() })
  );
  await redis.expire("drv:" + id, 15); // dead apps vanish from matching
}

export async function nearbyDrivers(lat: number, lng: number) {
  const center = geohash.encode(lat, lng, PRECISION);
  const cells = [center, ...geohash.neighbors(center)]; // avoid edge misses
  const out: Array<{ id: string; lat: number; lng: number }> = [];
  for (const c of cells) {
    const members = await redis.hgetall("cell:" + c);
    for (const [id, raw] of Object.entries(members)) {
      const p = JSON.parse(raw);
      if (Date.now() - p.t < FRESH_MS) out.push({ id, lat: p.lat, lng: p.lng });
    }
  }
  return out;
}`,
        },
        {
          title: "Nearest-driver ranking and atomic dispatch accept",
          language: "typescript",
          code: `function haversineKm(a: Pt, b: Pt) {
  const R = 6371, d = Math.PI / 180;
  const dLat = (b.lat - a.lat) * d, dLng = (b.lng - a.lng) * d;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * d) * Math.cos(b.lat * d) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function matchRide(tripId: number, pickup: Pt) {
  const candidates = (await nearbyDrivers(pickup.lat, pickup.lng))
    .map((c) => ({ ...c, dist: haversineKm(pickup, c) }))
    .sort((x, y) => x.dist - y.dist)
    .slice(0, 5);
  for (const c of candidates) {
    const accepted = await offerWithTtl(c.id, tripId, 10_000);
    if (!accepted) continue; // decline or timeout: next candidate
    // atomic compare-and-set is the double-dispatch guardrail
    const res = await pool.query(
      "UPDATE trips SET status = 'matched', driver_id = $1 " +
      "WHERE id = $2 AND status = 'matching'",
      [c.id, tripId]
    );
    if (res.rowCount === 1) return c.id; // this accept won
  }
  return null; // no driver found; widen the search ring
}`,
        },
      ],
    },
  },
  {
    slug: "key-value-store",
    title: "Design a Distributed Key-Value Store (Dynamo)",
    difficulty: "Hard",
    summary:
      "Design a horizontally scalable, highly available key-value store in the style of Amazon's Dynamo paper (and its descendants Cassandra and Riak). The design tour covers consistent hashing for placement, quorum reads/writes for tunable consistency, vector clocks for conflict detection, hinted handoff and merkle trees for repair, and gossip for membership.",
    functionalRequirements: [
      "get(key) returns the value (or, under conflict, a set of divergent versions for the client to reconcile).",
      "put(key, value) writes with a version context; supports values up to ~1 MB.",
      "delete(key) removes a key (implemented as a tombstone write).",
      "Cluster scales incrementally: adding or removing a node moves only a small fraction of keys.",
      "Per-operation tunable consistency: callers choose R and W per request or per table.",
    ],
    nonFunctionalRequirements: [
      "Always writable: the store accepts writes during node failures and network partitions (AP in CAP terms).",
      "P99 latency budget in single-digit milliseconds for reads and writes at the coordinator.",
      "No single point of failure; any node can coordinate any request.",
      "Eventual consistency with bounded, observable convergence; conflicting versions are surfaced, never silently dropped.",
      "Incremental scalability to hundreds of nodes and hundreds of TB with near-linear throughput.",
    ],
    backOfEnvelope: [
      {
        label: "Dataset",
        value: "100 TB logical, 300 TB raw",
        note: "Replication factor N=3 triples the footprint before compression.",
      },
      {
        label: "Cluster size",
        value: "~75 nodes",
        note: "300 TB / ~4 TB usable NVMe per node; also check per-node QPS fits.",
      },
      {
        label: "Throughput",
        value: "500K reads/s, 100K writes/s",
        note: "With N=3, R=W=2: each read touches ~2-3 replicas, each write ~3, so internal traffic is ~1.5M reads/s and ~300K writes/s across the fleet, ~20-25K ops/s per node.",
      },
      {
        label: "Virtual nodes",
        value: "~200 per physical node, ~15K total",
        note: "Smooths the hash ring so per-node load varies by a few percent instead of 2x, and spreads rebalancing across the whole cluster.",
      },
      {
        label: "Gossip convergence",
        value: "~O(log N) rounds ≈ 7 rounds ≈ 7s",
        note: "With 1s gossip intervals and 75 nodes, membership changes propagate cluster-wide in seconds.",
      },
    ],
    apiDesign: [
      {
        endpoint: "GET /v1/kv/{key}?r=2",
        description:
          "Coordinator reads from R of the N replicas, returns the highest version, or multiple siblings with their vector-clock contexts if versions are causally concurrent.",
      },
      {
        endpoint: "PUT /v1/kv/{key}?w=2 (body: value + context)",
        description:
          "Write with the version context from a prior read; the coordinator increments its vector-clock entry and returns success once W replicas ack.",
      },
      {
        endpoint: "DELETE /v1/kv/{key}?w=2",
        description:
          "Writes a tombstone through the same quorum path; tombstones are garbage-collected after a grace period longer than the maximum repair window.",
      },
      {
        endpoint: "GET /v1/admin/ring",
        description:
          "Operational endpoint exposing the current ring: token ranges, node ownership, and per-node health as seen via gossip.",
      },
    ],
    highLevelDesign: [
      "Clients (or a thin smart-client library) send requests to any node. Every node knows the full ring via gossip, so a node receiving a request either coordinates it directly or forwards it to a natural coordinator. There is no master, no config service on the hot path, and therefore no single point of failure.",
      "Placement uses consistent hashing: keys hash onto a ring of tokens, each physical node owns many virtual-node tokens, and a key's preference list is the next N distinct physical nodes clockwise from its hash. Virtual nodes make load and rebalancing granular; when a node joins it takes small slices from everyone rather than half of one neighbor's range.",
      "A write goes to the coordinator, which stamps the vector clock, sends it to all N preference-list replicas, and acks the client after W responses. A read fans out to the preference list and returns after R responses; if the responses disagree, the coordinator returns the causally latest version, or all concurrent siblings, and performs read repair by writing the winner back to stale replicas.",
      "Each replica persists writes to a local LSM-tree storage engine: append to a commit log, apply to an in-memory memtable, flush to immutable SSTables, and compact in the background. This makes the per-node write path sequential I/O, which is what sustains high write throughput on commodity disks.",
      "Failures are handled in layers: sloppy quorum with hinted handoff keeps writes flowing when a replica is briefly down; anti-entropy with merkle trees repairs longer divergence; and gossip-based membership with failure detection tells everyone which layer applies. Together these implement 'always writable' without a coordinator database.",
    ],
    dataModel: [
      {
        name: "item",
        fields:
          "key VARCHAR(1024) PK, value BLOB, vector_clock LIST<(node_id, counter)>, timestamp TIMESTAMP, tombstone BOOLEAN",
        note: "The vector clock travels with the item; the wall-clock timestamp is only a tiebreaker/GC aid, never the correctness mechanism.",
      },
      {
        name: "ring_state (gossiped)",
        fields:
          "node_id UUID, tokens LIST<BIGINT>, status VARCHAR, heartbeat_generation BIGINT, version BIGINT",
        note: "Every node holds a full copy, updated via gossip; versioned so newer state always wins a merge.",
      },
      {
        name: "hint",
        fields:
          "target_node UUID, key VARCHAR, value BLOB, vector_clock LIST<(node_id, counter)>, stored_at TIMESTAMP, PK (target_node, key, stored_at)",
        note: "Writes accepted on behalf of a down replica; replayed to the target when gossip marks it alive, expired after a few hours to bound buildup.",
      },
    ],
    deepDives: [
      {
        heading: "Consistent hashing and virtual nodes",
        body: "Naive placement (hash(key) mod N) reshuffles almost every key when N changes, which at 100 TB means a cluster-wide data migration for every node added. Consistent hashing fixes this: both keys and nodes hash onto the same ring, each node owns the arc between its token and its predecessor's, and adding a node moves only the keys in the slice it takes over, about 1/N of the data.\n\nRaw consistent hashing has two problems: random token placement gives some nodes arcs several times larger than others, and when a node dies its entire load lands on exactly one successor. Virtual nodes solve both: each physical node owns 100-300 tokens scattered around the ring, so ownership variance drops to a few percent, a dead node's load spreads across many successors, and heterogeneous hardware is handled by assigning proportionally more vnodes to bigger machines.\n\nReplication composes naturally: the preference list for a key is the first N distinct physical nodes walking clockwise (skipping vnodes that map to an already-chosen machine, and ideally skipping same-rack nodes for fault-domain diversity). Every node can compute any key's preference list locally from gossiped ring state, which is what lets any node coordinate any request.",
      },
      {
        heading: "Quorums: R + W > N and what it actually buys",
        body: "With N replicas, requiring W write acks and R read responses gives overlap when R + W > N: at least one replica in any read quorum saw the latest committed write. Typical setting N=3, R=W=2 tolerates one down replica for both reads and writes while keeping read-your-write-ish behavior. R=1, W=1 maximizes availability and speed at the cost of stale reads; W=N gives strong write durability but any single replica failure blocks writes.\n\nIt is worth saying in an interview that R + W > N is weaker than linearizability. The overlap guarantees the read quorum contains the newest version, but concurrent writes to different coordinators still produce siblings, and a failed write that reached one replica can 'leak' into future reads. This is why Dynamo pairs quorums with versioning (vector clocks) rather than pretending quorums alone give strong consistency.\n\nDynamo further uses sloppy quorums: if a preference-list node is unreachable, the coordinator uses the next healthy node on the ring as a stand-in, so W acks are still achievable during failures. That preserves availability but explicitly weakens the overlap guarantee (the stand-in is not in the read set), which is exactly the availability-over-consistency trade the system advertises. Strict-quorum systems like Cassandra with QUORUM consistency make the opposite call per-query.",
      },
      {
        heading: "Vector clocks and conflict resolution",
        body: "Wall-clock last-write-wins silently loses data whenever clocks skew or writes race. Vector clocks fix detection: each item carries a list of (coordinator, counter) pairs, and a coordinator handling a write increments its own counter. Version A is an ancestor of B if every counter in A is <= the corresponding counter in B; then B simply supersedes A. If each has a counter the other lacks, the versions are causally concurrent: a true conflict.\n\nOn conflict, Dynamo's choice is to keep both siblings and return them on read, pushing semantic resolution to the application, the canonical example being merging two divergent shopping carts by unioning items (an add is never lost; a concurrent delete may resurrect, which Amazon deemed acceptable). The client then writes back the merged value with a context descending from both siblings, collapsing the branches.\n\nThe costs are real: clocks grow with the number of distinct coordinators (pruned by keeping the most recent ~10 entries, which can rarely cause false concurrency), and every read-modify-write must round-trip the context. This is why later systems diverged: Cassandra dropped vector clocks for per-cell timestamps plus LWW (simpler, lossy), while CRDTs formalize the merge so it is automatic and provably convergent. Knowing this trade-space is the senior-level answer.",
      },
      {
        heading: "Failure handling: hinted handoff, merkle trees, gossip",
        body: "Hinted handoff covers short outages. When replica C is down during a write, the coordinator writes to a stand-in node D with a hint 'this belongs to C'. D stores hints separately and replays them when gossip reports C alive. Writes stay available and C converges quickly, but hints are best-effort: if D also dies, or the outage outlasts hint TTL, the write survives only on the other replicas, which is why a deeper repair layer is required.\n\nAnti-entropy with merkle trees covers long divergence. Each node maintains, per owned key range, a hash tree whose leaves cover buckets of keys. Two replicas compare roots; identical roots mean the range is in sync at the cost of one hash exchange, and differing roots are chased down the tree in O(log n) exchanges to find exactly the divergent buckets, which are then synchronized. This makes full-replica repair proportional to the amount of divergence, not the amount of data.\n\nGossip ties it together. Every second, each node exchanges versioned membership state (heartbeat generations, node statuses, token ownership) with a few random peers; information spreads epidemically in O(log N) rounds. Failure detection is local and probabilistic (e.g., phi-accrual on heartbeat arrival intervals) and drives only routing decisions, never data deletion: a node marked down gets hints, and permanent removal is an explicit operator action. Interviewers probe this exact point: temporary failure handling (hints) and permanent membership change (rebalance) must be distinct mechanisms.",
      },
    ],
    bottlenecks: [
      "Hot keys concentrate on one preference list regardless of ring quality; mitigations are request-level caching in front, key salting/splitting, or read replicas for the hot range.",
      "Sloppy quorum under partition can accept writes on stand-ins that a strict read quorum never sees until handoff completes; consistency-sensitive callers must use strict quorum settings.",
      "LSM compaction competes with foreground I/O; unthrottled compaction causes read latency spikes, throttled compaction risks unbounded SSTable buildup.",
      "Tombstone accumulation: deletes are writes, and ranges with heavy delete churn slow reads until GC grace expires and compaction purges them.",
      "Merkle-tree rebuilds and full repairs are I/O-heavy; running repair on many ranges at once can saturate disks, so repairs are scheduled and rate-limited.",
    ],
    keyTakeaways: [
      "Consistent hashing with virtual nodes gives incremental scalability: node changes move ~1/N of data, spread across the fleet.",
      "R + W > N is a tunable overlap knob, not linearizability; it must be paired with versioning to handle concurrent writes honestly.",
      "Vector clocks detect conflicts instead of hiding them; someone (app, CRDT, or LWW policy) must own the merge, and that choice defines the store's semantics.",
      "Layer the failure handling: sloppy quorum + hinted handoff for seconds-to-hours outages, merkle-tree anti-entropy for deep repair, gossip for membership truth.",
      "Every design choice here spends consistency to buy availability; be able to say precisely where (sloppy quorum, async repair, LWW pruning) that spend happens.",
    ],
    relatedTopics: [
      "consistent-hashing",
      "consistency-and-cap",
      "replication",
      "fault-tolerance",
      "sharding-and-partitioning",
    ],
    rapidImplementation: {
      stack:
        "Python + FastAPI nodes talking plain HTTP to each other, SQLite per node for storage, 3 processes via docker-compose on one laptop.",
      steps: [
        "Write the consistent-hash Ring class with ~100 vnodes per node; unit test that removing a node remaps only about 1/N of 10K sample keys.",
        "Build a FastAPI node exposing internal GET/PUT /local/{key} backed by a SQLite table (key, value, version).",
        "Add coordinator logic: any node computes the preference list for a key and fans the PUT to N=3 replicas, acking the client after W=2 responses.",
        "Implement quorum GET: read from R=2 replicas, return the highest version, and write it back to any stale replica (read repair).",
        "Bring up 3 nodes with docker-compose, kill one, and verify reads and writes still succeed at R=W=2.",
        "Add hinted handoff: when a replica is down, write to the next healthy ring node with a hint row, and replay hints on a background timer.",
        "Add GET /admin/ring showing token ownership and a smoke script that writes 10K keys and checks the distribution is roughly even.",
      ],
      codeSketches: [
        {
          title: "Consistent-hash ring with virtual nodes",
          language: "python",
          code: `import hashlib
from bisect import bisect_right

class Ring:
    def __init__(self, nodes, vnodes=100):
        self.tokens = []  # sorted (hash, node) pairs
        for node in nodes:
            for i in range(vnodes):
                self.tokens.append((self._hash(node + ":" + str(i)), node))
        self.tokens.sort()

    @staticmethod
    def _hash(s):
        return int(hashlib.md5(s.encode()).hexdigest(), 16)

    def preference_list(self, key, n=3):
        idx = bisect_right(self.tokens, (self._hash(key), chr(0)))
        picked = []
        for i in range(len(self.tokens)):
            node = self.tokens[(idx + i) % len(self.tokens)][1]
            if node not in picked:  # skip vnodes of already-chosen hosts
                picked.append(node)
            if len(picked) == n:
                break
        return picked`,
        },
        {
          title: "Quorum read with read repair",
          language: "python",
          code: `async def quorum_get(ring, key, r=2, n=3):
    replies = []
    for node in ring.preference_list(key, n):
        try:
            # each reply: {"value": ..., "version": int}
            replies.append((node, await http_get(node, key)))
        except Exception:
            continue  # dead replica, try the next one
        if len(replies) >= r:
            break
    if len(replies) < r:
        raise QuorumError("read quorum failed: " + str(len(replies)))
    newest = max(replies, key=lambda p: p[1]["version"])[1]
    for node, reply in replies:
        if reply["version"] < newest["version"]:
            # read repair: push the winner back to stale replicas
            await http_put(node, key, newest)
    return newest

async def quorum_put(ring, key, value, version, w=2, n=3):
    item = {"value": value, "version": version + 1}
    acks = 0
    for node in ring.preference_list(key, n):
        try:
            await http_put(node, key, item)
            acks += 1
        except Exception:
            continue
    if acks < w:
        raise QuorumError("write quorum failed")
    return item`,
        },
      ],
    },
  },
  {
    slug: "cloud-storage",
    title: "Design Cloud File Storage (Dropbox/Drive)",
    difficulty: "Hard",
    summary:
      "Design a file hosting service where users upload files, sync them across devices, and share them with others. The core ideas are content-defined chunking, block-level deduplication, delta sync so edits upload only changed chunks, a metadata database that is the real brain of the system, and conflict resolution when two devices edit the same file offline.",
    functionalRequirements: [
      "Upload, download, and delete files up to ~10 GB from desktop, mobile, and web clients.",
      "Automatic sync: a change on one device propagates to the user's other devices within seconds.",
      "File version history: restore any previous version within the retention window (e.g., 30 days).",
      "Share files and folders with other users with viewer/editor permissions.",
      "Offline edits sync when the device reconnects, with safe conflict handling when both sides changed.",
    ],
    nonFunctionalRequirements: [
      "Durability is the prime directive: eleven nines via replicated/erasure-coded block storage; losing a user's file is unacceptable.",
      "Sync latency of a few seconds for small edits on connected devices.",
      "Bandwidth efficiency: never re-upload unchanged data; edits transfer only deltas.",
      "Metadata operations strongly consistent (a committed upload is immediately listable on other devices).",
      "Scale: 500M users, ~50 PB logical data; encryption at rest and in transit.",
    ],
    backOfEnvelope: [
      {
        label: "Users and data",
        value: "500M users, 50 PB logical",
        note: "~100M DAU; average ~100 MB stored per registered user is realistic for a freemium tier mix.",
      },
      {
        label: "Physical storage after dedup and erasure coding",
        value: "~53 PB",
        note: "~30% cross-user dedup savings brings 50 PB to 35 PB; erasure coding at ~1.5x overhead brings it back to ~53 PB, versus 105 PB for 3x replication.",
      },
      {
        label: "Upload traffic",
        value: "~230K chunks/s peak",
        note: "100M DAU x 4 file changes/day x avg 2 changed 4-MB chunks = 800M chunk uploads/day ≈ 9.3K/s average; 25x peak factor for workday bursts.",
      },
      {
        label: "Metadata size",
        value: "~30 TB",
        note: "50 PB / 4 MB = ~12.5B chunk rows x ~1 KB with indexes, plus ~10B file/version rows; sharded relational or NewSQL territory.",
      },
      {
        label: "Notification fan-out",
        value: "~50M concurrent long-poll/WebSocket connections",
        note: "Each online device holds a connection to learn about changes; this is its own gateway fleet sizing problem.",
      },
    ],
    apiDesign: [
      {
        endpoint: "POST /v1/files/commit",
        description:
          "Commits a file version: {path, size, file_hash, ordered chunk hashes, parent_version}. Server responds with which chunks it already has (dedup) and presigned upload URLs for the missing ones; commit finalizes once all chunks exist.",
      },
      {
        endpoint: "PUT {presigned_block_url} (body: encrypted chunk)",
        description:
          "Uploads one content-addressed chunk directly to block storage, bypassing application servers; retried independently, enabling resumable parallel uploads.",
      },
      {
        endpoint: "GET /v1/files/{fileId}?version=n",
        description:
          "Returns file metadata and the chunk list with presigned download URLs; the client fetches only chunks it does not already hold locally.",
      },
      {
        endpoint: "GET /v1/changes?cursor={cursor} (+ long-poll /v1/notify)",
        description:
          "Cursor-based journal of metadata changes for the account; the notify channel just says 'something changed', and the client then pulls the delta from its cursor. This pull-based delta model makes missed notifications harmless.",
      },
    ],
    highLevelDesign: [
      "The desktop client is a significant system component in its own right: a watcher detects local file changes, a chunker splits files into blocks and hashes each (SHA-256), a local SQLite index maps files to chunk hashes, and a sync engine reconciles local state against the server journal. Because chunks are content-addressed, 'what changed' is computable entirely from hashes.",
      "On upload, the client sends the chunk-hash manifest to the metadata service first. The server diffs it against known chunks and returns only the missing ones, so unchanged chunks (the common case for edits) and chunks any user already uploaded (dedup) are never transferred. Missing chunks go straight to block storage (S3-style) via presigned URLs, keeping bulk bytes off the application tier.",
      "Once all chunks are durable, the client commits the version. The metadata service transactionally writes the new file version, its ordered chunk list, and a journal entry, with an atomic parent-version check that is the linchpin of conflict detection. Metadata lives in a sharded relational database (sharded by user/namespace) because sync correctness leans hard on transactions.",
      "The journal entry triggers the notification service, which pings the user's other online devices over long-lived connections. Devices respond by pulling changes from their cursor, computing which chunks they lack, and downloading just those, assembling the new version locally. Shared folders work the same way with the namespace's journal fanned out to all members.",
      "Cold chunks tier from hot object storage to cheaper archival classes based on access recency, and block storage runs erasure coding across failure domains for durability at ~1.5x overhead. A garbage collector deletes chunks only when reference counts from all live versions and the retention window reach zero.",
    ],
    dataModel: [
      {
        name: "file_version",
        fields:
          "id BIGINT PK, file_id BIGINT, version INT, size BIGINT, file_hash CHAR(64), device_id BIGINT, committed_at TIMESTAMP, is_deleted BOOLEAN, UNIQUE (file_id, version)",
        note: "Immutable once committed; version history and rollback are just pointers to old rows.",
      },
      {
        name: "version_chunk",
        fields:
          "version_id BIGINT, seq INT, chunk_hash CHAR(64), chunk_size INT, PK (version_id, seq)",
        note: "Ordered manifest mapping a version to its chunks; the join table that makes dedup and delta sync possible.",
      },
      {
        name: "chunk",
        fields:
          "chunk_hash CHAR(64) PK, storage_key VARCHAR, ref_count BIGINT, size INT, created_at TIMESTAMP",
        note: "Content-addressed; ref_count guards GC. In practice ref counting is done via periodic mark-and-sweep jobs rather than synchronous counters.",
      },
      {
        name: "journal",
        fields:
          "namespace_id BIGINT, cursor BIGINT, file_id BIGINT, version_id BIGINT, op VARCHAR, ts TIMESTAMP, PK (namespace_id, cursor)",
        note: "Monotonic per-namespace change log; clients sync by cursor, which makes recovery after disconnection trivial.",
      },
    ],
    deepDives: [
      {
        heading: "Chunking strategy: fixed-size vs. content-defined",
        body: "Fixed-size chunking (e.g., 4 MB blocks, Dropbox's historical choice) is simple and fast: offsets are predictable, and an in-place edit dirties only the chunks it touches. Its weakness is the insertion problem: inserting one byte near the start of a file shifts every subsequent byte, changing every downstream chunk hash and forcing a near-full re-upload.\n\nContent-defined chunking (CDC) fixes this by cutting chunks where a rolling hash (Rabin fingerprint or Gear/FastCDC) of a sliding window hits a boundary pattern, with min/avg/max bounds like 2/4/8 MB. Boundaries are determined by content, so an insertion changes only the chunk containing it (and occasionally a neighbor); everything after re-aligns to the same boundaries. The costs are CPU on the client and variable chunk sizes complicating bookkeeping.\n\nA sensible answer: fixed 4 MB for the v1 because most real workloads are whole-file replacements or appends, then CDC as the optimization for large frequently-edited files where it shines (VM images, mail archives, design files). Also note dedup granularity interacts with chunk size: smaller chunks dedup better but explode metadata row count, and at 12.5B chunk rows metadata is already the scaling pressure point.",
      },
      {
        heading: "Deduplication and its security tradeoffs",
        body: "Content addressing gives dedup almost for free: before uploading, the client sends chunk hashes and the server answers 'already have these'. Within one account this makes copies and moves nearly instant. Across users the savings are large (~30% is a commonly cited figure) because popular files (installers, media, shared docs) are stored once regardless of how many users hold them.\n\nCross-user dedup has a subtle security problem: if the server confirms 'I already have this chunk' before upload, an attacker can probe whether any user stores a specific file (the confirmation-of-file attack), and hash-only 'uploads' let someone claim possession of content they never had. Mitigations include requiring proof-of-possession over random chunk ranges, or scoping dedup to within an account or trust domain. Client-side encryption complicates this further: with per-user keys, identical plaintexts encrypt differently and dedup dies unless you adopt convergent encryption, which reintroduces the probing risk. This tension is a great senior-level talking point.\n\nGarbage collection is the other sharp edge: a chunk is deletable only when no live version in any namespace references it and all retention windows have passed. Synchronous reference counting under concurrent commits is racy, so production systems use asynchronous mark-and-sweep with a deletion quarantine, accepting temporarily higher storage over the risk of deleting a chunk a in-flight commit was about to reference.",
      },
      {
        heading: "Delta sync and the metadata commit protocol",
        body: "Delta sync falls out of the manifest design: to sync an edited file, the client re-chunks it locally, diffs the new hash list against the previous version's list from its local index, uploads only new hashes, and commits a manifest that mostly points at pre-existing chunks. A one-character edit to a 2 GB file with fixed 4 MB chunks transfers 4 MB, not 2 GB; with CDC, often less.\n\nThe commit must be atomic and ordered: (1) all referenced chunks durable in block storage, (2) one transaction inserting the version row, manifest rows, and journal entry, conditional on parent_version matching the current head. Doing metadata before blocks would create versions pointing at missing data; the reverse order merely leaves orphan chunks for GC, which is the safe failure mode. This blocks-then-metadata ordering is worth stating explicitly in an interview.\n\nDownloads mirror uploads: fetch the manifest, diff against local chunks, pull missing ones. Two consequences follow: renames and moves are pure metadata operations regardless of file size, and a new device syncing a large shared folder benefits from LAN sync or peer-assisted transfer since officemates likely already hold most chunks.",
      },
      {
        heading: "Conflict resolution across offline devices",
        body: "Two devices edit the same file while offline; both come online and commit. The atomic parent-version check makes this safe: device A commits version 6 on parent 5 and wins; device B's commit on parent 5 is rejected because head is now 6. No lock service, no distributed coordination, just optimistic concurrency in the metadata transaction.\n\nThe loser must not lose data. The standard resolution, used by Dropbox, is to preserve B's content as a sibling: 'report.docx (conflicted copy from Bob's laptop 2026-08-16)', committed as a new file, and let humans merge. Automatic merging is only safe for formats the server understands (Google Docs solves this with operational transformation, but that is a collaborative-editing system, not a file store). Last-writer-wins is the one clearly wrong answer here because it silently destroys a user's work.\n\nFolder-level races get messier: concurrent rename vs. edit, delete vs. edit inside the deleted folder, or case-sensitivity mismatches across OSes. The design principles that keep this tractable: every mutation goes through the same journal with the same optimistic check, deletes are soft (tombstones plus retention) so a delete/edit race is always recoverable, and the sync engine treats the server journal as the single ordering authority rather than trying to merge device histories peer-to-peer.",
      },
    ],
    bottlenecks: [
      "Metadata DB write throughput and row count (billions of chunk manifest rows) is the true scaling frontier, not block storage; shard by namespace early.",
      "Notification fan-out to tens of millions of idle connections; long-poll gateways plus pull-based cursors keep this cheap and loss-tolerant.",
      "Hot shared namespaces (a 10K-member company folder) concentrate journal writes and fan-out on one shard; large shared namespaces may need dedicated shards.",
      "Client-side chunking and hashing can pin laptop CPUs on huge files; throttle and hash incrementally.",
      "GC of unreferenced chunks at PB scale is a massive background scan; poorly scheduled sweeps compete with live traffic for storage I/O.",
    ],
    keyTakeaways: [
      "Split the system into a block plane (dumb, content-addressed, S3-like) and a metadata plane (transactional, the actual brain); almost every feature is a metadata feature.",
      "Content-addressed chunks give dedup, delta sync, resumable transfer, and instant copies from one design decision.",
      "Order commits blocks-first, metadata-second, so the failure mode is orphaned chunks (GC-able) rather than dangling versions (data loss).",
      "Use optimistic concurrency on parent version for conflicts, and preserve the loser as a conflicted copy; never last-writer-wins on user files.",
      "Cursor-based journal pull makes sync self-healing: notifications can be lossy because clients always reconcile from their cursor.",
    ],
    relatedTopics: [
      "storage-and-search",
      "sharding-and-partitioning",
      "consistency-and-cap",
      "replication",
      "message-queues",
    ],
    rapidImplementation: {
      stack:
        "Python + FastAPI for metadata, SQLite for the metadata tables, MinIO (free, S3-compatible) as the block store, watchdog for the client folder watcher, all on one machine.",
      steps: [
        "Run MinIO locally with a chunks bucket; create SQLite tables files, file_versions, version_chunks, and chunks.",
        "Write the client chunker: fixed 4 MB blocks, SHA-256 each, producing an ordered hash manifest per file.",
        "Build POST /files/precommit that returns which manifest hashes the server does not yet have, and PUT /chunks/{hash} that stores a block in MinIO keyed by its hash.",
        "Build POST /files/commit that inserts the version row and manifest atomically, conditional on the parent version still being head; reject stale parents.",
        "Write the client sync loop: watchdog detects a changed file, re-chunk it, upload only the missing hashes, then commit.",
        "Implement download as the mirror image: fetch the manifest, pull only chunks absent from the local chunk cache, reassemble in order.",
        "Handle commit rejection by saving the local file as 'name (conflicted copy)' and committing it as a new file.",
        "Verify dedup end to end: copy a 1 GB file to a second name and confirm the second upload transfers zero chunks.",
      ],
      codeSketches: [
        {
          title: "Client: fixed-size chunking and dedup upload",
          language: "python",
          code: `import hashlib

CHUNK = 4 * 1024 * 1024  # 4 MB fixed blocks

def chunk_manifest(path):
    hashes = []
    with open(path, "rb") as f:
        while True:
            block = f.read(CHUNK)
            if not block:
                break
            hashes.append(hashlib.sha256(block).hexdigest())
    return hashes

def sync_file(api, path, parent_version):
    manifest = chunk_manifest(path)
    # server answers with only the hashes it has never seen
    missing = set(api.post("/files/precommit", hashes=manifest))
    with open(path, "rb") as f:
        for seq, h in enumerate(manifest):
            if h not in missing:
                continue  # dedup: server already has this block
            f.seek(seq * CHUNK)
            api.put_chunk(h, f.read(CHUNK))  # content-addressed PUT
    # blocks are durable first; metadata commit comes second
    return api.post("/files/commit", path=path,
                    hashes=manifest, parent_version=parent_version)`,
        },
        {
          title: "Server: dedup check and optimistic-concurrency commit",
          language: "sql",
          code: `-- precommit: which of the client's hashes are new to us?
SELECT h.hash
FROM unnest($1::text[]) AS h(hash)
WHERE NOT EXISTS (SELECT 1 FROM chunks c WHERE c.hash = h.hash);

-- commit: one transaction, conditional on parent still being head
BEGIN;
INSERT INTO file_versions (file_id, version, file_hash)
SELECT $1, $2 + 1, $3
WHERE COALESCE(
  (SELECT MAX(version) FROM file_versions WHERE file_id = $1), 0
) = $2;
-- 0 rows inserted: another device committed first, so the client
-- must create a conflicted copy instead of overwriting head.

INSERT INTO version_chunks (version_id, seq, chunk_hash)
SELECT currval('file_versions_id_seq'), s.ord - 1, s.hash
FROM unnest($4::text[]) WITH ORDINALITY AS s(hash, ord);

INSERT INTO journal (namespace_id, file_id, op)
VALUES ($5, $1, 'commit');
COMMIT;`,
        },
      ],
    },
  },
  {
    slug: "payment-system",
    title: "Design a Payment System",
    difficulty: "Hard",
    summary:
      "Design the payment backend for a commerce platform: accept a customer's payment through a PSP like Stripe, record money movement in a double-entry ledger, pay merchants out, and guarantee that retries, crashes, and PSP flakiness never charge anyone twice or lose a cent. Correctness dominates every other concern.",
    functionalRequirements: [
      "Pay-in: charge a buyer for an order via a PSP (Stripe/Adyen); the platform never touches raw card numbers (PCI scope stays at the PSP).",
      "Record every money movement in an immutable double-entry ledger that is the internal source of truth.",
      "Pay-out: transfer accumulated funds to merchants on a schedule, net of platform fees.",
      "Support refunds (full and partial) and surface PSP-initiated events like chargebacks and disputes.",
      "Reconcile internal ledger state against PSP settlement reports daily and flag every discrepancy.",
      "Expose payment status to order systems via API and webhooks/events.",
    ],
    nonFunctionalRequirements: [
      "Correctness over availability: it is better to fail a payment visibly than to double-charge or record wrong amounts; core writes are strongly consistent and ACID.",
      "Effectively exactly-once money movement built from at-least-once delivery plus idempotency everywhere.",
      "Durability and auditability: ledger entries are append-only, immutable, and retained for 7+ years.",
      "Latency: authorization round-trip dominated by the PSP (~1-2s); internal overhead budget under ~100ms.",
      "Availability target 99.99% on the pay-in path; degraded mode queues payments rather than dropping them.",
    ],
    backOfEnvelope: [
      {
        label: "Payment volume",
        value: "10M payments/day",
        note: "~116/s average; Black Friday peak ~10x = ~1.2K/s. Modest QPS: payments are a correctness problem, not a throughput problem.",
      },
      {
        label: "Ledger write rate",
        value: "~60M entries/day",
        note: "Each payment yields ~3 transactions (auth/capture, fee, payable) x 2 entries each (double-entry); still under 1K writes/s average, comfortably single-primary Postgres territory per shard.",
      },
      {
        label: "Ledger growth",
        value: "~30 GB/day, ~11 TB/year",
        note: "60M entries x ~500 bytes; 7-year retention ≈ 77 TB, pushing old partitions to cheap append-only archive storage.",
      },
      {
        label: "Reconciliation batch",
        value: "10M PSP settlement records/day",
        note: "A daily batch join of PSP reports against internal ledger; even a 0.01% mismatch rate = 1,000 cases/day, so auto-classification of discrepancies is mandatory.",
      },
      {
        label: "PSP fees at stake",
        value: "~$870K/day",
        note: "10M x $50 avg x ~1.75% blended PSP fee (roughly 2.9% + $0.30 on cards): fee accounting itself is material money and must be in the ledger.",
      },
    ],
    apiDesign: [
      {
        endpoint: "POST /v1/payments (header: Idempotency-Key)",
        description:
          "Initiates a pay-in: {order_id, amount_minor, currency, payment_method_token}. Amounts are integer minor units, never floats. Returns the same result for the same key no matter how many times it is called.",
      },
      {
        endpoint: "GET /v1/payments/{paymentId}",
        description:
          "Returns payment state (created, pending, succeeded, failed, refunded) and associated ledger transaction ids; polling fallback for consumers of the async status events.",
      },
      {
        endpoint: "POST /v1/payments/{paymentId}/refunds (header: Idempotency-Key)",
        description:
          "Full or partial refund; validated against remaining refundable amount, executed at the PSP, and recorded as a compensating ledger transaction.",
      },
      {
        endpoint: "POST /v1/psp-webhooks/{provider}",
        description:
          "Receives PSP events (payment_intent.succeeded, charge.dispute.created, payout.paid). Signature-verified, persisted, deduped by event id, then processed async; webhooks are treated as hints, with polling as the fallback truth.",
      },
    ],
    highLevelDesign: [
      "Checkout tokenizes card details directly against the PSP (Stripe Elements), so raw PANs never touch platform servers and PCI scope collapses to SAQ-A. The order service then calls the payment service with an idempotency key derived from the order attempt.",
      "The payment service is the orchestrator and keeps a state machine per payment. On a new request it writes the payment row in 'created', then calls the PSP to create/confirm a PaymentIntent, passing the same idempotency key to Stripe so PSP-side retries are also safe. State transitions are recorded before and after each external call so a crash at any point leaves a resumable record rather than mystery money.",
      "Confirmed outcomes are written to the ledger service: every transaction is a balanced set of double-entry postings (debit PSP receivable, credit merchant payable and platform fee revenue) inside one ACID transaction in Postgres. The ledger is append-only; corrections are new reversing entries, never updates, which is what makes it auditable.",
      "Asynchrony rides on a transactional outbox: the ledger commit and an outbox event are one DB transaction, and a relay publishes to Kafka, so downstream consumers (order fulfillment, notifications, analytics, payout scheduling) see exactly the committed truth. PSP webhooks flow into the same event backbone after signature verification and dedup, advancing payment state machines for async outcomes like disputes.",
      "A scheduled payout service aggregates each merchant's payable balance from the ledger, initiates transfers via the PSP's payout API (again idempotently), and records the corresponding ledger entries. Nightly reconciliation jobs pull PSP settlement files, match them against ledger transactions three ways (internal ledger vs. PSP records vs. bank statement), auto-classify known mismatch patterns (timing, fees, currency rounding), and open cases for humans on the rest.",
    ],
    dataModel: [
      {
        name: "payment",
        fields:
          "id BIGINT PK, idempotency_key VARCHAR UNIQUE, order_id BIGINT, buyer_id BIGINT, merchant_id BIGINT, amount_minor BIGINT, currency CHAR(3), status VARCHAR, psp VARCHAR, psp_payment_intent_id VARCHAR UNIQUE, created_at TIMESTAMP, updated_at TIMESTAMP",
        note: "The state machine row; unique constraints on both the idempotency key and the PSP intent id are the double-charge backstops.",
      },
      {
        name: "ledger_transaction",
        fields:
          "id BIGINT PK, type VARCHAR, payment_id BIGINT, external_ref VARCHAR, posted_at TIMESTAMP, description VARCHAR",
        note: "Groups a balanced set of entries; immutable once posted.",
      },
      {
        name: "ledger_entry",
        fields:
          "id BIGINT PK, transaction_id BIGINT FK, account_id BIGINT, direction CHAR(1), amount_minor BIGINT, currency CHAR(3), CHECK (amount_minor > 0)",
        note: "Per transaction, sum(debits) must equal sum(credits) per currency; enforced in the service and by invariant checks. Balances are derived (materialized per account) rather than stored as mutable truth.",
      },
      {
        name: "psp_event",
        fields:
          "id BIGINT PK, provider VARCHAR, event_id VARCHAR UNIQUE, type VARCHAR, payload JSONB, signature_valid BOOLEAN, processed_at TIMESTAMP, received_at TIMESTAMP",
        note: "Raw webhook archive; unique event_id gives webhook dedup, and retaining payloads makes disputes and incident forensics tractable.",
      },
    ],
    deepDives: [
      {
        heading: "Idempotency: the backbone of not charging twice",
        body: "Retries are unavoidable: clients time out, networks drop responses, queues redeliver. The contract that makes retries safe is an idempotency key per logical operation. On first sight of a key the service atomically inserts a record (unique constraint) and proceeds; on any later sight it returns the stored outcome of the original attempt. The key must be scoped to the operation (payment attempt for order X), persisted with the response, and honored across every state the original attempt might be in, including 'still in progress', where the correct response is the in-progress state, not a second execution.\n\nThe subtle failure mode is the crash between committing your intent and calling the PSP, or between the PSP call and recording its result. The fix is to persist state transitions around the external call ('psp_call_pending' before, outcome after) and pass the same idempotency key to Stripe, which supports idempotency keys natively for exactly this reason. On recovery, a sweeper finds payments stuck in pending, queries the PSP for the intent's actual status, and resumes the state machine. You never guess; you ask the PSP what happened.\n\nExactly-once is thus an end-to-end illusion assembled from at-least-once retries plus idempotent effects at every hop: client to API (idempotency key), API to PSP (Stripe idempotency key + unique intent id), PSP to platform (webhook event-id dedup), platform to consumers (outbox + consumer-side dedup). Any single hop lacking idempotency reintroduces double-charging, which is why the interviewer will probe each hop.",
      },
      {
        heading: "Why a double-entry ledger, and how to build one",
        body: "Single-entry records ('merchant balance += $48.25') destroy information: when a balance is wrong you cannot tell why. Double-entry records every movement as balanced debits and credits between accounts: a $50 sale posts debit psp_receivable $50, credit merchant_payable $48.25, credit platform_fees $1.75 minus PSP cost. The invariant that all entries in a transaction sum to zero per currency is checkable at write time and continuously afterward, so entire classes of bugs (money created or destroyed) become detectable instantly rather than at month-end.\n\nImplementation rules that matter: append-only (corrections are reversing entries, so history is never rewritten and audits can replay everything), integer minor units with explicit currency (floating point is disqualifying in a payments interview), and both legs plus the transaction row written in one ACID transaction. Account balances are derived state: computed from entries and materialized with snapshots (balance as of entry N) so reads are fast without making a mutable balance the truth.\n\nScaling the ledger is deliberately boring: partition by account or merchant, keep hot partitions on a strongly consistent primary, archive old partitions. At ~1K writes/s average you do not need a distributed database; you need the transaction and the invariants. Reaching for eventual consistency in the ledger is the trap answer.",
      },
      {
        heading: "PSP integration: webhooks, state machines, and never trusting one channel",
        body: "The Stripe-style flow: create a PaymentIntent server-side, confirm it from the client (which handles 3-D Secure challenges), then learn the outcome. Outcomes arrive on two channels: the synchronous API response and asynchronous webhooks, and neither is sufficient alone. The sync response can be lost to a timeout after the charge succeeded; webhooks are delivered at-least-once, out of order, and occasionally late. The robust pattern is to treat webhooks as triggers, dedupe them by event id, verify signatures, and let the state machine advance only along legal transitions, with a reconciling poller that queries the PSP directly for any payment stuck in a non-terminal state past a deadline.\n\nOut-of-order handling falls out of the state-machine design: if 'payment_intent.succeeded' arrives after you already processed it via polling, the transition is a no-op; if a 'charge.refunded' arrives for a payment you have not marked succeeded, park the event and re-drive it after fetching current PSP state. Idempotent transitions plus a poll-based source of truth make webhook ordering irrelevant to correctness.\n\nPlan for PSP failure as a first-class scenario. Short outages: queue payment intents internally and drain when the PSP recovers, telling the buyer 'processing' rather than failing checkout. Sustained degradation: multi-PSP routing with health-based failover, though this multiplies integration and reconciliation surface (different fee schedules, settlement formats, refund semantics), so it is a deliberate business decision, not a free redundancy trick.",
      },
      {
        heading: "Reconciliation: the safety net that catches everything else",
        body: "Every mechanism above can still leak: a webhook lost past retry windows, a bug that posts a fee wrong, a PSP settling an amount that differs from the auth. Reconciliation is the periodic proof that internal records match external reality. Daily, the PSP's settlement report (every charge, refund, fee, chargeback, and the net payout) is matched against the ledger, and the bank statement is matched against expected payouts: a three-way check between what we recorded, what the PSP says happened, and what actually hit the bank.\n\nMost mismatches are benign and auto-classifiable: timing differences (charge on day N, settlement on N+1), FX rounding, fee-schedule drift. The pipeline should auto-clear these categories and emit metrics on their rates, escalating only genuine breaks (missing transaction, amount mismatch, unknown charge) to a human-worked case queue with links to the ledger transaction, PSP objects, and raw webhook archive. A discrepancy rate creeping upward is often the first observable symptom of a code bug in fee logic or a stuck consumer.\n\nDesign choices upstream determine whether reconciliation is tractable: stable external references on every ledger transaction (PSP charge id), immutable raw webhook storage, and append-only ledger history are what make 'investigate this $0.30 break from last Tuesday' a ten-minute job instead of an archaeology project. Interviewers rate candidates who volunteer reconciliation unprompted, because it signals operational experience with money systems.",
      },
    ],
    bottlenecks: [
      "The PSP itself: 1-2s auth latency and third-party availability dominate the user experience; internal queuing and multi-PSP failover are the levers.",
      "Hot ledger accounts (the platform fee account is credited on every payment) serialize writes; mitigate with sub-account sharding summed at read time.",
      "Idempotency-key storage on the hot path must be strongly consistent; a cache-only implementation reintroduces double-charge risk on cache loss.",
      "Webhook bursts after a PSP incident (hours of queued events delivered at once) can flood consumers; dedup plus state-machine no-ops make the flood safe, rate limiting makes it survivable.",
      "Reconciliation case volume scales with payment volume; without auto-classification, ops headcount becomes the system's real bottleneck.",
    ],
    keyTakeaways: [
      "Payments is a correctness problem at modest QPS: choose ACID, strong consistency, and visible failure over availability tricks.",
      "Exactly-once money movement is assembled from at-least-once delivery plus idempotency at every hop: client key, PSP key, webhook event-id dedup, outbox consumers.",
      "The double-entry ledger with append-only balanced entries in integer minor units is the internal source of truth; balances are derived, never mutated.",
      "Drive everything through explicit per-payment state machines; on ambiguity (crash, timeout, weird webhook order) query the PSP and resume, never guess.",
      "Reconciliation against PSP and bank records is the mandatory safety net; design ledger references and webhook archives so breaks are cheap to investigate.",
    ],
    relatedTopics: [
      "distributed-transactions",
      "message-queues",
      "event-driven-architecture",
      "security",
      "observability",
    ],
    rapidImplementation: {
      stack:
        "Node.js + Express, Postgres for payments and the ledger, Stripe in test mode (no real money), deployed on a Render free-tier instance.",
      steps: [
        "Create Postgres tables payments, idempotency_keys, ledger_transactions, and ledger_entries; every amount is an integer in minor units (cents).",
        "Write the idempotency middleware and mount it on POST /payments and POST /refunds; require the Idempotency-Key header.",
        "Integrate Stripe test mode: create and confirm a PaymentIntent server-side, passing the same idempotency key through to Stripe.",
        "On confirmed success, post the balanced double-entry ledger transaction (receivable debit, merchant payable and fee credits) in one DB transaction, then store the response against the idempotency key.",
        "Add the webhook endpoint: verify the Stripe signature, insert the event with a unique event_id (duplicates no-op), and advance the payment state machine only along legal transitions.",
        "Add a sweeper cron that finds payments stuck in pending for over 10 minutes, queries Stripe for the intent's real status, and resumes the state machine; never guess.",
        "Write a nightly reconciliation script that pulls Stripe balance transactions and diffs them against the ledger, printing every mismatch.",
        "Test with Stripe CLI webhook replays and duplicate POSTs to prove the same key never charges twice.",
      ],
      codeSketches: [
        {
          title: "Idempotency-key middleware",
          language: "typescript",
          code: `export function idempotency(pool: Pool) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = req.header("Idempotency-Key");
    if (!key) {
      return res.status(400).json({ error: "Idempotency-Key required" });
    }
    // atomic claim: unique constraint decides who runs the handler
    const claim = await pool.query(
      "INSERT INTO idempotency_keys (key, status) " +
      "VALUES ($1, 'in_progress') ON CONFLICT (key) DO NOTHING " +
      "RETURNING key",
      [key]
    );
    if (claim.rowCount === 1) {
      res.locals.idemKey = key; // handler stores its response under this
      return next();
    }
    const prior = await pool.query(
      "SELECT status, response FROM idempotency_keys WHERE key = $1",
      [key]
    );
    if (prior.rows[0].status === "in_progress") {
      // original attempt still running: report it, never re-execute
      return res.status(409).json({ error: "request already in progress" });
    }
    return res.status(200).json(prior.rows[0].response); // replay outcome
  };
}`,
        },
        {
          title: "Double-entry ledger posting in one transaction",
          language: "sql",
          code: `-- A $50.00 capture: all rows commit together or not at all.
BEGIN;

INSERT INTO ledger_transactions (id, type, payment_id, external_ref)
VALUES (11, 'capture', 42, 'pi_3XyzStripeIntentId');

-- balanced postings in integer cents: debits equal credits
INSERT INTO ledger_entries
  (transaction_id, account_id, direction, amount_minor) VALUES
  (11, 1001, 'D', 5000),  -- psp_receivable
  (11, 2042, 'C', 4825),  -- merchant_payable (merchant 42)
  (11, 3001, 'C', 175);   -- platform_fee_revenue

-- invariant check: divide by zero aborts the whole transaction
-- if debits and credits do not net to zero
SELECT 1 / CASE WHEN COALESCE(SUM(
  CASE direction WHEN 'D' THEN amount_minor ELSE -amount_minor END
), -1) = 0 THEN 1 ELSE 0 END
FROM ledger_entries WHERE transaction_id = 11;

COMMIT;
-- corrections are new reversing entries; rows are never updated`,
        },
      ],
    },
  },
];
