import type { GlossaryEntry, LatencyNumber } from "./types";

export const glossary: GlossaryEntry[] = [
  {
    term: "ACID",
    definition:
      "The four guarantees of relational database transactions: Atomicity (all or nothing), Consistency (valid state to valid state), Isolation (concurrent transactions do not interfere), and Durability (committed data survives crashes).",
  },
  {
    term: "Anycast",
    definition:
      "A routing technique where the same IP address is advertised from multiple locations and BGP delivers each packet to the nearest one. Used by CDNs and DNS resolvers for automatic geographic distribution and failover.",
  },
  {
    term: "API Gateway",
    definition:
      "A single entry point in front of backend services that handles routing, authentication, rate limiting, and TLS termination. It hides internal service topology from clients.",
  },
  {
    term: "Backpressure",
    definition:
      "A mechanism by which an overloaded downstream component signals upstream producers to slow down, typically via bounded queues or demand signaling. It prevents unbounded buffering and memory exhaustion under load.",
  },
  {
    term: "BASE",
    definition:
      "Basically Available, Soft state, Eventually consistent: the loose counterpart to ACID adopted by many distributed NoSQL systems. It prioritizes availability and partition tolerance over immediate consistency.",
  },
  {
    term: "Bloom Filter",
    definition:
      "A space-efficient probabilistic data structure that tests set membership with possible false positives but no false negatives. Commonly used to skip expensive lookups, such as avoiding disk reads for keys that definitely do not exist.",
  },
  {
    term: "Blue-Green Deployment",
    definition:
      "A release strategy running two identical environments where traffic switches from the old (blue) to the new (green) all at once. Rollback is instant by switching back.",
  },
  {
    term: "Cache Stampede",
    definition:
      "A failure mode where a popular cache entry expires and many concurrent requests all hit the backing store to regenerate it simultaneously. Mitigated by request coalescing, staggered TTLs, and serving stale data during refresh.",
  },
  {
    term: "Canary Release",
    definition:
      "A deployment strategy that routes a small percentage of traffic to a new version, monitors error rates and latency, and gradually increases the share. It limits the blast radius of a bad release.",
  },
  {
    term: "CAP Theorem",
    definition:
      "The principle that during a network partition a distributed system must choose between consistency and availability. Since partitions are unavoidable, systems are characterized as CP or AP by their behavior when one occurs.",
  },
  {
    term: "CDC (Change Data Capture)",
    definition:
      "A technique that streams a database's committed changes, usually by reading its write-ahead log or binlog, to downstream consumers as an ordered event feed. Used to sync caches, search indexes, and warehouses without dual writes.",
  },
  {
    term: "CDN (Content Delivery Network)",
    definition:
      "A geographically distributed network of edge servers that caches content close to users, reducing latency and offloading the origin. Primarily used for static assets, images, and video.",
  },
  {
    term: "Checksum",
    definition:
      "A small value computed from data, such as a hash, used to detect corruption during storage or transmission. Receivers recompute it and compare to verify integrity.",
  },
  {
    term: "Circuit Breaker",
    definition:
      "A resilience pattern that trips open after repeated failures to a dependency, failing fast instead of piling up requests, then probes with trial requests before closing again. It prevents cascading failures.",
  },
  {
    term: "Cold Start",
    definition:
      "The extra latency incurred when a serverless function or service instance must be initialized from scratch before handling its first request. Mitigated by provisioned concurrency, warm pools, and lighter runtimes.",
  },
  {
    term: "Compaction",
    definition:
      "The background process in LSM-based storage engines that merges sorted on-disk segments, discarding overwritten and deleted entries. It reclaims space and keeps read performance bounded at the cost of write amplification.",
  },
  {
    term: "Connection Pooling",
    definition:
      "Reusing a set of pre-established connections (typically to a database) instead of opening a new one per request. It avoids handshake overhead and caps the number of concurrent connections the backend must handle.",
  },
  {
    term: "Consistent Hashing",
    definition:
      "A hashing scheme that maps nodes and keys onto a ring so that adding or removing a node only remaps about 1/N of the keys. Virtual nodes are used to balance load; it is standard in distributed caches and databases.",
  },
  {
    term: "CQRS (Command Query Responsibility Segregation)",
    definition:
      "An architecture that separates the write model from the read model, letting each use its own schema, storage, and scaling, typically synchronized through events. Useful when read and write workloads differ sharply.",
  },
  {
    term: "DAU (Daily Active Users)",
    definition:
      "The number of unique users who engage with a product in a day, a standard input for capacity estimation. Interviewers often give DAU and expect derived request rates and storage needs.",
  },
  {
    term: "Dead Letter Queue",
    definition:
      "A queue that receives messages that could not be processed after repeated attempts, isolating poison messages so they do not block the main queue. Operators inspect and replay or discard them.",
  },
  {
    term: "Denormalization",
    definition:
      "Deliberately duplicating data across tables or documents to avoid joins and speed up reads. It trades storage and write-path complexity for read performance.",
  },
  {
    term: "Edge Computing",
    definition:
      "Running compute at locations geographically close to users, such as CDN points of presence, rather than in a central region. It reduces round-trip latency for logic like personalization, auth, and A/B routing.",
  },
  {
    term: "Eventual Consistency",
    definition:
      "A consistency model guaranteeing that, absent new writes, all replicas converge to the same value over time, so reads may temporarily return stale data. It enables high availability and low latency in replicated systems.",
  },
  {
    term: "Exponential Backoff",
    definition:
      "A retry strategy where the wait between attempts grows exponentially, reducing pressure on a struggling service. Combined with jitter to prevent synchronized retry waves.",
  },
  {
    term: "Failover",
    definition:
      "The process of shifting traffic from a failed component to a healthy standby, either automatically or manually. Key metrics are detection time, promotion time, and whether any acknowledged writes are lost.",
  },
  {
    term: "Fan-out",
    definition:
      "Distributing one event or request to many recipients, such as delivering a post to every follower's feed. Fan-out on write precomputes results at publish time; fan-out on read assembles them at query time.",
  },
  {
    term: "Geohash",
    definition:
      "An encoding that converts latitude and longitude into a short string where shared prefixes indicate spatial proximity. Used to index and shard location data for nearby-search queries.",
  },
  {
    term: "Gossip Protocol",
    definition:
      "A decentralized communication pattern where each node periodically exchanges state with a few random peers, spreading information epidemically. Used for membership, failure detection, and metadata dissemination in systems like Cassandra.",
  },
  {
    term: "Graceful Degradation",
    definition:
      "Designing a system to keep serving its core function with reduced quality when dependencies fail, using fallbacks, feature flags, and load shedding rather than failing entirely.",
  },
  {
    term: "Heartbeat",
    definition:
      "A periodic signal a node sends to indicate it is alive. Missing heartbeats past a timeout trigger failure detection, failover, or leader election.",
  },
  {
    term: "Hinted Handoff",
    definition:
      "A technique in leaderless replication where, if a replica is down, another node temporarily accepts its writes along with a hint, then replays them when the replica recovers. It preserves write availability during transient failures.",
  },
  {
    term: "Hot Spot",
    definition:
      "A shard, partition, or key that receives disproportionate traffic, overwhelming its node while others sit idle. Classic causes are celebrity users and monotonically increasing keys like timestamps.",
  },
  {
    term: "Idempotency",
    definition:
      "The property that performing an operation multiple times has the same effect as performing it once. Essential for safe retries; commonly implemented with client-supplied idempotency keys.",
  },
  {
    term: "Jitter",
    definition:
      "Randomness added to retry delays or scheduled intervals so many clients do not act in synchronized waves. It smooths load spikes caused by correlated timing.",
  },
  {
    term: "Leader Election",
    definition:
      "The process by which nodes in a distributed system agree on a single coordinator, typically via consensus protocols like Raft or coordination services like ZooKeeper or etcd. Majority quorums prevent two simultaneous leaders.",
  },
  {
    term: "Linearizability",
    definition:
      "The strongest single-object consistency model: every operation appears to take effect atomically at some instant between its start and completion, so reads always reflect the most recent write. Also called strong consistency.",
  },
  {
    term: "Load Balancer",
    definition:
      "A component that distributes incoming traffic across a pool of servers using algorithms like round robin, least connections, or hashing. Operates at L4 (transport) or L7 (application) and performs health checks to route around failures.",
  },
  {
    term: "Load Shedding",
    definition:
      "Deliberately rejecting or deprioritizing some requests when a system nears overload so that remaining requests can be served correctly. Preferable to accepting all traffic and failing everything.",
  },
  {
    term: "LSM Tree (Log-Structured Merge Tree)",
    definition:
      "A write-optimized storage structure that buffers writes in memory and flushes them as sorted immutable segments merged by background compaction. Powers Cassandra, RocksDB, and LevelDB; fast writes at the cost of read and write amplification.",
  },
  {
    term: "Merkle Tree",
    definition:
      "A tree of hashes where each parent hashes its children, letting two replicas compare roots and descend only into differing branches. Enables efficient anti-entropy synchronization in systems like DynamoDB and Cassandra.",
  },
  {
    term: "Message Queue",
    definition:
      "A buffer that decouples producers from consumers, absorbing bursts and enabling asynchronous processing with retries. Each message is typically consumed by exactly one worker in a competing consumer pool.",
  },
  {
    term: "MTTR (Mean Time To Recovery)",
    definition:
      "The average time from failure detection to restored service. Modern reliability practice favors minimizing MTTR through fast detection and rollback over maximizing time between failures.",
  },
  {
    term: "N+1 Query Problem",
    definition:
      "An access pattern where fetching a list requires one query for the list plus one additional query per item, multiplying database load. Fixed with joins, batch fetching, or data loaders.",
  },
  {
    term: "Outbox Pattern",
    definition:
      "A pattern that writes events into an outbox table within the same database transaction as the state change, with a separate relay publishing them to a message broker. It guarantees events are published if and only if the transaction committed.",
  },
  {
    term: "PACELC",
    definition:
      "An extension of CAP: if a Partition occurs, trade Availability versus Consistency; Else, in normal operation, trade Latency versus Consistency. It captures the everyday cost of synchronous replication.",
  },
  {
    term: "Partition Tolerance",
    definition:
      "A system's ability to continue operating when network failures split nodes into groups that cannot communicate. In practice it is mandatory, forcing the CAP choice between consistency and availability.",
  },
  {
    term: "Quorum",
    definition:
      "The minimum number of nodes that must agree for an operation to proceed, usually a majority. With N replicas, requiring W write acks and R read responses where R + W > N ensures reads overlap the latest write.",
  },
  {
    term: "Rate Limiting",
    definition:
      "Restricting how many requests a client can make in a time window to protect services from abuse and overload. Common algorithms include token bucket, leaky bucket, and sliding window counters.",
  },
  {
    term: "Read Replica",
    definition:
      "A copy of a database that receives replicated writes from the primary and serves read traffic, scaling reads horizontally. Asynchronous replication means replicas can lag and serve slightly stale data.",
  },
  {
    term: "Replication Lag",
    definition:
      "The delay between a write committing on the primary and appearing on a replica. It causes anomalies like a user not seeing their own write, mitigated by read-your-writes routing or synchronous replication.",
  },
  {
    term: "Saga",
    definition:
      "A pattern for distributed transactions that executes a sequence of local transactions across services, undoing completed steps with compensating transactions if a later step fails. Implemented via choreography (events) or orchestration (a coordinator).",
  },
  {
    term: "Serializability",
    definition:
      "The strongest transaction isolation level, guaranteeing that concurrent transactions produce the same result as some serial execution. It eliminates anomalies like write skew at the cost of throughput.",
  },
  {
    term: "Service Discovery",
    definition:
      "The mechanism by which services find the current network locations of other services, via a registry like Consul, etcd, or DNS. Essential in dynamic environments where instances scale and move constantly.",
  },
  {
    term: "Service Mesh",
    definition:
      "An infrastructure layer, typically sidecar proxies like Envoy managed by a control plane like Istio, that handles service-to-service traffic: mutual TLS, retries, timeouts, load balancing, and observability, without application code changes.",
  },
  {
    term: "Sharding",
    definition:
      "Splitting a dataset horizontally across multiple nodes, each holding a subset of rows determined by a shard key. It scales storage and throughput beyond one machine but complicates cross-shard queries and transactions.",
  },
  {
    term: "Sidecar",
    definition:
      "A helper process deployed alongside an application container to provide cross-cutting capabilities like proxying, logging, or configuration. The building block of service meshes.",
  },
  {
    term: "SLA (Service Level Agreement)",
    definition:
      "A contractual commitment to customers about service performance, such as uptime, with defined penalties for breaches. Usually looser than the internal SLO that backs it.",
  },
  {
    term: "SLI (Service Level Indicator)",
    definition:
      "A quantitative measurement of service behavior, such as p99 latency, error rate, or availability. SLIs are the raw signals against which SLOs are set.",
  },
  {
    term: "SLO (Service Level Objective)",
    definition:
      "An internal target for an SLI, such as 99.9% of requests succeeding within 200ms over 30 days. The remaining allowance defines the error budget that gates release velocity.",
  },
  {
    term: "Snapshot Isolation",
    definition:
      "A transaction isolation level where each transaction reads from a consistent snapshot of the database taken at its start, implemented via MVCC. It avoids most anomalies without read locks but permits write skew.",
  },
  {
    term: "Split Brain",
    definition:
      "A failure mode where a partition leaves two nodes both acting as leader, accepting conflicting writes. Prevented by majority quorums and fencing tokens.",
  },
  {
    term: "Sticky Session",
    definition:
      "Load balancer behavior that routes all of a client's requests to the same backend instance, usually via a cookie or IP hash. Needed for in-memory session state but hinders even load distribution and failover.",
  },
  {
    term: "Throughput",
    definition:
      "The amount of work a system completes per unit of time, such as requests or bytes per second. Often traded against latency, for example through batching.",
  },
  {
    term: "Thundering Herd",
    definition:
      "Many clients or processes waking or retrying simultaneously and overwhelming a shared resource, such as after a cache expiry or a service recovering from an outage. Mitigated by jitter, request coalescing, and gradual ramp-up.",
  },
  {
    term: "Tombstone",
    definition:
      "A marker written to record a deletion in systems with immutable or replicated storage, so the delete propagates to all replicas before the data is physically removed during compaction.",
  },
  {
    term: "TTL (Time To Live)",
    definition:
      "An expiry duration attached to cached entries, DNS records, or messages, after which they are discarded or refreshed. TTLs bound staleness and enable automatic cleanup.",
  },
  {
    term: "Two-Phase Commit (2PC)",
    definition:
      "An atomic commit protocol where a coordinator first asks all participants to prepare, then instructs all to commit or abort. It guarantees atomicity across nodes but blocks if the coordinator fails after prepare, hurting availability.",
  },
  {
    term: "Vector Clock",
    definition:
      "A logical clock assigning each node a counter vector to track causality between events without synchronized time. It distinguishes ordered updates from concurrent conflicting ones in leaderless replication.",
  },
  {
    term: "WAL (Write-Ahead Log)",
    definition:
      "An append-only log where changes are durably recorded before being applied to the main data structures, enabling crash recovery by replay. Also the foundation of replication streams and CDC.",
  },
  {
    term: "WebSocket",
    definition:
      "A protocol providing a persistent, full-duplex connection between client and server over a single TCP connection, upgraded from HTTP. Used for chat, live collaboration, and gaming where both sides push data.",
  },
  {
    term: "Write Amplification",
    definition:
      "The ratio of bytes physically written to storage versus bytes logically written by the application, caused by compaction, page rewrites, or SSD garbage collection. High amplification wears SSDs and consumes I/O bandwidth.",
  },
  {
    term: "Zero Downtime Deployment",
    definition:
      "Releasing new software without interrupting service, using strategies like rolling updates, blue-green switches, or canaries. Requires backward-compatible database migrations and connection draining.",
  },
];

export const latencyNumbers: LatencyNumber[] = [
  {
    operation: "L1 cache reference",
    latency: "1 ns",
    comparison: "The baseline: if this were 1 second, a disk seek would take about 3 weeks",
  },
  {
    operation: "L2 cache reference",
    latency: "4 ns",
    comparison: "About 4x slower than L1",
  },
  {
    operation: "Mutex lock/unlock",
    latency: "17 ns",
    comparison: "Uncontended; contention makes this far worse",
  },
  {
    operation: "Main memory reference",
    latency: "100 ns",
    comparison: "About 100x slower than L1 cache",
  },
  {
    operation: "Compress 1 KB with Zippy (Snappy)",
    latency: "2 us",
    comparison: "Compression is cheap relative to network and disk",
  },
  {
    operation: "Read 1 MB sequentially from memory",
    latency: "10 us",
    comparison: "Memory bandwidth is enormous; sequential beats random",
  },
  {
    operation: "SSD random read",
    latency: "16 us",
    comparison: "About 160x slower than a main memory reference",
  },
  {
    operation: "Read 1 MB sequentially from SSD",
    latency: "200 us",
    comparison: "About 20x slower than reading it from memory",
  },
  {
    operation: "Round trip within same datacenter",
    latency: "500 us",
    comparison: "Half a millisecond; budget for several of these per request",
  },
  {
    operation: "Read 1 MB sequentially from disk (HDD)",
    latency: "2 ms",
    comparison: "About 10x slower than SSD, 200x slower than memory",
  },
  {
    operation: "Disk seek (HDD)",
    latency: "2 ms",
    comparison: "About 4 datacenter round trips; random disk I/O is the enemy",
  },
  {
    operation: "Send packet CA to Netherlands to CA",
    latency: "150 ms",
    comparison: "Speed of light dominates; this is why regions and CDNs exist",
  },
];
