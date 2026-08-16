import type { CaseStudy } from "./types";

export const caseStudies5: CaseStudy[] = [
  {
    slug: "metrics-monitoring",
    title: "Design a Metrics Monitoring System (Datadog)",
    difficulty: "Medium",
    summary:
      "Build a system that ingests time-series metrics from thousands of hosts, stores them efficiently with downsampling, supports fast tag-filtered queries, and evaluates alert rules in near real time.",
    functionalRequirements: [
      "Agents on hosts push counters, gauges, and histograms with tags (host, region, service) at 10 second resolution",
      "Users query metrics with tag filters and aggregations (avg, sum, p95, max) over arbitrary time ranges",
      "Users define alert rules (threshold, duration) that fire notifications when breached",
      "Dashboards render multiple queries with auto-selected resolution based on the time range",
      "Old data is retained at coarser resolution: raw for 7 days, 1 minute rollups for 30 days, 1 hour rollups for 1 year",
    ],
    nonFunctionalRequirements: [
      "Ingest 10M data points per second at peak without dropping writes",
      "Query latency under 200ms p99 for dashboard panels over a 24 hour window",
      "Alert evaluation delay under 30 seconds from data arrival to notification",
      "Ingestion path must tolerate a storage node failure with no data loss (buffered writes)",
      "Read availability matters more than perfect freshness; a 1 minute lag in dashboards is acceptable",
    ],
    backOfEnvelope: [
      { label: "Monitored hosts", value: "100,000", note: "each emits ~100 series at 10s resolution" },
      { label: "Write throughput", value: "1M points/sec", note: "100k hosts x 100 series / 10s" },
      { label: "Raw daily volume", value: "~1.4 TB/day", note: "1M/s x 86,400s x ~16 bytes per point" },
      { label: "After compression", value: "~120 GB/day", note: "Gorilla-style delta-of-delta gets ~1.37 bytes/point" },
      { label: "Active series (cardinality)", value: "10M series", note: "the real cost driver; each series needs an index entry" },
      { label: "1h rollup volume for 1 year", value: "~1.3 TB", note: "10M series x 8,760 hours x ~16 bytes, cheap on object storage" },
    ],
    apiDesign: [
      { endpoint: "POST /api/v1/ingest", description: "Batch of points: [{metric, tags, value, ts}]. Returns 202; durability comes from the queue, not the response." },
      { endpoint: "GET /api/v1/query?metric=cpu.util&filter=region:us-east&agg=p95&start=...&end=...&step=60s", description: "Time-series query with tag filter, aggregation, and resolution step." },
      { endpoint: "POST /api/v1/alerts", description: "Create alert rule: {query, threshold, comparator, for_duration, channels}." },
      { endpoint: "GET /api/v1/metrics/search?q=cpu", description: "Metric and tag autocomplete backed by the inverted tag index." },
    ],
    highLevelDesign: [
      "Agents batch points locally and push to an ingestion gateway that validates, normalizes tags into a canonical sorted order, and writes to Kafka partitioned by hash(metric name + tag set). Kafka is the durability boundary: once acked there, a storage node crash cannot lose data.",
      "Storage nodes consume their partitions and write to a time-series store. Each unique (metric, tag set) combination is a series identified by a series_id. Recent data lives in an in-memory write buffer plus a write-ahead log, flushed as compressed immutable blocks (Gorilla encoding) every 2 hours. An inverted index maps each tag key:value pair to the set of series_ids containing it, so a query like region:us-east AND service:api is a set intersection.",
      "A separate rollup pipeline consumes the same Kafka topics and maintains 1 minute and 1 hour pre-aggregates (min, max, sum, count, and a sketch for percentiles). The query planner picks the resolution tier automatically: a 1 hour dashboard reads raw, a 30 day dashboard reads 1h rollups, keeping the number of points scanned roughly constant regardless of range.",
      "The alerting engine is a scheduler that evaluates each rule every 30 seconds by running its query against the hot tier only. Rules track a state machine (ok, pending, firing) so a threshold must be breached for the configured duration before notifying, which suppresses flapping. Notifications go through a dedup and routing layer to Slack, PagerDuty, or webhooks.",
      "Aged blocks migrate down a tiering ladder: hot SSD for 7 days, then 1 minute rollups on cheaper disks for 30 days, then 1 hour rollups on object storage (S3) for a year. Queries fan out across tiers transparently and merge results.",
    ],
    dataModel: [
      { name: "series", fields: "series_id, metric_name, tags_hash, tags_json, first_seen, last_seen", note: "one row per unique metric + tag combination; this table size is the cardinality" },
      { name: "points (columnar blocks)", fields: "series_id, block_start_ts, resolution, compressed_timestamps, compressed_values", note: "immutable 2h blocks, Gorilla-compressed" },
      { name: "tag_index", fields: "tag_key, tag_value, series_ids (posting list)", note: "inverted index; queries intersect posting lists" },
      { name: "alert_rules", fields: "rule_id, query, comparator, threshold, for_duration_s, state, last_eval_ts, channels", note: "state machine: ok, pending, firing" },
    ],
    deepDives: [
      {
        heading: "Tag cardinality is the silent killer",
        body:
          "Storage volume scales with points per second, but memory, index size, and query planning cost all scale with the number of unique series. One engineer adding a user_id or request_id tag can turn 10M series into 500M overnight, blowing out the inverted index and the per-series write buffers. This is the classic cardinality explosion and it is the number one operational incident for real monitoring vendors.\n\nDefenses: enforce a per-metric cardinality budget at the ingestion gateway (track approximate distinct tag sets per metric with a HyperLogLog and reject or drop tags beyond a limit, say 100k series per metric), maintain an allowlist of tag keys, and expose a cardinality dashboard so teams see the cost of their tags. Some systems automatically quarantine high-cardinality tags into logs or traces instead, since those are the right tool for per-request identifiers.",
      },
      {
        heading: "Downsampling and rollups",
        body:
          "You cannot answer a 90 day query by scanning raw 10 second points: that is 777,600 points per series, and a dashboard panel touching 200 series would scan 155M points. Rollups keep query cost bounded by pre-aggregating each series into 1 minute and 1 hour buckets as data arrives, so the planner can always choose a tier where points scanned stays in the low thousands.\n\nThe subtlety is that you must store decomposable aggregates, not final answers. Store sum and count so any downstream consumer can compute a correct average across merged buckets; storing avg directly makes re-aggregation wrong. Percentiles do not decompose at all, so store a mergeable sketch (t-digest or DDSketch) per bucket. Min and max decompose trivially.\n\nRollups also solve late data: since a rollup consumer reads from Kafka, a point arriving 5 minutes late simply updates the still-open 1 minute bucket. Buckets seal after a grace period (say 15 minutes), after which late points are counted in a side metric rather than mutating sealed blocks.",
      },
      {
        heading: "Alert evaluation at scale",
        body:
          "With 100k alert rules evaluated every 30 seconds you run about 3,300 queries per second just for alerting. Two things make this tractable. First, alert queries only ever touch the hot in-memory tier, which is the cheapest data to read. Second, rules are sharded across evaluator workers by rule_id using consistent hashing, so adding workers scales evaluation linearly and a worker crash only delays its own shard until reassignment.\n\nCorrectness details matter more than throughput. The 'for duration' clause requires the rule state machine: a breach moves ok to pending with a timestamp, and only if every subsequent evaluation stays breached until for_duration elapses does it move to firing. Any recovery resets to ok. This suppresses flapping without heuristics. You also need a dead-man switch: a rule that receives no data at all should optionally fire (no data is often the outage), which means the evaluator must distinguish 'query returned empty' from 'query returned values below threshold'.",
      },
      {
        heading: "Why not just use Postgres",
        body:
          "A naive row-per-point schema in Postgres dies at this scale for three reasons: 16 bytes of payload carries ~40 bytes of row overhead plus index entries, B-tree indexes on (series_id, ts) suffer constant random inserts, and time-range scans read pages that interleave thousands of series. Write amplification and cache misses dominate.\n\nPurpose-built TSDBs win by exploiting the workload shape: writes are append-only per series, timestamps are nearly regular (delta-of-delta encodes them in ~1 bit), and consecutive values are similar (XOR encoding). Facebook's Gorilla paper reported 1.37 bytes per point versus 16 raw, a 12x reduction, which is what makes keeping 7 days of raw data in a hot tier affordable. For an interview, naming the columnar block layout and the inverted tag index is what distinguishes a real design from 'use InfluxDB'.",
      },
    ],
    bottlenecks: [
      "Cardinality explosion from unbounded tag values inflating the index and per-series buffers; needs ingestion-time budgets",
      "Hot Kafka partitions when one metric dominates traffic; partition by series hash, not metric name alone",
      "Query fan-out across storage shards for high-cardinality filters; mitigate with posting-list intersection order (smallest first)",
      "Rollup lag during traffic spikes makes long-range dashboards stale; monitor consumer lag as a first-class SLO",
      "Alert storms during a real outage flooding notification channels; group and dedup by service before paging",
    ],
    keyTakeaways: [
      "Cost and stability scale with series cardinality, not write volume; budget cardinality at the edge",
      "Store decomposable aggregates (sum, count, sketches) so rollups can be merged correctly",
      "Make the queue the durability boundary so storage nodes can crash without data loss",
      "Tier storage by age and resolution so query cost stays roughly constant across time ranges",
      "Alerting needs a state machine with a for-duration clause and a no-data path, not just threshold checks",
    ],
    relatedTopics: ["observability", "message-queues", "sharding-and-partitioning", "storage-and-search", "probabilistic-data-structures"],
    rapidImplementation: {
      stack: "Node + Fastify ingest, SQLite for blocks and index, a setInterval alert loop, uPlot dashboard, all on a $6 VPS",
      steps: [
        "Scaffold a Fastify server with POST /ingest accepting {metric, tags, value, ts} batches",
        "Canonicalize tags (sort keys, join as k=v,k=v) and hash to a series_id; upsert into a series table in SQLite",
        "Buffer points in memory per series; every 60s flush each buffer as a compressed block row (series_id, start_ts, JSON-packed deltas)",
        "Build GET /query that picks blocks by time range, decodes them, applies avg/max/p95, and returns [ts, value] pairs",
        "Add a rollup pass on flush: write 1-minute sum/count/min/max rows to a rollups table; query uses rollups when range > 6h",
        "Write the alert loop: every 30s run each rule's query over the last window, drive the ok/pending/firing state machine, POST to a webhook on firing",
        "Serve a static HTML page with uPlot charts polling /query every 10s",
        "Load test with a script emitting 10k points/sec of fake CPU metrics and watch p95 query latency",
      ],
      codeSketches: [
        {
          title: "Series canonicalization and delta-encoded block flush",
          language: "typescript",
          code: `import { createHash } from "crypto";

function seriesId(metric: string, tags: Record<string, string>): string {
  const canon = Object.keys(tags).sort()
    .map((k) => k + "=" + tags[k]).join(",");
  return createHash("sha1").update(metric + "|" + canon).digest("hex").slice(0, 16);
}

// In-memory buffer per series, flushed as a compact block every 60s.
const buffers = new Map<string, Array<[number, number]>>();

export function ingest(metric: string, tags: Record<string, string>, ts: number, value: number) {
  const id = seriesId(metric, tags);
  if (!buffers.has(id)) buffers.set(id, []);
  buffers.get(id)!.push([ts, value]);
}

export function flushBlock(id: string): { startTs: number; deltas: number[]; values: number[] } | null {
  const pts = buffers.get(id);
  if (!pts || pts.length === 0) return null;
  pts.sort((a, b) => a[0] - b[0]);
  const startTs = pts[0][0];
  const deltas: number[] = [];
  const values: number[] = [];
  let prev = startTs;
  for (const [ts, v] of pts) {
    deltas.push(ts - prev); // mostly 10, compresses to near nothing
    values.push(v);
    prev = ts;
  }
  buffers.set(id, []);
  return { startTs, deltas, values };
}`,
        },
        {
          title: "Rollup query with decomposable aggregates",
          language: "sql",
          code: `-- 1-minute rollups store sum and count so avg merges correctly.
CREATE TABLE rollups_1m (
  series_id TEXT NOT NULL,
  bucket_ts INTEGER NOT NULL,  -- epoch seconds floored to 60
  sum REAL NOT NULL,
  count INTEGER NOT NULL,
  min REAL NOT NULL,
  max REAL NOT NULL,
  PRIMARY KEY (series_id, bucket_ts)
);

-- Re-aggregate 1m buckets into 5m buckets at query time.
-- Correct because sum/count decompose; storing avg would not.
SELECT
  (bucket_ts / 300) * 300           AS ts5m,
  SUM(sum) / SUM(count)             AS avg_value,
  MIN(min)                          AS min_value,
  MAX(max)                          AS max_value
FROM rollups_1m
WHERE series_id IN (SELECT series_id FROM tag_index
                    WHERE tag = 'region=us-east')
  AND bucket_ts BETWEEN :start AND :end
GROUP BY ts5m
ORDER BY ts5m;`,
        },
        {
          title: "Alert state machine with for-duration",
          language: "typescript",
          code: `type AlertState = "ok" | "pending" | "firing";

interface Rule {
  id: string;
  threshold: number;
  forDurationMs: number;
  state: AlertState;
  breachedSince: number | null;
}

export function evaluate(rule: Rule, latestValue: number | null, now: number): AlertState {
  const breached = latestValue !== null && latestValue > rule.threshold;
  if (!breached) {
    rule.state = "ok";
    rule.breachedSince = null;
    return rule.state;
  }
  if (rule.breachedSince === null) {
    rule.breachedSince = now;
    rule.state = "pending";
  } else if (now - rule.breachedSince >= rule.forDurationMs && rule.state !== "firing") {
    rule.state = "firing"; // notify exactly once on this transition
    notify(rule);
  }
  return rule.state;
}

function notify(rule: Rule) {
  fetch(process.env.WEBHOOK_URL as string, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rule: rule.id, state: "firing", at: Date.now() }),
  }).catch(() => { /* retry queue in real life */ });
}`,
        },
      ],
    },
  },
  {
    slug: "leaderboard",
    title: "Design a Real-Time Leaderboard",
    difficulty: "Medium",
    summary:
      "Design a leaderboard for a game with millions of players: instant score updates, exact rank lookups, top-K queries, and neighborhood views, sharded past a single Redis node and hardened against cheaters.",
    functionalRequirements: [
      "Record a score event for a player and update their leaderboard position immediately",
      "Return the top 10 players globally and per region",
      "Return any player's exact rank and score",
      "Return the neighborhood view: 5 players above and below a given player",
      "Support monthly leaderboards that reset, with past boards viewable read-only",
    ],
    nonFunctionalRequirements: [
      "Rank reads visible within 1 second of a score update (real time for humans)",
      "Read-heavy: ~10:1 reads to writes; top-10 is the hottest query",
      "p99 latency under 50ms for rank and top-K queries",
      "Scores must never be lost or double-counted; the leaderboard is the game's economy",
      "Handle a 10x traffic spike during tournaments without degrading reads",
    ],
    backOfEnvelope: [
      { label: "Monthly active players", value: "25M", note: "5M daily actives" },
      { label: "Score updates", value: "5M DAU x 10 games/day = 50M/day", note: "~580 writes/sec average, ~5,800/sec peak" },
      { label: "Rank reads", value: "~500M/day", note: "10:1 read ratio, ~58k/sec peak with top-10 dominating" },
      { label: "Sorted set memory", value: "25M members x ~90 bytes = ~2.2 GB", note: "fits one Redis node; sharding is for throughput and blast radius, not memory" },
      { label: "Monthly board history", value: "12 boards x 2.2 GB = ~26 GB/year", note: "snapshot old boards to Postgres, keep only current in Redis" },
    ],
    apiDesign: [
      { endpoint: "POST /api/v1/scores", description: "Submit score event: {player_id, match_id, score}. Idempotent on (player_id, match_id)." },
      { endpoint: "GET /api/v1/leaderboard/top?n=10&board=2026-08", description: "Top N players with scores; served from cache." },
      { endpoint: "GET /api/v1/players/{id}/rank?board=2026-08", description: "Exact rank, score, and percentile for one player." },
      { endpoint: "GET /api/v1/players/{id}/neighbors?radius=5", description: "The 5 players above and below the given player." },
    ],
    highLevelDesign: [
      "The core data structure is a Redis sorted set (ZSET): member = player_id, score = points. ZINCRBY updates a score in O(log N), ZREVRANK returns exact rank in O(log N), ZREVRANGE returns top-K in O(log N + K). One command each for every product feature is why this problem is a Redis showcase; a SQL ORDER BY with OFFSET recomputes a sort or walks an index per query and cannot give cheap exact rank.",
      "Writes flow through a score service: the game server (never the client) posts a signed score event, the service checks idempotency on (player_id, match_id) in Postgres, appends the event to a durable events table, then applies ZINCRBY. Postgres is the source of truth; Redis is a rebuildable projection. If Redis dies, replay events to reconstruct the board.",
      "Reads split by pattern. Top-10 is served from a 1 second in-process cache in the API layer since millions of users see the identical payload; this absorbs the hottest traffic for free. Exact rank and neighbors go to Redis directly. Neighborhood is ZREVRANK to find the player's rank r, then ZREVRANGE r-5 to r+5.",
      "At larger scale, shard the sorted set by hash(player_id) across M Redis nodes. Any player's node is known, so ZINCRBY stays a single-node op. Top-K becomes scatter-gather: fetch top K from every shard and merge K x M candidates, cheap for K=10. Exact global rank is the hard part: sum ZREVRANK-style counts of players above score s across all shards (ZCOUNT s +inf per shard), which is M round trips done in parallel.",
      "Monthly reset is just a key naming scheme: leaderboard:2026-08. A cron snapshots the closing board into Postgres (rank, player, score rows), then traffic moves to the new key. Old boards are served from Postgres since they are immutable.",
    ],
    dataModel: [
      { name: "score_events", fields: "event_id, player_id, match_id, score, signature, created_at", note: "append-only source of truth; unique index on (player_id, match_id) gives idempotency" },
      { name: "redis: leaderboard:{YYYY-MM}", fields: "ZSET member=player_id score=total_points", note: "rebuildable projection of score_events" },
      { name: "board_snapshots", fields: "board_id, rank, player_id, score, snapshot_at", note: "closed monthly boards, immutable, served from Postgres" },
      { name: "players", fields: "player_id, handle, region, created_at, trust_score", note: "trust_score feeds anti-cheat review" },
    ],
    deepDives: [
      {
        heading: "Top-K vs exact rank: know which one you are building",
        body:
          "Top-K and exact rank look like the same feature but have wildly different costs, and interviewers probe this. Top-10 is trivially cacheable (one payload for all users), tolerates a second of staleness, and even in a sharded world is a cheap K x M merge. Exact rank for an arbitrary player is per-user, uncacheable, and under sharding requires aggregating counts across every shard.\n\nIf the product only needs top-K plus a rough position, you can skip exact rank entirely: show percentile instead, computed as players_above / total, where players_above comes from a per-shard ZCOUNT summed lazily every few seconds. Many real games do exactly this ('top 3%') because users cannot tell rank 1,204,113 from 1,206,551.\n\nIf exact rank is required at huge scale, an alternative to fan-out is range-partitioning by score band with periodic rebalancing, so rank = count in higher bands (maintained counters) + local rank within the band. It trades write-time complexity (band migrations) for O(1)-ish rank reads. Mention it, then say hash-shard fan-out is simpler and fine at M under ~20 shards.",
      },
      {
        heading: "Sharding a sorted set without breaking semantics",
        body:
          "Hash-sharding by player_id keeps every write and every per-player read single-node, which preserves Redis's O(log N) magic where it matters. The operations that break are the global ones: top-K needs scatter-gather merge, and global rank needs cross-shard counting. Both are embarrassingly parallel, so latency is max-of-shards rather than sum, but tail latency now follows your slowest shard, so keep shards uniform and use consistent hashing so adding a shard reshuffles only 1/M of players.\n\nA tempting wrong answer is range-sharding by score (shard 1 holds top players, etc.). It makes top-K a single-shard read but every score update can migrate a player across shards, and score distributions are heavily skewed so shards go hot. Only consider it with the band-counter scheme above, and say why.\n\nAlso note when NOT to shard: 25M members is ~2.2 GB, comfortably one node. Shard for write throughput, isolation, or failure blast radius, not memory. Saying 'this fits on one Redis and here is the number' is a strong interview move.",
      },
      {
        heading: "Anti-cheat and score integrity",
        body:
          "A leaderboard invites cheating, and the design must assume the client is hostile. Rule one: clients never submit scores. The authoritative game server computes the result and posts it with an HMAC over (player_id, match_id, score, timestamp) using a key the client never sees. The score service verifies the signature and rejects stale timestamps to stop replay.\n\nIdempotency doubles as anti-abuse: the unique (player_id, match_id) constraint means a captured request replayed 1,000 times counts once. On top of that, run anomaly detection on the event stream: z-score of points per match against the player's history and the global distribution, impossible session rates (50 matches an hour), and score deltas exceeding the game's theoretical max. Flag, do not auto-ban.\n\nFor flagged players, use shadow removal: ZREM them from the public board while their events keep accruing in Postgres. If the appeal succeeds, replay their events to restore the exact score. This is another payoff of keeping the durable event log separate from the Redis projection.",
      },
      {
        heading: "Failure modes and rebuild story",
        body:
          "Redis persistence (AOF everysec) can still lose the last second of writes on a crash, which is why Postgres holds the events. Recovery is: promote a replica for reads, then reconcile by replaying events since the replica's last applied event. Track a per-shard high-water mark (last event_id applied) in Redis itself so replay knows where to resume, making rebuilds idempotent.\n\nDual-write consistency between Postgres and Redis is the other classic trap. Writing Postgres then Redis means a crash in between leaves Redis stale; that is acceptable here because the projection is rebuildable and a background reconciler sweeps recent events comparing applied marks. What you must not do is write Redis first: a score visible on the board that never durably existed is a much worse failure for a game economy than a briefly stale rank.",
      },
    ],
    bottlenecks: [
      "Top-10 hot key hammering one Redis shard; absorb with short-TTL edge or in-process caching since the payload is identical for everyone",
      "Cross-shard fan-out for exact global rank makes tail latency the max of the slowest shard; keep shard count modest and query in parallel",
      "Idempotency check in Postgres sits on the write path; a unique-constraint insert doubles as check and record in one round trip",
      "Tournament spikes are write bursts to a few contested boards; queue score events and apply asynchronously if Redis CPU saturates",
      "Monthly rollover thundering herd when a new key starts cold; pre-create the key and warm the top-10 cache before cutover",
    ],
    keyTakeaways: [
      "Redis sorted sets give O(log N) update, exact rank, and top-K, which maps one-to-one onto leaderboard features",
      "Keep a durable append-only event log as source of truth and treat Redis as a rebuildable projection",
      "Top-K and exact rank have different costs; cache the former, consider percentile instead of the latter",
      "Shard by player hash to keep writes single-node; global queries become parallel scatter-gather",
      "Anti-cheat is server-authoritative scores, signed events, idempotency keys, and shadow removal",
    ],
    relatedTopics: ["caching", "sharding-and-partitioning", "consistent-hashing", "sql-vs-nosql", "rate-limiting"],
    rapidImplementation: {
      stack: "Redis sorted sets + Fastify + Postgres (events table) on a $15 VPS; k6 for load testing",
      steps: [
        "docker compose up redis and postgres; create score_events with a unique index on (player_id, match_id)",
        "Build POST /scores: verify HMAC, INSERT event (ON CONFLICT DO NOTHING), and ZINCRBY only when the insert added a row",
        "Build GET /leaderboard/top with ZREVRANGE WITHSCORES behind a 1 second in-process cache",
        "Build GET /players/:id/rank using ZREVRANK and ZSCORE, plus percentile via ZCARD",
        "Build the neighbors endpoint: ZREVRANK then ZREVRANGE rank-5 to rank+5",
        "Add a rebuild script that replays score_events into a fresh ZSET and diffs against the live one",
        "Add monthly key naming (leaderboard:YYYY-MM) and a snapshot script that dumps the closing board to Postgres",
        "Load test with k6 at 5k writes/sec and 50k reads/sec; verify p99 and that duplicate match_ids never double-count",
      ],
      codeSketches: [
        {
          title: "Idempotent score submit with HMAC verification",
          language: "typescript",
          code: `import { createHmac, timingSafeEqual } from "crypto";
import Redis from "ioredis";
import { Pool } from "pg";

const redis = new Redis();
const pg = new Pool();
const KEY = process.env.SCORE_HMAC_KEY as string;

function boardKey(d = new Date()): string {
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return "leaderboard:" + d.getUTCFullYear() + "-" + m;
}

export async function submitScore(
  playerId: string, matchId: string, score: number, ts: number, sig: string
): Promise<{ applied: boolean }> {
  const payload = playerId + "|" + matchId + "|" + score + "|" + ts;
  const expected = createHmac("sha256", KEY).update(payload).digest();
  const given = Buffer.from(sig, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new Error("bad signature");
  }
  if (Math.abs(Date.now() - ts) > 60_000) throw new Error("stale event");

  // Unique index makes this the idempotency check AND the durable record.
  const res = await pg.query(
    "INSERT INTO score_events (player_id, match_id, score, created_at) " +
    "VALUES ($1, $2, $3, now()) ON CONFLICT (player_id, match_id) DO NOTHING",
    [playerId, matchId, score]
  );
  if (res.rowCount === 0) return { applied: false }; // duplicate, already counted

  await redis.zincrby(boardKey(), score, playerId);
  return { applied: true };
}`,
        },
        {
          title: "Rank, top-K, and neighborhood reads",
          language: "typescript",
          code: `import Redis from "ioredis";
const redis = new Redis();

let topCache: { at: number; data: unknown } | null = null;

export async function topK(board: string, k = 10) {
  if (topCache && Date.now() - topCache.at < 1000) return topCache.data;
  const flat = await redis.zrevrange(board, 0, k - 1, "WITHSCORES");
  const data = [];
  for (let i = 0; i < flat.length; i += 2) {
    data.push({ rank: i / 2 + 1, playerId: flat[i], score: Number(flat[i + 1]) });
  }
  topCache = { at: Date.now(), data };
  return data;
}

export async function playerRank(board: string, playerId: string) {
  const [rank, score, total] = await Promise.all([
    redis.zrevrank(board, playerId),
    redis.zscore(board, playerId),
    redis.zcard(board),
  ]);
  if (rank === null) return null;
  return {
    rank: rank + 1,
    score: Number(score),
    percentile: Math.round((1 - rank / total) * 1000) / 10,
  };
}

export async function neighbors(board: string, playerId: string, radius = 5) {
  const rank = await redis.zrevrank(board, playerId);
  if (rank === null) return [];
  const start = Math.max(0, rank - radius);
  const flat = await redis.zrevrange(board, start, rank + radius, "WITHSCORES");
  const out = [];
  for (let i = 0; i < flat.length; i += 2) {
    out.push({ rank: start + i / 2 + 1, playerId: flat[i], score: Number(flat[i + 1]) });
  }
  return out;
}`,
        },
        {
          title: "Rebuild the board from the event log",
          language: "sql",
          code: `-- Source of truth: replaying this reconstructs Redis exactly.
CREATE TABLE score_events (
  event_id   BIGSERIAL PRIMARY KEY,
  player_id  TEXT NOT NULL,
  match_id   TEXT NOT NULL,
  score      INTEGER NOT NULL CHECK (score >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, match_id)  -- idempotency: replays cannot double-count
);

-- Totals to feed ZADD during a rebuild (batch in pages of 10k).
SELECT player_id, SUM(score) AS total
FROM score_events
WHERE created_at >= date_trunc('month', now())
GROUP BY player_id
ORDER BY player_id;

-- Reconciliation spot-check: compare against ZSCORE for sampled players.
SELECT player_id, SUM(score) AS total
FROM score_events
WHERE created_at >= date_trunc('month', now())
  AND player_id = ANY(:sampled_ids)
GROUP BY player_id;`,
        },
      ],
    },
  },
  {
    slug: "ad-click-aggregator",
    title: "Design an Ad Click Aggregator",
    difficulty: "Hard",
    summary:
      "Count billions of ad clicks per day into minute-level aggregates that advertisers are billed on: stream processing with exactly-once effects, dedup of client retries, late-event handling, and nightly reconciliation against raw logs.",
    functionalRequirements: [
      "Ingest click events (ad_id, user_id, click_id, timestamp) from browsers and mobile SDKs worldwide",
      "Serve clicks per ad per minute, queryable within seconds, for dashboards and pacing",
      "Support aggregate queries over ranges: clicks for ad X between t1 and t2, top ads by clicks",
      "Deduplicate client retries and detect basic click fraud (same user hammering one ad)",
      "Provide billing-grade corrected totals within 24 hours via reconciliation against raw logs",
    ],
    nonFunctionalRequirements: [
      "Peak ingest of 500k clicks/sec (10k/sec average with 50x spikes during major events)",
      "End-to-end latency under 10 seconds from click to queryable aggregate for the real-time path",
      "Aggregates used for billing must be exactly-once: no lost clicks, no double counting; money is on the line",
      "Tolerate a stream-processor crash without producing duplicate or missing counts",
      "Raw events retained 90 days for audit and reprocessing",
    ],
    backOfEnvelope: [
      { label: "Clicks per day", value: "~1B", note: "10k/sec average x 86,400s, peaks to 500k/sec" },
      { label: "Raw event size", value: "~200 bytes", note: "click_id, ad_id, user_id, ts, ip, ua hash" },
      { label: "Raw daily volume", value: "~200 GB/day, ~18 TB/90 days", note: "compressed parquet on S3 roughly 4x smaller" },
      { label: "Aggregate rows", value: "10M active ads x 1,440 min = 14.4B possible; ~500M non-zero/day", note: "most ads see no clicks most minutes" },
      { label: "Aggregate write rate", value: "~350k row upserts/min", note: "one flush per (ad, minute) window, trivial vs raw ingest" },
      { label: "Kafka partitions", value: "500k/s peak / ~10 MB/s per partition x 200 B = ~100 partitions", note: "keyed by ad_id for locality" },
    ],
    apiDesign: [
      { endpoint: "POST /v1/clicks", description: "Fire-and-forget click beacon: {click_id, ad_id, user_id, ts}. Returns 204 immediately; client retries with the same click_id." },
      { endpoint: "GET /v1/ads/{ad_id}/clicks?start=...&end=...&granularity=minute", description: "Time-series of aggregated clicks for one ad." },
      { endpoint: "GET /v1/ads/top?window=1h&n=100", description: "Top N ads by clicks in a recent window, from pre-aggregated data." },
      { endpoint: "GET /v1/reconciliation/{date}", description: "Per-ad drift report: realtime total vs batch total vs correction applied." },
    ],
    highLevelDesign: [
      "Click beacons hit lightweight collectors behind a CDN and geo load balancing. Collectors do zero business logic: validate shape, stamp arrival time, write to Kafka keyed by ad_id, return 204. Client SDKs generate a UUID click_id at click time and retry with the same id on timeout, which converts network flakiness into a dedup problem downstream instead of data loss.",
      "A Kafka connector also archives every raw event to S3 as hourly parquet files. This raw log is the system's ground truth and exists specifically so the streaming answer never has to be trusted alone.",
      "A Flink job consumes the stream and does the core work: dedup on click_id within a TTL window, then a 1 minute event-time tumbling window keyed by (ad_id, minute) with allowed lateness, incrementing a count per window. On window close (watermark passes end plus grace), it emits the aggregate to the serving store. Flink checkpoints its state (dedup index, open windows, Kafka offsets) atomically, so a crash rewinds to the last checkpoint and recomputes without gaps or double emission into state.",
      "The serving store is a columnar OLAP database (ClickHouse or Pinot): aggregates keyed by (ad_id, minute_ts) support fast range scans and top-N. Writes from Flink are idempotent upserts keyed by (ad_id, minute_ts, window_version) so replay after a crash overwrites rather than adds; this is how exactly-once effects survive an at-least-once delivery boundary.",
      "A nightly Spark batch job recomputes per-ad-per-minute counts from the S3 raw logs with full dedup and fraud filtering, then diffs against the streaming aggregates. Drift beyond a threshold triggers correction rows and an alert. Billing reads the corrected batch numbers; dashboards read the realtime ones. This is the lambda-architecture shape, kept honest by making reconciliation a product feature (advertisers see corrections) rather than an internal patch job.",
    ],
    dataModel: [
      { name: "raw_clicks (S3 parquet)", fields: "click_id, ad_id, user_id, event_ts, arrival_ts, ip_hash, ua_hash, collector_id", note: "immutable ground truth, hourly partitions, 90 day retention" },
      { name: "minute_aggregates (ClickHouse)", fields: "ad_id, minute_ts, clicks, unique_users_est, window_version, updated_at", note: "ReplacingMergeTree on window_version makes replays idempotent" },
      { name: "dedup_state (Flink RocksDB)", fields: "click_id -> first_seen_ts", note: "TTL 15 min; checkpointed with offsets so recovery is consistent" },
      { name: "reconciliation_report", fields: "date, ad_id, realtime_total, batch_total, drift, correction_applied", note: "billing reads batch; drift over 0.1% pages the on-call" },
    ],
    deepDives: [
      {
        heading: "What exactly-once actually means here",
        body:
          "Exactly-once delivery over a network is impossible; what real systems build is exactly-once processing effects: each click influences the final count exactly once, even though the event may be transmitted, read, and processed multiple times. Every hop achieves it differently and an interviewer wants the per-hop story.\n\nClient to collector: at-least-once via retries with a stable click_id, making duplicates detectable. Collector to Kafka: idempotent producer (producer id plus sequence number dedups broker-side retries). Inside Flink: checkpointing snapshots offsets and state atomically, so reprocessing after a crash resumes from a consistent point; duplicates from the rewound input are caught by the click_id dedup state, which was also rewound consistently. Flink to ClickHouse: the sink is not transactional, so we make writes idempotent instead: the row key (ad_id, minute_ts) plus a deterministic window_version means writing the same window twice converges to one row.\n\nThe pattern to name: end-to-end exactly-once = at-least-once delivery + idempotent or transactional effects at every boundary. Saying that sentence, then walking each boundary, is the difference between hand-waving 'Flink has exactly-once' and demonstrating you know why.",
      },
      {
        heading: "Late and out-of-order events",
        body:
          "Mobile clicks arrive late constantly: a user clicks in a subway, the SDK queues the event, and it arrives 4 minutes after event_ts. If you window on arrival time, counts land in the wrong minute and advertiser reports disagree with their own logs. So windows must key on event time, which forces the watermark question: how long do you wait before declaring a minute closed?\n\nThe standard answer is a bounded-out-of-orderness watermark (say, max observed event time minus 30 seconds) plus allowed lateness of a few minutes. Events inside lateness re-fire the window with an updated count, and the idempotent sink overwrites the previous emission, incrementing window_version. Events later than that go to a side output, land in a late_clicks table, and are picked up by nightly reconciliation rather than being dropped silently.\n\nThe tradeoff is explicit: shorter watermark delay means fresher dashboards but more corrections; longer means stabler numbers but stale pacing decisions. Since billing reads the batch layer anyway, tune the realtime path aggressively fresh and let reconciliation absorb the tail. Also plan for the pathological case: one skewed device with a broken clock sending event_ts hours in the future can drag the watermark forward and prematurely close everyone's windows, so clamp event_ts to arrival_ts plus a small tolerance at ingest.",
      },
      {
        heading: "Dedup state at 500k events/sec",
        body:
          "Naive dedup ('keep a set of all click_ids') is unbounded. The realistic version is a TTL: client retries happen within seconds, so a 15 minute TTL on the dedup index catches essentially all retry duplicates. At 500k/s that is 450M ids in flight; at ~50 bytes each in RocksDB that is ~22 GB of state spread across Flink workers, heavy but routine, and it checkpoints incrementally.\n\nYou can halve this with a two-tier scheme: an in-memory Bloom filter per worker as a cheap first pass (a negative means definitely new, skip the RocksDB read), with the exact store consulted only on Bloom positives. This trades a tiny false-positive-driven extra read for a large reduction in state lookups.\n\nDuplicates older than the TTL (a phone offline for an hour replaying its queue) slip through the realtime path by design. They are caught by the batch layer, which dedups over the full day with an exact distinct on click_id. This is a deliberate split: bounded state and speed in the stream, unbounded correctness in batch.",
      },
      {
        heading: "Reconciliation is the real product",
        body:
          "Every serious counting pipeline drifts: a Flink bug, a bad deploy replaying an hour, a collector that silently dropped 0.3% of beacons. The design decision that separates senior answers is treating the raw S3 log plus nightly recomputation as the billing source of truth, with the streaming layer explicitly labeled as a fast estimate.\n\nMechanically: the Spark job recomputes per-(ad, minute) counts from raw parquet with exact dedup and fraud filters, joins against the streaming aggregates, and writes a drift report. Small drift silently writes correction rows (the aggregates table keeps both realtime and corrected columns). Drift above a threshold, say 0.1% for any ad spending over 1,000 dollars a day, pages on-call because it means a systemic bug, not noise.\n\nThis also gives you free disaster recovery: if the streaming pipeline is down for 3 hours, dashboards go stale but zero money is lost, because billing was never derived from the stream. Reprocessing is 'replay Kafka from offset X' or 'rerun Spark for the window', both idempotent by construction.",
      },
    ],
    bottlenecks: [
      "Hot ad skew: one viral ad concentrates load on a single Kafka partition and Flink key; pre-aggregate per collector or salt the key into ad_id#0..7 subkeys merged at the sink",
      "Dedup state size grows with TTL x throughput; Bloom-filter front, TTL discipline, and incremental checkpoints keep it manageable",
      "Watermark stalls from one idle or clock-skewed partition holding back all window closes; use idle-partition timeouts and clamp event_ts at ingest",
      "ClickHouse merge pressure from high-frequency upserts; batch sink flushes to once per window close, not per event",
      "Checkpoint duration under peak load blocks throughput if state is large; incremental RocksDB checkpoints and unaligned checkpoints mitigate",
    ],
    keyTakeaways: [
      "Exactly-once means at-least-once delivery plus idempotent or transactional effects at every boundary; walk each hop",
      "Window on event time with watermarks and bounded lateness; send stragglers to a side output, never drop them silently",
      "Client-generated stable click_ids turn retries from data corruption into a solvable dedup problem",
      "Keep raw immutable logs and reconcile nightly; bill from batch, dashboard from stream",
      "Bound streaming state with TTLs and Bloom filters, and let the batch layer own long-tail correctness",
    ],
    relatedTopics: ["message-queues", "event-driven-architecture", "distributed-transactions", "probabilistic-data-structures", "fault-tolerance"],
    rapidImplementation: {
      stack: "Redpanda (single binary Kafka) + a Node consumer with SQLite state + Postgres aggregates, on one $20 VPS",
      steps: [
        "Run Redpanda in Docker; create topic clicks with 8 partitions keyed by ad_id",
        "Build a Fastify beacon endpoint that validates {click_id, ad_id, user_id, ts}, clamps ts to now+5s, and produces to Kafka; return 204",
        "Also tee every raw event to a daily NDJSON file (the poor man's S3 raw log)",
        "Write the aggregator consumer: per-event dedup on click_id in SQLite with a 15 min TTL sweep, then increment an in-memory (ad_id, minute) window map",
        "Close windows when watermark (max event ts minus 30s) passes window end; upsert (ad_id, minute_ts, clicks, version) into Postgres ON CONFLICT UPDATE",
        "Commit Kafka offsets only after the upsert succeeds, so replays re-upsert idempotently instead of losing data",
        "Write the reconciliation script: recompute counts from the NDJSON raw log with exact dedup, diff against Postgres, print per-ad drift",
        "Chaos test: kill -9 the consumer mid-stream, restart, rerun reconciliation, and verify drift is zero",
      ],
      codeSketches: [
        {
          title: "Tumbling window aggregator with dedup and watermark",
          language: "typescript",
          code: `interface Click { clickId: string; adId: string; eventTs: number }

const DEDUP_TTL_MS = 15 * 60 * 1000;
const LATENESS_MS = 30 * 1000;

const seen = new Map<string, number>();            // clickId -> firstSeen (SQLite in real MVP)
const windows = new Map<string, number>();          // "adId|minuteTs" -> count
let watermark = 0;

export function onEvent(c: Click, flush: (adId: string, minuteTs: number, count: number) => void) {
  const now = Date.now();
  if (seen.has(c.clickId)) return;                  // duplicate retry, drop
  seen.set(c.clickId, now);

  const minuteTs = Math.floor(c.eventTs / 60000) * 60000;
  watermark = Math.max(watermark, c.eventTs - LATENESS_MS);

  if (minuteTs + 60000 <= watermark) {
    // window already closed: route to late side-output for reconciliation
    lateOutput(c);
    return;
  }
  const key = c.adId + "|" + minuteTs;
  windows.set(key, (windows.get(key) ?? 0) + 1);

  // Close every window whose end is behind the watermark.
  for (const [k, count] of windows) {
    const ts = Number(k.split("|")[1]);
    if (ts + 60000 <= watermark) {
      const adId = k.split("|")[0];
      flush(adId, ts, count);                       // idempotent upsert downstream
      windows.delete(k);
    }
  }
  // TTL sweep for dedup state (run on a timer in real code)
  if (seen.size > 1_000_000) {
    for (const [id, t] of seen) if (now - t > DEDUP_TTL_MS) seen.delete(id);
  }
}

function lateOutput(c: Click) {
  // append to late_clicks NDJSON; nightly reconciliation picks it up
}`,
        },
        {
          title: "Idempotent aggregate upsert (replay-safe sink)",
          language: "sql",
          code: `CREATE TABLE minute_aggregates (
  ad_id      TEXT NOT NULL,
  minute_ts  TIMESTAMPTZ NOT NULL,
  clicks     BIGINT NOT NULL,
  version    BIGINT NOT NULL,       -- bumped on each re-emission of the window
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ad_id, minute_ts)
);

-- Replaying the same closed window overwrites instead of double-counting.
-- Version guard means an old replay can never clobber a newer correction.
INSERT INTO minute_aggregates (ad_id, minute_ts, clicks, version)
VALUES (:ad_id, :minute_ts, :clicks, :version)
ON CONFLICT (ad_id, minute_ts) DO UPDATE
SET clicks = EXCLUDED.clicks,
    version = EXCLUDED.version,
    updated_at = now()
WHERE minute_aggregates.version <= EXCLUDED.version;`,
        },
        {
          title: "Reconciliation against the raw log",
          language: "python",
          code: `import json
from collections import defaultdict

def recompute_from_raw(paths):
    seen = set()
    counts = defaultdict(int)  # (ad_id, minute_ts) -> clicks
    for path in paths:
        with open(path) as f:
            for line in f:
                e = json.loads(line)
                if e["click_id"] in seen:      # exact full-day dedup
                    continue
                seen.add(e["click_id"])
                minute_ts = (e["event_ts"] // 60000) * 60000
                counts[(e["ad_id"], minute_ts)] += 1
    return counts

def reconcile(raw_counts, db_rows, threshold=0.001):
    drifts = []
    db = {(r["ad_id"], r["minute_ts"]): r["clicks"] for r in db_rows}
    for key in set(raw_counts) | set(db):
        truth, rt = raw_counts.get(key, 0), db.get(key, 0)
        if truth == rt:
            continue
        drift = abs(truth - rt) / max(truth, 1)
        drifts.append({"key": key, "batch": truth, "realtime": rt, "drift": drift,
                       "page_oncall": drift > threshold})
    return drifts  # apply corrections: upsert batch value with bumped version`,
        },
      ],
    },
  },
  {
    slug: "distributed-message-queue",
    title: "Design a Distributed Message Queue (Kafka)",
    difficulty: "Hard",
    summary:
      "Design a Kafka-style distributed log: partitioned append-only storage, consumer groups with offset tracking, leader-follower replication with ISR, and the tradeoffs behind at-least-once versus exactly-once delivery and ordering.",
    functionalRequirements: [
      "Producers publish messages to named topics; consumers subscribe and process them",
      "Topics are split into partitions; messages with the same key preserve relative order",
      "Multiple consumer groups each independently consume the full stream at their own pace",
      "Consumers can replay from any retained offset (retention by time or size, e.g. 7 days)",
      "Acknowledged messages survive the failure of any single broker",
    ],
    nonFunctionalRequirements: [
      "Sustain 1M messages/sec (1 GB/sec at 1 KB average) across the cluster",
      "End-to-end p99 latency under 50ms for acks=all producers",
      "No acknowledged message is lost as long as one in-sync replica survives",
      "Horizontally scalable by adding brokers and partitions without downtime",
      "Consumers scale to hundreds of instances per group with automatic partition rebalancing",
    ],
    backOfEnvelope: [
      { label: "Throughput", value: "1M msg/s x 1 KB = 1 GB/s ingress", note: "3 GB/s written with replication factor 3" },
      { label: "Retention storage", value: "1 GB/s x 604,800s x 3 = ~1.8 PB for 7 days", note: "the dominant cost; compression cuts 3-5x" },
      { label: "Brokers", value: "~30 brokers", note: "each handling ~100 MB/s write (sequential IO) plus replication traffic" },
      { label: "Partitions", value: "600 partitions for the big topic", note: "1 GB/s / ~10 MB/s comfortable per-partition write, x6 headroom" },
      { label: "Consumer group size limit", value: "max 600 parallel consumers", note: "one partition per consumer max; partitions cap parallelism" },
    ],
    apiDesign: [
      { endpoint: "POST /topics/{topic}/produce", description: "Publish batch: {key, value, headers}[] with acks=0|1|all; returns per-record (partition, offset)." },
      { endpoint: "POST /consumer-groups/{group}/poll", description: "Long-poll fetch from assigned partitions starting at current offsets; returns records and high-water marks." },
      { endpoint: "POST /consumer-groups/{group}/commit", description: "Commit consumed offsets per partition; defines the resume point after crash or rebalance." },
      { endpoint: "PUT /topics/{topic}", description: "Create or alter topic: partition count, replication factor, retention.ms." },
      { endpoint: "GET /topics/{topic}/offsets?ts=...", description: "Look up the earliest offset at or after a timestamp, for replay from a point in time." },
    ],
    highLevelDesign: [
      "Storage is an append-only log per partition, physically a sequence of segment files (say 1 GB each) with two sidecar indexes: offset to file position, and timestamp to offset, both sparse (an entry every 4 KB). Appends are sequential writes and reads are sequential scans from an index-located start, which is why a disk-backed log can outrun many in-memory systems: the OS page cache plus sendfile (zero-copy) means hot consumers are served from memory without the JVM touching the bytes.",
      "A topic's partitions are spread across brokers. Producers hash the message key to pick a partition (same key, same partition, hence per-key ordering) or round-robin when keyless. Each partition has one leader broker handling all reads and writes, and N-1 followers replicating by fetching from the leader like ordinary consumers.",
      "Replication safety hinges on the ISR (in-sync replica set): followers caught up within a lag bound. With acks=all, the leader acks a produce only after every ISR member has the record; the high-water mark (minimum replicated offset across ISR) bounds what consumers may read, so a consumer can never see a record that a leader failover could erase. min.insync.replicas=2 with RF=3 means writes stall rather than silently lose redundancy when two replicas are down: choosing consistency over availability for acked data.",
      "Consumer groups deliver queue semantics on top of the log: each partition is assigned to exactly one consumer in the group, and a group coordinator (a broker) manages membership via heartbeats and triggers rebalances when consumers join or die. Progress is just a committed offset per (group, partition), stored in an internal compacted topic. This makes consumption stateless and replayable: reset the offset and history replays; a slow consumer holds back only its own group.",
      "Cluster metadata (which broker leads which partition, ISR membership) lives in a Raft-based controller quorum (KRaft in modern Kafka, ZooKeeper historically). On leader failure the controller elects a new leader from the ISR; any log entries beyond the new leader's high-water mark are truncated on the old leader when it returns, which is exactly why unacked (sub-ISR) writes are the only thing that can be lost.",
    ],
    dataModel: [
      { name: "log segment", fields: "base_offset, records (offset, timestamp, key, value, headers, crc), sealed_flag", note: "immutable once sealed; deletion is dropping whole old segments" },
      { name: "offset index (per segment)", fields: "relative_offset, byte_position", note: "sparse, memory-mapped; binary search then short scan" },
      { name: "partition metadata", fields: "topic, partition_id, leader_broker, replica_set, isr_set, leader_epoch, high_water_mark", note: "leader_epoch fences zombie leaders" },
      { name: "consumer_offsets (compacted topic)", fields: "group_id, topic, partition, committed_offset, metadata, commit_ts", note: "key = (group, topic, partition); compaction keeps only the latest" },
    ],
    deepDives: [
      {
        heading: "Delivery guarantees: where messages are actually lost or duplicated",
        body:
          "At-most-once, at-least-once, and exactly-once are not modes you toggle; they emerge from choices at three points. Producer side: if a produce times out and you retry, the broker may have both copies (duplicate); if you do not retry, it may have neither (loss). Kafka's idempotent producer fixes the duplicate case with a producer id and per-partition sequence numbers the broker uses to discard retried batches. Broker side: acks=1 can lose a record if the leader dies after acking but before followers fetch; acks=all with min ISR closes that hole. Consumer side: commit offsets before processing and a crash skips messages (at-most-once); process then commit and a crash reprocesses (at-least-once).\n\nExactly-once within the Kafka-to-Kafka world is real: transactions let a consumer-transformer-producer commit output records and input offsets atomically, so a crash either replays into an aborted (invisible) transaction or resumes past a committed one. But the moment effects leave Kafka (an email, an HTTP call, a non-transactional DB write), you are back to at-least-once plus idempotent effects, the same pattern as every distributed system.\n\nInterview framing: say 'at-least-once with idempotent consumers is the default I design for; exactly-once is a property of a closed transactional loop, not of the network'. Then show where each duplicate or loss would concretely occur.",
      },
      {
        heading: "Replication, ISR, and the unclean election tradeoff",
        body:
          "Kafka's ISR design is a middle path between synchronous replication to all replicas (slow, one dead follower blocks writes) and fully async (fast, loses acked data). The leader tracks which followers are caught up; only those count for acks=all, and a lagging follower is evicted from the ISR rather than allowed to stall producers. This gives quorum-like durability with the flexibility that the quorum shrinks under failure instead of blocking, down to min.insync.replicas.\n\nThe leader_epoch is the subtle piece: it is a monotonically increasing number bumped on every leader election, stamped into the log. A partitioned old leader (a zombie) that keeps accepting writes will have them truncated when it rejoins and discovers a higher epoch, and followers use epoch history to truncate divergent suffixes correctly rather than trusting the high-water mark alone (which historically caused data loss bugs).\n\nUnclean leader election is the tradeoff every candidate should name: if all ISR members die and only a stale replica survives, do you elect it (availability, but acked messages vanish) or wait (consistency, but the partition is down)? Kafka defaults to waiting. Being able to say 'this knob is CAP made concrete, and for a payments topic I would never enable unclean election' is exactly what a hard-level interview is probing.",
      },
      {
        heading: "Consumer groups, rebalancing, and offset management",
        body:
          "The consumer group protocol turns a log into a scalable queue. The coordinator assigns each partition to exactly one group member; adding consumers up to the partition count adds parallelism, beyond it they idle. The classic operational pain is rebalancing: eager rebalancing stops the world (every consumer revokes everything, waits, gets a new assignment), so a single deploy of a 200-instance consumer fleet used to cause minutes of pause. Cooperative incremental rebalancing fixes this by only moving the partitions that actually change hands, and static membership (group.instance.id) avoids rebalances entirely on rolling restarts.\n\nOffsets deserve their own paragraph because they are the entire consumption state. Committing to a compacted internal topic means offset commits are themselves just produced messages: replicated, ordered, cheap. Auto-commit on a timer is the classic footgun: it can commit offsets for messages your handler has not finished, silently converting your at-least-once pipeline to at-most-once. Commit manually after processing, and make handlers idempotent because rebalances redeliver in-flight messages.\n\nAlso know the poison-pill pattern: a message that always crashes the handler will loop forever under at-least-once. Production systems add a retry counter (in headers) and route to a dead-letter topic after N failures, keeping the partition flowing.",
      },
      {
        heading: "Ordering: what is guaranteed and what people wrongly assume",
        body:
          "Kafka guarantees order within a partition, full stop. Cross-partition order does not exist, and 'topic order' is not a thing. Per-entity ordering (all events for user 42 in order) is achieved by keying on the entity id so they land in one partition. This is usually exactly what applications need, and it is why choosing the partition key is the most important schema decision in the system.\n\nThree things silently break even per-key ordering. Producer retries without idempotence: with max.in.flight > 1, batch B can succeed while earlier batch A retries, landing A after B; the idempotent producer restores order for up to 5 in-flight batches. Repartitioning: changing the partition count changes hash(key) mod N, so the same key maps to a new partition and old and new events for one key live in two partitions with no mutual order; plan partition counts generously up front. Consumer-side parallelism: handing records from one partition to a worker pool reorders them; if you parallelize, do it per key, not per record.\n\nThe honest summary for an interviewer: ordering is a per-partition, per-key contract that both producer config and consumer architecture must actively preserve, not a global property you get for free.",
      },
    ],
    bottlenecks: [
      "Hot partitions from skewed keys (one celebrity user) cap throughput at one broker; salt hot keys or accept per-key ordering loss for whales",
      "Partition count explosion: too many partitions inflate metadata, leader elections, and end-to-end latency; too few cap consumer parallelism",
      "Stop-the-world rebalances on large consumer groups during deploys; use cooperative rebalancing and static membership",
      "Slow ISR follower degrading acks=all latency for all producers on that partition; lag-based ISR eviction trades durability margin for latency",
      "Page cache pollution from a lagging consumer reading old segments, evicting hot data and hurting realtime consumers on the same broker",
    ],
    keyTakeaways: [
      "A partitioned append-only log with sequential IO and zero-copy reads is the whole performance story",
      "ISR replication plus acks=all plus min.insync.replicas defines exactly which failures can lose acked data",
      "Consumer groups turn a log into a queue; offsets in a compacted topic make consumption stateless and replayable",
      "Ordering is per-partition only; the partition key is the most consequential design decision",
      "Design for at-least-once with idempotent consumers; exactly-once only holds inside a closed transactional loop",
    ],
    relatedTopics: ["message-queues", "replication", "consistency-and-cap", "event-driven-architecture", "fault-tolerance"],
    rapidImplementation: {
      stack: "Node + TypeScript: append-only segment files with a sparse offset index, HTTP produce/consume API, offsets in SQLite; runs anywhere",
      steps: [
        "Define the record format: 4-byte length prefix + JSON {offset, ts, key, value}; create a data dir per topic-partition",
        "Implement the segment writer: append records, fsync on a 10ms timer, roll to a new segment file at 64 MB",
        "Build the sparse index: every 4 KB written, record (offset, bytePosition) in a .index file; loading it enables binary-search seeks",
        "Implement produce: hash(key) mod partitions to pick the partition, append, return the assigned offset",
        "Implement fetch: given (partition, offset), binary-search the index, scan to the exact record, stream up to max_bytes",
        "Add consumer groups: a groups table in SQLite mapping (group, partition) to committed_offset, plus a commit endpoint",
        "Add naive rebalancing: consumers heartbeat; on membership change, reassign partitions round-robin and bump a generation id that fences stale commits",
        "Verify: produce 1M records, kill -9 the server mid-produce, restart, assert no acked offset is missing and replays from offset 0 return identical data",
      ],
      codeSketches: [
        {
          title: "Append-only segment writer with sparse offset index",
          language: "typescript",
          code: `import * as fs from "fs";
import * as path from "path";

const INDEX_INTERVAL_BYTES = 4096;

export class Segment {
  private fd: number;
  private indexFd: number;
  private bytesSinceIndex = 0;
  public bytesWritten = 0;

  constructor(dir: string, public baseOffset: number, public nextOffset: number) {
    const name = String(baseOffset).padStart(20, "0");
    this.fd = fs.openSync(path.join(dir, name + ".log"), "a");
    this.indexFd = fs.openSync(path.join(dir, name + ".index"), "a");
  }

  append(key: string | null, value: string, ts = Date.now()): number {
    const offset = this.nextOffset++;
    const payload = Buffer.from(JSON.stringify({ offset, ts, key, value }));
    const frame = Buffer.alloc(4 + payload.length);
    frame.writeUInt32BE(payload.length, 0);
    payload.copy(frame, 4);

    if (this.bytesSinceIndex >= INDEX_INTERVAL_BYTES) {
      const entry = Buffer.alloc(12);
      entry.writeUInt32BE(offset - this.baseOffset, 0); // relative offset
      entry.writeBigUInt64BE(BigInt(this.bytesWritten), 4); // byte position
      fs.writeSync(this.indexFd, entry);
      this.bytesSinceIndex = 0;
    }
    fs.writeSync(this.fd, frame);
    this.bytesWritten += frame.length;
    this.bytesSinceIndex += frame.length;
    return offset;
  }

  flush() { fs.fsyncSync(this.fd); } // called on a 10ms timer: group commit
}`,
        },
        {
          title: "Fetch by offset using the sparse index",
          language: "typescript",
          code: `import * as fs from "fs";

interface IndexEntry { relOffset: number; pos: number }

export function loadIndex(indexPath: string): IndexEntry[] {
  const buf = fs.readFileSync(indexPath);
  const entries: IndexEntry[] = [];
  for (let i = 0; i + 12 <= buf.length; i += 12) {
    entries.push({ relOffset: buf.readUInt32BE(i), pos: Number(buf.readBigUInt64BE(i + 4)) });
  }
  return entries;
}

// Binary search the sparse index for the greatest entry <= target,
// then scan forward frame by frame to the exact offset.
export function fetch(logPath: string, index: IndexEntry[], baseOffset: number,
                      targetOffset: number, maxRecords: number) {
  const rel = targetOffset - baseOffset;
  let lo = 0, hi = index.length - 1, startPos = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (index[mid].relOffset <= rel) { startPos = index[mid].pos; lo = mid + 1; }
    else hi = mid - 1;
  }
  const buf = fs.readFileSync(logPath); // real impl: bounded pread, not whole file
  const out = [];
  let pos = startPos;
  while (pos + 4 <= buf.length && out.length < maxRecords) {
    const len = buf.readUInt32BE(pos);
    const rec = JSON.parse(buf.subarray(pos + 4, pos + 4 + len).toString());
    if (rec.offset >= targetOffset) out.push(rec);
    pos += 4 + len;
  }
  return out;
}`,
        },
        {
          title: "Consumer group offsets with generation fencing",
          language: "sql",
          code: `CREATE TABLE group_offsets (
  group_id   TEXT NOT NULL,
  topic      TEXT NOT NULL,
  partition  INTEGER NOT NULL,
  committed  BIGINT NOT NULL,       -- next offset to read
  generation INTEGER NOT NULL,      -- bumped on every rebalance
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (group_id, topic, partition)
);

-- Commit is fenced: a consumer from an old generation (kicked out by a
-- rebalance it has not noticed yet) cannot clobber the new owner's progress.
UPDATE group_offsets
SET committed = :offset, generation = :gen, updated_at = datetime('now')
WHERE group_id = :group AND topic = :topic AND partition = :partition
  AND generation <= :gen
  AND committed < :offset;          -- offsets only move forward

-- Resume point after restart or rebalance:
SELECT partition, committed FROM group_offsets
WHERE group_id = :group AND topic = :topic;`,
        },
      ],
    },
  },
];
