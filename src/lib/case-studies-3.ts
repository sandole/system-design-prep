import type { CaseStudy } from "./types";

export const caseStudies3: CaseStudy[] = [
  {
    slug: "unique-id-generator",
    title: "Design a Unique ID Generator (Snowflake)",
    difficulty: "Easy",
    summary:
      "Design a service that hands out unique, roughly time-sorted 64-bit IDs at high throughput across many machines, in the style of Twitter Snowflake. The core challenge is generating IDs without coordination between nodes while keeping them sortable and collision-free.",
    functionalRequirements: [
      "Generate globally unique 64-bit numeric IDs with no duplicates across all machines.",
      "IDs must be roughly sortable by creation time so newer IDs compare greater than older ones.",
      "Support ID generation from many application servers or datacenters without a central coordinator on the hot path.",
      "Expose a simple API or library call that returns an ID in a single round trip or in-process call.",
      "Allow extracting the embedded timestamp from an ID for debugging and analytics.",
    ],
    nonFunctionalRequirements: [
      "Throughput of at least 10,000 IDs per second per machine, with headroom for bursts.",
      "Latency under 1 millisecond per ID, ideally an in-process call with no network hop.",
      "High availability: the generator must not become a single point of failure for every write in the system.",
      "Correctness under clock skew: NTP adjustments or leap seconds must never produce duplicate IDs.",
      "IDs should fit in a signed 64-bit integer so they work as primary keys in Postgres, MySQL, and Java longs.",
    ],
    backOfEnvelope: [
      {
        label: "Timestamp bits",
        value: "41 bits",
        note: "2^41 ms is about 69 years of millisecond timestamps from a custom epoch.",
      },
      {
        label: "Machine capacity",
        value: "4,096 IDs/ms",
        note: "12 sequence bits give 2^12 = 4,096 IDs per millisecond per worker.",
      },
      {
        label: "Peak per machine",
        value: "4.1M IDs/sec",
        note: "4,096 IDs/ms x 1,000 ms; far above any realistic single-node need.",
      },
      {
        label: "Worker ID space",
        value: "1,024 workers",
        note: "5 datacenter bits x 5 machine bits = 32 x 32 = 1,024 unique generators.",
      },
      {
        label: "Storage per ID",
        value: "8 bytes",
        note: "A UUID is 16 bytes; at 10B rows the 64-bit ID saves about 80 GB in the primary index alone.",
      },
    ],
    apiDesign: [
      {
        endpoint: "GET /v1/id",
        description:
          "Returns a single new 64-bit ID as a JSON string (stringified to avoid JavaScript number precision loss beyond 2^53).",
      },
      {
        endpoint: "GET /v1/ids?count=100",
        description:
          "Batch endpoint returning up to 1,000 IDs in one call so clients amortize network overhead.",
      },
      {
        endpoint: "GET /v1/id/{id}/decode",
        description:
          "Debug endpoint that unpacks an ID into its timestamp, datacenter ID, machine ID, and sequence number.",
      },
    ],
    highLevelDesign: [
      "The Snowflake layout packs four fields into one 64-bit integer: 1 unused sign bit, 41 bits of milliseconds since a custom epoch, 5 bits of datacenter ID, 5 bits of machine ID, and 12 bits of per-millisecond sequence. Because the timestamp occupies the high bits, IDs sort by creation time, which keeps B-tree inserts append-friendly and lets you paginate by ID instead of a separate created_at column.",
      "Each application server runs the generator as an in-process library. On startup it acquires a unique worker ID (datacenter + machine) from a small coordination store such as ZooKeeper, etcd, or even a database table with a unique constraint. After that, ID generation requires no network calls at all: the node reads its local clock, increments a sequence counter, and bit-shifts the fields together.",
      "Within one millisecond, the 12-bit sequence counter distinguishes IDs. If a node exhausts 4,096 IDs in a single millisecond, it spins until the next millisecond tick. Across milliseconds the counter resets to zero. Across machines, uniqueness comes from the worker ID bits, so two machines can never collide even at the exact same timestamp and sequence.",
      "Alternatives worth naming in an interview: UUIDv4 is coordination-free and simple but is 128 bits, random (terrible for B-tree locality), and not time-sortable; UUIDv7 fixes sortability but is still 16 bytes. A database ticket server (Flickr style) uses REPLACE INTO on an auto-increment table, which is simple but adds a network hop and a single point of failure, usually mitigated by two servers handing out odd and even IDs. Snowflake is the sweet spot when you need compact, sortable, high-throughput IDs.",
    ],
    dataModel: [
      {
        name: "worker_registry",
        fields: "worker_id, datacenter_id, machine_id, hostname, leased_until, created_at",
        note: "Stored in etcd or a small SQL table; each node leases a worker_id at boot and renews it.",
      },
      {
        name: "id_layout (conceptual)",
        fields: "sign(1), timestamp_ms(41), datacenter_id(5), machine_id(10 combined), sequence(12)",
        note: "Not a table; the bit layout of the 64-bit integer itself.",
      },
    ],
    deepDives: [
      {
        heading: "Handling clock skew and backwards clocks",
        body:
          "The generator trusts the local clock, so a backwards clock jump is the main correctness hazard. If NTP steps the clock back 50 ms, the node could re-issue timestamps it already used, and with a repeated sequence number that means duplicate IDs. The standard defense is to remember the last timestamp used: if the current clock reads earlier than that, either refuse to generate (throw and let the caller retry) or spin-wait until the clock catches up if the skew is small, say under 10 ms.\n\nOperationally, you prevent large jumps by running NTP in slew mode (which speeds up or slows down the clock gradually instead of stepping it) and by refusing to start the generator if the clock looks wildly wrong compared to the lease store. Some implementations also reserve a few bits or a fallback sequence range to survive small regressions without blocking.\n\nA subtler issue is worker ID reuse: if a node dies and another node takes its worker ID while the old process is still running (a zombie), both generate with the same worker bits. Leases with TTLs plus a startup wait of one lease period close this hole.",
      },
      {
        heading: "Why not just UUIDs or auto-increment",
        body:
          "UUIDv4 needs zero coordination and never blocks, which is genuinely attractive. The costs: 16 bytes instead of 8, no time ordering, and random inserts that scatter writes across the entire primary key B-tree, causing page splits and cache misses at scale. UUIDv7 embeds a millisecond timestamp in the high bits and largely fixes locality, so it is the modern default when 128 bits are acceptable.\n\nDatabase auto-increment is perfect on a single node but breaks under sharding: two shards will both hand out ID 1001. Workarounds include offset-and-stride (shard 1 issues 1, 3, 5 and shard 2 issues 2, 4, 6) or Flickr-style ticket servers, where a dedicated MySQL pair with auto_increment_increment=2 hands out blocks. Both add either operational rigidity or a network hop to every insert.\n\nSnowflake trades a small amount of setup complexity (worker ID assignment, clock discipline) for coordination-free generation, compact sortable IDs, and per-node throughput that no ticket server can match.",
      },
      {
        heading: "Choosing the bit budget",
        body:
          "The 41-5-5-12 split is a default, not a law. Every bit you move is a tradeoff along three axes: lifespan (timestamp bits), fleet size (worker bits), and burst rate (sequence bits). 41 timestamp bits from a 2020 epoch last until roughly 2089. If you only ever run 64 generators, you can shrink worker bits to 6 and give the extra bits to the sequence, doubling per-millisecond capacity.\n\nSome systems use second-level rather than millisecond timestamps with a much larger sequence, which tolerates coarse clocks better but weakens sort granularity. Instagram's variant uses 41 bits of time, 13 bits of logical shard ID, and 10 bits of a per-shard sequence generated inside Postgres itself, showing the same idea can live inside the database as a PL/pgSQL function.\n\nWhatever split you choose, publish it as a constant and never change it in place: reinterpreting the bits of already-issued IDs silently corrupts ordering and decoding.",
      },
    ],
    bottlenecks: [
      "Backwards clock jumps can cause duplicates; must track last timestamp and block or error on regression.",
      "Worker ID assignment is the one coordination point; a misconfigured duplicate worker ID silently produces collisions.",
      "The 4,096 per-millisecond sequence cap makes a single node spin under extreme bursts; batch requests or add nodes.",
      "JavaScript clients corrupt IDs above 2^53 if APIs return them as JSON numbers; always serialize as strings.",
      "A centralized ID service (instead of an in-process library) puts a network hop and a failure domain on every write path.",
    ],
    keyTakeaways: [
      "Uniqueness comes from partitioning the ID space (worker bits), not from coordination on the hot path.",
      "Time-sortable IDs double as creation timestamps and keep B-tree inserts sequential.",
      "Clock skew is the central failure mode; the last-timestamp guard is non-negotiable.",
      "Know the alternatives cold: UUIDv4 (simple, fat, unsorted), UUIDv7 (sorted, still 16 bytes), ticket servers (simple, centralized).",
      "Bit budgets are tunable: lifespan vs fleet size vs burst throughput.",
    ],
    relatedTopics: [
      "sharding-and-partitioning",
      "database-indexing",
      "scalability",
      "fault-tolerance",
      "consistency-and-cap",
    ],
    rapidImplementation: {
      stack: "Node.js (TypeScript) library + a 3-line etcd or Postgres worker-ID lease, embedded in any API server; zero extra infrastructure.",
      steps: [
        "Pick a custom epoch (e.g. 2024-01-01T00:00:00Z) and define the bit layout as constants: 41 timestamp, 10 worker, 12 sequence.",
        "Write the generator class with BigInt bit-shifting and a lastTimestamp guard that throws on clock regression.",
        "Create a worker_leases table in Postgres with a UNIQUE(worker_id) constraint; on boot, INSERT the first free ID in 0..1023 with a leased_until timestamp.",
        "Add a renewal loop that extends the lease every 30 seconds and kills the process if renewal fails twice.",
        "Wrap the generator in a GET /v1/id route that returns the ID as a string, plus a /decode route for debugging.",
        "Load test with autocannon at 50k req/sec and verify zero duplicates by inserting all IDs into a UNIQUE column.",
        "Add a unit test that mocks Date.now going backwards and asserts the generator throws instead of duplicating.",
      ],
      codeSketches: [
        {
          title: "Snowflake bit-packing generator",
          language: "typescript",
          code: `const EPOCH = 1704067200000n; // 2024-01-01 UTC
const WORKER_BITS = 10n;
const SEQ_BITS = 12n;
const MAX_SEQ = (1n << SEQ_BITS) - 1n; // 4095

export class Snowflake {
  private lastTs = -1n;
  private seq = 0n;
  constructor(private workerId: bigint) {
    if (workerId < 0n || workerId > 1023n) throw new Error("worker id out of range");
  }
  next(): bigint {
    let ts = BigInt(Date.now());
    if (ts < this.lastTs) throw new Error("clock moved backwards");
    if (ts === this.lastTs) {
      this.seq = (this.seq + 1n) & MAX_SEQ;
      if (this.seq === 0n) {
        while (ts <= this.lastTs) ts = BigInt(Date.now()); // spin to next ms
      }
    } else {
      this.seq = 0n;
    }
    this.lastTs = ts;
    return ((ts - EPOCH) << (WORKER_BITS + SEQ_BITS)) | (this.workerId << SEQ_BITS) | this.seq;
  }
}`,
        },
        {
          title: "Decode an ID back into its fields",
          language: "typescript",
          code: `const EPOCH_MS = 1704067200000; // must match the generator's epoch

export function decode(id: bigint) {
  const seq = id & 0xfffn;               // low 12 bits
  const workerId = (id >> 12n) & 0x3ffn; // next 10 bits
  const tsOffset = id >> 22n;            // high 41 bits
  const createdAtMs = Number(tsOffset) + EPOCH_MS;
  return {
    createdAt: new Date(createdAtMs),
    createdAtMs,
    workerId: Number(workerId),
    sequence: Number(seq),
  };
}`,
        },
        {
          title: "Worker ID lease in Postgres",
          language: "sql",
          code: `CREATE TABLE worker_leases (
  worker_id INT PRIMARY KEY CHECK (worker_id BETWEEN 0 AND 1023),
  hostname TEXT NOT NULL,
  leased_until TIMESTAMPTZ NOT NULL
);

-- Claim the first free or expired worker id atomically
INSERT INTO worker_leases (worker_id, hostname, leased_until)
SELECT gs.id, 'api-7', now() + interval '60 seconds'
FROM generate_series(0, 1023) AS gs(id)
WHERE NOT EXISTS (
  SELECT 1 FROM worker_leases w
  WHERE w.worker_id = gs.id AND w.leased_until > now()
)
ORDER BY gs.id
LIMIT 1
ON CONFLICT (worker_id) DO UPDATE
  SET hostname = EXCLUDED.hostname, leased_until = EXCLUDED.leased_until
  WHERE worker_leases.leased_until <= now()
RETURNING worker_id;`,
        },
      ],
    },
  },
  {
    slug: "distributed-cache",
    title: "Design a Distributed Cache (Redis)",
    difficulty: "Medium",
    summary:
      "Design a horizontally scalable in-memory key-value cache like Redis or Memcached that sits in front of a database. The interesting problems are how keys map to nodes (consistent hashing), what to evict when memory fills (LRU), how to survive node loss (replication), and how to avoid stampedes and hot keys melting single nodes.",
    functionalRequirements: [
      "GET, SET with TTL, and DELETE operations on string keys and binary-safe values.",
      "Distribute keys across N cache nodes and route each request to the right node client-side.",
      "Evict least recently used entries when a node reaches its memory limit.",
      "Support adding or removing nodes with minimal key redistribution.",
      "Optional read replicas per shard for failover and read scaling.",
    ],
    nonFunctionalRequirements: [
      "p99 latency under 1 ms for GET within the same datacenter.",
      "Sustain 100k+ operations per second per node; scale linearly by adding shards.",
      "Losing one node must not take the cache tier down and must invalidate at most 1/N of keys.",
      "Eventual consistency with the source of truth is acceptable; the database remains authoritative.",
      "Memory-bounded: hard cap per node with predictable eviction, never OOM.",
      "Cache failures must degrade to database reads, never to user-facing errors.",
    ],
    backOfEnvelope: [
      {
        label: "Working set",
        value: "200 GB",
        note: "100M cached objects x 2 KB average (key + value + overhead).",
      },
      {
        label: "Node count",
        value: "8 shards",
        note: "200 GB / 32 GB usable RAM per node (64 GB box, half reserved for spikes and fork copies) = 6.25, round to 8.",
      },
      {
        label: "Read throughput",
        value: "500k ops/sec",
        note: "50M DAU x 100 reads/day = 5B reads/day, about 58k/sec average, 10x peak = 580k/sec; 8 nodes at 100k each covers it.",
      },
      {
        label: "Hit ratio impact",
        value: "95% hits",
        note: "At 500k ops/sec, 95% hit ratio leaves 25k/sec on the database; at 90% it doubles to 50k/sec, so every hit-ratio point matters.",
      },
      {
        label: "Rebalance cost",
        value: "1/9 of keys",
        note: "With consistent hashing, adding a 9th node moves only about 11% of keys; naive mod-N hashing would remap about 89%.",
      },
    ],
    apiDesign: [
      {
        endpoint: "GET /cache/{key}",
        description:
          "Returns the value and remaining TTL, or 404 on miss. Client library hashes the key to pick the node before this call.",
      },
      {
        endpoint: "PUT /cache/{key}?ttl=300",
        description:
          "Sets a value with a TTL in seconds. Body is raw bytes. Overwrites move the entry to the head of the LRU list.",
      },
      {
        endpoint: "DELETE /cache/{key}",
        description: "Explicit invalidation, used by write-through paths after a database update.",
      },
      {
        endpoint: "GET /admin/ring",
        description:
          "Returns the current hash ring membership and virtual node layout so clients can refresh their routing table.",
      },
    ],
    highLevelDesign: [
      "Clients embed a smart library that owns routing: it hashes each key onto a consistent hash ring and talks directly to the owning node, so there is no central proxy to bottleneck. Each physical node is placed on the ring 100 to 200 times as virtual nodes, which smooths out load imbalance from an uneven hash distribution and lets heterogeneous machines take proportional shares.",
      "Each node is a single-threaded (or sharded-per-core) event loop over an in-memory hash map, paired with a doubly linked list for LRU ordering. Every GET moves the entry to the head; when memory passes the cap, the tail is evicted. TTLs are enforced lazily on read plus a background sampler that scans a few random keys per tick, which is how Redis actually does it.",
      "The dominant usage pattern is cache-aside: the application reads the cache, falls back to the database on a miss, then populates the cache with a TTL. Writes go to the database first and then delete (not update) the cache key, because delete-on-write avoids races where an older value overwrites a newer one. TTLs act as the safety net for any missed invalidation.",
      "For availability, each shard gets an async replica. On primary failure, a sentinel process (or the cluster's gossip protocol) promotes the replica and clients refresh the ring. Because replication is async, a promoted replica may serve slightly stale data, which is acceptable for a cache where the database is the source of truth.",
      "Two failure amplifiers get dedicated treatment: cache stampedes (thousands of concurrent misses on the same expired key all hitting the database) are handled with per-key mutex locks or probabilistic early refresh; hot keys (one celebrity key exceeding a single node's capacity) are handled with client-local caching and key duplication across nodes.",
    ],
    dataModel: [
      {
        name: "cache_entry (in-memory)",
        fields: "key, value_bytes, expires_at, lru_prev, lru_next, size_bytes",
        note: "Lives in a hash map; prev/next pointers thread it into the LRU list. No disk persistence needed for a pure cache.",
      },
      {
        name: "ring_config",
        fields: "node_id, host, port, vnode_count, status, updated_at",
        note: "Small config record in etcd or a config service; clients watch it to rebuild the ring on membership change.",
      },
      {
        name: "shard_stats",
        fields: "node_id, used_bytes, max_bytes, hits, misses, evictions, ops_per_sec",
        note: "Exported to the metrics system; hit ratio and eviction rate are the two alerts that matter.",
      },
    ],
    deepDives: [
      {
        heading: "Consistent hashing and virtual nodes",
        body:
          "Naive routing uses hash(key) mod N, but when N changes almost every key maps to a new node, so a single scale-out event flushes the whole cache and stampedes the database. Consistent hashing fixes this by hashing both nodes and keys onto a circular space (say 0 to 2^32); each key belongs to the first node clockwise from it. Adding a node steals keys only from its clockwise neighbor, about 1/N of the total.\n\nWith one point per physical node the ring is lumpy: random placement can give one node 3x the arc of another, and removing a node dumps its entire range onto a single neighbor. Virtual nodes solve both problems: each physical node claims 100+ points, so ranges average out statistically and a failed node's load spreads across many survivors instead of one.\n\nAn alternative worth mentioning is Rendezvous (highest random weight) hashing: for each key, score every node with hash(key, node) and pick the max. It gives perfect balance with no ring state, at O(N) per lookup, which is fine for small clusters and is simpler to implement correctly.",
      },
      {
        heading: "Cache stampede protection",
        body:
          "When a popular key expires, every concurrent request misses simultaneously and all of them query the database and recompute, which is exactly the load spike the cache existed to prevent. Three defenses stack well. First, per-key locking: the first miss acquires a short-lived lock (SET key_lock NX PX 3000 in Redis), recomputes, and fills the cache; other requests either wait briefly and re-read, or serve the stale value if you keep one.\n\nSecond, probabilistic early expiration (the XFetch algorithm): each reader recomputes before actual expiry with a probability that rises as the deadline approaches, scaled by how long the recompute takes. Statistically one client refreshes early and everyone else keeps hitting the warm entry, so the expiry cliff never happens.\n\nThird, for known-hot keys, do not let them expire at all: a background refresher recomputes them on a schedule and writes them with a long TTL as a crash backstop. This turns the read path into pure cache hits at the cost of a small always-on job.",
      },
      {
        heading: "Hot keys and skewed load",
        body:
          "Consistent hashing balances key counts, not key traffic. A single viral key (a celebrity profile, a flash-sale product) can drive more requests than one node can serve, and no amount of resharding helps because one key cannot be split by hashing. Detection comes first: sample requests client-side or track per-key counters with a count-min sketch to find the top-K keys cheaply.\n\nThe two standard fixes: replicate the hot key under derived names (key#1 through key#10, each hashing to a different node, readers pick one at random) so reads spread across 10 nodes; or cache it in-process in each application server with a very short TTL of 1 to 5 seconds, which removes the network hop entirely and typically absorbs 99% of the traffic to that key.\n\nThe tradeoff of both is staleness fan-out: invalidation now has to touch 10 copies, or wait out the local TTL. For read-heavy hot keys that change rarely, this is almost always the right trade.",
      },
      {
        heading: "Replication and failover semantics",
        body:
          "Cache replication is about availability, not durability: the goal is that losing a node costs you a hit-ratio dip on 1/N of keys, not an outage. Async primary-replica replication is standard; the replica applies the primary's write stream with some lag, and a monitor promotes it when the primary stops answering pings for a few seconds.\n\nThe classic hazard is split brain: a network partition makes the monitor promote the replica while the old primary still serves writes from clients that can reach it. For a cache this is survivable (worst case, stale reads until TTLs expire), which is why cache systems accept far looser failover semantics than databases. Redis Cluster requires a majority of masters to agree before failover, which bounds the damage.\n\nA pragmatic MVP skips replication entirely: on node death, clients treat its range as a miss and fall through to the database while the ring heals. Whether that is acceptable depends on whether your database can absorb 1/N of cache traffic for a few minutes; do that arithmetic before adding replicas.",
      },
    ],
    bottlenecks: [
      "Cache stampede on popular key expiry can multiply database load by 100x in milliseconds.",
      "Hot keys concentrate traffic on one node regardless of shard count; need detection plus key duplication or local caching.",
      "Full cache flush on deploy or mod-N rehashing causes a cold-start database hammering; consistent hashing and warmup are mandatory.",
      "Large values (over ~100 KB) block the single-threaded event loop and spike p99 for all keys on that node.",
      "Async replication lag means a failover can resurrect stale values; TTLs bound the staleness window.",
    ],
    keyTakeaways: [
      "Consistent hashing with virtual nodes is the core routing idea: membership changes move only 1/N of keys.",
      "LRU is a hash map plus a doubly linked list; every operation is O(1).",
      "Delete-on-write plus TTL backstop beats update-on-write for cache-aside correctness.",
      "Stampedes and hot keys are the two production killers; per-key locks and key duplication are the standard answers.",
      "A cache must fail open: any cache error degrades to a database read, never a user error.",
    ],
    relatedTopics: [
      "caching",
      "consistent-hashing",
      "replication",
      "sharding-and-partitioning",
      "probabilistic-data-structures",
    ],
    rapidImplementation: {
      stack: "Two Node.js (TypeScript) cache server processes + a client library with a consistent hash ring, all on a single $12 VPS; Postgres as the backing store.",
      steps: [
        "Build the LRU store class: Map for O(1) lookup, doubly linked list for recency order, maxBytes cap with tail eviction.",
        "Wrap it in a tiny TCP or HTTP server exposing GET, SET with TTL, and DELETE; run two instances on ports 7001 and 7002.",
        "Write the client library: build a ring of 128 virtual nodes per server using sha1(node + '#' + i), route each key with binary search over sorted ring points.",
        "Implement cache-aside in a demo API route: check cache, on miss query Postgres, SET with a 300 second TTL plus 10% random jitter.",
        "Add stampede protection: a per-key in-flight promise map in the client so concurrent misses for the same key share one database query.",
        "Kill one cache process while load testing and verify requests fall through to Postgres and the ring reroutes after the config refresh.",
        "Add a /stats endpoint per node (hits, misses, evictions) and confirm the hit ratio exceeds 90% under a zipfian load test.",
      ],
      codeSketches: [
        {
          title: "LRU cache with map + doubly linked list",
          language: "typescript",
          code: `interface Node { key: string; val: Buffer; expiresAt: number; prev: Node | null; next: Node | null; }

export class LRU {
  private map = new Map<string, Node>();
  private head: Node | null = null; // most recent
  private tail: Node | null = null; // least recent
  private used = 0;
  constructor(private maxBytes: number) {}

  get(key: string): Buffer | undefined {
    const n = this.map.get(key);
    if (!n) return undefined;
    if (n.expiresAt < Date.now()) { this.remove(n); return undefined; }
    this.remove(n); this.pushFront(n); // refresh recency
    return n.val;
  }
  set(key: string, val: Buffer, ttlMs: number) {
    const old = this.map.get(key);
    if (old) this.remove(old);
    const n: Node = { key, val, expiresAt: Date.now() + ttlMs, prev: null, next: null };
    this.pushFront(n);
    this.used += val.length + key.length;
    while (this.used > this.maxBytes && this.tail) this.remove(this.tail); // evict LRU
  }
  private pushFront(n: Node) {
    this.map.set(n.key, n);
    n.next = this.head; n.prev = null;
    if (this.head) this.head.prev = n;
    this.head = n;
    if (!this.tail) this.tail = n;
  }
  private remove(n: Node) {
    this.map.delete(n.key);
    this.used -= n.val.length + n.key.length;
    if (n.prev) n.prev.next = n.next; else this.head = n.next;
    if (n.next) n.next.prev = n.prev; else this.tail = n.prev;
  }
}`,
        },
        {
          title: "Consistent hash ring with virtual nodes",
          language: "typescript",
          code: `import { createHash } from "crypto";

function hash32(s: string): number {
  return createHash("sha1").update(s).digest().readUInt32BE(0);
}

export class Ring {
  private points: { h: number; node: string }[] = [];
  constructor(nodes: string[], vnodes = 128) {
    for (const node of nodes)
      for (let i = 0; i < vnodes; i++)
        this.points.push({ h: hash32(node + "#" + i), node });
    this.points.sort((a, b) => a.h - b.h);
  }
  lookup(key: string): string {
    const h = hash32(key);
    let lo = 0, hi = this.points.length - 1;
    while (lo < hi) { // first point with h >= key hash
      const mid = (lo + hi) >> 1;
      if (this.points[mid].h < h) lo = mid + 1; else hi = mid;
    }
    return this.points[this.points[lo].h >= h ? lo : 0].node; // wrap around
  }
}`,
        },
        {
          title: "Stampede protection via shared in-flight promise",
          language: "typescript",
          code: `const inflight = new Map<string, Promise<Buffer>>();

export async function getOrLoad(
  key: string,
  cacheGet: (k: string) => Promise<Buffer | undefined>,
  cacheSet: (k: string, v: Buffer, ttlMs: number) => Promise<void>,
  loadFromDb: (k: string) => Promise<Buffer>
): Promise<Buffer> {
  const hit = await cacheGet(key);
  if (hit) return hit;
  const pending = inflight.get(key);
  if (pending) return pending; // piggyback on the miss already in flight
  const p = (async () => {
    try {
      const val = await loadFromDb(key);
      const jitter = 1 + Math.random() * 0.1; // avoid synchronized expiry
      await cacheSet(key, val, Math.floor(300_000 * jitter));
      return val;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}`,
        },
      ],
    },
  },
  {
    slug: "instagram",
    title: "Design a Photo Sharing App (Instagram)",
    difficulty: "Medium",
    summary:
      "Design a photo sharing service where users upload images, follow each other, and scroll a reverse-chronological feed with likes and comments. The core problems are a reliable upload and resizing pipeline, feed generation at fan-out scale, CDN-fronted delivery, and counters that survive celebrity-level write rates.",
    functionalRequirements: [
      "Users can upload photos with a caption; uploads are processed into multiple sizes.",
      "Users can follow other users and see followed users' photos in a reverse-chronological feed.",
      "Users can like and comment on photos, with visible like and comment counts.",
      "Feed supports infinite scroll with cursor pagination.",
      "Users have profiles showing their own photo grid.",
    ],
    nonFunctionalRequirements: [
      "Feed load p99 under 500 ms; image bytes served from CDN edge in under 100 ms.",
      "Read-heavy: roughly 100 feed reads per photo upload, so optimize the read path.",
      "Uploads must be durable the moment the client gets a 200; resizing can lag by seconds.",
      "Eventual consistency is fine for feeds and counters; a like may take seconds to appear globally.",
      "Scale target: 10M DAU, 2M photos uploaded per day.",
      "No data loss for original images; store them redundantly.",
    ],
    backOfEnvelope: [
      {
        label: "Upload rate",
        value: "23 photos/sec avg, ~120/sec peak",
        note: "2M photos/day / 86,400 sec = 23/sec; 5x peak factor for evening hours.",
      },
      {
        label: "Blob storage growth",
        value: "~6 TB/day",
        note: "2M photos x (2 MB original + ~1 MB across resized variants) = 6 TB/day, about 2.2 PB/year.",
      },
      {
        label: "Feed read QPS",
        value: "~23k req/sec peak",
        note: "10M DAU x 20 feed fetches/day = 200M/day = 2.3k/sec average, 10x peak = 23k/sec.",
      },
      {
        label: "Fan-out write volume",
        value: "~4.6k feed inserts/sec",
        note: "23 uploads/sec x 200 median followers; a 10M-follower celebrity would need 10M inserts for one post, which is why celebrities get pull, not push.",
      },
      {
        label: "Metadata size",
        value: "~1 KB/photo row",
        note: "2M/day x 1 KB = 2 GB/day of Postgres rows; trivially shardable by photo id for years.",
      },
    ],
    apiDesign: [
      {
        endpoint: "POST /v1/photos/upload-url",
        description:
          "Returns a presigned S3 PUT URL and a photo_id. The client uploads bytes directly to object storage, keeping large payloads off the API servers.",
      },
      {
        endpoint: "POST /v1/photos/{photoId}/complete",
        description:
          "Client confirms the upload finished; server writes the metadata row with status uploaded and enqueues the resize job.",
      },
      {
        endpoint: "GET /v1/feed?cursor={photoId}&limit=20",
        description:
          "Returns the next feed page. Cursor is the last seen photo id (time-sortable Snowflake id), avoiding OFFSET pagination.",
      },
      {
        endpoint: "POST /v1/photos/{photoId}/like",
        description:
          "Idempotent like; inserts into the likes table and increments the counter asynchronously. DELETE on the same path unlikes.",
      },
      {
        endpoint: "POST /v1/photos/{photoId}/comments",
        description: "Adds a comment; returns the comment with its id for optimistic UI insertion.",
      },
    ],
    highLevelDesign: [
      "Uploads bypass the API tier: the client asks for a presigned URL, PUTs the original image straight to object storage (S3), then calls a completion endpoint. This makes uploads durable and cheap before any processing happens. The completion call writes a metadata row and drops a resize job onto a message queue, decoupling the user-facing latency from image processing.",
      "A pool of resize workers consumes the queue, downloads the original, and produces a ladder of variants (thumbnail 150px, feed 1080px, full size) in modern formats like WebP. Workers write variants back to S3 under deterministic keys and flip the photo's status to ready, at which point it becomes eligible for feeds. The queue gives you retries, backpressure, and horizontal scaling of workers for free.",
      "Feed generation uses a hybrid fan-out. For normal users (under ~10k followers), a post triggers fan-out-on-write: a worker inserts the photo id into a Redis list per follower, so reading a feed is a single list read plus a metadata multi-get. For celebrity accounts, fan-out-on-write would mean millions of inserts per post, so their posts are pulled at read time and merged into the precomputed list. This is the exact tradeoff interviewers want articulated.",
      "All image bytes are served through a CDN with the S3 bucket as origin. URLs are immutable and content-addressed (photo id + variant), so cache headers can be set to a year and the CDN hit ratio approaches 99%, which is what actually makes image delivery fast and cheap. The API tier only ever serves JSON.",
      "Likes and comments write to Postgres for truth (a likes table with a unique user-photo constraint gives idempotency) while a Redis counter serves the hot read path. Counter increments flow through the queue so a viral post's like storm becomes sequential queue consumption instead of row-lock contention on one photo row.",
    ],
    dataModel: [
      {
        name: "photos",
        fields: "photo_id (snowflake PK), user_id, caption, status, s3_key_original, variants_json, like_count, comment_count, created_at",
        note: "Counters here are periodically reconciled from the truth tables; the snowflake PK doubles as the feed cursor.",
      },
      {
        name: "follows",
        fields: "follower_id, followee_id, created_at",
        note: "PK (follower_id, followee_id); index on followee_id to enumerate followers during fan-out.",
      },
      {
        name: "likes",
        fields: "photo_id, user_id, created_at",
        note: "PK (photo_id, user_id) makes likes idempotent; count(*) here is the source of truth for reconciliation.",
      },
      {
        name: "comments",
        fields: "comment_id (snowflake PK), photo_id, user_id, body, created_at",
        note: "Indexed on (photo_id, comment_id) for cursor-paginated comment threads.",
      },
    ],
    deepDives: [
      {
        heading: "The upload and resizing pipeline",
        body:
          "The order of operations is what makes uploads reliable: durable bytes first (direct-to-S3 with a presigned URL), metadata second, processing third. If the resize worker crashes, the original is safe and the job retries; if the client dies mid-upload, no orphan metadata exists, and a scheduled sweep can delete unconfirmed S3 objects after 24 hours.\n\nResizing is embarrassingly parallel and belongs behind a queue. Each job produces every variant in one pass (decode once, encode many) because decoding the original dominates the cost. Workers should be idempotent: writing variants to deterministic keys means a retried job simply overwrites identical bytes. A poison-pill photo (corrupt JPEG that crashes the decoder) must go to a dead-letter queue after a few attempts rather than blocking the pipeline.\n\nA useful refinement is client-side resizing: the mobile app uploads a pre-shrunk 1080px version alongside the original request path, so the feed variant can be available near-instantly while the full ladder is processed in the background.",
      },
      {
        heading: "Fan-out on write vs fan-out on read",
        body:
          "Fan-out-on-write precomputes each user's feed: when someone posts, insert the photo id into every follower's feed list (Redis LPUSH plus LTRIM to cap length at a few hundred ids). Reads become O(1): one list read, one multi-get for metadata. The cost is write amplification proportional to follower count and wasted work for dormant followers.\n\nFan-out-on-read computes the feed at request time: fetch the recent photo ids of everyone you follow and merge-sort by id. Reads get expensive (hundreds of queries or a scatter-gather) but writes are O(1). Pure read-time fan-out cannot hit a 500 ms p99 at 23k req/sec without heavy caching.\n\nThe production answer is hybrid: push for the 99.9% of accounts with modest followings, pull for the few thousand celebrity accounts. At read time, merge the precomputed list with fresh posts from followed celebrities. Also skip fan-out for followers inactive for 30+ days and rebuild their feed lazily on next login, which cuts fan-out volume dramatically since most followers of large accounts are dormant.",
      },
      {
        heading: "Counters that survive viral posts",
        body:
          "A naive UPDATE photos SET like_count = like_count + 1 serializes on the row lock: a post receiving 10k likes/sec becomes a single-row contention point and p99 explodes. The truth should live in the likes table (idempotent inserts keyed by user and photo), with the displayed count maintained separately.\n\nThe standard pattern is buffered increments: likes enqueue an event, a consumer aggregates increments in memory for 100 ms or so, then applies one UPDATE of +N per photo per window, collapsing 10k row updates into 10. Meanwhile Redis INCR serves the displayed count with single-digit microsecond writes. A nightly reconciliation job recomputes counts from the likes table and repairs any drift from lost increments.\n\nExact counts stop mattering above roughly 10k; nobody notices 1,340,551 vs 1,340,570. That observation licenses aggressive batching and short-TTL caching of counts on hot posts, which is where all the load is anyway.",
      },
      {
        heading: "CDN strategy for image delivery",
        body:
          "Roughly 95% of Instagram's egress is image bytes, so the CDN is the real delivery system and everything else is metadata plumbing. The key enabler is immutability: a photo variant never changes after creation, so URLs like /photos/{id}/feed_1080.webp can carry cache-control max-age of one year, letting edge caches keep hit ratios near 99% and pulling origin traffic down to almost nothing.\n\nVariant selection belongs in the API response, not the edge: the feed JSON includes URLs for each size and the client picks based on viewport and network. Precomputing the ladder beats on-the-fly edge resizing for a feed product because the same few sizes are requested millions of times; on-demand transformation only wins for long-tail sizing needs.\n\nTwo practical notes: use signed URLs or signed cookies if private accounts must be enforced at the edge, and set S3 as a private origin reachable only by the CDN so nobody bypasses the cache and runs up your egress bill.",
      },
    ],
    bottlenecks: [
      "Celebrity fan-out: one post to 10M followers cannot be pushed synchronously; requires the hybrid push-pull split.",
      "Like-counter row contention on viral posts; solved with buffered increments and Redis-served counts.",
      "Resize queue backlog during upload spikes delays photo visibility; autoscale workers on queue depth.",
      "Feed metadata multi-get fans out to many DB shards; needs a cache layer in front of photo metadata.",
      "CDN cache misses on brand-new posts hit origin hardest exactly when a post is going viral; origin shielding mitigates.",
    ],
    keyTakeaways: [
      "Separate the byte path (client to S3 to CDN) from the metadata path (API to Postgres); they scale completely differently.",
      "Hybrid fan-out is the canonical answer: push to normal users' feed lists, pull from celebrities at read time.",
      "Make every pipeline step idempotent (presigned keys, deterministic variant names, unique like constraint) so retries are free.",
      "Counters: truth in a table, speed in Redis, reconciliation to fix drift.",
      "Immutable content-addressed URLs are what make a 99% CDN hit ratio possible.",
    ],
    relatedTopics: [
      "cdn",
      "message-queues",
      "caching",
      "sharding-and-partitioning",
      "storage-and-search",
    ],
    rapidImplementation: {
      stack: "Next.js API routes + Postgres + Redis + S3-compatible storage (Cloudflare R2, free egress) + sharp for resizing, on one $15 VPS.",
      steps: [
        "Create tables: users, photos, follows, likes, comments; snowflake-style BIGINT ids so ids double as time cursors.",
        "Build POST /photos/upload-url returning a presigned R2 PUT URL plus a new photo_id with status pending.",
        "Build POST /photos/:id/complete that marks status uploaded and pushes the photo_id onto a Redis list acting as the resize queue.",
        "Write a worker loop (BRPOP on the queue) that downloads the original, generates 150px and 1080px WebP variants with sharp, uploads them, and sets status ready.",
        "Implement fan-out on write: on status ready, LPUSH the photo_id to feed:{followerId} for each follower and LTRIM to 500 entries.",
        "Build GET /feed: LRANGE the caller's feed list from the cursor, multi-get photo rows, return JSON with R2 public URLs.",
        "Add like/unlike with INSERT ... ON CONFLICT DO NOTHING plus Redis INCR/DECR of likes:{photoId}; render counts from Redis.",
        "Point a Cloudflare domain at the R2 bucket with max-age 31536000 and verify repeat image loads hit the edge cache.",
      ],
      codeSketches: [
        {
          title: "Resize worker (queue consumer)",
          language: "python",
          code: `import io, json, time
import boto3, redis
from PIL import Image

r = redis.Redis()
s3 = boto3.client("s3", endpoint_url="https://<accountid>.r2.cloudflarestorage.com")
SIZES = {"thumb": 150, "feed": 1080}

def process(photo_id: str, key: str):
    raw = s3.get_object(Bucket="photos", Key=key)["Body"].read()
    img = Image.open(io.BytesIO(raw)).convert("RGB")  # decode once
    for name, width in SIZES.items():
        h = int(img.height * width / img.width)
        out = io.BytesIO()
        img.resize((width, h)).save(out, "WEBP", quality=82)
        variant_key = "photos/" + photo_id + "/" + name + ".webp"  # deterministic: retries overwrite
        s3.put_object(Bucket="photos", Key=variant_key, Body=out.getvalue(),
                      ContentType="image/webp", CacheControl="public, max-age=31536000, immutable")

while True:
    item = r.brpop("resize_queue", timeout=5)
    if not item:
        continue
    job = json.loads(item[1])
    try:
        process(job["photo_id"], job["s3_key"])
        r.lpush("fanout_queue", job["photo_id"])  # ready for feed fan-out
    except Exception:
        attempts = job.get("attempts", 0) + 1
        job["attempts"] = attempts
        target = "resize_dlq" if attempts >= 3 else "resize_queue"
        r.lpush(target, json.dumps(job))
        time.sleep(1)`,
        },
        {
          title: "Hybrid feed read (push list + celebrity pull)",
          language: "typescript",
          code: `async function getFeed(userId: string, cursor: bigint | null, limit = 20) {
  // 1. Precomputed ids from fan-out-on-write
  const pushedIds = (await redis.lrange("feed:" + userId, 0, 499))
    .map(BigInt)
    .filter((id) => cursor === null || id < cursor);

  // 2. Pull recent posts from followed celebrities (not fanned out)
  const celebs = await db.query(
    "SELECT f.followee_id FROM follows f JOIN users u ON u.id = f.followee_id " +
    "WHERE f.follower_id = $1 AND u.follower_count > 10000", [userId]);
  const celebIds: bigint[] = celebs.rows.length === 0 ? [] :
    (await db.query(
      "SELECT photo_id FROM photos WHERE user_id = ANY($1) AND status = 'ready' " +
      "AND ($2::bigint IS NULL OR photo_id < $2) ORDER BY photo_id DESC LIMIT $3",
      [celebs.rows.map((r: any) => r.followee_id), cursor, limit]
    )).rows.map((r: any) => BigInt(r.photo_id));

  // 3. Merge by id desc (snowflake ids sort by time) and hydrate
  const merged = [...new Set([...pushedIds, ...celebIds])]
    .sort((a, b) => (a > b ? -1 : 1))
    .slice(0, limit);
  const photos = await hydratePhotos(merged); // multi-get metadata + Redis counts
  return { photos, nextCursor: merged.length ? merged[merged.length - 1].toString() : null };
}`,
        },
        {
          title: "Idempotent like with buffered counter",
          language: "sql",
          code: `-- Truth: one row per (photo, user); re-likes are no-ops
INSERT INTO likes (photo_id, user_id, created_at)
VALUES ($1, $2, now())
ON CONFLICT (photo_id, user_id) DO NOTHING;

-- Batch applier: every 100 ms, collapse queued increments into one UPDATE per photo
UPDATE photos p
SET like_count = p.like_count + b.delta
FROM (VALUES ($1::bigint, $2::int)) AS b(photo_id, delta)
WHERE p.photo_id = b.photo_id;

-- Nightly reconciliation: repair drift from lost increments
UPDATE photos p
SET like_count = t.actual
FROM (SELECT photo_id, count(*) AS actual FROM likes GROUP BY photo_id) t
WHERE p.photo_id = t.photo_id AND p.like_count <> t.actual;`,
        },
      ],
    },
  },
  {
    slug: "google-docs",
    title: "Design a Collaborative Editor (Google Docs)",
    difficulty: "Hard",
    summary:
      "Design a real-time collaborative text editor where multiple users type into the same document simultaneously and everyone converges to the same content. The heart of the problem is concurrent edit reconciliation (operational transformation vs CRDTs), plus cursor presence, version history, and offline editing.",
    functionalRequirements: [
      "Multiple users edit the same document concurrently and all replicas converge to identical content.",
      "Edits from one user appear on other users' screens within a few hundred milliseconds.",
      "Show each collaborator's cursor position and selection in real time with a name label.",
      "Maintain version history with the ability to view and restore past snapshots.",
      "Support offline editing: queued local edits sync and merge when connectivity returns.",
      "Per-document access control (owner, editor, viewer).",
    ],
    nonFunctionalRequirements: [
      "Edit propagation latency under 300 ms for collaborators in the same region.",
      "Convergence is non-negotiable: all replicas must reach the same state regardless of message ordering (within the protocol's delivery guarantees).",
      "Local typing must never block on the network; edits apply optimistically at the local replica.",
      "Support up to ~100 concurrent editors per document; scale to millions of documents overall.",
      "Durability: an acknowledged edit survives server crashes (persisted op log).",
      "Session reconnects must resume cleanly from the last acknowledged revision.",
    ],
    backOfEnvelope: [
      {
        label: "Ops per document-second",
        value: "~25 ops/sec",
        note: "5 active typists x 5 keystrokes/sec; trivial per document, the challenge is correctness, not volume.",
      },
      {
        label: "Op message size",
        value: "~100 bytes",
        note: "Op type + position + character + revision + author; 25 ops/sec x 100 B = 2.5 KB/sec per hot document.",
      },
      {
        label: "Fan-out bandwidth",
        value: "~250 KB/sec per hot doc",
        note: "2.5 KB/sec x 100 connected clients; one WebSocket server core handles hundreds of hot documents.",
      },
      {
        label: "Op log growth",
        value: "~9 MB/hour of active editing",
        note: "25 ops/sec x 100 B x 3600; snapshot every 1,000 ops and archive older ops to keep replay under 100 ms.",
      },
      {
        label: "Platform scale",
        value: "~50k concurrent hot docs",
        note: "10M docs with 0.5% concurrently active; shard by document id so each doc's ops serialize through one server.",
      },
    ],
    apiDesign: [
      {
        endpoint: "WS /docs/{docId}/connect?rev=1042",
        description:
          "WebSocket session for a document. Client sends its last known revision; server replays missed ops, then streams live ops, acks, and presence updates.",
      },
      {
        endpoint: "WS message: {type:'op', baseRev, ops:[...]}",
        description:
          "Client submits an edit based on revision baseRev. Server transforms it against concurrent ops, assigns the next revision, acks the author, and broadcasts to others.",
      },
      {
        endpoint: "WS message: {type:'cursor', pos, selEnd}",
        description:
          "Ephemeral presence update; broadcast to peers, throttled to ~10/sec, never persisted.",
      },
      {
        endpoint: "GET /docs/{docId}/snapshot?rev=900",
        description:
          "Returns the document content at a revision, materialized from the nearest stored snapshot plus op replay; powers history view and restore.",
      },
      {
        endpoint: "POST /docs/{docId}/restore",
        description:
          "Restores an old version by appending inverse ops as a new edit, preserving the full history rather than rewriting it.",
      },
    ],
    highLevelDesign: [
      "The naive approach fails immediately: if Alice inserts at position 5 while Bob deletes at position 2, applying their raw operations in different orders yields different documents on each replica. Every collaborative editor is an answer to this concurrency problem, and the two established answers are operational transformation (OT) and conflict-free replicated data types (CRDTs).",
      "OT, the Google Docs approach, keeps operations position-based (insert 'x' at 5) and transforms them against concurrent operations before applying: if Bob's delete at 2 arrives first, Alice's insert shifts to position 4. OT is dramatically simpler when a central server serializes all operations into one canonical order: each client tracks the last server revision it has seen, sends ops against that revision, and the server transforms incoming ops over anything it accepted since. Clients symmetrically transform their unacknowledged local ops over incoming remote ops.",
      "CRDTs instead give every character a permanent unique identity (say, an author-counter pair plus a reference to its left neighbor), so operations commute by construction and no transformation or central sequencer is needed. This makes offline merge and peer-to-peer sync natural, at the price of per-character metadata and tombstones for deleted text. Modern implementations (Yjs, Automerge) compress the overhead well enough that CRDTs are now the default for new projects, while OT survives in systems that already have a central server and want minimal payloads.",
      "The serving architecture: each document is owned by exactly one WebSocket server (route by hashing document id at a connection gateway), which holds the document's hot state, orders or merges ops, appends them to a persisted op log, and broadcasts to subscribers. Snapshots every N ops bound recovery and history-replay time. If the owner dies, another server reloads snapshot plus op-log tail and clients reconnect with their last acked revision.",
      "Presence (cursors, selections, who's online) rides the same WebSocket but is ephemeral: throttled, broadcast, never written to the log. Cursor positions must be mapped through the same transform/identity machinery as text, otherwise remote cursors drift as text changes around them. With CRDTs this is elegant: a cursor is just a reference to a character id, so it survives any remote edit automatically.",
    ],
    dataModel: [
      {
        name: "documents",
        fields: "doc_id, owner_id, title, current_rev, latest_snapshot_rev, created_at, updated_at",
        note: "current_rev is the head of the op log; routing hashes doc_id to a WebSocket server.",
      },
      {
        name: "ops",
        fields: "doc_id, rev, author_id, op_json, created_at",
        note: "PK (doc_id, rev). The append-only source of truth; op_json holds insert/delete payloads.",
      },
      {
        name: "snapshots",
        fields: "doc_id, rev, content_blob, created_at",
        note: "Materialized every 1,000 ops; any revision = nearest earlier snapshot + replay of ops in between.",
      },
      {
        name: "doc_acl",
        fields: "doc_id, user_id, role, granted_by, created_at",
        note: "Role in (owner, editor, viewer); checked at WebSocket connect and on every mutating op.",
      },
    ],
    deepDives: [
      {
        heading: "OT vs CRDT: the real tradeoff",
        body:
          "OT's operations are small and human-readable (insert at index, delete range), the persisted log is compact, and intention preservation (what should happen when edits collide) is encoded explicitly in the transform functions. Its weakness is that correctness is notoriously subtle: transform functions must satisfy convergence properties (TP1, and TP2 for serverless topologies), and several published algorithms were later shown to violate them. Practical systems avoid the hard case entirely by forcing all ops through one server that defines a total order, which is exactly what Google Docs does.\n\nCRDTs move the cleverness from the algorithm to the data structure: each character carries an identity and ordering metadata, so concurrent inserts at the same place are ordered deterministically by comparing ids. Convergence is guaranteed by construction, offline and peer-to-peer merging need no special machinery, and there is no central sequencer requirement. The costs are metadata overhead, tombstones that must be retained or carefully garbage-collected, and interleaving anomalies in naive designs (two users' concurrent sentences shuffling character-by-character) that mature libraries mitigate.\n\nInterview guidance: OT if you have a central server anyway and want minimal storage and precise intention control; CRDT if offline-first, P2P, or implementation safety matters more, since a library like Yjs gives you proven convergence out of the box. Saying 'CRDT with a central relay server' is a perfectly modern answer that gets the best of both.",
      },
      {
        heading: "The server-serialized OT protocol",
        body:
          "The protocol that makes OT tractable has each client maintain three things: the last server revision it has synced to, at most one op in flight awaiting ack, and a buffer of local edits composed while waiting. The client applies local edits immediately (zero-latency typing), sends the in-flight op tagged with its base revision, and composes any further typing into the buffer.\n\nThe server holds the canonical op log. When an op arrives based on revision R but the log is at R+k, the server transforms the op over those k concurrent ops, appends the result as revision R+k+1, acks the author, and broadcasts to everyone else. Receiving clients transform the incoming op over their own in-flight and buffered ops before applying, and symmetrically transform their pending ops over it, so both sides account for each other exactly once.\n\nThis one-in-flight-op discipline (used by Google Wave and every derivative) matters: it bounds the transformation cases the client must handle and makes recovery simple. On reconnect, the client sends its last acked revision, receives the ops it missed, transforms its pending buffer over them, and resumes. Every message carries the revision number, which doubles as the idempotency key against duplicate delivery.",
      },
      {
        heading: "Offline edits and long-lived divergence",
        body:
          "Online, concurrent windows are milliseconds; offline, a user may accumulate hours of edits against a stale base revision. With OT, reconciliation means transforming the entire offline batch over every op the server accepted meanwhile, which is O(offline ops x missed ops) transform calls. It works, but a thousand offline edits against ten thousand missed ops is ten million transforms, so implementations compose offline edits into a compact form first and cap how stale a base revision can be before forcing a manual merge.\n\nCRDTs treat offline as the normal case: the offline replica just merges with the server state like any other sync, and convergence is automatic regardless of divergence duration. State-based sync with version vectors lets the two sides exchange only the ops the other has not seen. This asymmetry is the single strongest argument for CRDTs in any product where offline is a first-class feature.\n\nEither way, converged is not the same as semantically sensible: two users independently rewriting the same paragraph will merge into interleaved text that neither intended. Good products surface large offline merges to the user (show a diff, keep both versions in history) rather than pretending the algorithm resolved the human conflict.",
      },
      {
        heading: "Versioning, snapshots, and history",
        body:
          "The append-only op log is the natural spine for version history: any revision is reproducible as snapshot(rev <= r) plus replay of ops up to r. Snapshots every 1,000 ops (or every few minutes of activity) bound both crash recovery and history rendering to a bounded replay. Old ops can be compacted into coarser summary snapshots after 30 days if per-keystroke history is not required forever.\n\nRestore must not rewrite history: restoring revision 900 at head revision 1200 appends new ops that transform the head content into the revision-900 content (or with CRDTs, applies a computed diff as fresh edits). History stays linear and auditable, and a restore can itself be undone.\n\nAttribution falls out for free since every op carries its author: the history view can replay ops and color spans by author, and per-user undo works by inverting only your own ops and transforming the inverse over everything applied since, which is exactly how collaborative undo is built.",
      },
    ],
    bottlenecks: [
      "Per-document ordering serializes through a single owner server; a doc with hundreds of editors is a hard ceiling (mitigate by throttling, batching ops, or splitting the doc).",
      "OT transform storms on reconnect after long offline periods; requires op composition and staleness caps.",
      "CRDT tombstone and metadata growth in long-lived heavily edited documents; needs GC once all replicas have seen a deletion.",
      "Unthrottled cursor presence traffic can exceed the actual edit traffic; throttle to 10 updates/sec and coalesce.",
      "WebSocket server failover loses in-memory doc state; op-log persistence plus client resume-from-revision must be airtight or edits vanish.",
    ],
    keyTakeaways: [
      "State the core problem first: concurrent position-based edits do not commute, so you need OT (transform to a canonical order) or CRDT (make ops commute by giving characters identities).",
      "A central server makes OT simple: one canonical op order, clients keep one op in flight and transform the rest.",
      "CRDTs trade metadata overhead for guaranteed convergence and effortless offline merge; Yjs-style libraries make this the pragmatic modern default.",
      "The op log is the product: it gives you durability, history, restore, attribution, and undo in one structure.",
      "Convergence is a data-structure property; resolving human intent conflicts is a product decision, so surface big merges instead of hiding them.",
    ],
    relatedTopics: [
      "realtime-communication",
      "consistency-and-cap",
      "event-driven-architecture",
      "replication",
      "fault-tolerance",
    ],
    rapidImplementation: {
      stack: "Node.js + ws WebSocket server + Postgres op log, plain textarea client with vanilla TypeScript OT; runs on one $6 VPS.",
      steps: [
        "Create the docs, ops (PK doc_id + rev), and snapshots tables in Postgres.",
        "Define the op format as JSON: {retain n, insert 'text', delete n} segments over the whole document, plus baseRev and author.",
        "Implement transform(opA, opB) for insert/insert, insert/delete, and delete/delete cases with unit tests asserting both application orders converge.",
        "Build the WebSocket server: on connect, send snapshot plus ops since the client's revision; on op receipt, transform over concurrent ops, INSERT the op row, ack the author with the new rev, broadcast to others.",
        "Build the client sync loop: apply local edits to the textarea immediately, keep one op in flight, compose further edits into a buffer, transform pending ops over incoming remote ops.",
        "Map remote cursors: broadcast {pos} presence messages at most 10/sec and shift each remote cursor through the same transform as text.",
        "Add snapshotting every 200 ops and a /history page that replays ops from the nearest snapshot with a revision slider.",
        "Torture test: two headless clients firing random concurrent edits for 10,000 ops, assert final texts are byte-identical.",
      ],
      codeSketches: [
        {
          title: "OT transform for concurrent insert/delete",
          language: "typescript",
          code: `type Op =
  | { type: "insert"; pos: number; text: string; author: string }
  | { type: "delete"; pos: number; len: number; author: string };

// Transform opA so it applies correctly AFTER opB has been applied.
export function transform(a: Op, b: Op): Op {
  if (b.type === "insert") {
    const shift = b.text.length;
    if (a.type === "insert") {
      // Tie at same position: lower author id goes first (deterministic on all replicas)
      const aFirst = a.pos < b.pos || (a.pos === b.pos && a.author < b.author);
      return aFirst ? a : { ...a, pos: a.pos + shift };
    }
    if (a.pos >= b.pos) return { ...a, pos: a.pos + shift };
    if (a.pos + a.len <= b.pos) return a;
    return { ...a, len: a.len + shift }; // b inserted inside a's delete range
  }
  // b is a delete
  const bEnd = b.pos + b.len;
  if (a.type === "insert") {
    if (a.pos <= b.pos) return a;
    if (a.pos >= bEnd) return { ...a, pos: a.pos - b.len };
    return { ...a, pos: b.pos }; // a's insertion point was deleted
  }
  const aEnd = a.pos + a.len;
  if (aEnd <= b.pos) return a;
  if (a.pos >= bEnd) return { ...a, pos: a.pos - b.len };
  const overlap = Math.min(aEnd, bEnd) - Math.max(a.pos, b.pos);
  return { ...a, pos: Math.min(a.pos, b.pos), len: a.len - overlap };
}`,
        },
        {
          title: "Server: serialize, transform, ack, broadcast",
          language: "typescript",
          code: `async function handleClientOp(doc: DocState, client: Client, msg: { baseRev: number; op: Op }) {
  let op = msg.op;
  // Transform over every op accepted since the client's base revision
  const concurrent = doc.log.slice(msg.baseRev); // log[i] produced rev i+1
  for (const prior of concurrent) op = transform(op, prior.op);

  const rev = doc.log.length + 1;
  doc.content = applyOp(doc.content, op);
  doc.log.push({ rev, op, author: client.userId });
  await db.query(
    "INSERT INTO ops (doc_id, rev, author_id, op_json) VALUES ($1, $2, $3, $4)",
    [doc.id, rev, client.userId, JSON.stringify(op)]
  );

  client.send({ type: "ack", rev });                       // author advances baseRev
  for (const peer of doc.clients) {
    if (peer !== client) peer.send({ type: "op", rev, op }); // others transform locally
  }
  if (rev % 200 === 0) await saveSnapshot(doc.id, rev, doc.content);
}`,
        },
        {
          title: "Client: one op in flight, compose while waiting",
          language: "typescript",
          code: `class ClientSync {
  rev = 0;                    // last server revision synced
  inflight: Op | null = null; // sent, awaiting ack
  buffer: Op[] = [];          // local edits composed while waiting

  localEdit(op: Op) {
    applyToEditor(op);        // optimistic: typing never waits on the network
    this.buffer.push(op);
    this.flush();
  }
  private flush() {
    if (this.inflight || this.buffer.length === 0) return;
    this.inflight = this.buffer.shift()!;
    ws.send(JSON.stringify({ type: "op", baseRev: this.rev, op: this.inflight }));
  }
  onServerMessage(msg: any) {
    if (msg.type === "ack") { this.rev = msg.rev; this.inflight = null; this.flush(); return; }
    // Remote op: transform it over our pending ops, and our pending ops over it
    let remote: Op = msg.op;
    const pending = [this.inflight, ...this.buffer].filter((o): o is Op => o !== null);
    for (let i = 0; i < pending.length; i++) {
      const mine = pending[i];
      pending[i] = transform(mine, remote);
      remote = transform(remote, mine);
    }
    if (this.inflight) this.inflight = pending[0];
    this.buffer = pending.slice(this.inflight ? 1 : 0);
    applyToEditor(remote);
    this.rev = msg.rev;
  }
}`,
        },
      ],
    },
  },
];
