import type { Topic } from "./types";

export const dataTopics: Topic[] = [
  {
    slug: "caching",
    title: "Caching",
    category: "Data",
    summary:
      "Caching stores frequently accessed data in a fast layer (usually memory) to cut latency and shield backing stores from load. It is often the single highest-leverage optimization in a system design interview.",
    sections: [
      {
        heading: "Why caching matters",
        body:
          "The core motivation is the latency gap between storage tiers. Reading from L1 cache takes about 1 nanosecond, main memory about 100 nanoseconds, an SSD around 100 microseconds, and a cross-region network round trip 100 milliseconds or more. A Redis GET served from RAM in the same datacenter typically returns in under 1 millisecond, while the equivalent SQL query with joins might take 10 to 50 milliseconds under load. Caching converts expensive repeated work into cheap lookups.\n\nCaching also protects the database. If 90 percent of reads hit the cache, the database sees only 10 percent of traffic, which often means the difference between one Postgres primary and a fleet of read replicas. Real systems lean on this heavily: Facebook's memcache tier famously serves billions of requests per second so that MySQL only handles the misses.\n\nThe tradeoff is staleness. Any cache is a copy of data that can drift from the source of truth, so every caching discussion in an interview should address invalidation and acceptable staleness for the specific use case.",
      },
      {
        heading: "Caching strategies: cache-aside, read-through, write-through, write-back",
        body:
          "Cache-aside (lazy loading) is the most common pattern. The application checks the cache first; on a miss it reads the database, then writes the value into the cache with a TTL. It is simple and only caches data that is actually requested, but the first request after expiry always pays the miss penalty, and application code owns the consistency logic.\n\nRead-through moves the loading logic into the cache layer itself: the application always talks to the cache, and the cache fetches from the database on a miss. Write-through writes to the cache and the database synchronously on every write, keeping the cache fresh at the cost of higher write latency and caching data that may never be read.\n\nWrite-back (write-behind) acknowledges the write once it lands in the cache and flushes to the database asynchronously, often batched. This gives excellent write throughput and absorbs spikes, but risks data loss if the cache node dies before the flush. It suits metrics, counters, and like counts, where losing a few seconds of writes is tolerable, and is the same idea a database uses internally with its buffer pool.",
      },
      {
        heading: "Eviction and invalidation",
        body:
          "Caches are smaller than the datasets they front, so something must be evicted. LRU (least recently used) evicts the entry idle the longest and works well when recent access predicts future access. LFU (least frequently used) keeps hot keys even if they were not touched in the last few seconds, which handles scan-heavy workloads better but is costlier to track. Redis implements approximated LRU and LFU by sampling keys rather than maintaining exact ordering, and also supports TTL-based expiry and random eviction.\n\nInvalidation is the harder problem. TTLs bound staleness cheaply: a 60 second TTL means at most 60 seconds of stale reads. Explicit invalidation (delete the key on write) gives fresher data but must handle race conditions, for example a read that fetches an old value from the database and writes it to the cache just after an invalidation. A common mitigation is to delete rather than update the cache on writes, and rely on the next read to repopulate.\n\nA subtle failure mode is the thundering herd (cache stampede): a hot key expires and thousands of concurrent requests all miss and hammer the database simultaneously. Mitigations include per-key locking so only one request recomputes while others wait, probabilistic early refresh before expiry, jittered TTLs so keys do not expire in unison, and serving slightly stale data while a background refresh runs.",
      },
      {
        heading: "Multi-tier caching and technology choices",
        body:
          "Real systems cache at several layers. The browser caches static assets via Cache-Control headers, a CDN like CloudFront or Cloudflare caches at edge locations near users, the application tier caches in-process (a Guava or Caffeine map) and in a shared store like Redis, and the database caches pages in its buffer pool. Each layer trades freshness for latency: a CDN can serve an image in 20 milliseconds from an edge POP versus 200 milliseconds from origin across an ocean.\n\nRedis versus Memcached is a classic comparison. Memcached is a simple, multi-threaded, in-memory key-value store that excels at raw string caching. Redis is single-threaded per core for command execution but offers rich data structures (sorted sets for leaderboards, hashes, streams), persistence via RDB snapshots and AOF logs, replication, Lua scripting, and clustering. Most teams today default to Redis for its versatility; Memcached still wins for simple, huge, multi-threaded object caches.\n\nIn-process caches are the fastest (no network hop, sub-microsecond) but each app instance holds its own copy, so a fleet of 100 servers has 100 potentially inconsistent caches and a cold cache after every deploy. A shared Redis tier adds roughly 0.5 to 1 millisecond per lookup but gives one consistent view. Many systems layer both: a small in-process cache with a very short TTL in front of Redis.",
      },
    ],
    keyPoints: [
      "Cache-aside is the default pattern: check cache, on miss read DB and populate; simple but the app owns consistency.",
      "Write-back gives the best write throughput but risks losing acknowledged writes if the cache node fails before flushing.",
      "Eviction (LRU/LFU) decides what to drop when full; invalidation (TTL or explicit delete) decides how stale data can get.",
      "Thundering herd: a hot key expiring can stampede the database; fix with request coalescing, jittered TTLs, or stale-while-revalidate.",
      "Cache at multiple tiers: browser, CDN, in-process, shared Redis, DB buffer pool; each trades freshness for latency.",
      "A 90 percent hit rate cuts database read load by 10x, often the difference between one primary and a replica fleet.",
    ],
    tradeoffs: [
      {
        option: "Cache-aside with TTL",
        pros: [
          "Simple to implement and reason about",
          "Only caches data that is actually read",
          "Cache failure degrades to slower reads, not errors",
        ],
        cons: [
          "First read after expiry pays full miss latency",
          "Staleness up to the TTL window",
          "Susceptible to stampedes on hot key expiry",
        ],
      },
      {
        option: "Write-through",
        pros: [
          "Cache is always consistent with the database",
          "Reads never see stale data from this path",
        ],
        cons: [
          "Every write pays double latency (cache plus DB)",
          "Caches data that may never be read, wasting memory",
        ],
      },
      {
        option: "Write-back (write-behind)",
        pros: [
          "Lowest write latency; absorbs write spikes via batching",
          "Great for high-frequency counters and metrics",
        ],
        cons: [
          "Acknowledged writes can be lost on cache node failure",
          "More complex failure and recovery semantics",
        ],
      },
    ],
    interviewTips: [
      "Always state what happens on a cache miss and on a write; interviewers probe the consistency path, not the happy path.",
      "Quantify the win: estimate hit rate and show how it reduces DB QPS (e.g., 100k reads/s at 95 percent hit rate leaves 5k/s for Postgres).",
      "Bring up thundering herd unprompted when you place a TTL on a hot key; proposing jitter plus request coalescing signals seniority.",
      "Match the pattern to the data: write-back for like counters, cache-aside for user profiles, CDN for static assets.",
    ],
    related: ["cdn", "database-indexing", "consistent-hashing", "performance-metrics"],
  },
  {
    slug: "sql-vs-nosql",
    title: "SQL vs NoSQL",
    category: "Data",
    summary:
      "Choosing between relational and non-relational databases is a foundational interview decision. The right answer depends on data shape, query patterns, consistency needs, and scale, not fashion.",
    sections: [
      {
        heading: "Relational databases and ACID",
        body:
          "Relational databases (Postgres, MySQL) store data in tables with enforced schemas, and their superpower is ACID transactions: atomicity (all or nothing), consistency (constraints hold), isolation (concurrent transactions behave as if serial), and durability (committed data survives crashes). Transferring money between accounts, decrementing inventory while creating an order, or any multi-row invariant is dramatically simpler with ACID.\n\nSQL also gives you joins, secondary indexes, and ad hoc queries. When product requirements change and someone asks for a new report, a relational schema usually answers it with a query rather than a data migration. A single well-tuned Postgres instance on modern hardware comfortably handles 10,000 to 50,000 transactions per second and terabytes of data, which covers the vast majority of businesses.\n\nThe scaling story is the traditional weakness: relational databases scale vertically first, then via read replicas, and only painfully via sharding. Modern answers like Vitess (which shards MySQL and runs YouTube-scale workloads), Citus for Postgres, and NewSQL systems like CockroachDB and Spanner have narrowed this gap considerably.",
      },
      {
        heading: "The NoSQL families",
        body:
          "NoSQL is four distinct families, and interviewers expect you to distinguish them. Document stores (MongoDB, CouchDB) hold JSON-like documents with flexible schemas, ideal when entities are self-contained and read together, such as a product with its variants and reviews embedded. Key-value stores (DynamoDB, Redis) offer the simplest model, get and put by key, with predictable single-digit millisecond latency at any scale; DynamoDB famously served over 89 million requests per second during Amazon Prime Day.\n\nWide-column stores (Cassandra, HBase, Bigtable) organize data into partitions of ordered rows, optimized for massive write throughput and range scans within a partition. Cassandra's masterless design lets it ingest hundreds of thousands of writes per second across commodity nodes, which is why it backs time-series and messaging workloads: Discord stored trillions of messages on Cassandra before migrating to ScyllaDB, a compatible rewrite.\n\nGraph databases (Neo4j, Amazon Neptune) model nodes and edges directly, so multi-hop traversals like friends-of-friends-of-friends run in milliseconds where the equivalent SQL requires exploding self-joins. They shine for fraud rings, recommendations, and social graphs, but are a poor fit for bulk analytics or simple CRUD.",
      },
      {
        heading: "BASE and the consistency spectrum",
        body:
          "Many NoSQL systems trade ACID for BASE: Basically Available, Soft state, Eventually consistent. Instead of guaranteeing every read sees the latest write, they guarantee availability and let replicas converge over time. A Cassandra write at consistency level ONE is acknowledged by a single replica and propagates to others asynchronously; a reader hitting a different replica milliseconds later may see the old value.\n\nEventual consistency is not lawless. Systems offer tunable knobs: Cassandra lets you set read and write quorums per query (writes at QUORUM plus reads at QUORUM gives strongly consistent behavior for that key), and DynamoDB offers strongly consistent reads at double the cost and roughly half the throughput of eventually consistent ones. DynamoDB also added ACID transactions across items in 2018, and MongoDB added multi-document transactions in version 4.0, so the old bright line has blurred.\n\nThe interview skill is mapping consistency needs to features: a shopping cart can tolerate eventual consistency (Amazon's original Dynamo paper literally used the cart as its example, resolving conflicts by merging), while a payment ledger cannot.",
      },
      {
        heading: "How to choose in an interview",
        body:
          "Start from access patterns, not technology. If you need flexible ad hoc queries, joins across entities, and transactional invariants, and your scale fits a single primary plus replicas, pick Postgres and say why. It is a strong senior signal to default to relational and justify NoSQL only when a concrete pressure demands it.\n\nReach for NoSQL when you have a specific forcing function: a write rate or dataset size that requires horizontal scale-out across dozens of nodes (Cassandra, DynamoDB), a strict low-latency key lookup SLA at massive scale (DynamoDB, Redis), genuinely schema-less or rapidly evolving documents (MongoDB), or traversal-heavy graph queries (Neo4j). Name the access pattern first, then the store.\n\nPolyglot persistence is the realistic endgame: an e-commerce system might keep orders and payments in Postgres, the product catalog in a document store or search index, sessions in Redis, and clickstream events in Cassandra. Acknowledge the operational cost of running multiple databases; every additional store is another system to secure, back up, and page on.",
      },
    ],
    keyPoints: [
      "SQL gives ACID transactions, joins, and ad hoc queries; default to it unless a concrete scale or model pressure says otherwise.",
      "NoSQL is four families with different sweet spots: document (MongoDB), key-value (DynamoDB, Redis), wide-column (Cassandra), graph (Neo4j).",
      "BASE trades immediate consistency for availability and scale; many stores offer tunable consistency (quorum reads/writes) per request.",
      "Wide-column stores like Cassandra excel at write-heavy, partition-scannable workloads such as time series and message history.",
      "The lines have blurred: DynamoDB and MongoDB support transactions; Vitess, Citus, and Spanner scale SQL horizontally.",
      "Choose by access pattern and consistency requirement, then name the store; polyglot persistence is normal at scale.",
    ],
    tradeoffs: [
      {
        option: "Relational (Postgres, MySQL)",
        pros: [
          "ACID transactions and enforced schema protect invariants",
          "Joins and flexible querying adapt to changing requirements",
          "Mature ecosystem, tooling, and hiring pool",
        ],
        cons: [
          "Horizontal write scaling requires sharding, which is operationally painful",
          "Schema migrations on huge tables need care (locking, backfills)",
          "Rigid schema can slow iteration on document-shaped data",
        ],
      },
      {
        option: "Wide-column / key-value NoSQL (Cassandra, DynamoDB)",
        pros: [
          "Near-linear horizontal scaling for writes and storage",
          "Predictable low-latency lookups at massive scale",
          "High availability by design, often across regions",
        ],
        cons: [
          "Query patterns must be designed up front; no ad hoc joins",
          "Eventual consistency pushes conflict handling into the application",
          "Secondary access patterns often require duplicating data into new tables or indexes",
        ],
      },
    ],
    interviewTips: [
      "Never say 'NoSQL scales better' without specifying the family and the access pattern that drives the choice.",
      "State your consistency requirement first (e.g., 'payments need serializable transactions'), then let the database follow from it.",
      "Show you know the blurred lines: DynamoDB transactions, MongoDB 4.0 multi-document transactions, Vitess sharding MySQL.",
      "If you pick NoSQL, immediately describe the table/partition design for your top two queries; that is where interviewers dig.",
    ],
    related: ["database-indexing", "sharding-and-partitioning", "consistency-and-cap", "replication"],
  },
  {
    slug: "database-indexing",
    title: "Database Indexing",
    category: "Data",
    summary:
      "Indexes trade extra storage and write cost for dramatically faster reads. Understanding B-trees versus LSM trees and index design (composite, covering) explains most real-world database performance behavior.",
    sections: [
      {
        heading: "Why indexes exist",
        body:
          "Without an index, finding a row means a full table scan: O(n) pages read from disk. On a 100 million row table that can mean seconds of I/O per query. An index is a separate structure, sorted or hashed by the indexed columns, that lets the database locate matching rows in O(log n) page reads, typically 3 to 4 for a B-tree even on very large tables.\n\nThe cost is paid on writes. Every INSERT, UPDATE, or DELETE must also update every index on the table, so a table with six indexes does roughly seven writes per logical write. Indexes also consume storage, often 20 to 50 percent of table size each, and they occupy buffer pool memory that could cache table data. The design skill is indexing the queries you actually run and nothing more.\n\nA useful interview framing: an index is a materialized sort order. Any question of the form 'find rows where X equals or is between values' benefits from a structure sorted by X.",
      },
      {
        heading: "B-trees: the read-optimized default",
        body:
          "The B-tree (technically B+ tree in most databases) is the default index in Postgres, MySQL InnoDB, Oracle, and SQL Server. It is a balanced tree of fixed-size pages (commonly 8 or 16 KB) where internal nodes hold routing keys and leaf nodes hold the indexed values in sorted order, linked for range scans. With a branching factor of a few hundred, a 4-level B-tree addresses billions of rows, so a point lookup costs about 4 page reads, most of which are usually cached.\n\nB-trees update in place: a write finds the target leaf page and modifies it, with occasional page splits when a page fills. This gives strong, predictable read performance and efficient range queries (WHERE created_at BETWEEN two timestamps walks linked leaves sequentially). Writes involve random I/O across the tree, which historically was the bottleneck on spinning disks and still causes write amplification through the write-ahead log plus dirty page flushes.\n\nInnoDB adds a wrinkle worth knowing: the table itself is stored as a B-tree clustered on the primary key, and secondary indexes store the primary key as their pointer. This makes primary key lookups very fast, but a long primary key inflates every secondary index, and random primary keys (like UUIDv4) cause page splits and cache misses; sequential IDs or UUIDv7 insert much more gracefully.",
      },
      {
        heading: "LSM trees: the write-optimized alternative",
        body:
          "Log-structured merge trees power Cassandra, RocksDB, LevelDB, HBase, and the storage engines behind many modern systems. Writes go to an in-memory sorted structure (the memtable) and an append-only commit log; when the memtable fills (say, 64 MB) it is flushed to disk as an immutable sorted file (an SSTable). Background compaction merges SSTables, discarding overwritten and deleted entries.\n\nThis makes writes sequential and fast: an LSM engine can sustain write throughput several times higher than a B-tree because it never updates pages in place. The price is read amplification: a point read may need to check the memtable plus several SSTables across levels. Bloom filters mitigate this by letting the engine skip SSTables that definitely do not contain the key, cutting most negative lookups to zero disk reads.\n\nCompaction is the operational heart of an LSM system. It causes write amplification (the same data is rewritten each time it moves down a level, commonly 10x to 30x total) and consumes I/O bandwidth that can spike read latencies, which is why Cassandra operators care about compaction strategy (size-tiered for write-heavy, leveled for read-heavy). The rule of thumb: B-trees for read-heavy and range-heavy relational workloads, LSM trees for write-heavy, append-mostly workloads.",
      },
      {
        heading: "Composite, covering, and specialized indexes",
        body:
          "A composite index sorts by multiple columns in order, like (user_id, created_at). The leftmost-prefix rule governs its use: this index accelerates queries filtering on user_id alone, or user_id plus created_at, but not created_at alone, because the data is sorted by user_id first. Column order matters: put equality-filtered columns first and range-filtered or sort columns last, so an index on (user_id, created_at) perfectly serves 'the 20 most recent posts by user X'.\n\nA covering index includes every column a query needs, letting the database answer from the index alone without touching the table (an index-only scan). If a query selects only user_id and email, an index on (user_id) INCLUDE (email) in Postgres avoids the heap fetch entirely, often turning a 50 millisecond query into a 2 millisecond one. The tradeoff is a fatter index and more write overhead.\n\nBeyond B-trees, know the specialized options at a sentence each: hash indexes for pure equality lookups, GIN indexes in Postgres for JSONB and full-text search, partial indexes that only cover rows matching a predicate (for example only unshipped orders, keeping the index tiny), and geospatial indexes (R-trees, or geohash-based schemes) for location queries.",
      },
    ],
    keyPoints: [
      "Indexes convert O(n) scans into O(log n) lookups but tax every write and consume storage and cache; index only real query patterns.",
      "B-trees update in place and excel at reads and range scans; they are the default in Postgres and MySQL.",
      "LSM trees turn writes into sequential appends plus background compaction, trading read and write amplification for high write throughput (Cassandra, RocksDB).",
      "Composite indexes follow the leftmost-prefix rule; order columns as equality filters first, then range or sort columns.",
      "Covering indexes let queries be answered entirely from the index, eliminating table lookups.",
      "Bloom filters are how LSM engines avoid checking every SSTable on point reads.",
    ],
    tradeoffs: [
      {
        option: "B-tree storage engine",
        pros: [
          "Fast, predictable point reads (3 to 4 page reads)",
          "Efficient range scans via sorted, linked leaf pages",
          "Mature transactional integration in relational databases",
        ],
        cons: [
          "Random-I/O writes and page splits limit write throughput",
          "In-place updates complicate crash recovery (needs WAL)",
        ],
      },
      {
        option: "LSM-tree storage engine",
        pros: [
          "Sequential writes sustain very high ingest rates",
          "Immutable SSTables compress well and simplify backups",
        ],
        cons: [
          "Read amplification: point reads may consult multiple SSTables",
          "Compaction causes 10x-30x write amplification and background I/O spikes",
        ],
      },
      {
        option: "Adding more indexes to a table",
        pros: [
          "Each well-chosen index can speed a query class by orders of magnitude",
          "Covering indexes can eliminate table access entirely",
        ],
        cons: [
          "Every index slows every write to the table",
          "Unused indexes waste storage and buffer pool memory",
        ],
      },
    ],
    interviewTips: [
      "When you propose a table, immediately state its indexes and which query each serves; unmotivated indexes are a red flag.",
      "Explain the leftmost-prefix rule with a concrete query; it is the most common indexing follow-up question.",
      "Contrast B-tree vs LSM when the workload is write-heavy (metrics, events, messages); choosing Cassandra implicitly chooses LSM.",
      "Mention write amplification as the reason you would not put ten indexes on a high-write table.",
    ],
    related: ["sql-vs-nosql", "storage-and-search", "caching", "performance-metrics"],
  },
  {
    slug: "sharding-and-partitioning",
    title: "Sharding and Partitioning",
    category: "Data",
    summary:
      "Partitioning splits data across machines when one node can no longer hold or serve it. The choice of partition key and strategy determines load balance, query flexibility, and how painful growth becomes.",
    sections: [
      {
        heading: "Vertical vs horizontal partitioning",
        body:
          "Vertical partitioning splits by columns or by domain: move the profiles tables to one database and the orders tables to another, or split rarely used blob columns into a side table. This is often the first scaling step and aligns naturally with a move toward services owning their own data. Its ceiling is obvious: the busiest single table still lives on one machine.\n\nHorizontal partitioning (sharding) splits rows of the same table across nodes by a partition key, so users 1 to 10 million live on shard A and the next 10 million on shard B. This is how systems scale writes and storage past a single machine: each shard handles a fraction of traffic and data. A single Postgres node might comfortably serve 20,000 writes per second; sixteen shards raise that ceiling to the low hundreds of thousands.\n\nSharding is a last resort for relational data because it breaks things you take for granted: cross-shard joins, cross-shard transactions, unique constraints across the dataset, and autoincrement IDs. Interviewers reward candidates who exhaust vertical scaling, read replicas, and caching before reaching for shards, and who then choose the partition key deliberately.",
      },
      {
        heading: "Hash, range, and directory sharding",
        body:
          "Hash sharding applies a hash to the partition key and assigns the result to a shard, for example hash(user_id) mod 16. It distributes load evenly and is the default for key-addressed workloads, but it destroys ordering: a range query like 'all orders from last week' must scatter to every shard and gather results. Naive modulo also reshuffles almost every key when the shard count changes, which is the problem consistent hashing solves.\n\nRange sharding assigns contiguous key ranges to shards, as HBase and Bigtable do and as DynamoDB does within partitions. Range queries become cheap single-shard scans, but poorly chosen keys create hot spots: sharding by timestamp sends every current write to the newest shard while the others sit idle. Range-sharded systems typically auto-split hot ranges, but a monotonically increasing key defeats even that.\n\nDirectory-based sharding keeps an explicit lookup service mapping keys or tenants to shards. It offers maximum flexibility, for example pinning a huge enterprise tenant to its own dedicated shard, or moving a tenant during rebalancing by updating one row. The costs are an extra hop on every request and the directory becoming a critical dependency that must itself be cached and replicated. Slack and many B2B SaaS products use variants of this for tenant placement.",
      },
      {
        heading: "Hot spots and the celebrity problem",
        body:
          "Even a perfect hash distributes keys evenly, not load. If one key is orders of magnitude hotter than the rest, its shard melts while others idle. The canonical example is the celebrity problem: a social network shards by user_id, and a celebrity with 100 million followers turns every post into a write fan-out storm and their profile into a read hot spot on one unlucky shard.\n\nStandard mitigations: cache hot keys aggressively in front of the shards (a celebrity profile is highly cacheable); split a hot key by appending a random suffix, writing to celebrity_id#1 through celebrity_id#8 and aggregating on read; or handle the head of the distribution with a different code path entirely, as Twitter historically did by pulling tweets from mega-follower accounts at read time instead of fanning out on write.\n\nChoosing the partition key is where most sharding designs succeed or fail. Good keys have high cardinality, spread load evenly over time, and appear in your most common queries so those queries hit one shard. Sharding a messaging system by channel_id keeps a conversation's history together but makes one giant channel a hot spot; Discord dealt with exactly this in its Cassandra message store, where huge servers created hot partitions.",
      },
      {
        heading: "Resharding and routing in practice",
        body:
          "Resharding, changing the number or boundaries of shards while serving traffic, is the operational nightmare that motivates planning ahead. The classic technique is to pre-create many more logical partitions than physical nodes (for example 1,024 virtual shards mapped onto 8 machines) so that growth means remapping logical shards to new machines and copying their data, never re-hashing individual keys. Consistent hashing achieves a similar goal for dynamic membership.\n\nA live migration typically runs in phases: dual-write to old and new shards, backfill historical data with a bulk copier, verify with checksums, cut reads over, then stop writes to the old location. Each phase must be reversible. Vitess automates much of this for MySQL with resharding workflows, and DynamoDB and Cassandra handle splits internally, which is a large part of their appeal.\n\nRouting must also live somewhere: in a client library that knows the shard map (fast, but every client needs updates), in a proxy tier like Vitess's vtgate or a MongoDB mongos router (centralized logic, extra hop), or in the database itself for natively sharded stores. Cross-shard queries then need scatter-gather with partial failure handling, and cross-shard writes need sagas or two-phase commit, which is a big enough topic that flagging it in an interview is usually sufficient.",
      },
    ],
    keyPoints: [
      "Shard only after caching, read replicas, and vertical scaling are exhausted; sharding breaks joins, transactions, and unique constraints.",
      "Hash sharding balances load but kills range queries; range sharding enables scans but risks hot spots on sequential keys.",
      "Directory-based sharding adds a lookup layer for flexible placement, common in multi-tenant SaaS.",
      "The celebrity problem: uniform key distribution does not mean uniform load; mitigate hot keys with caching, key splitting, or special-casing.",
      "Pre-allocate many logical partitions (e.g., 1,024) over few physical nodes so resharding is data movement, not re-hashing.",
      "Live resharding follows dual-write, backfill, verify, cutover; each phase must be reversible.",
    ],
    tradeoffs: [
      {
        option: "Hash-based sharding",
        pros: [
          "Even key distribution with no planning",
          "Simple, stateless routing from key to shard",
        ],
        cons: [
          "Range queries must scatter-gather across all shards",
          "Changing shard count reshuffles keys unless combined with consistent hashing or virtual shards",
        ],
      },
      {
        option: "Range-based sharding",
        pros: [
          "Efficient range scans and sorted access within a shard",
          "Shards can split organically as ranges grow",
        ],
        cons: [
          "Sequential keys (timestamps, autoincrement) hammer the newest shard",
          "Requires ongoing split/merge management",
        ],
      },
      {
        option: "Directory-based sharding",
        pros: [
          "Arbitrary, per-tenant placement and easy targeted migration",
          "Can isolate huge tenants on dedicated hardware",
        ],
        cons: [
          "Directory service is an extra hop and a critical dependency",
          "Mapping must be cached and kept consistent during moves",
        ],
      },
    ],
    interviewTips: [
      "Name your partition key and defend it against your top three queries; single-shard queries are the goal.",
      "Proactively address the hottest key you can imagine (biggest tenant, celebrity user) and give a concrete mitigation.",
      "Mention logical-to-physical shard mapping as your resharding plan; it shows you have thought past day one.",
      "If asked for cross-shard transactions, acknowledge the cost and offer sagas or redesigning keys so the transaction is single-shard.",
    ],
    related: ["consistent-hashing", "replication", "sql-vs-nosql", "distributed-transactions"],
  },
  {
    slug: "replication",
    title: "Replication",
    category: "Data",
    summary:
      "Replication keeps copies of data on multiple nodes for availability, durability, and read scaling. The core designs are leader-follower, multi-leader, and leaderless quorums, each with distinct consistency and failover behavior.",
    sections: [
      {
        heading: "Leader-follower replication",
        body:
          "In leader-follower (primary-replica) replication, one node accepts all writes and streams its change log to followers, which apply the same changes in order. Postgres streaming replication ships WAL records; MySQL ships binlog events. Reads can go to any replica, which is how most read-heavy systems scale: one primary handling writes with 5 replicas can serve roughly 6x the read throughput.\n\nThe key choice is synchronous versus asynchronous propagation. Asynchronous replication acknowledges the write once the leader commits, giving low latency but risking loss of the last few writes if the leader dies before followers catch up. Synchronous replication waits for at least one follower to confirm, guaranteeing durability at the cost of latency and availability (a slow follower stalls writes). Semi-synchronous setups, one sync follower plus several async ones, are a common production compromise.\n\nThis topology dominates practice: Postgres, MySQL, MongoDB replica sets, Redis, and Kafka partitions (each partition has a leader and in-sync replicas) all use it. Its fundamental limits are that write throughput is capped by one node and that failover is a hard problem.",
      },
      {
        heading: "Replication lag and read consistency",
        body:
          "Asynchronous followers lag the leader, typically by milliseconds but sometimes by seconds or minutes under load, during network hiccups, or while replaying a large migration. Any read served by a lagging replica can return stale data, which produces user-visible anomalies that interviewers love to probe.\n\nThe canonical anomaly is violating read-your-writes: a user updates their profile (write hits the leader), the confirmation page reads from a replica that has not applied the change, and the user sees their old profile and files a bug. Standard fixes: route a user's reads to the leader for a short window after they write (for example 10 seconds, or until the replica's replay position passes the write's log position), pin each session to a replica at least as fresh as its last write, or have clients send a minimum log sequence number with reads.\n\nTwo related anomalies are worth naming. Monotonic reads: a user refreshing a page must not see data go backward in time, which happens if consecutive reads hit replicas with different lag; pinning a session to one replica fixes it. Consistent prefix: comments must not appear before the post they reply to, an issue mainly in partitioned systems where different partitions replicate at different speeds.",
      },
      {
        heading: "Failover and its failure modes",
        body:
          "When the leader dies, a follower must be promoted. Automatic failover involves detecting the failure (usually a heartbeat timeout of 10 to 30 seconds), electing the most up-to-date follower, and repointing clients. Every step can go wrong, which is why systems like Patroni for Postgres, MySQL group replication with a consensus layer, and MongoDB's Raft-based elections exist.\n\nThe two classic hazards are lost writes and split brain. With asynchronous replication, the promoted follower may be missing the dead leader's last writes; when the old leader returns, its divergent writes are typically discarded, and GitHub's 2018 incident (a 43 second network partition led to writes on two masters and hours of reconciliation) is the standard cautionary tale. Split brain, two nodes both believing they are leader, corrupts data fast; the defenses are quorum-based elections (a leader needs majority acknowledgment) and fencing, forcibly isolating the old leader (the grimly named STONITH: shoot the other node in the head).\n\nA practical interview detail: failover time is part of your availability budget. If detection takes 15 seconds and promotion 15 more, every unplanned leader failure costs 30 seconds of write downtime, which alone nearly exhausts a 99.99 percent monthly budget of about 4.3 minutes.",
      },
      {
        heading: "Multi-leader and leaderless replication",
        body:
          "Multi-leader replication lets several nodes accept writes, typically one leader per region, with leaders replicating to each other asynchronously. It gives each region low write latency and tolerates region-level partitions, but concurrent writes to the same record in different regions conflict. Resolution strategies include last-writer-wins (simple but silently drops data, and clock skew makes 'last' unreliable), application-level merge logic, and CRDTs (conflict-free replicated data types) that merge mathematically, used by Redis Enterprise CRDBs and Riak.\n\nLeaderless replication, from Amazon's Dynamo paper and implemented by Cassandra and Riak, has no leader at all: clients (or coordinators) write to N replicas and consider the write successful after W acknowledgments; reads query R replicas and take the newest value. If R + W > N (commonly N=3, W=2, R=2), read and write sets overlap and reads see the latest acknowledged write, giving tunable consistency per request. Lower W or R buys latency and availability at the price of staleness.\n\nLeaderless systems repair divergence continuously: read repair updates stale replicas noticed during reads, hinted handoff stores writes destined for a down node on a neighbor until it recovers, and anti-entropy processes compare replicas in the background using Merkle trees. There is no failover event because there is no leader to fail, which is precisely why Cassandra targets always-writable workloads across regions.",
      },
    ],
    keyPoints: [
      "Leader-follower is the default: all writes to one node, reads scale across replicas; write throughput stays single-node.",
      "Async replication risks losing recent writes on failover; sync replication trades latency and availability for durability; semi-sync is the common compromise.",
      "Replication lag causes read-your-writes and monotonic-read anomalies; fix by routing recent writers to the leader or tracking log positions.",
      "Failover hazards: lost writes and split brain; defend with quorum elections and fencing (STONITH).",
      "Multi-leader suits multi-region writes but requires conflict resolution (LWW, merges, CRDTs).",
      "Leaderless quorums (Dynamo, Cassandra): R + W > N gives overlap; read repair and hinted handoff heal divergence.",
    ],
    tradeoffs: [
      {
        option: "Leader-follower (async)",
        pros: [
          "Simple mental model; low write latency",
          "Cheap read scaling by adding replicas",
        ],
        cons: [
          "Recent writes can be lost on leader failure",
          "Replica lag causes stale reads; failover is complex",
        ],
      },
      {
        option: "Multi-leader",
        pros: [
          "Local write latency in every region",
          "Keeps accepting writes during inter-region partitions",
        ],
        cons: [
          "Write conflicts are inevitable and resolution is hard to get right",
          "Last-writer-wins silently discards data under clock skew",
        ],
      },
      {
        option: "Leaderless quorum (Dynamo-style)",
        pros: [
          "No failover event; smooth handling of node loss",
          "Per-request tunable consistency (R, W knobs)",
        ],
        cons: [
          "Quorum overlap still is not linearizability under all failure interleavings",
          "Sloppy quorums and concurrent writes push conflict handling (versioning, sibling merges) to the application",
        ],
      },
    ],
    interviewTips: [
      "When you add read replicas, immediately mention replication lag and how you preserve read-your-writes for the writing user.",
      "State sync vs async explicitly and tie it to your durability requirement (can we lose 1 second of acknowledged writes?).",
      "Know the N/W/R arithmetic cold: N=3, W=2, R=2 is the canonical quorum example.",
      "Use failover time in availability math; 30 seconds of promotion nearly spends a four-nines monthly budget on one incident.",
    ],
    related: ["consistency-and-cap", "sharding-and-partitioning", "fault-tolerance", "consistent-hashing"],
  },
  {
    slug: "consistency-and-cap",
    title: "Consistency and the CAP Theorem",
    category: "Data",
    summary:
      "CAP and PACELC frame the fundamental tradeoffs between consistency, availability, and latency in distributed systems. Knowing the consistency spectrum lets you match guarantees to product requirements instead of over- or under-engineering.",
    sections: [
      {
        heading: "What CAP actually says",
        body:
          "The CAP theorem states that when a network partition occurs, a distributed system must choose between consistency (every read sees the most recent write) and availability (every request to a non-failed node gets a response). Partition tolerance is not optional: networks partition in practice, so the real choice is what happens during the partition. A CP system rejects or blocks some requests to stay correct; an AP system keeps answering with possibly stale data.\n\nCommon misreadings are worth correcting in an interview. CAP does not mean 'pick two of three at all times'; in the absence of partitions a system can be both consistent and available. Its C means linearizability, a much stronger guarantee than ACID's C (which just means constraints hold). And most real outages are not clean partitions but gray failures, slow links, and partial connectivity, so CAP is a lens rather than a design manual.\n\nClassifying real systems: ZooKeeper and etcd are CP (a minority partition refuses writes because Raft or Zab needs a quorum). Cassandra and Dynamo-style stores default to AP (any replica set that can be reached keeps serving). A single-region relational primary with sync replication behaves CP-ish; DNS is the classic AP example, serving cached answers that may be stale.",
      },
      {
        heading: "PACELC: the latency dimension",
        body:
          "PACELC extends CAP with the observation that the interesting tradeoff exists even without partitions: if a Partition occurs, choose Availability or Consistency; Else, choose Latency or Consistency. Strong consistency requires coordination, usually a round trip to a quorum or leader, and coordination costs latency on every single request, not just during failures.\n\nThe classification is compact and impressive to wield: DynamoDB and Cassandra are PA/EL, favoring availability under partitions and latency otherwise. Google Spanner is PC/EC, always choosing consistency; it makes global strong consistency practical with TrueTime, GPS and atomic clocks that bound clock uncertainty (typically under 7 milliseconds), letting it order transactions globally, at the price of commit-wait latency. MongoDB with majority write concern behaves PC/EC-ish; with weaker write concerns it slides toward EL.\n\nThe concrete intuition: a cross-region quorum write spanning US and Europe pays at least one transatlantic round trip, roughly 80 to 150 milliseconds, on every write. An eventually consistent write to the local region completes in single-digit milliseconds. That two-orders-of-magnitude gap on the hot path, not partition behavior, is usually why teams accept eventual consistency.",
      },
      {
        heading: "The consistency spectrum",
        body:
          "Linearizability is the strongest practical guarantee: the system behaves as if there is a single copy of the data, and once any client sees a write, every subsequent read (in real time) sees it. It is what you need for uniqueness constraints, leader election, and locks, and it is what consensus systems (Raft, Paxos) provide. It is expensive because every operation coordinates.\n\nSequential and causal consistency relax real-time ordering. Causal consistency, the strongest guarantee achievable while staying available under partition, promises only that causally related events appear in order everywhere: a reply never appears before the comment it answers, though unrelated writes may interleave differently on different replicas. Systems track causality with version vectors or explicit dependency metadata.\n\nEventual consistency merely promises replicas converge if writes stop, with no bound on when. In practice it is packaged with client-centric session guarantees that fix the worst anomalies: read-your-writes (you see your own updates), monotonic reads (time never goes backward across your reads), monotonic writes, and writes-follow-reads. Azure Cosmos DB productizes this spectrum directly, offering five levels from strong through bounded staleness (lag at most K versions or T seconds) and session (its default) down to eventual, each level cheaper and faster than the one above.",
      },
      {
        heading: "Choosing consistency per feature",
        body:
          "Strong consistency is a requirement, not a virtue, and it is a per-operation decision. Inventory decrement at checkout, account balances, username uniqueness, and permission revocation want linearizability: overselling the last item or letting a revoked user act is a real cost. Like counts, view counters, follower numbers, and activity feeds tolerate seconds of staleness invisibly, and nobody can even verify whether a view counter is exact.\n\nA strong interview pattern is hybrid design within one product. An e-commerce checkout might read the catalog eventually consistently (cached, fast), but perform the final stock check and payment inside a strongly consistent transaction. A social app might write posts to a feed eventually consistently but enforce read-your-writes so authors always see their own post immediately.\n\nWhen asked 'what consistency does your design provide', answer per data type and per operation, name the anomaly you are preventing or accepting, and state the price. 'Feed reads are eventually consistent, which risks a follower seeing a post a few seconds late; checkout is linearizable via a single-partition conditional write, which costs a quorum round trip' is a senior-level answer.",
      },
    ],
    keyPoints: [
      "CAP: during a partition you choose consistency or availability; partition tolerance is mandatory because networks fail.",
      "CAP's C is linearizability, not ACID's C; and the theorem constrains behavior only during partitions.",
      "PACELC adds the everyday tradeoff: even without partitions, consistency costs latency (coordination round trips).",
      "Spectrum from strong to weak: linearizable, sequential, causal, session guarantees (read-your-writes, monotonic reads), eventual.",
      "Causal consistency is the strongest level compatible with availability under partition.",
      "Choose consistency per operation: linearizable for money, uniqueness, and permissions; eventual for counters and feeds.",
    ],
    tradeoffs: [
      {
        option: "CP / strong consistency (Spanner, etcd, quorum writes)",
        pros: [
          "No stale reads or lost updates; safe for invariants like uniqueness and balances",
          "Simplest application code; no conflict resolution",
        ],
        cons: [
          "Every operation pays coordination latency (cross-region quorums cost 80ms+)",
          "Minority partitions refuse service, reducing availability",
        ],
      },
      {
        option: "AP / eventual consistency (Cassandra, DynamoDB defaults)",
        pros: [
          "Low latency from local reads and writes",
          "Stays writable through partitions and node failures",
        ],
        cons: [
          "Applications must tolerate stale reads and resolve conflicts",
          "Anomalies (vanishing updates, out-of-order views) surface as user-facing bugs without session guarantees",
        ],
      },
    ],
    interviewTips: [
      "Never claim your whole system is 'CP' or 'AP'; assign consistency per operation and justify each with the anomaly at stake.",
      "Drop PACELC when the interviewer raises CAP; noting that consistency costs latency even without partitions is a strong signal.",
      "Read-your-writes is the most commonly required session guarantee; explain concretely how your design provides it.",
      "Have examples memorized: etcd/ZooKeeper CP, Cassandra AP, Spanner PC/EC with TrueTime, Cosmos DB's five levels.",
    ],
    related: ["replication", "distributed-transactions", "sql-vs-nosql", "fault-tolerance"],
  },
  {
    slug: "consistent-hashing",
    title: "Consistent Hashing",
    category: "Data",
    summary:
      "Consistent hashing assigns keys to nodes so that adding or removing a node remaps only a small fraction of keys, instead of nearly all of them. It underpins distributed caches, Dynamo-style databases, and CDN request routing.",
    sections: [
      {
        heading: "The problem with modulo hashing",
        body:
          "The naive way to spread keys across N servers is server = hash(key) mod N. It distributes evenly, but the moment N changes almost every key moves: going from 4 to 5 servers remaps roughly 80 percent of keys. For a cache fleet this is catastrophic, since a routine scale-up instantly invalidates most of the cache, the hit rate collapses, and the full read load lands on the database at once, a self-inflicted thundering herd.\n\nThe requirement, then: a mapping from keys to nodes where membership changes move only the keys that must move. Adding one node to N should relocate about 1/N of keys (about K/N of K keys) and nothing else. Consistent hashing, introduced in a 1997 MIT paper and commercialized by Akamai for CDN routing, achieves exactly this.\n\nThis matters for any stateful fleet: cache clusters (Memcached client libraries used consistent hashing early on), partitioned databases, and load balancers that want the same client or session to keep landing on the same backend.",
      },
      {
        heading: "The hash ring",
        body:
          "Picture the output range of a hash function, say 0 to 2^32 - 1, bent into a circle. Each node is hashed (by name or IP) to one or more positions on this ring. To place a key, hash it to a point on the ring and walk clockwise to the first node you meet; that node owns the key. Each node therefore owns the arc between its predecessor and itself.\n\nMembership changes are now local. When a node is removed, only the keys on its arc move, to its clockwise successor; every other key stays put. When a node is added, it takes over part of exactly one existing node's arc. With K keys and N nodes, each change moves about K/N keys, the theoretical minimum.\n\nLookups need a sorted structure of node positions, so routing is a binary search, O(log N), typically done in the client library (Memcached's ketama), in a coordinator, or via gossip-shared ring state as in Cassandra.",
      },
      {
        heading: "Virtual nodes",
        body:
          "With one position per node, the ring is badly balanced: random placement gives some nodes arcs several times larger than others, and when a node dies its entire load dumps onto a single successor. Heterogeneous hardware makes it worse, since a box with twice the RAM cannot be given twice the keys.\n\nVirtual nodes (vnodes) fix all three issues. Each physical node is hashed to many ring positions, commonly 100 to 1,000; Cassandra historically defaulted to 256 tokens per node, later reduced to 16 with a smarter allocation algorithm. With many vnodes per machine, arc sizes average out (variance falls roughly with the square root of the vnode count), a failed node's load scatters across many successors instead of one, and a beefier machine simply gets proportionally more vnodes.\n\nThe costs are modest: a larger ring table to store and search, and in replicated databases more distinct ranges per node, which increases the bookkeeping for repairs and streaming. This is why Cassandra tuned its default down once its allocator improved.",
      },
      {
        heading: "Where it is used, and alternatives",
        body:
          "Amazon's Dynamo paper made consistent hashing with vnodes the backbone of its partitioning, and Cassandra and Riak inherited the design: the ring determines both the primary owner of a key and its replicas (the next R-1 distinct physical nodes clockwise). DynamoDB descends from this lineage. Akamai used consistent hashing to route URLs to CDN edge caches so that cache contents survive server churn. Discord uses it to assign guilds to server processes, and Envoy and HAProxy offer ring-hash load balancing for session affinity.\n\nKnow the notable alternatives. Rendezvous (highest random weight) hashing scores every node for a key via hash(key, node) and picks the maximum; it needs no ring, gives excellent balance, and is O(N) per lookup, fine for small N. Google's Maglev hashing builds a lookup table for near-perfect balance with minimal disruption, built for software load balancers. Jump consistent hash is a tiny, fast algorithm ideal when nodes are numbered and only added or removed at the end.\n\nAlso be ready to contrast with the explicit-mapping approach: systems like Redis Cluster (16,384 hash slots assigned to nodes) and Vitess keep a slot or shard map instead of a pure ring. Explicit maps allow deliberate, operator-controlled rebalancing at the cost of maintaining that metadata, effectively trading algorithmic simplicity for placement control.",
      },
    ],
    keyPoints: [
      "Modulo hashing remaps nearly all keys when the node count changes; consistent hashing moves only about K/N keys per membership change.",
      "Keys and nodes hash onto a ring; a key belongs to the first node clockwise from it.",
      "Virtual nodes (hundreds per machine) smooth load imbalance, spread a failed node's load across many successors, and support weighted heterogeneous hardware.",
      "Dynamo, Cassandra, and Riak use the ring for both partitioning and replica placement (next distinct nodes clockwise).",
      "Alternatives: rendezvous hashing (simple, O(N) lookup), Maglev (near-perfect balance for load balancers), jump hash, and explicit slot maps (Redis Cluster's 16,384 slots).",
      "Losing a cache node without consistent hashing can crater hit rate fleet-wide; with it, only that node's share is lost.",
    ],
    tradeoffs: [
      {
        option: "Consistent hashing (ring + vnodes)",
        pros: [
          "Minimal key movement on scale-up, scale-down, and failure",
          "Decentralized: any client with the ring can route in O(log N)",
          "Vnodes give balance and weighted capacity",
        ],
        cons: [
          "Balance is only statistical; requires enough vnodes to smooth variance",
          "No control over which keys move; hot ranges cannot be manually placed",
        ],
      },
      {
        option: "Explicit slot/shard mapping (Redis Cluster, Vitess)",
        pros: [
          "Operators control placement and can migrate specific hot slots",
          "Rebalancing is observable and throttleable",
        ],
        cons: [
          "The map is metadata that must be stored, propagated, and kept consistent",
          "Rebalancing is a manual or orchestrated operation rather than automatic",
        ],
      },
    ],
    interviewTips: [
      "Lead with the failure story: explain what modulo hashing does to your cache hit rate on a scale event, then introduce the ring as the fix.",
      "Always mention virtual nodes; a ring without vnodes is the follow-up question the interviewer is waiting to ask.",
      "Tie it to your design concretely: 'the cache client uses ketama-style consistent hashing so losing 1 of 10 nodes costs about 10 percent of the cache'.",
      "Know one alternative (rendezvous or Redis Cluster slots) to show the ring is a choice, not the only option.",
    ],
    related: ["caching", "sharding-and-partitioning", "load-balancing", "cdn"],
  },
  {
    slug: "storage-and-search",
    title: "Storage and Search",
    category: "Data",
    summary:
      "Large systems combine block, file, and object storage for bytes at rest, and inverted-index search engines for finding things in them. Knowing which storage tier and which search architecture fits each workload is a recurring interview theme.",
    sections: [
      {
        heading: "Block, file, and object storage",
        body:
          "Block storage exposes raw fixed-size blocks, like a virtual disk: AWS EBS, or a SAN. It offers the lowest latency (sub-millisecond) and supports in-place random writes, which is why databases run on it, but a volume attaches to essentially one server and capacity is provisioned, not elastic. File storage (NFS, AWS EFS) adds a POSIX hierarchy shared across many clients, convenient for legacy apps and shared workspaces, but metadata operations make it hard to scale to extreme sizes.\n\nObject storage (Amazon S3, Google Cloud Storage, Azure Blob) stores immutable blobs by key in a flat namespace, accessed over HTTP. You cannot edit a byte in place; you replace the whole object. In exchange you get practically unlimited capacity, 11 nines of durability (S3 stores redundantly across at least 3 availability zones, using replication and erasure coding), and pennies per GB-month, with tiers from S3 Standard down to Glacier Deep Archive at roughly one twentieth the cost for archival data.\n\nThe standard interview pattern: metadata in a database, bytes in object storage. A photo service stores the image in S3 under a key, and a Postgres row holds the key, owner, dimensions, and permissions. Uploads and downloads should use presigned URLs so clients transfer directly with S3 and your servers never proxy the bytes, and a CDN in front of the bucket serves hot objects from edge locations.",
      },
      {
        heading: "Inverted indexes: how search works",
        body:
          "A database index finds rows by exact key or range; it cannot efficiently answer 'documents containing the words cheap AND flights'. The inverted index solves this by mapping each term to the sorted list of document IDs containing it (a postings list), like a book's index at web scale. Querying intersects or unions postings lists: the AND of two terms is a merge of two sorted lists, which is fast even over millions of documents.\n\nBuilding the index requires text analysis: tokenize the text, lowercase it, drop stop words, and apply stemming so 'running' matches 'run', plus optional synonym expansion. The same analysis must apply to queries. Postings can also store term positions (for phrase queries like 'new york'), and frequencies for ranking.\n\nRanking is what separates search from lookup. Classic scoring is TF-IDF, refined into BM25 (the default in Lucene, Elasticsearch, and OpenSearch): a document scores higher when the query term appears often in it, the term is rare across the corpus, and the document is short. Modern stacks add a second stage, retrieving the top few hundred candidates with BM25 and re-ranking with machine-learned models, and increasingly hybrid search that combines keyword retrieval with vector similarity from embeddings.",
      },
      {
        heading: "Elasticsearch and search at scale",
        body:
          "Elasticsearch (and OpenSearch, its fork) packages Lucene, the inverted-index library, into a distributed system. An index is split into shards, each a full Lucene index; shards have replicas for availability and read throughput. A query fans out to one copy of every shard, each shard returns its top K candidates, and a coordinating node merges them into the global top K, classic scatter-gather. This is why shard count matters: 1,000 shards means every query does 1,000 sub-queries, and massive over-sharding is the most common Elasticsearch operational mistake; a common guideline keeps individual shards between 10 and 50 GB.\n\nWrites in Lucene follow an LSM-like pattern: documents buffer in memory and are written as immutable segments, which background merges consolidate. A document only becomes searchable after a refresh, which defaults to every 1 second, so Elasticsearch is near-real-time, not real-time, and it should be treated as eventually consistent search over your data, not as a primary store.\n\nThe canonical architecture keeps the source of truth in a database and syncs to the search cluster asynchronously, usually via change data capture (Debezium reading the database's replication log into Kafka, consumed by an indexer) or dual-writing through a queue. That pipeline introduces indexing lag, typically seconds, and requires idempotent indexing with versioning so replays and reordering do not corrupt documents. Handling deletes and mapping changes (which often force a full reindex into a new index behind an alias) are the operational realities worth mentioning.",
      },
      {
        heading: "Designing full-text search into a system",
        body:
          "When an interviewer adds 'users can search products' to a design, resist reaching for Elasticsearch first. Postgres full-text search with a GIN index on a tsvector handles surprising scale, millions of rows with tens of milliseconds queries, with zero extra infrastructure, and SQLite FTS5 or MySQL FULLTEXT cover smaller cases. Reach for a dedicated engine when you need heavy relevance tuning, typo-tolerant autocomplete, faceted navigation, multi-language analysis, or query volume that would harm the primary database.\n\nSize the problem out loud. A product catalog of 10 million items averaging 1 KB of searchable text is about 10 GB, an index that fits in one or two shards on a single node with a replica; a log-search cluster ingesting 1 TB per day is a completely different design with time-based indices, hot-warm-cold tiers on progressively cheaper hardware, and ILM policies that delete or archive old indices. Autocomplete is its own subproblem, usually served by edge n-gram indexes or an in-memory prefix trie rather than full queries.\n\nAlso know the adjacent options: Algolia and Typesense as managed low-latency search focused on instant results, vector databases and Lucene's HNSW support for semantic search over embeddings, and the pattern of caching frequent query results (search queries follow a power law, so a small cache absorbs a large share of traffic).",
      },
    ],
    keyPoints: [
      "Block storage for databases (low latency, single attach), file storage for shared POSIX access, object storage for everything blob-like at scale.",
      "S3-style object storage gives 11 nines durability and elastic capacity, but objects are immutable; store metadata in a DB and bytes in the bucket.",
      "Use presigned URLs for direct client upload/download and a CDN for hot objects; never proxy large blobs through app servers.",
      "An inverted index maps terms to postings lists; queries are sorted-list intersections, ranked by BM25.",
      "Elasticsearch shards are Lucene indexes queried scatter-gather; refresh interval (default 1s) makes search near-real-time, not real-time.",
      "Search is a derived view: sync from the source-of-truth database via CDC or queues, and design for indexing lag and reindexing.",
    ],
    tradeoffs: [
      {
        option: "Object storage (S3) for large binaries",
        pros: [
          "Effectively infinite capacity and 11 nines durability at low cost",
          "HTTP access, presigned URLs, versioning, lifecycle tiering to Glacier",
        ],
        cons: [
          "No in-place edits or POSIX semantics; whole-object replacement only",
          "Higher per-request latency than block storage; unsuited to database files",
        ],
      },
      {
        option: "Database built-in full-text search (Postgres tsvector/GIN)",
        pros: [
          "No extra infrastructure or sync pipeline; transactionally consistent with the data",
          "Perfectly adequate for millions of rows and moderate query rates",
        ],
        cons: [
          "Weaker relevance tuning, faceting, and typo tolerance than Lucene-based engines",
          "Heavy search traffic competes with OLTP load on the same database",
        ],
      },
      {
        option: "Dedicated search cluster (Elasticsearch/OpenSearch)",
        pros: [
          "Rich relevance, facets, aggregations, autocomplete, multi-language analysis",
          "Scales horizontally and isolates search load from the primary store",
        ],
        cons: [
          "Eventually consistent with the source of truth; sync pipeline (CDC) to build and operate",
          "Operationally demanding: shard sizing, reindexing, JVM heap tuning",
        ],
      },
    ],
    interviewTips: [
      "For any upload feature, say 'metadata in the DB, bytes in S3, presigned URLs, CDN in front' as one breath; it is the expected shape.",
      "Explain the inverted index in two sentences before naming Elasticsearch; interviewers test the concept, not the brand.",
      "Call out that search is eventually consistent and describe the CDC pipeline and its lag; that is the senior-level detail.",
      "Right-size: propose Postgres full-text for small scale and justify a dedicated cluster only with relevance or load requirements.",
    ],
    related: ["database-indexing", "cdn", "message-queues", "caching"],
  },
];
