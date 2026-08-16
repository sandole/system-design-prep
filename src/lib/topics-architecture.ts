import type { Topic } from "./types";

export const architectureTopics: Topic[] = [
  {
    slug: "microservices-vs-monolith",
    title: "Microservices vs Monolith",
    category: "Architecture",
    summary:
      "Choosing between a single deployable monolith and a fleet of independently deployed services is fundamentally a tradeoff between development simplicity and organizational scalability. Most systems should start as a well-structured monolith and split only when concrete pressure demands it.",
    sections: [
      {
        heading: "The Monolith and the Modular Monolith",
        body:
          "A monolith is a single deployable unit: one codebase, one build pipeline, one process (possibly horizontally scaled behind a load balancer). Calls between modules are in-process function calls, which are roughly 1000x faster than network calls (nanoseconds vs milliseconds) and cannot partially fail. Transactions across modules are ordinary database transactions with ACID guarantees. Debugging is a single stack trace, and refactoring across module boundaries is a compiler-checked rename.\n\nThe modular monolith is the disciplined version of this: a single deployable with strictly enforced internal boundaries, typically one module per business capability, communicating only through well-defined interfaces and ideally owning separate schemas or schema namespaces. Shopify runs one of the largest Rails applications in the world as a modular monolith with enforced component boundaries, and it handles Black Friday traffic in the millions of requests per minute. The key insight is that most benefits people attribute to microservices (clear ownership, independent modules, well-defined contracts) are achievable inside one deployable if the team has discipline.\n\nThe monolith's real failure modes are organizational and operational: build and test times grow superlinearly with codebase size, a single bad deploy takes down everything, all modules must scale together even if only one is hot, and the whole codebase is locked to one language and runtime. When a team of 200 engineers is queueing behind one deploy train, the monolith has become the bottleneck."
      },
      {
        heading: "What Microservices Actually Buy You",
        body:
          "Microservices decompose the system into independently deployable services, each owning its data and communicating over the network via APIs or messages. The primary benefit is independent deployability: team A can ship 20 times a day without coordinating with team B. This maps to Conway's Law, since the architecture mirrors and enables the org structure. Amazon's famous two-pizza teams each own services end to end, and Netflix runs on the order of a thousand microservices, which lets hundreds of teams deploy independently thousands of times per day.\n\nSecondary benefits include independent scaling (scale the video-encoding service to 500 instances while the billing service runs on 3), fault isolation (a memory leak in recommendations does not crash checkout, assuming proper bulkheads), and technology heterogeneity (a JVM service next to a Go service next to a Python ML service). Each service can also choose the datastore that fits its access pattern, such as Postgres for orders and Elasticsearch for search.\n\nNone of these benefits are free, and crucially, none of them matter much below a certain team size. A 5-person startup gets zero value from independent deployability because there is only one deploy stream anyway, but pays the full distributed-systems tax."
      },
      {
        heading: "The Operational Cost of Microservices",
        body:
          "Every in-process call that becomes a network call inherits latency, partial failure, retries, and timeouts. A user request that fans out across 10 services must reason about what happens when service 7 times out. You now need distributed tracing to debug anything, service discovery, per-service CI/CD pipelines, contract testing or schema registries to prevent breaking API changes, and an on-call rotation that understands cross-service failure modes. Segment famously published a post-mortem about consolidating hundreds of microservices back toward a monolith because the operational overhead of managing that many repos, queues, and deploy pipelines overwhelmed a small team, and Amazon Prime Video reported a 90 percent cost reduction after merging a distributed pipeline back into a monolithic process.\n\nData consistency is the deepest cost. Once orders and inventory live in different services with different databases, you lose cross-entity ACID transactions and must adopt sagas, outbox patterns, and eventual consistency, each of which adds code, failure modes, and reconciliation jobs. A common estimate is that a microservices architecture requires a dedicated platform team once you pass roughly 20 to 30 services, which is headcount a monolith does not need.\n\nThe distributed monolith is the worst outcome: services that must be deployed together, share a database, or call each other synchronously in long chains. It has the operational cost of microservices and the coupling of a monolith. If two services always change together, they should be one service."
      },
      {
        heading: "Service Boundaries and When to Split",
        body:
          "Good service boundaries follow business capabilities, not technical layers. Split by domain (orders, payments, inventory, identity) using domain-driven design bounded contexts, never by tier (a UI service, a business-logic service, a database service), because layer-based splits mean every feature touches every service. A well-drawn boundary has high cohesion inside, low coupling outside, and can be described in one sentence of business language. Each service must own its data exclusively; shared databases are the number one cause of distributed monoliths.\n\nSignals that it is time to extract a service: deploy contention (multiple teams blocked on one release train), a component with radically different scaling needs (the image-processing path needs GPUs, the rest does not), a component with different availability or compliance requirements (PCI scope isolation for payments), or a subsystem with a genuinely different rate of change. Extract incrementally using the strangler fig pattern: route a slice of traffic to the new service behind the existing interface, verify with shadow traffic or dual writes, then cut over. Rewriting everything at once is how migrations die.\n\nA sensible default answer in interviews: start with a modular monolith, enforce module boundaries and separate schemas from day one, and extract services only when a specific pain (team scaling, independent scaling, isolation) justifies the operational cost. This shows judgment rather than cargo-culting."
      }
    ],
    keyPoints: [
      "Monolith advantages: in-process calls, ACID transactions across modules, single deploy and debug surface, low operational overhead.",
      "Microservices advantages: independent deployability per team, independent scaling, fault isolation, per-service technology and datastore choice.",
      "The modular monolith captures most modularity benefits (clear boundaries, ownership) without the distributed-systems tax; Shopify runs at massive scale this way.",
      "Split along business capabilities (bounded contexts), never technical layers, and give each service exclusive ownership of its data.",
      "The distributed monolith (services that share databases or must deploy together) combines the worst of both worlds.",
      "Migrate incrementally with the strangler fig pattern; extract the service with the clearest boundary and highest pain first."
    ],
    tradeoffs: [
      {
        option: "Monolith (or modular monolith)",
        pros: [
          "Simple deployment, testing, and local development; one pipeline and one artifact",
          "In-process calls and ACID transactions; no partial failure between modules",
          "Far lower infrastructure and platform-team cost; ideal below roughly 50 engineers"
        ],
        cons: [
          "Whole system scales, deploys, and fails as one unit",
          "Build and test times grow with codebase; deploy trains create team contention",
          "Locked to one language and runtime; boundaries erode without discipline"
        ]
      },
      {
        option: "Microservices",
        pros: [
          "Independent deploys enable many teams to ship in parallel (Netflix, Amazon scale)",
          "Independent scaling and fault isolation per service",
          "Freedom to pick the right language and datastore per service"
        ],
        cons: [
          "Network calls introduce latency, timeouts, retries, and partial failure everywhere",
          "No cross-service ACID; requires sagas, outbox, and eventual consistency",
          "Heavy operational burden: tracing, service discovery, contract testing, platform team"
        ]
      }
    ],
    interviewTips: [
      "Default to 'start with a modular monolith, split when specific pressure appears' and name the pressures: deploy contention, divergent scaling needs, compliance isolation.",
      "Explicitly mention Conway's Law: microservices are as much an organizational tool as a technical one, so team size drives the decision.",
      "Call out the distributed monolith anti-pattern and the shared-database anti-pattern; interviewers listen for these.",
      "If asked to split a monolith, describe the strangler fig migration concretely: pick one bounded context, put a facade in front, dual-run, cut over."
    ],
    related: ["message-queues", "event-driven-architecture", "distributed-transactions", "api-design"]
  },
  {
    slug: "message-queues",
    title: "Message Queues and Streaming",
    category: "Architecture",
    summary:
      "Message queues decouple producers from consumers in time, rate, and availability, enabling async processing and load leveling. The core design decisions are the messaging model (point-to-point vs pub/sub), the delivery guarantee, and how ordering and failure handling work.",
    sections: [
      {
        heading: "Why Queues: Decoupling and Load Leveling",
        body:
          "A message queue sits between producers and consumers so that neither needs the other to be up, fast, or scaled the same way. Producers write and move on; consumers process at their own pace. This buys temporal decoupling (the email service can be down for 10 minutes and no orders are lost), load leveling (a spike of 50,000 requests per second gets absorbed by the queue and drained at the consumers' sustainable 5,000 per second), and independent scaling of the two sides.\n\nThe two classic models are point-to-point and publish/subscribe. In point-to-point, each message is consumed by exactly one worker from a shared queue, which is the model for task distribution: resize this image, send this email, charge this card. In pub/sub, each message is delivered to every subscriber, which is the model for event broadcast: OrderPlaced fans out to inventory, analytics, and notifications, each with its own subscription. Kafka unifies both with consumer groups: within one group, partitions are divided among members (point-to-point semantics for scaling), while multiple independent groups each get the full stream (pub/sub semantics).\n\nQueues are also the standard answer to write spikes in system design interviews: put a queue in front of the slow or expensive operation (video transcoding, third-party API calls, fan-out on write) so the user-facing path stays fast and the backlog is observable."
      },
      {
        heading: "Kafka vs RabbitMQ vs SQS",
        body:
          "Kafka is a distributed, partitioned, replicated commit log. Messages are appended to partitions and retained for a configured period (days or forever), regardless of consumption; consumers track their own offsets and can rewind and replay. This makes Kafka a streaming platform, not just a queue: the same topic feeds real-time consumers, batch jobs, and a new service backfilling from history. It was built at LinkedIn, where it grew to handle on the order of 7 trillion messages per day, and sequential disk I/O plus zero-copy transfer let a modest cluster sustain millions of messages per second. Choose Kafka for event streams, high throughput, replay, and multiple independent consumers of the same data.\n\nRabbitMQ is a traditional smart broker implementing AMQP. Messages are routed through exchanges (direct, topic, fanout, headers) into queues, pushed to consumers, and deleted on acknowledgment. It offers rich routing, per-message TTLs, priorities, and delayed delivery, with typical throughput in the tens of thousands of messages per second per node, and generally lower single-message latency at low volume than Kafka. Choose RabbitMQ for task queues and complex routing where you do not need replay or log retention.\n\nSQS is AWS's fully managed queue: effectively unlimited throughput on standard queues, no brokers to operate, pay per request. Standard queues give at-least-once delivery with best-effort ordering; FIFO queues give exactly-once processing and strict order within a message group, capped at 300 transactions per second per API action (3,000 with batching). Its visibility timeout model (a consumed message becomes invisible, then reappears if not deleted in time) is the mechanism behind its at-least-once behavior. Choose SQS when you are on AWS and want zero operational burden; pair with SNS for fan-out."
      },
      {
        heading: "Delivery Guarantees: At-Most-Once, At-Least-Once, Exactly-Once",
        body:
          "At-most-once means fire and forget: the producer does not wait for acknowledgment, or the consumer acks before processing, so a crash loses the message but nothing is ever duplicated. It is acceptable for metrics and logs where a small loss rate is tolerable. At-least-once means the message is retried until acknowledged after processing, so nothing is lost but duplicates occur: the consumer processes, crashes before acking, and the message is redelivered. This is the practical default for almost all real systems.\n\nBecause at-least-once is the default, consumers must be idempotent: processing the same message twice must have the same effect as once. Standard techniques are a deduplication table keyed by message ID (insert the ID in the same transaction as the side effect), natural idempotency (set status to shipped is safe to repeat, increment balance is not), or idempotency keys passed to downstream APIs the way Stripe accepts them on charge creation.\n\nExactly-once is best understood as exactly-once processing effect, not exactly-once delivery, which is impossible over an unreliable network in the general case (see the Two Generals problem). Kafka gets close within its own ecosystem: idempotent producers (broker deduplicates by producer ID and sequence number) plus transactions that atomically write output messages and commit consumer offsets, giving end-to-end exactly-once for Kafka-in, Kafka-out stream processing. The moment a side effect leaves Kafka (an HTTP call, a database write outside the transaction), you are back to at-least-once plus idempotency. Saying exactly that sentence in an interview is a strong signal."
      },
      {
        heading: "Ordering, Consumer Groups, and Partitioning",
        body:
          "Global ordering across a distributed queue does not scale, so systems offer ordering per partition or per message group instead. In Kafka, messages with the same key (say, user ID or order ID) hash to the same partition, and each partition is consumed by exactly one consumer within a group, so all events for a given order are processed in order. Choosing the partition key is a real design decision: it must match the entity whose order matters, and it must distribute well, since a hot key (one celebrity user, one huge tenant) creates a hot partition that caps throughput.\n\nConsumer groups are Kafka's unit of horizontal scaling. A topic with 32 partitions supports up to 32 active consumers in one group; adding a 33rd does nothing, which means partition count sets your parallelism ceiling and is expensive to change later, so it is typically overprovisioned (32 or 64 partitions for a topic that needs 8 consumers today). When consumers join or leave, the group rebalances, which briefly pauses consumption, and a consumer that is slow to heartbeat gets kicked out and its partitions reassigned, causing duplicate processing of in-flight messages, another reason idempotency is mandatory.\n\nRabbitMQ and SQS standard queues do not guarantee order once you have multiple consumers or redeliveries; SQS FIFO restores order per message group ID at the cost of throughput. A useful rule: require ordering only where the domain truly needs it, scope it to the narrowest key possible, and design consumers to tolerate reordering everywhere else."
      },
      {
        heading: "Dead Letter Queues and Backpressure",
        body:
          "A poison message that always fails (malformed payload, bug in a handler) will be redelivered forever under at-least-once semantics, blocking a FIFO queue entirely or wasting capacity on a standard one. The fix is a dead letter queue: after N failed attempts (SQS maxReceiveCount, RabbitMQ x-dead-letter-exchange, Kafka usually via an application-level retry topic chain like retry-5m, retry-1h, then DLQ), the message is shunted aside for inspection. A DLQ must be monitored and alerted on; an unmonitored DLQ is just silent data loss with extra steps. Design the operational loop: alert on DLQ depth, inspect, fix the bug, redrive messages back to the main queue.\n\nBackpressure is what happens when producers outrun consumers. In broker-based systems the queue absorbs the difference for a while, so the key metric is consumer lag (Kafka: offset lag per partition; SQS: ApproximateNumberOfMessagesVisible plus oldest message age). Growing lag means you must scale consumers, shed load, or slow producers. Kafka pushes backpressure naturally because consumers pull at their own rate; push-based systems like RabbitMQ use prefetch limits and publisher flow control, and brokers protect themselves with retention limits or max queue length, after which they drop or refuse messages.\n\nSizing sanity check for interviews: if producers emit 10,000 messages per second and each consumer handles 500 per second, you need at least 20 consumers, so at least 20 partitions, plus headroom to drain backlog after an outage (draining a 1-hour outage backlog at 1.5x capacity takes 2 more hours). Walking through that arithmetic unprompted is exactly what senior candidates do."
      }
    ],
    keyPoints: [
      "Queues decouple producers and consumers in time and rate: async processing, load leveling for spikes, independent scaling.",
      "Kafka is a replicated log with retention and replay (LinkedIn scale, trillions of messages per day); RabbitMQ is a smart-routing broker for task queues; SQS is zero-ops managed queuing on AWS.",
      "At-least-once is the practical default, so consumers must be idempotent (dedupe table, idempotency keys, naturally idempotent operations).",
      "Exactly-once means exactly-once processing effect, achievable within Kafka via idempotent producers and transactions, not generic exactly-once delivery.",
      "Ordering is per partition or message group, keyed by the entity that needs it; hot keys create hot partitions, and partition count caps consumer parallelism.",
      "Dead letter queues isolate poison messages after N retries and must be alerted on; consumer lag is the core backpressure signal."
    ],
    tradeoffs: [
      {
        option: "Kafka",
        pros: [
          "Very high throughput (millions of messages per second) via sequential log I/O and batching",
          "Retention and replay: multiple independent consumer groups, backfills, event sourcing",
          "Strong per-partition ordering and mature exactly-once support within the ecosystem"
        ],
        cons: [
          "Heavier operational burden (brokers, partitions, rebalances) unless using managed offerings",
          "Partition count fixes parallelism and is awkward to change; hot keys skew load",
          "Overkill for simple task queues; higher end-to-end latency at low volume than a lightweight broker"
        ]
      },
      {
        option: "RabbitMQ",
        pros: [
          "Rich routing (topic, fanout, headers), priorities, TTLs, delayed messages",
          "Low latency per message and simple semantics for work queues",
          "Mature, protocol-standard (AMQP), easy to run small"
        ],
        cons: [
          "No log retention or replay; a consumed message is gone",
          "Throughput ceiling far below Kafka for streaming workloads",
          "Ordering guarantees weaken with multiple consumers and redeliveries"
        ]
      },
      {
        option: "SQS (managed)",
        pros: [
          "Zero broker operations, effectively unlimited throughput on standard queues, pay per use",
          "Built-in DLQ and visibility timeout mechanics",
          "FIFO queues offer exactly-once processing and per-group ordering when needed"
        ],
        cons: [
          "Standard queues reorder and duplicate; FIFO throughput is capped (300 TPS, 3,000 batched)",
          "No replay or fan-out by itself (pair with SNS or Kinesis)",
          "AWS lock-in and per-request cost at very high volume"
        ]
      }
    ],
    interviewTips: [
      "When you add a queue to a design, immediately state the delivery guarantee and how consumers achieve idempotency; do not wait to be asked.",
      "Distinguish streaming (Kafka: retained log, replay, many readers) from task queues (RabbitMQ/SQS: consume and delete) and pick based on whether history matters.",
      "Do the throughput arithmetic out loud: messages per second, per-consumer rate, partition count, backlog drain time after an outage.",
      "Mention DLQs plus alerting for poison messages, and consumer lag as the metric that drives autoscaling."
    ],
    related: ["event-driven-architecture", "distributed-transactions", "microservices-vs-monolith", "rate-limiting"]
  },
  {
    slug: "event-driven-architecture",
    title: "Event-Driven Architecture",
    category: "Architecture",
    summary:
      "Event-driven architecture has services communicate by publishing facts about what happened rather than calling each other directly, trading synchronous coupling for eventual consistency. Its key patterns are event notification, event sourcing, CQRS, and the transactional outbox.",
    sections: [
      {
        heading: "Events vs Commands",
        body:
          "A command is a directed request for someone to do something (ChargeCard, ReserveInventory): it has one intended recipient, the sender cares about the outcome, and it can be rejected. An event is an immutable statement of fact about something that already happened (OrderPlaced, PaymentCaptured): it is past tense, cannot be rejected because it already occurred, and the publisher neither knows nor cares who consumes it. This inversion of knowledge is the whole point: with commands, the sender knows about the receiver; with events, the receiver knows about the sender's events, so adding a new consumer (fraud scoring, analytics, a data warehouse feed) requires zero changes to the producer.\n\nIn practice healthy systems mix both. A checkout flow might synchronously command the payment service (the user is waiting and needs a definitive answer), then publish OrderPlaced as an event for everything that can happen eventually: emails, loyalty points, warehouse picking, recommendations. A common smell is commands disguised as events, like SendWelcomeEmailRequested published to a topic with exactly one consumer; that is a command and coupling has just been hidden, not removed.\n\nEvent payload design matters too. Thin events (just OrderPlaced plus an order ID) force consumers to call back for details, reintroducing runtime coupling and read load; fat events carry the relevant state snapshot so consumers are self-sufficient, at the cost of larger payloads and schema evolution discipline. Most teams converge on fat domain events with versioned schemas managed through a schema registry."
      },
      {
        heading: "Event Sourcing",
        body:
          "Event sourcing changes the persistence model itself: instead of storing current state and updating it in place, you store the full sequence of events as the source of truth and derive state by replaying them. A bank account is not a row with balance 500; it is AccountOpened, Deposited 300, Deposited 400, Withdrew 200, and the balance is a left fold over that log. Accounting ledgers and git work exactly this way, which is the intuition to offer in interviews.\n\nThe benefits are a complete audit trail for free (what was the state on March 3, and why), temporal queries and debugging by replay, and the ability to build entirely new read models retroactively from history, since the events contain everything that ever happened. Replaying millions of events per entity is avoided with periodic snapshots: persist state every N events and replay only the tail.\n\nThe costs are real: schema evolution is hard because events are immutable and live forever (you end up with upcasters translating v1 events to v3 on read), querying across entities requires building projections rather than writing a SQL query, deleting data for GDPR requires tricks like crypto-shredding (encrypt per-user, delete the key), and the mental model is unfamiliar to most teams. The honest guidance: event sourcing is excellent for domains that are naturally ledger-like (payments, trading, inventory movements) and overkill as a system-wide default. It also pairs naturally with Kafka-style logs, but a topic with retention is not automatically an event store; an event store needs per-entity streams and optimistic concurrency on append."
      },
      {
        heading: "CQRS: Separating Reads from Writes",
        body:
          "Command Query Responsibility Segregation splits the write model from the read model. Writes go through a model optimized for validating business rules and recording changes; reads are served from one or more projections denormalized for each query pattern. The models are synchronized asynchronously, usually by consuming the write side's events. The motivating fact is that read and write workloads differ wildly: a typical feed-style system might see 100 reads per write, and the shape that makes writes correct (normalized, invariant-enforcing) is the opposite of the shape that makes reads fast (denormalized, precomputed).\n\nA concrete example: an e-commerce order service writes to Postgres, publishes OrderPlaced and OrderShipped events, and projections consume those events to maintain an Elasticsearch index for order search, a Redis view for the user's recent orders, and a warehouse table for analytics. Each read store is disposable and rebuildable by replaying events, which is also the operational escape hatch when a projection has a bug: fix the code, replay, done.\n\nCQRS comes in grades, and saying so shows maturity. Grade one is just separate read and write paths over the same database (different models, maybe read replicas), which most large systems already do. Grade two is separate storage engines updated via events, which buys performance and flexibility at the cost of eventual consistency between write and read sides. Full CQRS plus event sourcing is powerful but should be justified per bounded context, not adopted wholesale. The classic user-facing consequence to design for: a user submits a change, the next page read hits a stale projection, and their edit seems to have vanished. Mitigations include read-your-own-writes (route that user's reads to the write model briefly), returning the updated state in the command response, or optimistic UI updates."
      },
      {
        heading: "The Outbox Pattern and Eventual Consistency",
        body:
          "The dual-write problem is the most common correctness bug in event-driven systems: a service writes to its database and then publishes to Kafka as two separate operations, and a crash between them yields a state change nobody heard about, or an event for a change that rolled back. There is no distributed transaction across a database and a broker, so the fix is the transactional outbox: write the business change and the event into an outbox table in the same local ACID transaction, then a separate relay publishes outbox rows to the broker and marks them sent. The relay is either a poller or, better, change data capture tailing the database's write-ahead log with a tool like Debezium, which is how many teams stream Postgres or MySQL changes into Kafka. Delivery becomes at-least-once, so consumers deduplicate by event ID, which they needed to do anyway.\n\nEventual consistency is the systemic property you accept in exchange for decoupling: after OrderPlaced is published, there is a window (usually milliseconds to seconds, unbounded during incidents) where inventory, search, and notifications disagree with the order service. Design for it explicitly: make the window observable (consumer lag metrics, end-to-end freshness probes), define per-view staleness budgets (search may lag 30 seconds, the user's own order page may not), and handle the business consequences of the window, for example overselling inventory gets resolved by a compensating cancellation event rather than prevented by a lock.\n\nTwo operational realities round this out. First, event ordering and redelivery mean consumers must be idempotent and tolerate out-of-order events across different keys. Second, debugging shifts from reading one stack trace to following a correlation ID across topics, so distributed tracing and a searchable event log are not optional. Interviewers frequently probe exactly here: how do you know the event was published, and what happens if the consumer processes it twice."
      }
    ],
    keyPoints: [
      "Events are immutable past-tense facts with unknown consumers; commands are directed requests with one recipient that can be rejected. Mixing them deliberately is normal.",
      "Adding a consumer to an event stream requires no producer change, which is the core decoupling win of EDA.",
      "Event sourcing stores the event log as the source of truth and derives state by replay; great for ledger-like domains, costly for schema evolution, cross-entity queries, and GDPR deletion.",
      "CQRS separates write models from denormalized read projections, synchronized via events; adopt it in grades and only per bounded context.",
      "The transactional outbox (often with CDC via Debezium) solves the dual-write problem; never write DB then publish as two unrelated operations.",
      "Eventual consistency must be designed for: staleness budgets, read-your-own-writes, consumer lag monitoring, and compensating events."
    ],
    tradeoffs: [
      {
        option: "Event-driven (async events)",
        pros: [
          "Loose coupling: producers do not know consumers; new consumers added with zero producer changes",
          "Natural buffering and resilience: a down consumer catches up instead of failing the caller",
          "Enables event sourcing, CQRS projections, and replay-based rebuilds"
        ],
        cons: [
          "Eventual consistency windows leak into UX and business logic",
          "Harder debugging: no single stack trace, requires correlation IDs and tracing",
          "Duplicate and out-of-order delivery force idempotent, order-tolerant consumers"
        ]
      },
      {
        option: "Synchronous request/response",
        pros: [
          "Immediate, definitive results; simple mental model and error handling",
          "Strong consistency at the call site; no staleness window",
          "Trivial to trace and test"
        ],
        cons: [
          "Availability couples: callee downtime or latency cascades to callers",
          "Fan-out chains multiply tail latency",
          "Adding consumers of a state change requires modifying the producer"
        ]
      }
    ],
    interviewTips: [
      "When you draw an event flow, immediately address the dual-write problem with the outbox pattern; it is the most commonly probed gap.",
      "Distinguish event notification from event sourcing explicitly; conflating 'we publish events' with 'events are our source of truth' is a red flag.",
      "Name the user-facing consequence of eventual consistency (stale read after write) and give a mitigation like read-your-own-writes.",
      "Scope big patterns: say CQRS or event sourcing applies to a specific bounded context (payments ledger, order history), not the whole system."
    ],
    related: ["message-queues", "distributed-transactions", "consistency-and-cap", "microservices-vs-monolith"]
  },
  {
    slug: "distributed-transactions",
    title: "Distributed Transactions and Sagas",
    category: "Architecture",
    summary:
      "Once a business operation spans multiple services or databases, single-node ACID transactions no longer apply. The main tools are two-phase commit (strong but blocking), sagas with compensations (available but eventually consistent), and the supporting machinery of idempotency, distributed locks, and fencing tokens.",
    sections: [
      {
        heading: "Two-Phase Commit and Why It Is Rarely Used",
        body:
          "Two-phase commit (2PC) makes multiple resource managers commit atomically. In phase one (prepare), a coordinator asks every participant to get the transaction durable and locked, and each votes yes or no; in phase two, if all voted yes the coordinator writes a commit record and tells everyone to commit, otherwise it broadcasts abort. The protocol guarantees atomicity: either all participants commit or none do.\n\nThe fatal flaw is blocking on coordinator failure. A participant that voted yes is in the in-doubt state: it holds locks and cannot unilaterally commit or abort, because it does not know the global decision. If the coordinator crashes after prepare, participants can hold locks for the entire coordinator recovery time, stalling every other transaction that touches those rows. 2PC also requires all participants to speak the protocol (XA support), and its multiple synchronous round trips make it slow: throughput drops by an order of magnitude versus local transactions in typical measurements. This is why 2PC across heterogeneous services (your Postgres, someone's REST API, a Kafka topic) is effectively a non-starter, and why modern microservice architectures avoid it.\n\nWhere 2PC-family protocols do live on is inside tightly controlled infrastructure: Google Spanner runs 2PC across Paxos groups, using Paxos replication to make both the coordinator and participants highly available, which removes the classic single-coordinator blocking problem at the cost of significant engineering and TrueTime infrastructure. The interview takeaway: 2PC gives atomicity but sacrifices availability and latency, and is viable only when one team controls all participants."
      },
      {
        heading: "Sagas: Choreography vs Orchestration",
        body:
          "A saga replaces one distributed transaction with a sequence of local transactions, each committed independently, plus a compensating transaction for each step to semantically undo it if a later step fails. Booking a trip becomes: reserve flight, reserve hotel, charge card; if the charge fails, run the compensations cancel hotel then cancel flight. Compensations are semantic, not rollbacks: you cannot un-send an email, so you send a correction; you refund a charge rather than erasing it. Steps must therefore be designed so that compensation is possible, which sometimes means introducing a pending state (reserve, then confirm) rather than acting irreversibly, and some steps are pivot points after which the saga must run forward to completion because compensation is no longer possible.\n\nChoreography implements the saga through events with no central controller: order service publishes OrderPlaced, payment service reacts and publishes PaymentCaptured, inventory reacts to that, and failure events trigger compensating reactions. It is loosely coupled and has no single point of failure, but the workflow exists nowhere as an artifact: to answer where is order 123 stuck, you grep event streams across five services, and adding a step means changing multiple services' subscriptions. It fits sagas of 2 to 4 steps.\n\nOrchestration puts a saga orchestrator in charge: it sends commands (ReservePayment, ReserveInventory), receives replies, persists the saga's state machine, and drives compensations on failure. The workflow is explicit, queryable, and testable in one place, at the cost of the orchestrator being a component that must itself be highly available and at some risk of accumulating business logic that belongs in the services. Tools like Temporal, AWS Step Functions, and Camunda exist precisely to make orchestrator state durable and recoverable. For sagas of 5 or more steps, or anything with timeouts, retries, and human approval steps, orchestration is generally the right call, and Uber, DoorDash, and Netflix all run large workflow orchestration platforms (Temporal came out of Uber's Cadence) for this reason. Note the isolation caveat: sagas have no I in ACID, so other transactions can observe intermediate states (order placed but not yet paid), which must be acceptable or masked with status fields."
      },
      {
        heading: "Idempotency: The Load-Bearing Wall",
        body:
          "Every retry-based mechanism in distributed systems (at-least-once queues, HTTP retries, saga step retries) rests on idempotency: performing the same operation twice has the same effect as once. Without it, a timeout plus retry double-charges a card. The canonical implementation is the idempotency key: the client generates a unique key per logical operation (a UUID per checkout attempt), sends it with the request, and the server atomically checks-and-records the key alongside the side effect; on a duplicate it returns the stored result of the first execution without re-executing. Stripe's API works exactly this way via the Idempotency-Key header, storing responses for 24 hours, and it is the reference example to cite.\n\nImplementation details that interviewers probe: the key check and the business write must be in the same transaction (or use a unique constraint on the key column and treat the violation as a duplicate), otherwise a race between two concurrent retries executes twice. Keys need a TTL and a scope (per operation type). And you must decide what a duplicate with a different payload means, usually a 422 error rather than silent acceptance.\n\nAlternatives and complements: natural idempotency by design (UPSERT with a deterministic ID, set-status operations rather than increments), deduplication tables keyed by message ID on consumers, and conditional writes (compare-and-set with a version number) that make replays harmless. A useful framing: exactly-once processing is always implemented as at-least-once delivery plus idempotent handling; there is no other trick."
      },
      {
        heading: "Distributed Locks and Fencing Tokens",
        body:
          "A distributed lock ensures at most one process acts on a resource at a time across machines, used for leader election, cron singletons, and guarding non-idempotent external actions. Implementations include a lease in Redis (SET key value NX PX 30000), or a session-based lock in ZooKeeper or etcd. Every practical lock is a lease with an expiry, because a lock without expiry plus a crashed holder equals a permanent deadlock.\n\nLeases create the classic safety bug that Martin Kleppmann's critique of Redlock made famous: process A acquires the lease, hits a 40-second GC pause or network partition, the lease expires, process B acquires it and starts writing, then A wakes up still believing it holds the lock and writes too, corrupting data. The lock service was correct; the client's belief was stale. Timeouts alone cannot fix this because you can never distinguish a slow process from a dead one.\n\nThe fix is fencing tokens: the lock service hands out a strictly monotonically increasing number with each lease grant (ZooKeeper's zxid or a version counter in etcd works naturally), the client includes the token with every write, and the protected resource (the storage service) rejects any write bearing a token lower than the highest it has seen. When zombie A writes with token 33 after B wrote with token 34, storage rejects A. The crucial architectural implication is that the resource itself must participate by checking tokens, which is also why fencing sometimes degenerates into just use conditional writes or transactions in the storage layer directly, and why the best interview answer often is: prefer making the operation idempotent or using the database's own concurrency control, and reach for distributed locks only when coordinating an external, non-transactional side effect."
      }
    ],
    keyPoints: [
      "2PC gives atomic commit across participants but blocks holding locks if the coordinator dies, requires XA everywhere, and kills latency; avoid it across microservices.",
      "Sagas trade atomicity and isolation for availability: local transactions plus semantic compensations, with intermediate states visible to other readers.",
      "Choreography (event-reactive, no controller) suits short sagas; orchestration (explicit state machine, e.g. Temporal or Step Functions) suits long or complex ones.",
      "Compensations are semantic undo (refund, cancel), and some steps are irreversible pivots after which the saga must run forward.",
      "Idempotency keys with atomic check-and-record (the Stripe model) are the foundation of every retry-safe operation.",
      "Lease-based locks are unsafe against paused zombie clients unless writes carry fencing tokens that the resource itself validates."
    ],
    tradeoffs: [
      {
        option: "Two-phase commit",
        pros: [
          "True atomicity and strong consistency across participants",
          "No compensation logic to write; rollback is built in",
          "Well understood, supported by XA-compliant databases and brokers"
        ],
        cons: [
          "Blocking: coordinator failure leaves participants in-doubt holding locks",
          "High latency (multiple synchronous rounds) and poor throughput",
          "All participants must support the protocol; unusable across third-party APIs"
        ]
      },
      {
        option: "Saga (choreography)",
        pros: [
          "No central coordinator; maximally decoupled and available",
          "Minimal infrastructure beyond the event bus",
          "Each service owns its own step and compensation"
        ],
        cons: [
          "Workflow is implicit and scattered; hard to see, debug, or modify",
          "Cyclic event dependencies creep in as steps grow",
          "No isolation: intermediate states are externally visible"
        ]
      },
      {
        option: "Saga (orchestration)",
        pros: [
          "Explicit, queryable workflow state; easy to answer 'where is this order stuck'",
          "Centralized retry, timeout, and compensation logic; tools like Temporal make it durable",
          "Adding or reordering steps changes one component"
        ],
        cons: [
          "Orchestrator is extra infrastructure that must be highly available",
          "Risk of business logic leaking into the orchestrator (a smart hub, dumb spokes smell)",
          "Still eventually consistent; isolation anomalies remain"
        ]
      }
    ],
    interviewTips: [
      "When a design spans services, say explicitly: no distributed ACID here, so I will use a saga with compensations, and name the compensation for each step.",
      "Contrast choreography vs orchestration by saga length and debuggability, and name a tool (Temporal, Step Functions) for the orchestrated case.",
      "Bring up idempotency keys before the interviewer does, with the Stripe Idempotency-Key header as the concrete example.",
      "If you propose a distributed lock, immediately mention lease expiry, the zombie-writer problem, and fencing tokens; that trio is the expected depth."
    ],
    related: ["message-queues", "event-driven-architecture", "consistency-and-cap", "replication"]
  },
  {
    slug: "fault-tolerance",
    title: "Fault Tolerance Patterns",
    category: "Reliability",
    summary:
      "Fault tolerance is designing the system to keep serving (possibly in degraded form) when components fail, because at scale something is always failing. The toolkit includes redundancy and failover, circuit breakers, retries with backoff and jitter, bulkheads, graceful degradation, and chaos engineering to verify it all works.",
    sections: [
      {
        heading: "Redundancy and Failover",
        body:
          "The foundation of fault tolerance is eliminating single points of failure through redundancy: N+1 instances behind a load balancer, replicas of every database, multiple availability zones, sometimes multiple regions. The arithmetic that motivates it: a single machine with 99 percent availability gives 87.6 hours of downtime a year, but two independent redundant machines give 99.99 percent, under the (often violated) assumption that failures are independent. Correlated failures (same rack, same AZ, same bad deploy, same certificate expiry) are why cloud architectures spread across at least three availability zones and why a single global config push is the most common cause of large outages.\n\nFailover comes in two main shapes. Active-passive keeps a standby that takes over when the primary fails, promoted either manually or by automated health checks; it is simpler and avoids split-brain by construction, but the standby is idle cost, failover takes seconds to minutes (DNS TTLs, promotion time, connection draining), and the passive path is chronically undertested, so failovers fail exactly when needed. Active-active serves traffic from all nodes simultaneously, so failover is just the load balancer removing a dead node from rotation: near-zero recovery time and no wasted capacity, but every node must handle concurrent writes or the system must partition traffic, which is where conflict resolution and sticky routing complexity lives.\n\nTwo metrics frame every failover discussion: RTO (recovery time objective, how long until service is restored) and RPO (recovery point objective, how much data you may lose). Synchronous replication gives RPO of zero at a latency cost; async replication is faster but a failover can lose the last seconds of writes. A senior answer states the RTO/RPO target first and derives the replication and failover design from it."
      },
      {
        heading: "Retries, Exponential Backoff, and Jitter",
        body:
          "Retries are the first response to transient failure and the fastest way to turn a partial outage into a total one. A naive immediate retry against a struggling service multiplies its load exactly when it can least afford it: if every client retries 3 times, a service at 100 percent capacity suddenly faces 300 percent load, a retry storm. The standard discipline is exponential backoff: wait 100ms, then 200, 400, 800, capped at some maximum, so pressure decays instead of spiking.\n\nBackoff alone is not enough because a mass failure synchronizes clients: everything that failed at time T retries at T+100ms, then T+300ms, in coordinated waves (the thundering herd). The fix is jitter, randomizing each delay. AWS's Architecture Blog analysis found full jitter (sleep a uniform random amount between 0 and the exponential cap) close to optimal: it smears the herd across time, dramatically reducing peak contention for the same total work.\n\nRetries also need a budget and placement discipline. Retry only idempotent operations or use idempotency keys; cap total attempts (typically 2 to 3) and total elapsed time against the caller's own timeout; and retry at one layer, not every layer, because 3 retries at each of 4 layers in a call chain is 81 attempts hitting the bottom service. Mature systems use retry budgets (for example, retries may add at most 10 percent extra load, the approach used in Google SRE practice and in service meshes like Linkerd) and treat timeout choice as part of the same design: a downstream timeout must be shorter than the upstream deadline it lives inside, ideally propagating deadlines through the call chain."
      },
      {
        heading: "Circuit Breakers and Bulkheads",
        body:
          "A circuit breaker stops calling a dependency that is failing, converting slow cascading failures into fast local ones. It is a state machine: closed (normal operation, counting failures), open (failure rate exceeded the threshold, for example 50 percent of calls in a 10-second window, so all calls fail immediately without touching the dependency for a cooldown like 30 seconds), and half-open (after the cooldown, allow a few probe requests; success closes the circuit, failure reopens it). The point is twofold: the caller stops burning threads and latency on a dead dependency, and the dependency gets breathing room to recover instead of being hammered while down. Netflix's Hystrix popularized the pattern (since retired in favor of Resilience4j and adaptive concurrency limits, worth mentioning to show currency), and service meshes like Envoy implement it as outlier detection, ejecting bad hosts from the pool.\n\nEvery circuit breaker needs a fallback answer for what to return while open: a cached value, a default (empty recommendations row), a queued write to process later, or an explicit error to the user. The fallback is a product decision, not just an engineering one.\n\nBulkheads isolate resources so one failing dependency cannot exhaust shared capacity, named after ship compartments that contain flooding. The classic incident: service X calls dependencies A and B from one thread pool of 200; B starts timing out at 30 seconds, every thread piles up waiting on B, and now calls to perfectly healthy A fail too because no threads remain. Bulkheading gives each dependency its own pool or semaphore (say 10 concurrent calls max to B), so B's failure saturates only B's compartment. The same principle applies at every level: separate connection pools per downstream, separate instance groups per customer tier or workload class, cell-based architecture where customers are partitioned into independent cells so an incident hits one cell's customers, not everyone. AWS builds heavily on cells for exactly this blast-radius argument."
      },
      {
        heading: "Graceful Degradation and Chaos Engineering",
        body:
          "Graceful degradation is deciding in advance which parts of the product are load-bearing and which are shed first under stress. Netflix's canonical example: if the personalization service is down, serve a popularity-based generic row rather than an error, because playing video matters and perfect recommendations do not. Other standard degradations: serve stale cache when the database is unhealthy (an old homepage beats a 500), disable expensive features under load (search suggestions, real-time counters), switch to read-only mode during a primary failover, and load-shed the lowest-priority traffic first (drop batch and crawler traffic before user requests). This requires explicitly ranking functionality by criticality and wiring feature flags or kill switches so operators can shed load in seconds during an incident, not ship a change.\n\nChaos engineering verifies that all of the above actually works by injecting failures on purpose, in production, in a controlled way. Netflix's Chaos Monkey (2011) randomly terminated production instances during business hours, forcing every team to build instance-death tolerance as table stakes; the practice grew into terminating whole AZ and region dependencies (Chaos Kong) and a discipline of formal experiments: define steady state (business metric like stream starts per second), form a hypothesis (killing one Cassandra node does not move it), inject the failure with a small blast radius and an abort button, and compare. The finding that matters is always the surprise: the retry storm nobody predicted, the hard dependency that was supposed to be soft.\n\nThe cultural point to land in an interview: failover paths, fallbacks, and breakers that are never exercised are broken by default (untested backups famously do not restore). Regular game days, automated fault injection in CI or staging, and periodic real failovers of production databases are what turn a fault-tolerance diagram into actual fault tolerance."
      }
    ],
    keyPoints: [
      "Redundancy across independent failure domains (instances, AZs, regions) is the foundation; correlated failures like bad deploys and config pushes are the residual killer.",
      "Active-passive failover is simpler but slower and undertested; active-active gives near-zero RTO at the cost of concurrent-write and routing complexity. Anchor the choice in RTO/RPO targets.",
      "Retries need exponential backoff, jitter (AWS full jitter), idempotency, attempt caps, and single-layer placement to avoid retry storms and 81x amplification.",
      "Circuit breakers (closed/open/half-open, Hystrix then Resilience4j) fail fast and give dependencies room to recover; every breaker needs a defined fallback.",
      "Bulkheads (per-dependency pools, cells) contain blast radius so one slow dependency cannot exhaust shared threads or take down all customers.",
      "Graceful degradation is a pre-ranked product decision (Netflix's generic recommendations row); chaos engineering (Chaos Monkey, game days) is how you prove any of it works."
    ],
    tradeoffs: [
      {
        option: "Active-active multi-node/multi-region",
        pros: [
          "Near-zero failover time; capacity fully utilized",
          "Failover path is exercised constantly by real traffic, so it actually works",
          "Scales reads and writes across nodes or regions"
        ],
        cons: [
          "Concurrent writes require conflict resolution or careful traffic partitioning",
          "More complex routing, data replication, and testing",
          "Higher steady-state engineering cost"
        ]
      },
      {
        option: "Active-passive failover",
        pros: [
          "Simple mental model; split-brain avoided by having one writer",
          "Cheaper to build; standard for relational database HA",
          "Clear, sequential failover procedure"
        ],
        cons: [
          "RTO of seconds to minutes; async replication risks nonzero RPO",
          "Standby capacity is idle cost",
          "Rarely exercised path that tends to fail during real incidents unless drilled"
        ]
      },
      {
        option: "Aggressive retries vs fail fast",
        pros: [
          "Retries mask transient blips and improve perceived reliability for one-off failures",
          "Fail-fast (breakers, low attempt caps) protects the system during real outages and keeps latency bounded"
        ],
        cons: [
          "Aggressive retries amplify load exactly during outages (retry storms, thundering herd)",
          "Fail-fast surfaces more errors to callers during brief blips and needs fallback design"
        ]
      }
    ],
    interviewTips: [
      "Trace one failure end to end: dependency B hangs, timeouts fire, breaker opens, fallback serves cached data, alerts page, breaker half-opens and recovers. That narrative beats listing pattern names.",
      "Say 'exponential backoff with jitter, capped attempts, idempotent operations only, retries at a single layer' as one breath; each omission is a follow-up question you did not want.",
      "Quantify availability: 99.9 is 8.7 hours down per year, 99.99 is 52 minutes; serial dependencies multiply (five 99.9 services in a chain give roughly 99.5).",
      "Name-drop precisely: Hystrix popularized breakers but is retired (Resilience4j, Envoy outlier detection); Chaos Monkey forced instance-death tolerance at Netflix."
    ],
    related: ["observability", "load-balancing", "replication", "rate-limiting"]
  },
  {
    slug: "observability",
    title: "Observability: Metrics, Logs, Traces",
    category: "Reliability",
    summary:
      "Observability is the ability to ask arbitrary questions about a running system from its outputs, built on three pillars: metrics, logs, and traces. It becomes actionable through methods like RED and USE, SLO-based alerting, and error budgets that turn reliability into a negotiable engineering resource.",
    sections: [
      {
        heading: "The Three Pillars and Their Cost Profiles",
        body:
          "Metrics are numeric time series (request count, latency histogram, queue depth), aggregated at the source, cheap to store and query, and ideal for dashboards and alerts. Their cost scales with cardinality, not traffic: a counter labeled by endpoint and status code is nearly free at any request volume, but adding a user_id label with a million values multiplies the series count and is the classic way teams blow up their Prometheus. Metrics tell you that something is wrong and roughly where, but not why for a specific request.\n\nLogs are discrete, timestamped events with arbitrary detail, the ground truth for individual occurrences. Modern practice is structured logging (JSON with consistent fields like request_id, user_id, latency_ms) so logs are queryable rather than grepped prose. Cost scales linearly with traffic, which is why log volume at scale forces sampling or tiered retention (hot searchable for 7 to 30 days, cold object storage after), and why a service logging 1KB per request at 10,000 RPS produces roughly 850GB per day before replication.\n\nTraces follow one request across service boundaries: a trace is a tree of spans, each span one operation with start time, duration, and attributes, glued together by a trace ID propagated in headers (W3C traceparent). Google's Dapper paper (2010) established the model; Zipkin, Jaeger, and now OpenTelemetry, the CNCF standard that unifies instrumentation APIs and wire formats for all three pillars, descend from it. Traces answer where did these 3 seconds go across 12 services, the question neither metrics nor logs can. Because full tracing is expensive, systems sample: head-based sampling (decide at the front, say 1 percent) is cheap but misses rare errors; tail-based sampling (buffer, then keep the slow and failed traces) keeps the interesting ones at the cost of buffering infrastructure. The three pillars converge in practice: a metric alert fires, you pivot to exemplar traces from the bad window, then to the logs of the failing span, all joined by trace and request IDs."
      },
      {
        heading: "RED and USE: Knowing What to Measure",
        body:
          "The RED method, articulated by Tom Wilkie, defines the three signals for every request-driven service: Rate (requests per second), Errors (failed requests per second), and Duration (latency distribution, not averages). Every service dashboard should lead with these three, uniformly, so an on-call engineer can walk down the architecture during an incident reading identical panels for every service. RED is essentially the user's view of a service: how often it is asked, how often it lies, how long it takes.\n\nThe USE method, from Brendan Gregg, covers resources rather than services: for every resource (CPU, memory, disk I/O, network, connection pools, thread pools), check Utilization (fraction of time busy), Saturation (queued work that cannot be served yet, like run-queue length or a full connection pool), and Errors. Saturation is the leading indicator; a disk at 90 percent utilization with no queue is fine, while a growing queue means latency is about to explode. USE catches the causes (a saturated pool) whose symptoms RED displays (rising duration).\n\nLatency must be handled as distributions and percentiles: means lie. If p50 is 20ms and p99 is 2 seconds, one customer in a hundred has a terrible experience, and at 100 requests per page load, most page loads contain a p99 request. Track p50, p95, p99 from histograms, and never average percentiles across hosts (aggregate the histograms instead). Google's SRE book frames the same territory as the four golden signals: latency, traffic, errors, saturation, which is RED plus saturation, and citing both shows range."
      },
      {
        heading: "Alerting That Pages on Pain, Not Noise",
        body:
          "The cardinal rule is to alert on symptoms (user-visible pain: error rate, latency, correctness) and not on causes (CPU is high, a host is down). Cause-based alerts generate pages for conditions users never notice (one dead instance behind a load balancer is Tuesday), and each false page erodes on-call trust until real pages get ignored, the alert fatigue that post-mortems repeatedly identify as a contributing factor. Causes belong on dashboards for diagnosis and in tickets for follow-up, not on pagers at 3am.\n\nEvery page must be actionable, urgent, and novel: a human must need to do something now that automation cannot. Anything else is a ticket or a dashboard. Good hygiene includes runbook links in every alert, multi-window checks to suppress flapping, and severity tiers where only the top tier pages.\n\nThe modern refinement is SLO-based alerting on burn rate: instead of paging when error rate exceeds a static 1 percent for 5 minutes, page when the error budget is being consumed too fast. A burn rate of 1 means you will spend exactly your monthly budget in a month; the SRE Workbook's standard policy is to page at 14.4x burn over 1 hour (consuming 2 percent of the monthly budget in an hour) and 6x over 6 hours, and only ticket slower burns. Multi-window multi-burn-rate alerts catch both fast outages and slow bleeds while staying quiet for noise that will not threaten the SLO."
      },
      {
        heading: "SLOs and Error Budgets",
        body:
          "An SLI is a measured indicator (the fraction of requests under 300ms that returned non-5xx, measured at the load balancer); an SLO is the target on it (99.9 percent over a rolling 30 days); an SLA is the external contract with financial penalties, always looser than the internal SLO. Choosing the SLI carefully matters more than the number: measure as close to the user as possible, define what counts as good explicitly, and exclude only what you can defend.\n\nThe error budget is the SLO's complement made spendable: 99.9 percent over 30 days allows 43.2 minutes of full downtime, or 0.1 percent of requests failing continuously. This reframes reliability from a virtue into a resource. Budget remaining means teams ship fast, run chaos experiments, and take risks; budget exhausted triggers the agreed policy, classically a feature freeze with engineering redirected to reliability until the budget recovers. The genius of the mechanism, as Google's SRE book presents it, is political: it replaces the eternal dev-versus-ops argument about whether the system is reliable enough with a number both sides agreed to in advance, and it makes 100 percent explicitly the wrong target, since each added nine costs roughly 10x and users on flaky wifi cannot tell 99.99 from 99.999.\n\nPractical failure modes worth naming: SLOs set aspirationally rather than from measured baselines (instant permanent violation, policy ignored), too many SLOs (nobody can attend to 40 of them; pick 2 or 3 user journeys), and error budget policies without teeth (a freeze that leadership overrides the first time it binds is theater). A senior candidate ties the loop together: SLIs feed SLOs, SLOs define budgets, budgets drive burn-rate alerting and the ship-versus-stabilize decision."
      }
    ],
    keyPoints: [
      "Metrics (cheap, aggregated, cardinality-limited), logs (per-event ground truth, cost scales with traffic), and traces (cross-service request trees from Dapper lineage) answer different questions and are joined by trace/request IDs.",
      "OpenTelemetry is the current standard for instrumenting all three pillars; tail-based sampling keeps the slow and failed traces.",
      "RED (rate, errors, duration) for every service; USE (utilization, saturation, errors) for every resource; saturation is the leading indicator.",
      "Use latency percentiles (p50/p95/p99) from histograms; never averages, never averaging percentiles across hosts.",
      "Page on user-visible symptoms, not causes; every page must be actionable, urgent, and novel, or it belongs in a ticket or dashboard.",
      "SLO error budgets (99.9 percent monthly = 43.2 minutes) turn reliability into a spendable resource, with multi-window burn-rate alerts (14.4x/1h page) and a freeze policy when exhausted."
    ],
    tradeoffs: [
      {
        option: "High-cardinality observability (per-user labels, 100 percent tracing)",
        pros: [
          "Can answer arbitrary questions about any single user or request after the fact",
          "No sampling blind spots; rare bugs are always captured"
        ],
        cons: [
          "Metrics cardinality explosion and trace storage costs grow with users and traffic, easily dominating infra spend",
          "Query performance degrades; most captured data is never read"
        ]
      },
      {
        option: "Sampled, low-cardinality observability",
        pros: [
          "Cost bounded and predictable; dashboards stay fast",
          "Tail-based sampling preserves most diagnostic value (errors and slow traces) at a few percent of the cost"
        ],
        cons: [
          "Head-based sampling can miss the one weird request that matters",
          "Debugging a specific user's issue may lack data unless dynamically boosted"
        ]
      },
      {
        option: "SLO burn-rate alerting vs static-threshold alerting",
        pros: [
          "Burn-rate alerts page only when the SLO is genuinely threatened, cutting noise dramatically",
          "Static thresholds are simple to set up and reason about for infrastructure basics"
        ],
        cons: [
          "Burn-rate alerting requires defined SLOs and more sophisticated tooling first",
          "Static thresholds generate the false pages and alert fatigue that burn out on-call rotations"
        ]
      }
    ],
    interviewTips: [
      "Narrate the incident workflow: burn-rate alert fires, RED dashboard isolates the service, exemplar trace shows the slow span, span logs give the cause. Connecting the pillars beats defining them.",
      "Volunteer the percentile point (p99 matters, do not average percentiles) and the cardinality point (no user_id metric labels); both are classic senior signals.",
      "Compute an error budget on the spot: 99.9 monthly is 43.2 minutes, 99.99 is 4.3 minutes, and state what policy triggers when it is spent.",
      "Mention OpenTelemetry and trace-context propagation through queues (not just HTTP) if the design is event-driven."
    ],
    related: ["fault-tolerance", "performance-metrics", "message-queues", "load-balancing"]
  },
  {
    slug: "security",
    title: "Security Fundamentals",
    category: "Reliability",
    summary:
      "System design security covers proving who a caller is (authentication), deciding what they may do (authorization), protecting data in transit and at rest, and defending against the common attack classes. The recurring themes are defense in depth and never trusting the network.",
    sections: [
      {
        heading: "Authentication vs Authorization, Sessions vs JWTs",
        body:
          "Authentication (authn) establishes who you are; authorization (authz) decides what you may do. They are separate layers with separate failure modes: a broken authn lets attackers in as someone else, while broken authz (like IDOR, changing /orders/123 to /orders/124 and reading someone else's data) lets legitimate users do illegitimate things. Broken access control sits at the top of the OWASP Top 10 for a reason: authz must be enforced server-side on every request against the resource's owner, never inferred from what the UI happens to show.\n\nServer-side sessions are the classic web model: on login the server stores a session record and gives the browser an opaque random ID in a cookie (flagged HttpOnly, Secure, SameSite). The server holds all state, which means instant revocation (delete the session row and the user is out now) at the cost of a session-store lookup per request, typically Redis with roughly 1ms latency, and the session store becoming shared infrastructure across services.\n\nJWTs invert this: the server signs a token containing the claims (subject, roles, expiry) and any service holding the public key can verify it statelessly, no lookup, which is why JWTs dominate service-to-service and microservice edge auth. The cost is revocation: a signed token is valid until it expires no matter what, so a stolen token or a fired employee's token keeps working. The standard mitigation is short-lived access tokens (5 to 15 minutes) paired with long-lived refresh tokens that are stateful and revocable, plus optionally a denylist checked for high-value operations, at which point you have partially reinvented sessions and should say so. Implementation hygiene interviewers listen for: verify the algorithm (reject alg none, do not accept HS256 where RS256 is expected), validate issuer, audience, and expiry, and keep tokens out of localStorage when XSS is a concern."
      },
      {
        heading: "OAuth2, OpenID Connect, and API Keys",
        body:
          "OAuth2 is a delegated authorization framework: it lets a user grant a third-party app limited access to their resources without sharing their password. The roles are resource owner (the user), client (the app), authorization server (issues tokens), and resource server (the API). The flow to know cold is authorization code with PKCE: the client redirects the user to the authorization server, the user authenticates and consents, the client receives a one-time code and exchanges it (with a code verifier proving it initiated the flow) for an access token. PKCE closed the code-interception hole and is now recommended for all clients, including web apps; the older implicit flow is deprecated. Client credentials flow covers machine-to-machine auth with no user involved.\n\nA point that reliably distinguishes candidates: OAuth2 by itself is authorization, not authentication. Sign in with Google is OpenID Connect (OIDC), an identity layer on top of OAuth2 that adds a signed id_token (a JWT with standard identity claims) so the client learns who the user is, not merely that it can call an API. Using a bare OAuth2 access token as proof of identity is a known vulnerability pattern.\n\nAPI keys are the simplest credential: a static random string identifying a calling application, suited to server-to-server integrations and usage tracking (billing, rate limiting per key). Their weaknesses are that they are long-lived bearer secrets with no user context, so they demand hashing at rest (treat them like passwords), scoped permissions, per-key rate limits, rotation support, and secret scanning, since leaking keys in public GitHub repos is one of the most common real-world breach vectors. A typical mature stack: OIDC for humans at the edge, OAuth2 client credentials or mTLS for service-to-service, API keys only for external developer APIs."
      },
      {
        heading: "TLS and Encryption at Rest and in Transit",
        body:
          "Encryption in transit means TLS everywhere. The TLS handshake uses asymmetric cryptography and certificates to authenticate the server (a CA-signed certificate chain proving the server owns the domain) and to agree on symmetric session keys that encrypt the actual traffic; TLS 1.3 cut the handshake to one round trip and removed known-weak ciphers. Modern deployments get certificates free and auto-rotated via Let's Encrypt and ACME. Two design decisions come up in interviews: terminate TLS at the load balancer (cheaper, centralized certificates, but plaintext behind it) versus end-to-end TLS between services, and whether internal service-to-service traffic uses mutual TLS (mTLS), where both sides present certificates, giving every service a cryptographic identity. Service meshes like Istio exist substantially to automate mTLS certificate issuance and rotation.\n\nEncryption at rest protects stored data against stolen disks, snapshots, and improperly decommissioned hardware. The standard architecture is envelope encryption: data is encrypted with a data encryption key (DEK), the DEK is itself encrypted by a key encryption key (KEK) living in a KMS or HSM, and access to the KMS is audited and IAM-controlled. This makes key rotation cheap (re-encrypt the small DEKs, not terabytes of data) and enables crypto-shredding: destroy the key and the data is effectively erased, a practical answer for GDPR deletion in append-only stores. Know the layers: full-disk encryption (protects against physical theft only), database-level transparent encryption, and application-level field encryption for the most sensitive columns, which protects even against a compromised database but breaks indexing and querying on those fields.\n\nThe boundary to state clearly: encryption at rest does nothing against an attacker who compromises the running application, because the app can decrypt by design. That threat is addressed by access control, least privilege, and auditing, which is a defense-in-depth point interviewers reward."
      },
      {
        heading: "Common Attacks and Zero Trust",
        body:
          "Injection attacks smuggle attacker-controlled data into an interpreter. SQL injection (the canonical ' OR 1=1 --) is fully solved by parameterized queries, never string concatenation, with ORMs safe by default and input validation as a secondary layer only. XSS injects script into pages viewed by other users, mitigated by contextual output encoding (framework auto-escaping), Content-Security-Policy headers, and HttpOnly cookies so stolen-script access to tokens is limited. The pattern across all of them is the same: never mix code and data channels; keep untrusted input inert.\n\nDDoS attacks exhaust resources. Volumetric floods (hundreds of gigabits to terabits per second from botnets; major clouds have absorbed multi-terabit attacks) are absorbed by CDN and edge providers with massive anycast capacity, which is why the practical answer is Cloudflare, AWS Shield, or equivalent, not something you build. Protocol attacks (SYN floods, mitigated by SYN cookies) and application-layer attacks (expensive endpoints like search or login hammered at low volume) are subtler; the latter are fought with rate limiting per IP/user/key, CAPTCHAs on abuse signals, caching, and making expensive endpoints cheaper. Defense in depth stacks these: edge scrubbing, then WAF, then rate limits, then per-service bulkheads.\n\nZero trust replaces the castle-and-moat model (hard perimeter, trusted internal network) with never trust, always verify: every request is authenticated and authorized regardless of network origin, because perimeters fail (VPN compromise, phishing, insider threat, lateral movement after any single host is popped). Concretely this means strong identity for every user and workload (mTLS, short-lived credentials instead of static secrets in config), per-request policy enforcement, least privilege everywhere, and audit logging. Google's BeyondCorp, built after the 2009 Aurora intrusion, is the reference deployment: employees access internal apps from untrusted networks with no VPN, access decided per request from user identity and device posture. In system design answers, zero trust shows up as: no service trusts a caller just because it is inside the VPC; internal APIs authenticate with mTLS or signed tokens, and secrets live in a vault, not environment files."
      }
    ],
    keyPoints: [
      "Authn proves identity, authz enforces permissions per resource server-side; broken access control (IDOR) tops OWASP because authz is the part teams skip.",
      "Sessions are stateful and instantly revocable; JWTs are stateless and fast to verify but hard to revoke, so pair short-lived access tokens (5-15 min) with revocable refresh tokens.",
      "OAuth2 is delegated authorization (know the authorization code + PKCE flow); OIDC adds the identity layer that makes 'Sign in with Google' authentication.",
      "TLS 1.3 everywhere in transit, mTLS for service-to-service identity; envelope encryption (DEK wrapped by KMS-held KEK) at rest, enabling rotation and crypto-shredding.",
      "SQL injection dies to parameterized queries; XSS to output encoding and CSP; DDoS to edge/CDN absorption plus rate limiting on expensive endpoints.",
      "Zero trust (BeyondCorp): authenticate and authorize every request regardless of network location; no implicit trust for being inside the VPC."
    ],
    tradeoffs: [
      {
        option: "Server-side sessions",
        pros: [
          "Instant revocation and logout; full server control over active sessions",
          "Opaque IDs leak nothing if intercepted",
          "Simple, battle-tested model for browser apps with cookies"
        ],
        cons: [
          "Session-store lookup on every request; the store is shared infrastructure to scale and replicate",
          "Awkward across many independent services without centralizing auth",
          "Cookies need CSRF defenses (SameSite, tokens)"
        ]
      },
      {
        option: "JWT access tokens",
        pros: [
          "Stateless verification with a public key; no per-request store lookup, natural fit for microservices",
          "Carries claims (roles, tenant) so services avoid extra identity calls",
          "Standardized, cross-language ecosystem"
        ],
        cons: [
          "No revocation until expiry; stolen tokens work until TTL runs out",
          "Refresh-token machinery and denylists reintroduce state you tried to avoid",
          "Algorithm confusion and weak validation are recurring real-world vulnerabilities"
        ]
      },
      {
        option: "TLS termination at the edge vs end-to-end mTLS",
        pros: [
          "Edge termination centralizes certificates, offloads CPU, simplifies debugging",
          "mTLS end-to-end gives every service cryptographic identity and satisfies zero-trust internal networks"
        ],
        cons: [
          "Edge termination leaves plaintext on the internal network, an implicit-trust assumption",
          "mTLS everywhere is heavy certificate lifecycle work without a service mesh to automate it"
        ]
      }
    ],
    interviewTips: [
      "Say 'authentication then authorization, enforced server-side per resource' early, and mention IDOR as the failure mode; it signals you know where real bugs live.",
      "When you choose JWTs, immediately state the revocation weakness and the short-TTL-plus-refresh-token mitigation before being asked.",
      "Distinguish OAuth2 (authorization) from OIDC (authentication); confusing them is a known trap.",
      "For DDoS, lead with 'absorb volumetric at the edge (CDN/Shield), rate limit the application layer' rather than trying to solve it in your own servers."
    ],
    related: ["api-design", "rate-limiting", "cdn", "proxies"]
  },
  {
    slug: "probabilistic-data-structures",
    title: "Probabilistic Data Structures",
    category: "Data",
    summary:
      "Probabilistic data structures trade exact answers for enormous space savings: approximate set membership, frequency counts, and cardinality in kilobytes instead of gigabytes. Bloom filters, count-min sketch, and HyperLogLog, plus spatial indexes like geohash and quadtrees, appear constantly in real large-scale systems.",
    sections: [
      {
        heading: "Bloom Filters: Approximate Set Membership",
        body:
          "A Bloom filter answers is X in the set with two possible responses: definitely not, or probably yes. It is a bit array of m bits with k independent hash functions; to add an element, hash it k ways and set those k bits; to query, check the k bits, and if any is zero the element was definitely never added (no false negatives), while all ones means probably present (false positives possible, because other elements may have set those bits). The math is friendly: about 9.6 bits per element gives a 1 percent false positive rate regardless of element size, so 100 million URLs fit in roughly 115MB versus many gigabytes for the strings themselves. Optimal k is around (m/n) ln 2, typically 7 hashes for that 1 percent target.\n\nThe canonical uses exploit the one-sided error. LSM-tree databases (Cassandra, RocksDB, HBase, LevelDB) keep a Bloom filter per SSTable so a read for a missing key skips the disk entirely: definitely not here means no I/O, and the occasional false positive just costs one wasted read. Content and cache systems use them to avoid caching one-hit wonders (Akamai found roughly 75 percent of URLs were requested exactly once, so they cache only on second request, using a Bloom filter to remember first sightings). Browsers historically used them for malware URL prescreening, and databases use them for distributed joins (ship a Bloom filter of join keys instead of the keys themselves).\n\nLimits to volunteer: a standard Bloom filter supports no deletion (clearing bits would create false negatives; counting Bloom filters fix this at 4x space) and no enumeration, and the false positive rate degrades as it fills beyond its design capacity, so you size it for expected n up front or use scalable variants. The design question it answers in interviews is always the same shape: an expensive lookup (disk, network, database) dominated by misses, and a tiny in-memory filter that eliminates most of them."
      },
      {
        heading: "Count-Min Sketch: Approximate Frequencies",
        body:
          "A count-min sketch estimates how many times each item has appeared in a stream using fixed memory, regardless of how many distinct items exist. It is a 2D array of counters with d rows (one hash function each) and w columns; to record an item, hash it once per row and increment the d chosen counters; to query, take the minimum of the d counters. Collisions only inflate counters, so the estimate never undercounts, it only overcounts, with error bounded by epsilon times the total stream size with probability 1 minus delta, where w = e/epsilon and d = ln(1/delta). Concretely, a sketch of a few kilobytes (say 5 rows by 2,000 columns of 4-byte counters, about 40KB) tracks frequencies over streams of billions of events.\n\nBecause the guarantee is one-sided overcounting that hurts rare items proportionally more, the sketch shines for heavy hitters: which items are hot, not the exact count of a cold one. That is exactly the shape of real problems: top-K trending hashtags or searches, hot keys in a cache or shard (detecting the celebrity whose key needs special handling), per-IP request counting for approximate rate limiting or DDoS detection, and finding heavy flows in network switches. Pair it with a small heap of the current top K candidates and you get the standard streaming top-K design.\n\nWhen an interviewer asks for trending topics over the last hour across millions of events per second, the expected answer combines a count-min sketch (frequencies in bounded memory), a min-heap of the K best, and a windowing scheme (per-minute sketches that are summed or rotated, since sketches merge by element-wise addition, which also makes them shard-friendly: each server sketches locally, a coordinator merges)."
      },
      {
        heading: "HyperLogLog: Counting Distinct Elements",
        body:
          "HyperLogLog (HLL) estimates the number of distinct elements in a stream using about 12KB of memory for cardinalities into the billions, with a standard error of roughly 0.81 percent at the common 2^14-register configuration. The intuition: hash every element uniformly, and observe the maximum number of leading zero bits seen; seeing a hash starting with k zeros is a 2^-k event, so witnessing many leading zeros implies many distinct elements were hashed. One maximum is far too noisy, so HLL splits elements into 16,384 buckets by their first 14 hash bits, tracks the max leading-zero count per bucket, and combines the bucket values with a harmonic mean plus bias corrections. Duplicates hash identically, so they cannot move any maximum, which is precisely why the structure counts distinct elements.\n\nThe exact problem it solves is brutal at scale: distinct requires remembering every element seen, so counting unique visitors among a billion events needs gigabytes per counter, times every (page, day, country) combination you want. HLL makes each counter 12KB and, critically, mergeable: the union of two HLLs is the element-wise max of their registers, so per-hour or per-server sketches roll up losslessly into daily or global counts, which is exactly what pre-aggregated analytics needs. Redis ships it natively (PFADD, PFCOUNT, PFMERGE), Google's systems process HLL++ at scale (BigQuery's APPROX_COUNT_DISTINCT), and Reddit famously used HLL to serve live unique-view counts on posts.\n\nCaveats: HLL supports union beautifully but not deletion, and intersections only indirectly via inclusion-exclusion with compounding error. The interview trigger phrase is count unique X at scale where a small error is acceptable: unique visitors, distinct search queries, distinct IPs hitting an endpoint."
      },
      {
        heading: "Geohashing and Quadtrees: Indexing Space",
        body:
          "Geospatial queries (find drivers within 2km) defeat ordinary B-tree indexes because two-dimensional proximity does not map to one-dimensional order: an index on latitude alone returns a planet-wide band. Geohash solves this by interleaving the bits of latitude and longitude and encoding the result in base32, producing strings where a shared prefix implies spatial proximity: each added character subdivides the cell, with 5 characters being roughly 4.9 x 4.9 km and 6 characters roughly 1.2 x 0.6 km. Proximity search becomes a string prefix query any database can do, and cell IDs become natural shard keys and pub/sub channels. The classic gotcha to volunteer: prefix similarity is one-directional (shared prefix implies near, but near does not imply shared prefix), because cells on opposite sides of a boundary, or at the equator or antimeridian, are adjacent yet share no prefix; correct search therefore queries the cell plus its 8 neighbors.\n\nA quadtree attacks the same problem adaptively: recursively split the plane into four quadrants, but only subdivide nodes that exceed a capacity threshold (say 100 points), so dense downtown areas get deep fine-grained cells while empty ocean stays coarse. This adaptivity is its advantage over fixed geohash grids, which either over-divide sparse areas or under-divide dense ones; the cost is an in-memory tree structure that must be built, rebalanced as points move, and is harder to distribute than a flat key space. Range and k-nearest-neighbor searches descend only the intersecting quadrants, giving logarithmic behavior on realistic distributions.\n\nReal systems mix these with a third option, Google's S2 (hierarchical cells on a sphere via a space-filling curve, avoiding projection distortion and pole/antimeridian pathologies). Uber has used geohash-style cell indexing (and later its own hexagonal H3 grid, whose uniform neighbor distances suit ride-dispatch and surge-pricing math), Redis implements GEOADD and GEOSEARCH on geohash-encoded sorted sets, and Yext/Lyft-scale nearby searches commonly run on quadtree or S2 indexes. In a design-a-proximity-service interview (Yelp, Uber, Find my friends), the expected move is: choose a cell scheme (geohash for simplicity on top of existing key-value infrastructure, quadtree for adaptive density, S2/H3 for global correctness and uniformity), index entities by cell ID, query the covering cells plus neighbors, then exact-distance filter the candidates."
      },
      {
        heading: "Where They Show Up in Real Systems",
        body:
          "The unifying pattern: when the exact answer requires memory or I/O proportional to the data, and the business question tolerates approximately 1 percent error, a probabilistic structure collapses the cost by orders of magnitude. Web-scale companies wire these in everywhere: Cassandra and RocksDB consult Bloom filters before every SSTable read; CDNs use Bloom filters for cache-on-second-hit admission; Redis exposes HyperLogLog as a first-class type and geohash under its geo commands; stream processors like Flink and Druid use sketches (the Apache DataSketches library, born at Yahoo, standardizes HLL, theta sketches, and quantile sketches) for real-time dashboards; network and security gear uses count-min sketches for heavy-hitter and DDoS detection.\n\nA senior candidate also knows the boundaries. These structures are approximate, mostly non-deletable, and their guarantees are one-sided in specific directions (Bloom: false positives only; CMS: overcount only; HLL: small symmetric error), so they belong on the fast path with an exact system of record behind them: the Bloom filter avoids the disk read, but the SSTable is still the truth; the HLL powers the live dashboard, but billing runs an exact batch count. Stating which side the error falls on, and confirming the product can tolerate it, is the difference between name-dropping and engineering.\n\nA quick decision table for interviews: have I seen this before means Bloom filter; how often does each item occur or top K means count-min sketch plus heap; how many distinct means HyperLogLog; what is nearby means geohash, quadtree, or S2/H3 cells. Each answer should come with its memory figure (10 bits per element, tens of KB, 12KB, and cell-indexed rows respectively) because the numbers are the argument."
      }
    ],
    keyPoints: [
      "Bloom filters: no false negatives, tunable false positives, about 9.6 bits per element for 1 percent FPR; used in Cassandra/RocksDB SSTable reads and CDN cache admission; no deletion or enumeration.",
      "Count-min sketch: fixed-KB frequency estimates that only overcount; ideal for heavy hitters, top-K trending, and hot-key detection, paired with a min-heap and time windows.",
      "HyperLogLog: distinct counts into the billions in about 12KB with roughly 0.8 percent error; mergeable across shards and time buckets; native in Redis (PFCOUNT) and BigQuery.",
      "Geohash interleaves lat/lng bits so prefix similarity means proximity, but boundary cases require searching the 8 neighbor cells; quadtrees subdivide adaptively for skewed density; S2/H3 fix spherical pathologies.",
      "All of these are mergeable and shard-friendly, which is why they fit distributed streaming systems so well.",
      "Keep them on the fast path with an exact system of record behind them, and always state which direction the error falls and why the product tolerates it."
    ],
    tradeoffs: [
      {
        option: "Probabilistic structure (Bloom/CMS/HLL)",
        pros: [
          "Orders-of-magnitude memory reduction (12KB vs gigabytes for distinct counts)",
          "Constant-time updates and queries; mergeable for sharded and windowed aggregation",
          "Error is mathematically bounded and tunable via sizing"
        ],
        cons: [
          "Approximate answers with one-sided errors; unacceptable for billing, money, or compliance",
          "Generally no deletion, no enumeration, no lookups of raw members",
          "Must be sized for expected volume up front; accuracy degrades past design capacity"
        ]
      },
      {
        option: "Geohash grid vs quadtree",
        pros: [
          "Geohash: flat string keys work on any key-value store, trivially shardable, human-composable prefixes",
          "Quadtree: adapts cell size to density, so dense cities and empty oceans are both indexed efficiently"
        ],
        cons: [
          "Geohash: fixed grid over- or under-divides skewed data; boundary and pole issues force 8-neighbor queries",
          "Quadtree: in-memory tree needs rebuilds/rebalancing as points move and is harder to distribute"
        ]
      }
    ],
    interviewTips: [
      "Trigger-match out loud: seen-before means Bloom, frequency/top-K means count-min sketch, distinct count means HLL, nearby means geohash/quadtree; then give the memory number.",
      "Always state the error direction and check tolerance: Bloom false positives cost a wasted disk read (fine), false negatives would lose data (impossible here, which is why it works).",
      "In proximity designs, mention querying neighbor cells and exact-distance filtering after the cell lookup; skipping the neighbor step is the classic wrong answer.",
      "Mention mergeability when the design is sharded or windowed: per-server HLLs or sketches roll up losslessly, which is why analytics pipelines love them."
    ],
    related: ["caching", "sharding-and-partitioning", "storage-and-search", "rate-limiting"]
  }
];
