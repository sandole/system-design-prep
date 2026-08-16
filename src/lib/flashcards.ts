import type { Flashcard } from "./types";

export const flashcards: Flashcard[] = [
  // Fundamentals
  {
    question: "What is the difference between horizontal and vertical scaling?",
    answer:
      "Vertical scaling adds more resources (CPU, RAM) to a single machine, while horizontal scaling adds more machines to a pool. Vertical scaling is simpler but hits hardware limits and creates a single point of failure. Horizontal scaling offers near-unlimited growth and fault tolerance but requires load balancing, data distribution, and handling of distributed-systems complexity.",
    category: "Fundamentals",
  },
  {
    question: "What is the difference between latency and throughput?",
    answer:
      "Latency is the time to complete a single operation, typically measured in milliseconds. Throughput is the number of operations a system completes per unit of time, such as requests per second. They are related but distinct: batching often improves throughput at the cost of latency, and a system can have low latency per request yet low overall throughput.",
    category: "Fundamentals",
  },
  {
    question: "What does the CAP theorem state?",
    answer:
      "CAP states that during a network partition, a distributed system must choose between consistency (every read sees the latest write) and availability (every request gets a response). Partition tolerance is not optional in practice because networks fail, so the real choice is CP versus AP behavior during a partition. Banks typically favor consistency; social feeds typically favor availability.",
    category: "Fundamentals",
  },
  {
    question: "How does PACELC extend the CAP theorem?",
    answer:
      "PACELC says that if a Partition occurs, a system trades Availability against Consistency; Else, during normal operation, it trades Latency against Consistency. It captures the everyday tradeoff CAP ignores: even without failures, synchronous replication for strong consistency adds latency. For example, DynamoDB is PA/EL while a strongly consistent system like Spanner leans PC/EC.",
    category: "Fundamentals",
  },
  {
    question: "What is the difference between strong and eventual consistency?",
    answer:
      "Strong consistency guarantees that every read reflects the most recent successful write, as if there were a single copy of the data. Eventual consistency only guarantees that, absent new writes, all replicas converge to the same value over time, so reads may return stale data. Eventual consistency enables lower latency and higher availability, which is why it is common in geo-replicated systems.",
    category: "Fundamentals",
  },
  {
    question: "What is the difference between an SLA, an SLO, and an SLI?",
    answer:
      "An SLI is a measured indicator of service health, such as p99 latency or error rate. An SLO is the internal target for that indicator, such as 99.9% of requests under 200ms. An SLA is the external contract with customers that attaches consequences, like refunds, to missing agreed targets, and is usually looser than the internal SLO.",
    category: "Fundamentals",
  },
  {
    question: "Why should services be stateless where possible?",
    answer:
      "Stateless services keep no client session data between requests, so any instance can serve any request. This makes horizontal scaling, load balancing, rolling deploys, and failure recovery trivial because instances are interchangeable. State is pushed to dedicated stores like Redis or a database, which are designed for durability and sharing.",
    category: "Fundamentals",
  },
  {
    question: "What is idempotency and why does it matter in distributed systems?",
    answer:
      "An operation is idempotent if performing it multiple times has the same effect as performing it once. Networks are unreliable, so clients and queues retry requests, which means the same message can be delivered more than once. Idempotency keys or natural idempotent semantics (like setting a value rather than incrementing) prevent duplicate side effects such as double charges.",
    category: "Fundamentals",
  },
  {
    question: "How do you approach back-of-envelope capacity estimation in an interview?",
    answer:
      "Start from stated scale (e.g. DAU), derive request rates by multiplying actions per user and dividing by roughly 100,000 seconds per day, then separate read and write QPS. Estimate storage from record size times write volume times retention, and size bandwidth and cache from hot data assumptions like the 80/20 rule. Round aggressively; the goal is order-of-magnitude numbers that justify design choices.",
    category: "Fundamentals",
  },
  {
    question: "What is consistent hashing and what problem does it solve?",
    answer:
      "Consistent hashing maps both nodes and keys onto a ring so each key is owned by the next node clockwise. When a node joins or leaves, only about 1/N of the keys move, unlike naive hash-mod-N where nearly all keys remap. Virtual nodes are added to smooth out load imbalance, making it the standard technique for distributed caches and databases like DynamoDB and Cassandra.",
    category: "Fundamentals",
  },

  // Networking
  {
    question: "What is the difference between L4 and L7 load balancing?",
    answer:
      "An L4 load balancer routes at the transport layer using IPs and ports, forwarding packets without inspecting content, which makes it very fast. An L7 load balancer terminates the connection and routes on application data like URL paths, headers, or cookies, enabling smart routing, TLS termination, and sticky sessions. L7 is more flexible; L4 is cheaper and lower latency.",
    category: "Networking",
  },
  {
    question: "When would you choose UDP over TCP?",
    answer:
      "TCP provides ordered, reliable, connection-oriented delivery with congestion control, at the cost of handshakes and retransmission delays. UDP is connectionless and gives no delivery guarantees, so it is chosen when low latency matters more than reliability, such as video streaming, gaming, VoIP, and DNS. Applications on UDP can implement their own reliability, as QUIC does.",
    category: "Networking",
  },
  {
    question: "How do WebSockets, Server-Sent Events, and long polling compare for realtime updates?",
    answer:
      "Long polling holds an HTTP request open until data arrives, then the client reconnects; it is simple but wasteful at scale. SSE keeps one HTTP connection open for server-to-client streaming only, with automatic reconnects, ideal for feeds and notifications. WebSockets provide a persistent full-duplex channel, best for chat and games, but require stateful connection handling on servers and load balancers.",
    category: "Networking",
  },
  {
    question: "How does a CDN reduce latency?",
    answer:
      "A CDN caches content on edge servers geographically close to users, so requests avoid the long round trip to the origin. On a cache miss the edge fetches from origin and stores the response per its TTL and cache headers. CDNs primarily serve static assets, but edge computing and dynamic acceleration also improve routing for dynamic content.",
    category: "Networking",
  },
  {
    question: "Walk through what happens during DNS resolution.",
    answer:
      "The client asks a recursive resolver, which checks its cache and otherwise walks the hierarchy: root servers point to the TLD servers (like .com), which point to the domain's authoritative name servers, which return the record. Results are cached at every layer according to the record TTL. Low TTLs enable fast failover at the cost of more lookups.",
    category: "Networking",
  },
  {
    question: "What is the difference between a forward proxy and a reverse proxy?",
    answer:
      "A forward proxy sits in front of clients and makes requests on their behalf, used for anonymity, filtering, or egress control. A reverse proxy sits in front of servers, accepting requests and forwarding them to backends, used for load balancing, TLS termination, caching, and compression. The key distinction is who the proxy represents: clients versus servers.",
    category: "Networking",
  },
  {
    question: "When would you choose gRPC over REST?",
    answer:
      "gRPC uses HTTP/2 and Protocol Buffers, giving compact binary payloads, multiplexed streams, strongly typed contracts, and generated clients, which makes it a strong fit for internal service-to-service calls. REST with JSON is human-readable, cacheable, and universally supported, making it better for public APIs and browser clients. A common pattern is REST at the edge and gRPC internally.",
    category: "Networking",
  },
  {
    question: "What is anycast and where is it used?",
    answer:
      "Anycast advertises the same IP address from many locations, and internet routing (BGP) delivers each packet to the nearest one. It provides automatic geographic load distribution and failover without client-side logic. It is widely used by DNS providers and CDNs, such as the 1.1.1.1 and 8.8.8.8 resolvers.",
    category: "Networking",
  },

  // Data
  {
    question: "How do you decide between SQL and NoSQL databases?",
    answer:
      "Choose a relational database when you need ACID transactions, complex ad hoc queries, joins, and a well-understood schema; it should be the default. Choose NoSQL when the access patterns are known and simple, scale requirements exceed comfortable single-node relational limits, or the data model fits documents, key-value, wide-column, or graph shapes better. Many modern SQL systems also scale horizontally, so justify NoSQL by access pattern, not fashion.",
    category: "Data",
  },
  {
    question: "Compare range-based and hash-based sharding.",
    answer:
      "Range sharding assigns contiguous key ranges to shards, enabling efficient range scans but risking hotspots when traffic concentrates on one range, such as recent timestamps. Hash sharding distributes keys uniformly, eliminating most hotspots but destroying key ordering, so range queries must hit every shard. The right choice follows the query pattern: scans favor range, point lookups favor hash.",
    category: "Data",
  },
  {
    question: "How do you handle the hot key or celebrity problem in a sharded system?",
    answer:
      "A hot key (like a celebrity user's data) overwhelms its single shard regardless of how well other keys are distributed. Mitigations include caching the hot data aggressively, splitting the key by appending a random suffix and fanning reads across the copies, dedicating isolated capacity to known hot entities, and read replicas for hot partitions. Detecting hot keys via metrics is a prerequisite.",
    category: "Data",
  },
  {
    question: "What are the tradeoffs of adding database indexes?",
    answer:
      "Indexes turn full-table scans into logarithmic lookups, dramatically speeding reads that match the indexed columns. The costs are slower writes, since every insert or update must also maintain each index, plus extra storage and memory pressure. Index the columns your queries filter and sort on, and avoid indexing high-churn columns that are rarely queried.",
    category: "Data",
  },
  {
    question: "How does an LSM tree differ from a B-tree, and when is each preferred?",
    answer:
      "A B-tree updates data in place in fixed-size pages, giving strong read performance and predictable latency, which suits read-heavy relational workloads. An LSM tree buffers writes in memory and flushes sorted immutable segments to disk, merging them via compaction, which makes writes sequential and fast but can slow reads and cause write amplification. LSM engines (Cassandra, RocksDB) suit write-heavy workloads; B-trees (Postgres, MySQL InnoDB) suit read-heavy ones.",
    category: "Data",
  },
  {
    question: "What problem do vector clocks solve?",
    answer:
      "Vector clocks track causality between events in a distributed system without synchronized physical clocks. Each node keeps a counter per node and merges vectors on communication, so the system can tell whether one version of a value happened before another or whether they were concurrent conflicting updates. Dynamo-style databases use them to detect conflicts that need reconciliation instead of silently losing writes.",
    category: "Data",
  },
  {
    question: "How do quorum reads and writes provide consistency in leaderless replication?",
    answer:
      "With N replicas, writes wait for W acknowledgments and reads query R replicas; if R + W > N, every read set overlaps every write set, so a read sees at least one up-to-date copy. Tuning W and R trades latency and availability against staleness, for example W=N, R=1 for fast reads or W=1 for fast writes. Quorums alone do not guarantee linearizability under failures, which is why systems add read repair and hinted handoff.",
    category: "Data",
  },
  {
    question: "When is denormalization worth it?",
    answer:
      "Denormalization duplicates data across tables or documents to eliminate expensive joins on the read path, trading storage and write complexity for read speed. It is worth it in read-heavy systems where join latency dominates, such as precomputed feeds or embedded author names on posts. The cost is keeping copies in sync, which requires careful update paths or asynchronous propagation and tolerance for brief inconsistency.",
    category: "Data",
  },
  {
    question: "What is change data capture (CDC) and what is it used for?",
    answer:
      "CDC streams a database's changes, usually by tailing its write-ahead log or binlog, into downstream consumers as an ordered event feed. It keeps caches, search indexes, data warehouses, and other services in sync with the source of truth without dual writes. Tools like Debezium with Kafka are the canonical implementation, and CDC underpins reliable cache invalidation and event-driven integration.",
    category: "Data",
  },
  {
    question: "How does a bloom filter work and where would you use one?",
    answer:
      "A bloom filter is a compact probabilistic bit array where multiple hash functions set bits per inserted key; membership checks can return false positives but never false negatives. It answers \"definitely not present\" cheaply, so systems use it to skip expensive lookups, such as LSM storage engines avoiding disk reads for absent keys, or checking username availability. Its size and hash count tune the false positive rate.",
    category: "Data",
  },
  {
    question: "Compare cache-aside, write-through, and write-behind caching.",
    answer:
      "In cache-aside, the application reads the cache first, loads from the database on a miss, and populates the cache; it is simple and the most common pattern. Write-through writes to cache and database synchronously, keeping them consistent at the cost of write latency. Write-behind acknowledges writes at the cache and flushes to the database asynchronously, which is fast but risks data loss if the cache fails before flushing.",
    category: "Data",
  },
  {
    question: "Why is cache invalidation hard, and what strategies help?",
    answer:
      "The cache and the source of truth are updated at different times over an unreliable network, so any dual-write scheme can leave them permanently inconsistent under partial failure. Practical strategies include TTLs as a safety net so staleness is bounded, deleting rather than updating cache entries on writes, and driving invalidation from CDC so it follows committed database changes. Most systems accept bounded staleness rather than perfect coherence.",
    category: "Data",
  },

  // Architecture
  {
    question: "When would you choose fan-out on read over fan-out on write?",
    answer:
      "Fan-out on write precomputes each follower's feed at post time, making reads fast but making a celebrity's post trigger millions of writes. Fan-out on read assembles the feed at request time, making writes cheap but reads expensive. Choose fan-out on write for typical users to optimize the read-heavy path, and fan-out on read for high-follower accounts; large systems like Twitter use this hybrid.",
    category: "Architecture",
  },
  {
    question: "What are the tradeoffs between a monolith and microservices?",
    answer:
      "A monolith is simpler to develop, test, deploy, and debug, with in-process calls and single-database transactions. Microservices enable independent scaling, deployment, and team ownership, but introduce network latency, partial failures, distributed transactions, and heavy operational tooling. Start with a modular monolith and extract services when team scale or divergent scaling needs justify the overhead.",
    category: "Architecture",
  },
  {
    question: "When should you put a message queue between two services?",
    answer:
      "Use a queue when work can be asynchronous: it decouples producer and consumer availability, absorbs traffic spikes as a buffer, enables retries, and lets consumers scale independently. The costs are added latency, eventual consistency, and operating the broker, plus handling duplicates since most queues deliver at-least-once. Keep synchronous calls for requests where the client needs the result immediately.",
    category: "Architecture",
  },
  {
    question: "What is the difference between a message queue and pub/sub?",
    answer:
      "In a queue, each message is consumed by exactly one worker from a competing consumer pool, which suits task distribution. In pub/sub, every subscriber (or subscriber group) receives its own copy of each message, which suits broadcasting events to multiple independent systems. Kafka blends both: consumer groups compete within a group while multiple groups each get the full stream.",
    category: "Architecture",
  },
  {
    question: "What is CQRS and when is it justified?",
    answer:
      "CQRS separates the write model (commands) from the read model (queries), letting each use its own schema, storage, and scaling strategy, typically synced via events. It is justified when reads and writes have very different shapes or loads, such as a normalized transactional store feeding denormalized read views or search indexes. The price is eventual consistency between models and significantly more moving parts.",
    category: "Architecture",
  },
  {
    question: "How does the saga pattern handle distributed transactions?",
    answer:
      "A saga breaks a cross-service transaction into a sequence of local transactions, each publishing an event or reply that triggers the next step. If a step fails, previously completed steps are undone by explicit compensating transactions, such as refunding a charge. Sagas can be choreographed through events or orchestrated by a coordinator; they trade the atomicity of 2PC for availability and loose coupling.",
    category: "Architecture",
  },
  {
    question: "What problem does the outbox pattern solve?",
    answer:
      "Writing to a database and publishing to a message broker are two systems, so doing both directly can leave them inconsistent when one succeeds and the other fails. The outbox pattern writes the event into an outbox table within the same database transaction as the state change, and a separate relay (poller or CDC) publishes it to the broker afterward. This guarantees at-least-once publication consistent with committed state, with consumers handling duplicates idempotently.",
    category: "Architecture",
  },
  {
    question: "What does an API gateway do?",
    answer:
      "An API gateway is the single entry point in front of backend services, handling cross-cutting concerns: routing, authentication, rate limiting, TLS termination, request transformation, and response aggregation. It shields clients from internal service topology and lets those policies be enforced in one place. The risks are that it becomes a bottleneck or a dumping ground for business logic, so keep it thin and horizontally scaled.",
    category: "Architecture",
  },
  {
    question: "Compare token bucket and sliding window rate limiting.",
    answer:
      "A token bucket refills tokens at a steady rate up to a capacity, and each request spends a token, allowing short bursts up to the bucket size while enforcing an average rate. A sliding window log or counter tracks requests over the trailing interval, enforcing a smoother, stricter limit without bursts. Token bucket is memory-cheap and burst-friendly; sliding window is more precise at boundary conditions.",
    category: "Architecture",
  },
  {
    question: "What is event sourcing and what are its tradeoffs?",
    answer:
      "Event sourcing stores every state change as an immutable event, and current state is derived by replaying or folding the event log, often with snapshots for speed. It gives a complete audit trail, temporal queries, and the ability to rebuild new read models from history. The costs are schema evolution of old events, replay complexity, and that querying current state requires maintained projections; it pairs naturally with CQRS.",
    category: "Architecture",
  },

  // Reliability
  {
    question: "How does a circuit breaker prevent cascading failures?",
    answer:
      "A circuit breaker wraps calls to a dependency and trips open when the error rate or latency exceeds a threshold, failing fast instead of letting requests pile up on a dying service. While open, calls return immediately with an error or fallback, giving the dependency room to recover; after a timeout it goes half-open to probe with a few trial requests. This stops one slow service from exhausting threads and connections across the fleet.",
    category: "Reliability",
  },
  {
    question: "Compare leader-follower, multi-leader, and leaderless replication.",
    answer:
      "Leader-follower routes all writes through one node and replicates to followers, giving simple ordering but a failover bottleneck and read staleness on async followers. Multi-leader accepts writes in multiple locations, great for multi-region latency, but requires conflict resolution between concurrent writes. Leaderless (Dynamo-style) lets any replica accept writes with quorum reads and writes, offering high availability at the cost of consistency machinery like read repair and vector clocks.",
    category: "Reliability",
  },
  {
    question: "What is split brain and how do systems prevent it?",
    answer:
      "Split brain occurs when a network partition leaves two nodes each believing they are the leader, accepting conflicting writes that diverge the data. Prevention relies on quorum: a leader must hold support from a majority of nodes, so at most one side of a partition can elect one. Fencing tokens and STONITH additionally stop a deposed leader from continuing to write to shared storage.",
    category: "Reliability",
  },
  {
    question: "Why should retries use exponential backoff with jitter?",
    answer:
      "Immediate retries multiply load exactly when a service is struggling, turning a blip into an outage. Exponential backoff spaces attempts increasingly far apart, and jitter randomizes the timing so thousands of clients do not retry in synchronized waves. Retries should also be capped, budgeted, and applied only to idempotent operations to avoid duplicate side effects.",
    category: "Reliability",
  },
  {
    question: "What is the thundering herd problem and how do you mitigate it?",
    answer:
      "A thundering herd occurs when many clients or processes simultaneously hit the same resource, classically when a popular cache entry expires and thousands of requests stampede the database. Mitigations include request coalescing so only one request regenerates the value while others wait, staggered or randomized TTLs, serving stale data during refresh, and locks or singleflight around recomputation.",
    category: "Reliability",
  },
  {
    question: "What is backpressure and how do systems apply it?",
    answer:
      "Backpressure is a mechanism for a downstream component to signal an upstream producer to slow down when it cannot keep up, instead of buffering unboundedly until it collapses. Techniques include bounded queues that block or reject when full, TCP flow control, reactive streams demand signaling, and load shedding of low-priority requests. Without backpressure, overload manifests as ballooning memory and latency followed by total failure.",
    category: "Reliability",
  },
  {
    question: "How does leader election work in consensus systems like Raft?",
    answer:
      "Nodes start as followers; if one hears no heartbeat from a leader within a randomized timeout, it becomes a candidate, increments the term, and requests votes. A candidate winning votes from a majority becomes leader and sends heartbeats; majorities guarantee at most one leader per term, preventing split brain. Randomized timeouts make vote splits rare, and stale leaders step down when they see a higher term.",
    category: "Reliability",
  },
  {
    question: "Compare blue-green and canary deployment strategies.",
    answer:
      "Blue-green runs two identical environments and switches all traffic from the old to the new at once, giving instant rollback by switching back, but exposing all users to a bad release simultaneously. Canary shifts a small percentage of traffic to the new version, monitors error rates and latency, and gradually ramps up, limiting the blast radius of defects. Canary is safer but slower and requires solid metrics and traffic splitting.",
    category: "Reliability",
  },
  {
    question: "What is graceful degradation and how do you design for it?",
    answer:
      "Graceful degradation means a system keeps serving its core function with reduced quality when dependencies fail, rather than failing entirely. Techniques include fallbacks (cached or default responses), feature flags to disable noncritical features under load, load shedding of low-priority traffic, and strict timeouts so a slow dependency cannot stall the whole request. It requires deciding in advance which features are essential.",
    category: "Reliability",
  },
  {
    question: "What is a health check and why distinguish liveness from readiness?",
    answer:
      "Health checks let load balancers and orchestrators decide whether an instance should receive traffic or be restarted. A liveness check asks whether the process is alive at all and should be restarted if not; a readiness check asks whether it can currently serve traffic, failing during startup, overload, or dependency outages. Conflating them causes restart loops: a service waiting on a dependency is not ready, but killing it does not help.",
    category: "Reliability",
  },
];
