import type { CaseStudy } from "./types";

export const caseStudies4: CaseStudy[] = [
  {
    slug: "proximity-service",
    title: "Design a Proximity Service (Yelp / Nearby)",
    difficulty: "Medium",
    summary:
      "A location-based service that returns businesses near a user, sorted by distance and relevance. The core challenge is indexing 2D geospatial data so radius queries stay fast at hundreds of millions of businesses, while keeping business data reasonably fresh.",
    functionalRequirements: [
      "Return all businesses within a user-specified radius (0.5 km to 20 km) of a lat/lng point",
      "Support pagination and sorting by distance, rating, or a combined relevance score",
      "Business owners can add, update, and delete their business listings",
      "Return business detail pages (hours, photos, reviews summary) by business id",
      "Filter results by category (restaurants, gas stations, etc.)",
    ],
    nonFunctionalRequirements: [
      "Low latency: p99 under 200 ms for nearby search",
      "Read-heavy workload: roughly 1000:1 read to write ratio, optimize for reads",
      "High availability: search should degrade gracefully rather than fail",
      "Eventual consistency is acceptable: a business update can take up to a minute to appear in search",
      "Handle uneven density: Manhattan has thousands of businesses per km2, rural areas nearly none",
    ],
    backOfEnvelope: [
      {
        label: "Businesses",
        value: "200 million",
        note: "Global footprint, Yelp-scale plus international",
      },
      {
        label: "Daily active users",
        value: "100 million",
        note: "Each does about 5 searches per day",
      },
      {
        label: "Search QPS",
        value: "~5,800 average, ~12,000 peak",
        note: "100M x 5 / 86,400 s, peak at 2x average",
      },
      {
        label: "Business write QPS",
        value: "~10",
        note: "Assume 1M updates/day: 1M / 86,400 s. Trivially small vs reads",
      },
      {
        label: "Index storage",
        value: "~20 GB",
        note: "200M businesses x ~100 bytes (id 8B + geohash 8B + metadata). Fits in RAM on one box, replicate for QPS",
      },
      {
        label: "Full business data",
        value: "~2 TB",
        note: "200M x ~10 KB (text, hours, photo refs). Lives in a separate business DB, not the geo index",
      },
    ],
    apiDesign: [
      {
        endpoint: "GET /v1/search/nearby?lat={lat}&lng={lng}&radius={m}&category={c}&page={p}",
        description:
          "Core search. Returns a page of business summaries (id, name, distance, rating) sorted by relevance. Radius is clamped server-side to supported precision tiers.",
      },
      {
        endpoint: "GET /v1/businesses/{id}",
        description:
          "Full business detail. Served from the business service with a CDN/cache layer since detail pages are hot and change rarely.",
      },
      {
        endpoint: "POST /v1/businesses",
        description:
          "Create a listing. Writes to the business DB, then asynchronously updates the geo index (directly or via a nightly rebuild plus incremental log).",
      },
      {
        endpoint: "PUT /v1/businesses/{id}",
        description: "Update a listing. Same async index propagation as create.",
      },
      {
        endpoint: "DELETE /v1/businesses/{id}",
        description: "Tombstone the listing so the index can filter it out before the next rebuild.",
      },
    ],
    highLevelDesign: [
      "Split the system into two services: a stateless Location-Based Search (LBS) service that answers nearby queries, and a Business service that owns CRUD on business data. They scale independently because the workloads are wildly different: LBS is read-hot and latency sensitive, the business service is a boring CRUD API in front of a relational database with replicas.",
      "The heart of the LBS is a geospatial index. The three mainstream options are geohash, quadtree, and Uber's H3. Geohash encodes lat/lng into an interleaved base32 string where a shared prefix implies spatial proximity, so a radius query becomes a prefix match over the target cell plus its 8 neighbors. A quadtree recursively splits the map until each leaf holds under ~100 businesses, adapting naturally to density but living in memory and needing rebuilds. H3 uses hexagons, which have the nice property that all neighbors are equidistant, making ring-based expansion cleaner. For an interview, geohash on top of a plain database index is the simplest defensible answer.",
      "Query flow: the client sends lat/lng and radius. The LBS picks a geohash precision matching the radius (precision 5 is about 4.9 x 4.9 km, precision 6 about 1.2 x 0.6 km), computes the center cell and its 8 neighbors, fetches candidate business ids from the index for those 9 prefixes, computes exact haversine distance to filter false positives from cell corners, then ranks and hydrates the top N from the business service or a cache.",
      "Writes take the slow path. Business updates land in the business DB immediately, and the geo index is updated asynchronously: either incrementally (insert/delete the geohash row) or via a periodic rebuild for the in-memory quadtree variant. Because the index rows are tiny, the whole index replicates cheaply across many read replicas, and a fresh replica can rebuild from the DB in minutes.",
    ],
    dataModel: [
      {
        name: "business",
        fields:
          "business_id (PK), name, address, city, country, latitude, longitude, category, rating, hours_json, created_at, updated_at",
        note: "Source of truth, relational DB with read replicas",
      },
      {
        name: "geo_index",
        fields: "geohash (char 6), business_id, PRIMARY KEY (geohash, business_id)",
        note: "One row per business. Compound key makes prefix scans and dedup trivial; no need for a JSON list per cell, which would create update contention",
      },
      {
        name: "business_category",
        fields: "category, business_id, PRIMARY KEY (category, business_id)",
        note: "Optional inverted list for category filtering before distance ranking",
      },
    ],
    deepDives: [
      {
        heading: "Geohash vs quadtree vs H3",
        body:
          "Geohash is a static grid: pick a precision, and every cell at that precision has the same size. Its killer feature is that it turns 2D proximity into 1D string prefix matching, so a vanilla B-tree index on a geohash column supports radius queries with no special database extensions. Its two weaknesses are boundary effects (two points meters apart can sit in different cells, even with non-matching prefixes across major grid lines) and fixed granularity (a dense downtown cell can hold 10,000 businesses). The boundary problem is solved by always querying the center cell plus 8 neighbors; the density problem by capping and paginating within a cell or dropping to a finer precision in hot areas.\n\nA quadtree adapts to density: recursively subdivide any node holding more than ~100 businesses. Searches walk down to the leaf containing the query point and expand to sibling leaves until enough candidates are found. The tree for 200M businesses is only a few GB and fits in memory, giving very fast lookups, but it is an in-memory structure you must build (minutes at startup), rebuild or patch on updates, and warm on every new server, which complicates deploys and autoscaling.\n\nH3 tiles the earth with hexagons at 16 resolutions. Hexagons have uniform neighbor distance (squares have diagonal neighbors ~41 percent farther), which makes k-ring expansion for radius search more accurate and is why ride-sharing companies use it for supply/demand smoothing. In an interview: lead with geohash for simplicity, mention quadtree when asked about density adaptation, mention H3 when the domain involves movement and ring-based aggregation.",
      },
      {
        heading: "Choosing precision and handling the radius query",
        body:
          "Map the requested radius to the smallest geohash precision whose cell fully covers it: 20 km maps to precision 4 (~39 x 19.5 km), 5 km to precision 5 (~4.9 x 4.9 km), 1 km to precision 6 (~1.2 x 0.6 km). Then fetch all rows whose geohash starts with the center cell prefix or any of its 8 neighbors. Using LIKE 'prefix%' on the indexed column (or storing exactly at query precision) keeps this a handful of index range scans.\n\nCandidates from 9 cells form a superset of the true radius, so compute exact haversine distance per candidate and discard anything outside the radius. This filter step is cheap: even a dense query returns a few thousand candidates, and a few thousand haversine evaluations cost well under a millisecond.\n\nRanking rarely stops at raw distance. A practical relevance score blends distance decay, rating, review count, and open-now status, for example score = w1 * exp(-distance/1km) + w2 * rating_normalized + w3 * log(1 + review_count). Keep ranking in the LBS layer so you can iterate without touching the index.",
      },
      {
        heading: "Keeping the index fresh under business updates",
        body:
          "Writes are ~10 QPS against ~12,000 read QPS, so never let writes contend with reads on the hot path. The clean pattern: business service commits to its DB, emits an event (or the LBS tails a change log), and an indexer applies the delta to geo_index rows. A moved business is a delete of the old (geohash, id) row plus an insert of the new one.\n\nIf you use in-memory quadtrees instead, incremental tree surgery across a replica fleet is fiddly, so most designs accept staleness: rebuild the tree nightly from a DB snapshot and roll replicas gradually so the fleet never rebuilds at once. A one-minute to one-day staleness window is explicitly acceptable per requirements; the business detail page (served from the DB) is always fresh, so users rarely notice index lag.\n\nDeletes need care: a tombstoned business may linger in the index until the next delta or rebuild, so the hydration step should drop ids that no longer resolve in the business service rather than render ghosts.",
      },
    ],
    bottlenecks: [
      "Dense cells: a single precision-5 cell in Manhattan can hold tens of thousands of businesses; mitigate with finer precision in hot regions, per-cell result caps, and category pre-filtering",
      "Hot geographic keys: everyone in a stadium queries the same 9 cells; cache (cell, radius, category) result lists in Redis with a short TTL",
      "Cross-cell boundary queries always cost 9 index lookups; batch them into one range-scan query rather than 9 round trips",
      "Hydrating full business records for ranking can dominate latency; store denormalized rank fields (rating, review_count) alongside the index or in a cache",
      "Index replica warm-up after deploys (quadtree variant) causes cold-start latency spikes; use blue-green rollout with pre-warmed snapshots",
    ],
    keyTakeaways: [
      "Turn a 2D problem into a 1D one: geohash prefix matching lets an ordinary B-tree answer radius queries",
      "Always query the center cell plus 8 neighbors, then filter by exact haversine distance to fix boundary false negatives",
      "Separate the tiny hot geo index (GBs, replicate everywhere) from the large cold business data (TBs, cache in front)",
      "Exploit the 1000:1 read/write skew: async index updates, aggressive read replication, eventual consistency by design",
      "Know the trade triangle: geohash is simplest, quadtree adapts to density, H3 gives uniform neighbor geometry",
    ],
    relatedTopics: ["caching", "database-indexing", "replication", "sharding-and-partitioning", "storage-and-search"],
    rapidImplementation: {
      stack:
        "Postgres (Neon free tier) with earthdistance + cube extensions, Next.js API routes on Vercel free tier, ngeohash npm package",
      steps: [
        "Create a Neon Postgres database and run CREATE EXTENSION cube; CREATE EXTENSION earthdistance;",
        "Create the businesses table with latitude, longitude, and a geohash char(6) column",
        "Seed 100k rows from the free OpenStreetMap POI extract for one city (osmnx or a CSV dump)",
        "Add a B-tree index on geohash and a GIST index on ll_to_earth(latitude, longitude) so you can benchmark both strategies",
        "Install ngeohash and write a /api/nearby route: encode the query point at precision 6, compute the 8 neighbors, query WHERE geohash IN the 9 cells",
        "Filter candidates by exact haversine distance in TypeScript and sort by a score of distance decay plus rating",
        "Add a Redis (Upstash free tier) cache keyed by center-cell geohash plus radius with a 60 second TTL",
        "Deploy to Vercel and load-test the endpoint with autocannon to confirm sub-100 ms p99 on the cached path",
      ],
      codeSketches: [
        {
          title: "Geohash neighbor search (query handler)",
          language: "typescript",
          code: `import geohash from "ngeohash";
import { sql } from "./db";

const PRECISION_FOR_RADIUS = [
  { maxMeters: 1000, precision: 6 },
  { maxMeters: 5000, precision: 5 },
  { maxMeters: 20000, precision: 4 },
];

export async function nearby(lat: number, lng: number, radiusM: number) {
  const { precision } = PRECISION_FOR_RADIUS.find(
    (t) => radiusM <= t.maxMeters
  ) ?? { precision: 4 };

  const center = geohash.encode(lat, lng, precision);
  const cells = [center, ...geohash.neighbors(center)];

  // geohash column is stored at precision 6; prefix match covers coarser cells
  const rows = await sql(
    "SELECT id, name, rating, latitude, longitude FROM businesses " +
      "WHERE " + cells.map((_, i) => "geohash LIKE $" + (i + 1)).join(" OR "),
    cells.map((c) => c + "%")
  );

  return rows
    .map((r) => ({ ...r, distanceM: haversine(lat, lng, r.latitude, r.longitude) }))
    .filter((r) => r.distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, 20);
}`,
        },
        {
          title: "Haversine distance",
          language: "typescript",
          code: `export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // earth radius in meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}`,
        },
        {
          title: "Schema and the earthdistance alternative",
          language: "sql",
          code: `CREATE TABLE businesses (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  category   TEXT,
  rating     REAL DEFAULT 0,
  latitude   DOUBLE PRECISION NOT NULL,
  longitude  DOUBLE PRECISION NOT NULL,
  geohash    CHAR(6) NOT NULL
);

CREATE INDEX idx_businesses_geohash ON businesses (geohash);
CREATE INDEX idx_businesses_earth
  ON businesses USING GIST (ll_to_earth(latitude, longitude));

-- Alternative radius query without geohash, using earthdistance directly:
SELECT id, name,
       earth_distance(ll_to_earth(latitude, longitude), ll_to_earth(40.7484, -73.9857)) AS meters
FROM businesses
WHERE earth_box(ll_to_earth(40.7484, -73.9857), 1000) @> ll_to_earth(latitude, longitude)
ORDER BY meters
LIMIT 20;`,
        },
      ],
    },
  },
  {
    slug: "distributed-job-scheduler",
    title: "Design a Distributed Job Scheduler",
    difficulty: "Medium",
    summary:
      "A service that runs millions of one-off and recurring (cron) jobs on time, distributing work across a fleet of workers with retries, priorities, and at-least-once (approaching exactly-once) execution guarantees, even when schedulers and workers crash mid-flight.",
    functionalRequirements: [
      "Schedule one-off jobs to run at a specific future time (run_at)",
      "Schedule recurring jobs with cron expressions, computing the next run after each firing",
      "Retry failed jobs with exponential backoff up to a configurable max attempts",
      "Support job priorities so urgent jobs jump the queue under load",
      "Let clients query job status (pending, running, succeeded, failed, dead) and cancel pending jobs",
      "Prevent the same job execution from running concurrently on two workers",
    ],
    nonFunctionalRequirements: [
      "Timeliness: 99 percent of jobs start within 10 seconds of their scheduled time",
      "At-least-once execution with idempotency hooks so effective exactly-once is achievable for well-behaved jobs",
      "Horizontal scalability: 10k+ job executions per second across the fleet",
      "No single point of failure: a crashed scheduler or worker never loses or strands a job",
      "Durability: an accepted job survives node failures until it completes or exhausts retries",
    ],
    backOfEnvelope: [
      {
        label: "Jobs scheduled per day",
        value: "500 million",
        note: "Mix of one-off and cron firings",
      },
      {
        label: "Average execution QPS",
        value: "~5,800",
        note: "500M / 86,400 s; provision for 3x peak at top-of-minute cron alignment, ~17k QPS",
      },
      {
        label: "Job row size",
        value: "~1 KB",
        note: "Payload pointer, schedule, status, timestamps, attempt count",
      },
      {
        label: "Hot table size",
        value: "~500 GB/day before archival",
        note: "500M x 1 KB. Move terminal-state rows to cold storage within hours to keep the polled index small",
      },
      {
        label: "Worker fleet",
        value: "~1,200 workers",
        note: "5,800 QPS x 10 s average job duration = 58k concurrent jobs; at 50 concurrent slots per worker",
      },
      {
        label: "Poll load on DB",
        value: "~120 polls/s",
        note: "1,200 workers polling every 10 s. Fine for one Postgres primary; shard by queue when this grows 100x",
      },
    ],
    apiDesign: [
      {
        endpoint: "POST /v1/jobs",
        description:
          "Create a job: { type, payload, run_at | cron, priority, max_attempts, idempotency_key }. Returns job_id. Idempotency key dedupes client retries of the create call itself.",
      },
      {
        endpoint: "GET /v1/jobs/{id}",
        description: "Fetch job status, attempt history, last error, and next scheduled run for cron jobs.",
      },
      {
        endpoint: "DELETE /v1/jobs/{id}",
        description: "Cancel a pending job or stop future firings of a cron job. Running executions finish; they are not killed.",
      },
      {
        endpoint: "POST /internal/leases/claim",
        description:
          "Worker API: atomically claim up to N due jobs, receiving a lease token and lease expiry per job.",
      },
      {
        endpoint: "POST /internal/leases/{token}/heartbeat",
        description:
          "Worker API: extend the lease for a long-running job, or report completion/failure. A completion with a stale token is rejected.",
      },
    ],
    highLevelDesign: [
      "Three planes: an API service that validates and persists jobs, a scheduling plane that decides what is due, and a worker plane that executes. The single most important design decision is that the source of truth is a durable jobs store (a relational DB works well into the tens of thousands of QPS), and everything else (queues, in-memory timing wheels) is a rebuildable acceleration layer on top of it.",
      "The scheduling plane handles two shapes of time. One-off jobs are simply rows with run_at; a due-job query is an index scan on (status, run_at). Cron jobs are templates: when a firing is claimed, the scheduler materializes the execution and immediately computes and writes the next run_at from the cron expression, so a cron job is just a self-replenishing one-off. This unifies the model and means missed windows (scheduler down for 5 minutes) are naturally caught up because due rows are still due.",
      "Dispatch uses worker leases rather than fire-and-forget queues. A worker claims due jobs with an atomic UPDATE ... RETURNING that flips status to running, stamps the worker id, and sets lease_expires_at = now + lease_duration. If the worker dies, it stops heartbeating, the lease expires, and a reaper flips the row back to pending for another worker. This gives at-least-once execution with no lost jobs and no zookeeper-style external lock service.",
      "Exactly-once semantics are layered on with fencing and idempotency. Every claim gets a monotonically increasing attempt number that acts as a fencing token: a zombie worker that wakes up after its lease expired will have its completion report rejected because its token is stale. For side effects outside the system (send an email, charge a card), the job payload carries an idempotency key that the downstream effect must honor; the scheduler can only guarantee exactly-once state transitions, not exactly-once side effects.",
      "Priority and load shedding: the claim query orders by (priority DESC, run_at ASC), so high-priority jobs are always claimed first, and under sustained overload low-priority jobs simply age in the queue rather than causing failures. Retries reinsert the job with run_at = now + backoff(attempt), where backoff is exponential with jitter, and after max_attempts the job moves to a dead-letter state for human inspection.",
    ],
    dataModel: [
      {
        name: "jobs",
        fields:
          "job_id (PK), type, payload_json, priority, status (pending|running|succeeded|failed|dead), run_at, cron_expr, attempt, max_attempts, lease_expires_at, worker_id, idempotency_key (unique), created_at, updated_at",
        note: "Partial index on (priority DESC, run_at) WHERE status = 'pending' keeps the claim scan tiny regardless of table size",
      },
      {
        name: "job_attempts",
        fields:
          "attempt_id (PK), job_id (FK), attempt_no, worker_id, started_at, finished_at, outcome, error_text",
        note: "Append-only audit trail; also what the status API reads for history",
      },
      {
        name: "workers",
        fields: "worker_id (PK), hostname, capacity, last_heartbeat_at",
        note: "Reaper marks a worker dead when heartbeat is stale and expires all its leases in one sweep",
      },
    ],
    deepDives: [
      {
        heading: "Cron at scale and the thundering herd at :00",
        body:
          "Cron expressions cluster brutally: an enormous fraction of jobs are scheduled at the top of the hour or minute because humans write '0 * * * *'. If 2 million jobs become due in the same second, a naive scheduler melts. Three mitigations stack well. First, jitter at registration: unless the job opts into strict timing, hash the job id into a 0-59 second offset so '0 * * * *' spreads across the minute. Second, the due-query itself is naturally rate-limited because workers claim in fixed-size batches; dueness is a floor, not a trigger, so a backlog drains at fleet capacity instead of stampeding. Third, pre-materialize: a sweeper runs every 30 seconds and expands cron templates into concrete execution rows for the next few minutes, so firing time does cheap row claims rather than cron parsing.\n\nRecurrence bookkeeping has one classic bug: computing next_run from the previous scheduled time versus from completion time. Fixed-rate (from scheduled time) keeps cadence but can pile up overlapping runs if executions are slow; fixed-delay (from completion) avoids overlap but drifts. Offer both, default to fixed-rate with an overlap guard: skip materializing a new execution while one is still running, incrementing a missed_runs counter instead.\n\nAlso decide catch-up policy explicitly: after a 30-minute outage, does an every-5-minutes job fire 6 times or once? Almost every consumer wants once (coalescing). Make coalescing the default and let strict jobs opt out.",
      },
      {
        heading: "Worker leases, fencing tokens, and the exactly-once illusion",
        body:
          "The claim operation must be atomic or two workers will run the same job. In SQL this is one statement: UPDATE jobs SET status='running', worker_id=$w, attempt=attempt+1, lease_expires_at=now()+interval '60 seconds' WHERE job_id IN (SELECT job_id FROM jobs WHERE status='pending' AND run_at <= now() ORDER BY priority DESC, run_at LIMIT 10 FOR UPDATE SKIP LOCKED) RETURNING *. The FOR UPDATE SKIP LOCKED clause is the whole trick: concurrent claimers skip rows another transaction has locked instead of blocking, so N workers claim disjoint batches with zero coordination.\n\nLeases handle worker death, but they create the zombie problem: a worker stalls (GC pause, network partition), its lease expires, the job is re-claimed by worker B, then worker A wakes up and finishes too. The job ran twice (unavoidable under at-least-once) but worse, A's completion could overwrite B's state. The fix is fencing: the attempt number captured at claim time is A's token; completion is UPDATE jobs SET status='succeeded' WHERE job_id=$id AND attempt=$myAttempt AND worker_id=$me. A's stale attempt number makes the update match zero rows, and A learns it was fenced.\n\nTrue exactly-once side effects are impossible in general (the worker can crash between the side effect and the ack), so the honest contract is: exactly-once state transitions inside the scheduler, at-least-once invocation of the job body, and idempotency keys handed to the job so it can make its own side effects safe. Say exactly this in the interview; claiming unconditional exactly-once is a red flag.",
      },
      {
        heading: "Retries, backoff, and dead letters",
        body:
          "A failed attempt should not retry immediately: if the failure is a downstream outage, instant retries are a self-inflicted DDoS. Standard policy is exponential backoff with full jitter: delay = random(0, min(cap, base * 2^attempt)), for example base 5 s, cap 15 minutes. Full jitter (randomizing over the whole window rather than adding small noise) is what actually breaks retry synchronization when thousands of jobs failed at the same moment.\n\nDistinguish failure classes. A retryable failure (timeout, 503) reschedules with backoff. A permanent failure (validation error, 4xx from downstream) should skip straight to dead: retrying a job that can never succeed wastes capacity and delays real work. Let the job body signal which class it hit; default unknown errors to retryable.\n\nAfter max_attempts, park the job in a dead-letter state with its full attempt history. Dead letters need an operational story: alerting when the dead rate spikes, a UI to inspect payload and errors, and a bulk requeue action for after the downstream incident is fixed. A scheduler without a dead-letter workflow silently loses work, just with extra steps.",
      },
      {
        heading: "Scaling past one database",
        body:
          "A single Postgres with the partial-index claim pattern comfortably handles a few thousand claims per second, which covers a surprising fraction of real companies. When you outgrow it, shard by queue/tenant: each shard is an independent jobs table with its own workers, and a thin router assigns jobs to shards by hash of tenant id. Cross-shard priority is approximated, not global, which is almost always acceptable.\n\nThe alternative architecture replaces DB polling with a delay-queue substrate: Redis sorted sets keyed by run_at (ZADD to schedule, ZRANGEBYSCORE plus atomic ZREM in a Lua script to claim), or Kafka with a timing-wheel service in front since Kafka has no native delay. These cut claim latency to single-digit milliseconds but reintroduce the durability question: Redis needs AOF plus replication, and you typically still write-through to a durable store for status queries and audit, which is exactly the two-tier design (durable truth plus fast acceleration layer) restated.\n\nScheduler-plane HA is simpler than it looks: the sweeper and reaper are the only singleton-ish components, and they can run on every node guarded by a short DB advisory lock, so failover is just the next node grabbing the lock.",
      },
    ],
    bottlenecks: [
      "Top-of-minute cron alignment creates 100x load spikes; jitter registration offsets and pre-materialize executions",
      "The pending-jobs index becomes the contention hot spot; FOR UPDATE SKIP LOCKED and a partial index WHERE status='pending' keep claimers from serializing",
      "Long-running jobs holding leases block visibility; require heartbeats and size lease_duration to a few heartbeat intervals, not job duration",
      "Table bloat from billions of terminal rows slows the claim scan; archive succeeded/dead rows to cold storage aggressively",
      "Retry storms after a downstream outage; full-jitter backoff plus a per-job-type circuit breaker that pauses claiming a failing type",
    ],
    keyTakeaways: [
      "Durable store as truth, queues as acceleration: you can rebuild dispatch state from the jobs table after any crash",
      "FOR UPDATE SKIP LOCKED turns a plain relational DB into a competitive work queue with atomic, coordination-free claiming",
      "Leases plus fencing tokens (attempt number) are the standard answer to worker crashes and zombies",
      "Promise at-least-once execution with idempotency hooks; exactly-once side effects are a downstream contract, not a scheduler feature",
      "Design the failure path first: backoff with full jitter, permanent-vs-retryable classification, and a dead-letter workflow",
    ],
    relatedTopics: ["message-queues", "distributed-transactions", "fault-tolerance", "database-indexing", "event-driven-architecture"],
    rapidImplementation: {
      stack:
        "Postgres (Supabase free tier) as the queue, Node.js worker processes with node-cron for the sweeper, no message broker at all",
      steps: [
        "Create the jobs table with the partial index: CREATE INDEX ON jobs (priority DESC, run_at) WHERE status = 'pending'",
        "Write a claimJobs(workerId, n) function using UPDATE ... FROM a SKIP LOCKED subquery, RETURNING the claimed rows",
        "Write the worker loop: claim up to 10 jobs, execute each with a try/catch, report success or failure with the fencing predicate (AND attempt = claimedAttempt)",
        "Add a heartbeat interval per running job that pushes lease_expires_at forward every 20 seconds",
        "Add the reaper: every 30 seconds, UPDATE jobs SET status='pending' WHERE status='running' AND lease_expires_at < now()",
        "Add cron support with the cron-parser npm package: on claiming a cron job, insert the next execution row before running the current one",
        "Implement failure handling: retryable errors set run_at = now + jittered backoff and status='pending'; attempt >= max_attempts sets status='dead'",
        "Kill -9 a worker mid-job and watch the reaper recover it; run 3 workers against 10k seeded jobs to verify no job runs with two overlapping leases",
      ],
      codeSketches: [
        {
          title: "Atomic batch claim with SKIP LOCKED",
          language: "sql",
          code: `-- Claim up to 10 due jobs atomically; concurrent workers get disjoint sets.
UPDATE jobs j
SET    status           = 'running',
       worker_id        = $1,
       attempt          = j.attempt + 1,
       lease_expires_at = now() + interval '60 seconds'
FROM (
  SELECT job_id
  FROM   jobs
  WHERE  status = 'pending'
    AND  run_at <= now()
  ORDER  BY priority DESC, run_at ASC
  LIMIT  10
  FOR UPDATE SKIP LOCKED
) due
WHERE j.job_id = due.job_id
RETURNING j.job_id, j.type, j.payload_json, j.attempt, j.cron_expr;`,
        },
        {
          title: "Worker loop with fenced completion",
          language: "typescript",
          code: `import { sql } from "./db";
import { handlers } from "./handlers";

const WORKER_ID = process.env.WORKER_ID ?? "worker-" + process.pid;

async function runOne(job: { job_id: string; type: string; payload_json: any; attempt: number }) {
  const hb = setInterval(() => {
    sql("UPDATE jobs SET lease_expires_at = now() + interval '60 seconds' " +
        "WHERE job_id = $1 AND worker_id = $2 AND attempt = $3",
        [job.job_id, WORKER_ID, job.attempt]).catch(() => {});
  }, 20_000);

  try {
    await handlers[job.type](job.payload_json);
    // Fencing: attempt must still match, or a zombie is trying to complete.
    await sql(
      "UPDATE jobs SET status = 'succeeded' " +
      "WHERE job_id = $1 AND worker_id = $2 AND attempt = $3",
      [job.job_id, WORKER_ID, job.attempt]
    );
  } catch (err) {
    const backoffSec = Math.random() * Math.min(900, 5 * 2 ** job.attempt);
    await sql(
      "UPDATE jobs SET " +
      "  status = CASE WHEN attempt >= max_attempts THEN 'dead' ELSE 'pending' END, " +
      "  run_at = now() + ($4 || ' seconds')::interval " +
      "WHERE job_id = $1 AND worker_id = $2 AND attempt = $3",
      [job.job_id, WORKER_ID, job.attempt, backoffSec.toFixed(0)]
    );
  } finally {
    clearInterval(hb);
  }
}`,
        },
        {
          title: "Cron materialization on claim",
          language: "typescript",
          code: `import parser from "cron-parser";
import { sql } from "./db";

// Called right after claiming a job that has a cron expression:
// schedule the next firing before running this one (fixed-rate semantics).
export async function materializeNext(job: {
  job_id: string; type: string; payload_json: any; cron_expr: string;
}) {
  const next = parser.parseExpression(job.cron_expr).next().toDate();
  await sql(
    "INSERT INTO jobs (type, payload_json, cron_expr, run_at, status, priority, max_attempts) " +
    "SELECT type, payload_json, cron_expr, $2, 'pending', priority, max_attempts " +
    "FROM jobs WHERE job_id = $1 " +
    "AND NOT EXISTS (" +
    "  SELECT 1 FROM jobs WHERE cron_expr = $3 AND type = $4 " +
    "  AND status = 'pending' AND run_at = $2" +
    ")",
    [job.job_id, next.toISOString(), job.cron_expr, job.type]
  );
}`,
        },
      ],
    },
  },
  {
    slug: "search-engine",
    title: "Design a Search Engine",
    difficulty: "Hard",
    summary:
      "A web-scale search engine: a polite distributed crawler feeding an inverted-index build pipeline, ranking that blends TF-IDF/BM25 text relevance with PageRank authority, and a sharded, replicated query-serving tier that answers keyword queries over billions of documents in under 200 ms.",
    functionalRequirements: [
      "Crawl the public web starting from seed URLs, respecting robots.txt and per-domain politeness limits",
      "Parse, deduplicate, and index page text into an inverted index keyed by term",
      "Serve keyword queries with AND semantics, returning the top 10 ranked results with title and snippet",
      "Rank results by combining text relevance (BM25/TF-IDF) with link-based authority (PageRank)",
      "Re-crawl pages on a freshness schedule so popular pages update within days",
    ],
    nonFunctionalRequirements: [
      "Query latency: p99 under 200 ms end to end at 50k QPS",
      "Index scale: 10 billion documents, tens of terabytes of posting lists",
      "Crawl politeness: never overwhelm an origin site; hard cap of ~1 request/second/domain",
      "Freshness: news-class pages re-indexed within hours, long tail within weeks",
      "Availability over consistency: serving a slightly stale index is always preferable to failing queries",
    ],
    backOfEnvelope: [
      {
        label: "Corpus",
        value: "10 billion pages, ~100 KB HTML each",
        note: "Raw crawl store ~1 PB; extracted text ~10 KB/page = 100 TB",
      },
      {
        label: "Crawl throughput needed",
        value: "~12,000 pages/s",
        note: "Refresh 10B pages over 10 days: 10B / (10 x 86,400 s). At 100 KB/page that is ~1.2 GB/s ingress",
      },
      {
        label: "Inverted index size",
        value: "~50 TB compressed",
        note: "~500 terms/page x 10B pages = 5 x 10^12 postings; ~10 bytes each raw, roughly halved by varint/delta compression",
      },
      {
        label: "Index shards",
        value: "~250 shards",
        note: "50 TB / ~200 GB per shard so each shard's hot postings fit in RAM+NVMe on one box; 3x replicas = 750 serving nodes",
      },
      {
        label: "Query fan-out cost",
        value: "50k QPS x 250 shards = 12.5M shard-queries/s",
        note: "Every query hits every document-partitioned shard; each replica group absorbs ~17k shard-queries/s across 3 replicas",
      },
      {
        label: "PageRank compute",
        value: "~50 iterations over a 100B-edge graph",
        note: "800 GB of edges (8 B/edge); a few hours per run on a modest Spark cluster, run weekly",
      },
    ],
    apiDesign: [
      {
        endpoint: "GET /v1/search?q={query}&page={p}",
        description:
          "Main search. Tokenizes and normalizes the query, fans out to index shards, merges top-k, hydrates titles and snippets from the document store.",
      },
      {
        endpoint: "GET /v1/suggest?prefix={text}",
        description:
          "Typeahead completions from a separate trie/FST built from query logs; entirely decoupled from the main index.",
      },
      {
        endpoint: "POST /internal/crawl/seeds",
        description: "Operator API to inject seed URLs or force recrawl of a domain.",
      },
      {
        endpoint: "GET /internal/index/epochs",
        description:
          "Lists index generations (epochs) and their shard manifests; the serving tier uses this to atomically swap to a new index version.",
      },
    ],
    highLevelDesign: [
      "Three loosely coupled subsystems connected by storage, not RPC: the crawler writes raw pages to a document store; the indexing pipeline reads the store and emits immutable index shards; the serving tier loads shards and answers queries. Each subsystem scales and fails independently, and the batch boundary between them (index epochs) is what makes the whole thing operable: serving never depends on the crawler being healthy.",
      "The crawler is a frontier-driven loop: a URL frontier (priority queues partitioned by domain) feeds fetchers, fetched HTML is parsed for text and outlinks, new URLs flow back to the frontier. Politeness is enforced structurally: all URLs for one domain map to one frontier queue with a per-queue rate limit, so no coordination is needed to avoid hammering a site. Content-seen deduplication (SimHash for near-duplicates, exact hash for identical bodies) prunes the 30-plus percent of the web that is duplicated before it wastes index space.",
      "The indexing pipeline is a classic MapReduce shape even if you run it on Spark: map each document to (term, docId, positions, tf) tuples, shuffle by term, reduce into per-term posting lists sorted by docId and delta-compressed. Alongside, a link-graph job extracts (src, dst) edges and iterates PageRank to convergence. The output is a new immutable index epoch: document-partitioned shards, each containing its term dictionary, posting lists, and per-doc static scores (PageRank, spam score, length norms).",
      "Serving is scatter-gather over document-partitioned shards. A query hits a coordinator, which normalizes terms, broadcasts to one replica of each shard, and each shard intersects posting lists, scores its local candidates with BM25 plus static signals, and returns its top 50. The coordinator merges, takes the global top 10, and hydrates snippets. Document partitioning (vs term partitioning) is the industry default because intersection happens locally on one node, network cost per query is bounded, and a dead shard degrades results by 1/250th instead of breaking specific terms.",
      "Freshness is layered rather than solved once: the big batch index rebuilds weekly, a small delta index rebuilds hourly from recently crawled pages, and serving queries both and merges (with the delta winning on doc collisions). This mirrors the Lucene segment model and avoids the false choice between real-time indexing complexity and week-stale results.",
    ],
    dataModel: [
      {
        name: "url_frontier",
        fields: "domain, url, priority, earliest_fetch_at, discovered_at, PRIMARY KEY (domain, url)",
        note: "Partitioned by domain hash; per-domain FIFO with a token-bucket rate gate",
      },
      {
        name: "documents",
        fields: "doc_id (PK), url, content_hash, simhash, fetched_at, http_status, title, extracted_text_ref, outlinks_ref",
        note: "The crawl store; blob refs point to object storage, metadata stays in a wide-column store",
      },
      {
        name: "posting_list (index shard file)",
        fields: "term, doc_count, postings: [delta_doc_id (varint), tf, position_offsets]",
        note: "Immutable, memory-mapped; term dictionary is an FST mapping term to file offset",
      },
      {
        name: "doc_scores",
        fields: "doc_id, pagerank, doc_length, spam_score, epoch",
        note: "Static per-doc signals co-located with each shard for scoring without network hops",
      },
    ],
    deepDives: [
      {
        heading: "Crawler: frontier design, politeness, and traps",
        body:
          "The frontier is the crawler's real data structure problem. It must balance priority (crawl important/fresh URLs first) against politeness (per-domain rate caps), and those goals fight: strict priority order would fetch 10,000 consecutive CNN URLs, which politeness forbids. The Mercator design solves it with two stages: front queues partitioned by priority, and back queues strictly partitioned by domain, each with a next-allowed-fetch timestamp. Fetcher threads pull from whichever back queue is ready, so the crawler naturally interleaves thousands of domains while each domain sees at most one request per politeness interval.\n\nDeduplication has two layers. URL-seen filtering (a Bloom filter or sharded hash set over ~100B URLs) stops re-enqueueing; at 10 bits per key a Bloom filter for 100B URLs is ~125 GB, shardable across frontier nodes, with false positives merely skipping a URL. Content dedup catches mirrors and www/non-www twins: SimHash produces a 64-bit fingerprint where near-duplicate pages differ in few bits, and Hamming-distance lookup tables find near-dupes at crawl rate.\n\nThe adversarial web is the part interviewers love: spider traps (calendar pages generating infinite next-month links), URL parameter explosions, and 200-OK error pages. Defenses are budget-based, not clever: max crawl depth, per-domain page budgets proportional to domain PageRank, URL canonicalization (strip session params, sort query strings), and content-hash checks that stop crawling a domain returning identical bodies.",
      },
      {
        heading: "Building the inverted index and computing PageRank",
        body:
          "The index build is deliberately batch. Attempting in-place index mutation at 12k docs/s creates unsolvable compaction and consistency problems; instead, every epoch is built from scratch (or from the previous epoch plus a delta) as immutable files. Map phase: parse, tokenize, stem, emit (term, docId, tf, positions). Shuffle by term. Reduce: sort postings by docId, delta-encode docIds (gaps compress far better than absolute ids), varint or PForDelta encode, and write the term dictionary as an FST. Sorting by docId is what later makes multi-term intersection a linear merge of sorted lists.\n\nPageRank models a random surfer: rank(p) = (1-d)/N + d * sum over inlinks q of rank(q)/outdegree(q), with damping d = 0.85. Implementation is iterative sparse matrix-vector multiplication over the link graph; 40-50 iterations converge for web graphs. The two practical wrinkles are dangling nodes (pages with no outlinks leak rank; redistribute their mass uniformly each iteration) and spam farms (link circles inflating each other; mitigated with trust-seeded variants like TrustRank and by discounting intra-domain links).\n\nTF-IDF's modern form is BM25: score(q,d) = sum over terms t of IDF(t) x tf(t,d) x (k1+1) / (tf(t,d) + k1 x (1 - b + b x |d|/avgdl)), with k1 around 1.2 and b around 0.75. The saturation term is why BM25 beats raw TF-IDF: the 50th occurrence of a term adds almost nothing, so keyword-stuffed pages stop winning. Final ranking is typically score = w_text x BM25 + w_auth x log(PageRank) + freshness and quality terms, with weights tuned on click data.",
      },
      {
        heading: "Query serving: scatter-gather, top-k, and latency discipline",
        body:
          "A multi-term query on one shard is posting-list intersection: walk the sorted lists in tandem, or better, iterate the rarest list and probe the others with skip pointers (galloping search), which makes intersection cost proportional to the rarest term's list length. Per-document scoring happens during intersection using local doc_scores, and a bounded min-heap keeps the shard's top 50. WAND-family optimizations prune documents whose maximum possible score cannot reach the current heap floor, often skipping 90 percent of scoring work on long lists.\n\nTail latency is governed by the slowest of 250 shards, so p99 discipline is structural: hedged requests (send to a second replica if the first has not answered in p95 time), per-shard deadlines with partial-result merging (answering from 248 of 250 shards is invisible to users), and replica load balancing aware of GC pauses. This is the canonical tail-at-scale problem and saying so, with hedging as the fix, scores points.\n\nCaching stacks multiply: a result cache for full queries (web queries are extremely head-heavy; 30-plus percent hit rates are normal), a posting-list block cache inside each shard, and OS page cache under the memory-mapped index files. Because index epochs are immutable, every cache layer gets trivially correct invalidation: caches are keyed by epoch and simply cut over when serving swaps epochs.",
      },
      {
        heading: "Sharding the index: document vs term partitioning",
        body:
          "Document partitioning assigns each document to one shard, which holds a full mini-index over its documents. Every query fans out to all shards; each shard does local intersection and returns its top-k. Term partitioning assigns each term's full posting list to one shard, so a query touches only its terms' shards. Term partitioning sounds cheaper but loses badly in practice: multi-term intersection now ships giant posting lists across the network, load skews brutally on hot terms, and one shard failure blacks out specific words. Document partitioning keeps intersections local, spreads load uniformly, and degrades gracefully. All major engines (Google, Elasticsearch, Vespa) partition by document.\n\nWithin document partitioning, assignment can be random (uniform load, the default) or quality-tiered: put the highest-PageRank documents in a small tier-1 that is searched first, and only fan out to lower tiers if tier-1 yields too few good results. Tiering cuts average query cost several-fold at the price of occasionally missing a long-tail result on the first pass.\n\nEpoch swap is the deployment story: the pipeline publishes a manifest (epoch N: 250 shard files plus checksums), serving nodes for each shard download their new file, warm it (touch pages, prime caches), report ready, and the coordinator flips the epoch pointer atomically. Rollback is flipping the pointer back, which is the operational payoff of immutability.",
      },
    ],
    bottlenecks: [
      "Crawl politeness caps throughput per domain, so a few enormous sites dominate crawl calendars; prioritize by PageRank-weighted budgets rather than URL counts",
      "Shuffle stage of the index build moves tens of TB; delta builds (index only changed docs) and per-shard local sorting keep rebuild hours, not days",
      "Scatter-gather tail latency: one slow shard sets query p99; hedged requests and partial-result deadlines are mandatory, not optional",
      "Hot head queries and hot terms (posting lists for 'the' are useless but huge); stopword handling, result caching, and WAND pruning",
      "Index epoch swaps can double memory temporarily on serving nodes; stagger shard cutover and size headroom for old+new residency",
    ],
    keyTakeaways: [
      "Decouple crawl, index build, and serving through immutable storage; batch epochs make a petabyte system operable",
      "Politeness is a data-structure property: one domain, one queue, one rate limiter, zero coordination",
      "Document partitioning beats term partitioning because intersection stays local and failure degrades uniformly",
      "BM25 plus PageRank is the canonical ranking answer: per-query text relevance times query-independent authority",
      "Immutable index epochs give free cache correctness, atomic deploys, and one-command rollback",
    ],
    relatedTopics: ["storage-and-search", "sharding-and-partitioning", "caching", "probabilistic-data-structures", "scalability"],
    rapidImplementation: {
      stack:
        "Python (httpx + selectolax for crawling, pure-dict inverted index), SQLite for the doc store, FastAPI for serving; runs on a laptop",
      steps: [
        "Write a polite async crawler: httpx with a per-domain asyncio semaphore and a 1 req/s per-domain sleep, seeded with 20 URLs from a niche you like",
        "Respect robots.txt via urllib.robotparser and store fetched pages (url, html, text, outlinks) in SQLite",
        "Extract text and links with selectolax; canonicalize URLs (strip fragments and utm params) and dedupe with a seen-set before enqueueing",
        "Crawl ~5,000 pages, then build the inverted index: tokenize, lowercase, stem with nltk, emit term -> sorted list of (doc_id, tf) into a pickle or SQLite table",
        "Compute PageRank over the crawled link graph with 30 power iterations (a 50-line function, no library needed)",
        "Implement BM25 scoring over posting-list intersection for multi-term queries and blend with 0.2 x log PageRank",
        "Serve GET /search?q= with FastAPI: tokenize the query, intersect postings, score, return top 10 with title and a naive snippet (text window around the first match)",
        "Verify: search a term you know appears on exactly 3 crawled pages and confirm those 3 rank above pages that merely link to them",
      ],
      codeSketches: [
        {
          title: "Inverted index build with BM25 stats",
          language: "python",
          code: `import math, re
from collections import defaultdict

TOKEN = re.compile(r"[a-z0-9]+")

def build_index(docs):  # docs: dict[doc_id] = text
    index = defaultdict(list)          # term -> [(doc_id, tf)] sorted by doc_id
    doc_len = {}
    for doc_id in sorted(docs):
        terms = TOKEN.findall(docs[doc_id].lower())
        doc_len[doc_id] = len(terms)
        tf = defaultdict(int)
        for t in terms:
            tf[t] += 1
        for t, f in tf.items():
            index[t].append((doc_id, f))
    avgdl = sum(doc_len.values()) / max(1, len(doc_len))
    return index, doc_len, avgdl

def bm25(index, doc_len, avgdl, n_docs, query, k1=1.2, b=0.75):
    scores = defaultdict(float)
    for term in TOKEN.findall(query.lower()):
        postings = index.get(term, [])
        if not postings:
            continue
        idf = math.log(1 + (n_docs - len(postings) + 0.5) / (len(postings) + 0.5))
        for doc_id, tf in postings:
            norm = tf * (k1 + 1) / (tf + k1 * (1 - b + b * doc_len[doc_id] / avgdl))
            scores[doc_id] += idf * norm
    return sorted(scores.items(), key=lambda x: -x[1])[:10]`,
        },
        {
          title: "PageRank power iteration",
          language: "python",
          code: `def pagerank(links, d=0.85, iters=30):
    # links: dict[url] = list of outlink urls (within the crawled set)
    pages = set(links) | {v for outs in links.values() for v in outs}
    n = len(pages)
    rank = {p: 1.0 / n for p in pages}
    inlinks = {p: [] for p in pages}
    for src, outs in links.items():
        for dst in outs:
            inlinks[dst].append(src)
    for _ in range(iters):
        dangling = sum(rank[p] for p in pages if not links.get(p))
        new = {}
        for p in pages:
            incoming = sum(rank[q] / len(links[q]) for q in inlinks[p] if links.get(q))
            new[p] = (1 - d) / n + d * (incoming + dangling / n)
        rank = new
    return rank`,
        },
        {
          title: "Polite async crawler core",
          language: "python",
          code: `import asyncio, time
from urllib.parse import urlparse
import httpx

class PoliteCrawler:
    def __init__(self, delay_per_domain=1.0, max_pages=5000):
        self.next_ok = {}          # domain -> earliest next fetch time
        self.seen = set()
        self.frontier = asyncio.Queue()
        self.delay = delay_per_domain
        self.budget = max_pages

    async def fetch(self, client, url):
        domain = urlparse(url).netloc
        wait = self.next_ok.get(domain, 0) - time.monotonic()
        if wait > 0:
            await asyncio.sleep(wait)
        self.next_ok[domain] = time.monotonic() + self.delay
        r = await client.get(url, timeout=10, follow_redirects=True)
        return r.text if r.status_code == 200 else None

    async def worker(self, client, on_page):
        while self.budget > 0:
            url = await self.frontier.get()
            if url in self.seen:
                continue
            self.seen.add(url)
            html = await self.fetch(client, url)
            if html:
                self.budget -= 1
                for link in on_page(url, html):   # parse, store, return outlinks
                    if link not in self.seen:
                        self.frontier.put_nowait(link)`,
        },
      ],
    },
  },
  {
    slug: "ticket-booking",
    title: "Design a Ticket Booking System (Ticketmaster)",
    difficulty: "Hard",
    summary:
      "A ticketing platform where millions of fans compete for tens of thousands of seats the moment a sale opens. The core problems are correctness (never sell one seat twice) under extreme write contention, temporary seat holds with TTL, and absorbing flash-sale spikes with a virtual waiting room so the transactional core stays within capacity.",
    functionalRequirements: [
      "Browse events and view a real-time seat map with availability",
      "Hold selected seats for a limited window (e.g. 8 minutes) while the user pays",
      "Confirm purchase: charge payment and convert held seats to sold atomically",
      "Release holds automatically on expiry or explicit cancellation",
      "Admit users through a fair virtual waiting room when demand exceeds capacity",
      "Never oversell: each seat is sold to exactly one buyer",
    ],
    nonFunctionalRequirements: [
      "Strong consistency for seat state transitions; overselling is a correctness failure, not a degradation",
      "Absorb flash spikes of 1M+ concurrent users against ~50k seats without collapsing the core",
      "Hold operations complete in under 300 ms even at peak",
      "Fairness: waiting-room ordering resists bots and refresh-abuse",
      "High availability for browsing even when purchasing is saturated; reads must not be blocked by write contention",
    ],
    backOfEnvelope: [
      {
        label: "Flash-sale audience",
        value: "1 million users at T-0",
        note: "A stadium tour on-sale; 20x more people than seats",
      },
      {
        label: "Seats on sale",
        value: "50,000",
        note: "The fundamental asymmetry: at most 50k successful purchases regardless of traffic",
      },
      {
        label: "Peak seat-map read QPS",
        value: "~500,000",
        note: "1M users polling/streaming availability every ~2 s; must be served from cache/pub-sub, never the transactional DB",
      },
      {
        label: "Sustainable hold QPS",
        value: "~2,000",
        note: "What one well-indexed Postgres primary handles for row-locked hold transactions; the waiting room exists to enforce this ceiling",
      },
      {
        label: "Sell-out time",
        value: "~10-25 minutes",
        note: "50k seats / 2k holds per second is 25 s of pure writes, but hold-to-purchase conversion (~40 percent) and 8-minute payment windows stretch reality to minutes",
      },
      {
        label: "Hold state size",
        value: "trivial: 50k seats x ~100 B = 5 MB",
        note: "The entire inventory of the hottest event on earth fits in one Redis instance; the problem is contention, not volume",
      },
    ],
    apiDesign: [
      {
        endpoint: "GET /v1/events/{id}/seats",
        description:
          "Seat map with availability. Served from a Redis-backed cache updated by change events; availability may be seconds stale, which the hold step reconciles.",
      },
      {
        endpoint: "POST /v1/events/{id}/holds",
        description:
          "Body: { seat_ids: [...] }. Requires a valid waiting-room admission token. Atomically holds all seats or none; returns hold_id and expires_at. 409 with the contested seat ids on conflict.",
      },
      {
        endpoint: "POST /v1/holds/{hold_id}/purchase",
        description:
          "Body: { payment_method, idempotency_key }. Charges payment and flips held seats to sold in one transaction. Idempotency key makes client retries safe.",
      },
      {
        endpoint: "DELETE /v1/holds/{hold_id}",
        description: "Explicit release when the user abandons; otherwise TTL expiry reclaims the seats.",
      },
      {
        endpoint: "GET /v1/waiting-room/{event_id}/status",
        description:
          "Long-poll/SSE endpoint returning queue position and, once admitted, a signed admission token with a short expiry.",
      },
    ],
    highLevelDesign: [
      "The architecture is a funnel with three pressure zones. Zone 1 (browse) is read-only and cache-served: CDN for static assets, Redis pub-sub or SSE for seat-map deltas, and it must survive 500k QPS untouched by transactions. Zone 2 (waiting room) is the admission valve: it queues the 1M-user stampede and releases users into zone 3 at a rate the core can handle. Zone 3 (transact) is a strongly consistent inventory service on a relational database where holds and purchases mutate seat rows under locks.",
      "Seat inventory is modeled as one row per seat per event with a state machine: available -> held -> sold, plus held -> available on expiry. The invariant 'a seat has at most one active hold or sale' is enforced by the database itself, not application logic: either row locks (SELECT ... FOR UPDATE, flip state only if currently available) or optimistic conditional updates (UPDATE ... WHERE status = 'available', check rows affected). Both make double-selling impossible at the storage layer, which is where correctness guarantees belong.",
      "Holds carry a TTL (expires_at). Expiry is enforced lazily and eagerly at once: lazily, every read and hold attempt treats an expired hold as available (WHERE status='available' OR (status='held' AND hold_expires_at < now())), so correctness never depends on a timer firing; eagerly, a sweeper flips expired rows back in batches so seat maps and counts stay tidy. This lazy-check pattern is the crucial trick: TTL cleanup jobs can lag without ever causing incorrect behavior.",
      "The purchase step spans two systems (inventory DB and payment provider), which is a distributed transaction in disguise. The standard resolution: hold seats first, then charge payment with an idempotency key, then mark sold in a local transaction; if the charge succeeds but the confirm write fails, a reconciliation worker replays the confirm using the payment provider's records as truth. The hold TTL is deliberately longer than any payment-provider timeout so the seat cannot be given away while a charge is in flight.",
      "The virtual waiting room is what turns an impossible load problem into a solved one. Users arriving before or at on-sale join a queue (Redis sorted set scored by arrival time plus anti-bot checks); a gatekeeper admits N users per second, N tuned to keep zone 3 below its measured capacity, issuing signed, short-lived admission tokens that the hold API requires. Everyone else sees an honest position indicator. This converts a 1M-QPS thundering herd into a steady 2k QPS the database shrugs at, and fairness becomes an explicit, auditable policy rather than an accident of who retried fastest.",
    ],
    dataModel: [
      {
        name: "seats",
        fields:
          "seat_id (PK), event_id, section, row, number, price_tier, status (available|held|sold), hold_id, hold_expires_at, version",
        note: "One row per seat per event; composite index on (event_id, status). The version column supports optimistic concurrency if you avoid row locks",
      },
      {
        name: "holds",
        fields: "hold_id (PK), event_id, user_id, seat_ids, created_at, expires_at, state (active|expired|converted|cancelled)",
        note: "Groups a multi-seat selection so purchase converts all-or-nothing",
      },
      {
        name: "orders",
        fields:
          "order_id (PK), user_id, event_id, seat_ids, amount, payment_intent_id, idempotency_key (unique), status (pending|paid|failed|refunded), created_at",
        note: "Unique idempotency_key makes retried purchase calls return the same order instead of double-charging",
      },
      {
        name: "waiting_room_entries",
        fields: "event_id, user_id, joined_at, position_score, admitted_at, token_hash",
        note: "Backed by a Redis sorted set at runtime; persisted for audit and abuse analysis",
      },
    ],
    deepDives: [
      {
        heading: "Preventing overselling: pessimistic vs optimistic seat locking",
        body:
          "Pessimistic locking wraps the hold in a transaction: SELECT ... FOR UPDATE on the chosen seat rows, verify all are available (or expired-held), set them held, commit. Correctness is trivial to reason about and multi-seat holds are naturally atomic. The risks are lock waits under contention and deadlocks when two users pick overlapping seat sets in different orders; the fixes are always locking seat ids in sorted order and using NOWAIT or a short lock_timeout so contenders fail fast with a clean 409 rather than queueing.\n\nOptimistic (conditional update) locking skips explicit locks: UPDATE seats SET status='held', hold_id=$h WHERE seat_id = ANY($ids) AND (status='available' OR (status='held' AND hold_expires_at < now())), then check that rows_affected equals the number requested; if not, roll back and report which seats were lost. Under a flash sale, contention on popular seats is ferocious and optimistic retries can livelock, so pessimistic-with-NOWAIT usually wins for hot events while optimistic is fine for the long tail. Both are correct; the choice is about wasted work under contention.\n\nWhat does not work: checking availability in application code and then writing (check-then-act race), enforcing uniqueness in a cache without the DB as backstop, or relying on the seat map UI as any kind of guard. The database constraint is the last line of defense and must hold even if every layer above it is buggy. A belt-and-suspenders addition: a partial unique index on (event_id, seat_id) WHERE status='sold' in the orders path makes double-sale physically unrepresentable.",
      },
      {
        heading: "Hold TTL mechanics and the payment race",
        body:
          "The hold window is a product decision with systems consequences: 8 minutes is common. Implement expiry as data, not as a scheduled action: the row stores hold_expires_at, and every state transition predicate treats an expired hold as available. A background sweeper (UPDATE seats SET status='available', hold_id=NULL WHERE status='held' AND hold_expires_at < now() LIMIT batches) is purely hygienic, restoring seats to the visible pool promptly, and its failure mode is cosmetic staleness rather than incorrectness.\n\nThe nasty race is purchase-at-expiry: the user submits payment at 7:59, the charge takes 20 seconds, and meanwhile the hold expires and another user grabs the seat. Two defenses compose. First, the confirm transaction re-checks the hold is still active and owned by this user before flipping to sold; if the hold lapsed, refund automatically and apologize. Second, prevent the window: the purchase endpoint refuses to start a charge in the final 60 seconds of a hold unless it first extends the hold (an extension is just an atomic conditional UPDATE on hold_expires_at, allowed once), sized so hold-extension >= payment-provider max timeout.\n\nIdempotency ties it together: the client sends an idempotency key with purchase; the orders table has a unique constraint on it; a retry after a network blip finds the existing order and returns it instead of re-charging. The same key is forwarded to the payment provider (Stripe-style) so even the charge itself is exactly-once from the user's perspective.",
      },
      {
        heading: "The virtual waiting room: fairness as load shedding",
        body:
          "Without admission control, on-sale moment traffic is a self-DDoS: 1M users hammering hold endpoints for 50k seats does 950k units of guaranteed-wasted work, and the contention collapses throughput for everyone including the eventual winners. The waiting room inverts this: absorb arrivals into a cheap queue (a Redis sorted set insert is microseconds), admit at the transactional core's measured capacity, and reject nothing; users just wait with an honest position.\n\nFairness design is where the interesting choices live. Score by arrival time and admission is FIFO, which feels fair but rewards bots that arrive first with thousands of connections; score by a random lottery among everyone present at T-0 and bots gain nothing from arriving early but humans who queued get no credit. Real systems blend: randomize within arrival cohorts, require a signed browser challenge or CAPTCHA to join, limit entries per account and payment fingerprint, and make the admission token single-use, user-bound, and short-lived so it cannot be resold or shared.\n\nThe admission token is the enforcement point: a signed JWT-style blob (event_id, user_id, admitted_at, expiry, nonce) that the hold API verifies statelessly plus a Redis single-use check on the nonce. Rate-tune admissions with a feedback loop: watch hold-endpoint p99 and DB lock waits, and shrink the admit rate when the core approaches saturation. This is a control system, not a static config.",
      },
      {
        heading: "Serving the seat map under 500k QPS of reads",
        body:
          "Seat-map reads outnumber transactional writes by orders of magnitude and must never touch the locked tables. The pattern is read-path/write-path separation: the inventory service emits a change event (seat X held/sold/released) on every commit, a fan-out layer folds these into a compact per-event availability bitmap or summary in Redis, and clients get deltas over SSE/WebSocket or poll a CDN-cacheable snapshot with a 1-2 second TTL.\n\nStaleness is embraced, not fought: a user may click a seat that was grabbed 800 ms ago, and the hold request comes back 409 with the current truth. The UX contract is 'the map is advisory; the hold is authoritative.' Optimizing the miss rate matters (fresher maps mean fewer failed holds and less wasted core capacity) but correctness never depends on map freshness.\n\nFor general-admission or price-tier sales (no assigned seats), replace per-seat rows with an atomic counter: Redis DECRBY with a Lua script that refuses to go below zero, write-behind to the DB, or a single-row UPDATE inventory SET remaining = remaining - $n WHERE remaining >= $n. Counters remove per-seat contention entirely and are why GA on-sales survive spikes that seated maps struggle with; mention this contrast to show you see the data-model lever, not just the infrastructure one.",
      },
    ],
    bottlenecks: [
      "Row-lock contention on popular seats (front row) serializes holds; lock in sorted seat order with NOWAIT, fail fast to 409, and let the map steer users apart",
      "The on-sale thundering herd: without a waiting room, wasted-work traffic collapses the core; admission control is the fix, not bigger databases",
      "Hold-expiry sweeps competing with live traffic for the same rows; sweep in small batches with SKIP LOCKED and rely on lazy expiry checks for correctness",
      "Payment provider latency (seconds) inside the user's hold window; never hold DB locks across the payment call, and extend holds before charging",
      "Seat-map fan-out at 500k QPS; push deltas via pub-sub and CDN-cache snapshots so reads never reach Postgres",
    ],
    keyTakeaways: [
      "Enforce the no-oversell invariant in the database (conditional updates or row locks), never in application checks or caches",
      "Model hold expiry as data checked lazily on every transition; background cleanup is hygiene, not correctness",
      "A virtual waiting room converts an unbounded spike into a tunable admission rate and makes fairness an explicit policy",
      "Bridge inventory and payment with idempotency keys plus reconciliation, not a distributed transaction protocol",
      "Separate read and write paths: advisory cached seat maps absorb 99 percent of traffic so locks only serialize real intent",
    ],
    relatedTopics: ["distributed-transactions", "consistency-and-cap", "rate-limiting", "caching", "message-queues"],
    rapidImplementation: {
      stack:
        "Postgres (Supabase free tier) for inventory, Upstash Redis for the waiting room and seat-map cache, Next.js on Vercel, Stripe test mode for payments",
      steps: [
        "Create the seats table (one row per seat, status + hold_expires_at columns) and seed a 500-seat venue for one event",
        "Implement POST /holds as a single transaction: SELECT ... FOR UPDATE NOWAIT on sorted seat ids, verify each is available or expired-held, set held with an 8-minute expiry",
        "Implement purchase: re-verify the hold under FOR UPDATE, create a Stripe test-mode PaymentIntent with the client's idempotency key, then mark seats sold and the order paid in one commit",
        "Add lazy expiry to every predicate (status='available' OR hold_expires_at < now()) and a 30-second sweeper cron that releases expired holds with SKIP LOCKED",
        "Build the seat map endpoint from a Redis hash (seat_id -> status) updated after every commit, with a 2-second client poll",
        "Add the waiting room: ZADD users into a Redis sorted set on arrival, a gatekeeper loop that pops the lowest N scores per second and writes single-use signed admission tokens, and token verification middleware on the hold route",
        "Write a contention test: fire 200 concurrent hold requests at the same 5 seats with autocannon and assert exactly 1 winner per seat and zero rows with status='sold' duplicated",
        "Simulate the flash sale end to end: 2,000 scripted users through the waiting room against 500 seats, verify sell-out with zero oversells and honest queue positions",
      ],
      codeSketches: [
        {
          title: "Atomic multi-seat hold with FOR UPDATE NOWAIT and lazy expiry",
          language: "sql",
          code: `BEGIN;

-- Lock in sorted order to prevent deadlocks; NOWAIT fails fast under contention.
SELECT seat_id, status, hold_expires_at
FROM seats
WHERE event_id = $1 AND seat_id = ANY($2)   -- $2 must be sorted by caller
ORDER BY seat_id
FOR UPDATE NOWAIT;

-- Application verifies every returned row is grabbable, then:
UPDATE seats
SET    status = 'held',
       hold_id = $3,
       hold_expires_at = now() + interval '8 minutes'
WHERE  event_id = $1
  AND  seat_id = ANY($2)
  AND  (status = 'available'
        OR (status = 'held' AND hold_expires_at < now()));
-- If row_count <> array_length($2), another user won a seat: ROLLBACK and 409.

COMMIT;`,
        },
        {
          title: "Purchase confirmation with idempotency and hold re-check",
          language: "typescript",
          code: `import { pool } from "./db";
import { stripe } from "./stripe";

export async function purchase(holdId: string, userId: string, idemKey: string) {
  const existing = await pool.query(
    "SELECT order_id, status FROM orders WHERE idempotency_key = $1", [idemKey]);
  if (existing.rows[0]) return existing.rows[0]; // safe retry

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const hold = await client.query(
      "SELECT * FROM holds WHERE hold_id = $1 AND user_id = $2 " +
      "AND state = 'active' AND expires_at > now() FOR UPDATE", [holdId, userId]);
    if (!hold.rows[0]) throw new Error("HOLD_EXPIRED");

    // Charge outside any seat-row locks; idempotency key makes it retry-safe.
    const intent = await stripe.paymentIntents.create(
      { amount: hold.rows[0].amount, currency: "usd", confirm: true,
        payment_method: hold.rows[0].payment_method },
      { idempotencyKey: idemKey });

    await client.query(
      "UPDATE seats SET status = 'sold' WHERE hold_id = $1 AND status = 'held'", [holdId]);
    await client.query(
      "UPDATE holds SET state = 'converted' WHERE hold_id = $1", [holdId]);
    await client.query(
      "INSERT INTO orders (user_id, seat_ids, amount, payment_intent_id, idempotency_key, status) " +
      "VALUES ($1, $2, $3, $4, $5, 'paid')",
      [userId, hold.rows[0].seat_ids, hold.rows[0].amount, intent.id, idemKey]);
    await client.query("COMMIT");
    return { status: "paid" };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err; // reconciler replays confirms for succeeded charges
  } finally {
    client.release();
  }
}`,
        },
        {
          title: "Waiting-room gatekeeper (Redis sorted set admission)",
          language: "typescript",
          code: `import { createHmac, randomUUID } from "crypto";
import { redis } from "./redis";

const ADMIT_PER_SECOND = 50; // tune against measured hold-endpoint capacity

export async function joinQueue(eventId: string, userId: string) {
  await redis.zadd("wr:" + eventId, { score: Date.now(), member: userId });
}

export async function gatekeeperTick(eventId: string) {
  const admitted = await redis.zpopmin("wr:" + eventId, ADMIT_PER_SECOND);
  for (const { member: userId } of admitted) {
    const nonce = randomUUID();
    const exp = Date.now() + 10 * 60 * 1000;
    const payload = [eventId, userId, exp, nonce].join(".");
    const sig = createHmac("sha256", process.env.WR_SECRET!).update(payload).digest("hex");
    await redis.set("wrtok:" + nonce, userId, { ex: 600 }); // single-use marker
    await redis.set("wradmit:" + eventId + ":" + userId, payload + "." + sig, { ex: 600 });
  }
}

export async function verifyToken(token: string): Promise<boolean> {
  const parts = token.split(".");
  const sig = parts.pop();
  const [, , exp, nonce] = parts;
  const expected = createHmac("sha256", process.env.WR_SECRET!)
    .update(parts.join(".")).digest("hex");
  if (sig !== expected || Number(exp) < Date.now()) return false;
  const used = await redis.getdel("wrtok:" + nonce); // atomic single-use burn
  return used !== null;
}`,
        },
      ],
    },
  },
];
