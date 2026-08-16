import type { CaseStudy } from "./types";

export const caseStudies6: CaseStudy[] = [
  {
    slug: "dating-app",
    title: "Design a Dating App (Tinder)",
    difficulty: "Medium",
    summary:
      "A location-based dating app where users swipe right or left on candidate profiles, a match is created when two users like each other, and matched users can chat. The core challenges are generating a fast geo-filtered candidate feed, detecting mutual likes cheaply, and keeping swipe latency low at high write volume.",
    functionalRequirements: [
      "Users create a profile with photos, bio, age, gender, and preferences (age range, distance radius, gender).",
      "Users see a stack of candidate profiles filtered by location and preferences, ordered by a recommendation score.",
      "Users swipe right (like) or left (pass) on candidates; each candidate is shown at most once.",
      "When two users like each other, a match is created and both are notified immediately.",
      "Matched users can exchange messages in a chat thread.",
      "Users can unmatch, block, and report other users.",
    ],
    nonFunctionalRequirements: [
      "Swipe writes must be acknowledged in under 100 ms p99; the feed must never stall waiting on writes.",
      "Match detection must be exactly-once: no duplicate match rows, no missed mutual likes.",
      "Candidate feed generation under 300 ms p99 including geo filtering and dedup against prior swipes.",
      "Scale to 50 million daily active users generating around 2 billion swipes per day.",
      "Location data is sensitive: coordinates are never exposed to clients, only rounded distances.",
      "High availability for swiping (eventual consistency acceptable for the feed, not for matches).",
    ],
    backOfEnvelope: [
      {
        label: "Swipe write QPS",
        value: "~23K avg, ~70K peak",
        note: "2B swipes/day / 86,400 s ≈ 23K/s; 3x peak factor for evening hours.",
      },
      {
        label: "Swipe storage per day",
        value: "~64 GB/day",
        note: "2B swipes x 32 bytes (two 8-byte ids, direction, timestamp) ≈ 64 GB before indexes.",
      },
      {
        label: "Matches per day",
        value: "~10M",
        note: "Roughly 1% of right swipes (assume 50% of swipes are right, ~1% mutual) ≈ 10M matches/day.",
      },
      {
        label: "Feed reads",
        value: "~6K QPS",
        note: "50M DAU x 10 feed refills / day ≈ 500M feed builds ≈ 6K/s average.",
      },
      {
        label: "Geo index size",
        value: "~4 GB in memory",
        note: "50M active users x ~80 bytes (id, geohash, age, gender, prefs) fits in one Redis cluster.",
      },
    ],
    apiDesign: [
      {
        endpoint: "GET /v1/feed?limit=25",
        description: "Returns a batch of candidate profiles for the current user, pre-filtered by geo radius, preferences, and prior swipes.",
      },
      {
        endpoint: "POST /v1/swipes {targetUserId, direction}",
        description: "Records a like or pass. Response includes matched: true when the swipe completes a mutual like.",
      },
      {
        endpoint: "GET /v1/matches?cursor=...",
        description: "Lists the current user's matches with the other user's profile summary and last message preview.",
      },
      {
        endpoint: "POST /v1/matches/{matchId}/messages {text}",
        description: "Sends a chat message within a match; delivered over a WebSocket or push notification to the peer.",
      },
      {
        endpoint: "DELETE /v1/matches/{matchId}",
        description: "Unmatches; hides the conversation for both sides and prevents further messages.",
      },
    ],
    highLevelDesign: [
      "Clients talk to an API gateway that fronts three main services: a Feed service, a Swipe service, and a Match/Chat service. User profiles live in a Postgres cluster sharded by user id, with a read-through cache for hot profiles.",
      "The Feed service answers the question: which nearby, preference-compatible users has this person not yet swiped on. It queries a geo index (Redis with geohash-bucketed sets, or PostGIS for the MVP) to get candidates within the radius, filters by age and gender preferences, then removes already-swiped ids using a per-user Bloom filter plus an exact check on the swipes table for the survivors. Surviving candidates are ranked by a score (recency of activity, profile completeness, ELO-style desirability) and returned in batches of 25.",
      "The Swipe service is write-optimized. Each swipe is appended to a swipes table sharded by swiper id and, when the direction is a like, the service performs mutual-like detection: check whether the target has already liked the swiper. Doing this check and the match insert in one transaction on a single shard keyed by the unordered user pair guarantees exactly-once match creation even when both users like each other simultaneously.",
      "When a match is created, an event is published to a message queue. Consumers create the chat thread, send push notifications to both users, and update each user's match list cache. Chat itself is a standard messaging subsystem: messages persisted to a table partitioned by match id, fanned out over WebSockets when both users are online.",
      "Swiped-on ids per user grow unboundedly, so the dedup layer is tiered: a Bloom filter in Redis (fast, tiny, false positives acceptable because a false positive only hides one candidate) backed by the authoritative swipes table. Feeds are also precomputed asynchronously for active users so the read path is mostly a cache pop.",
    ],
    dataModel: [
      {
        name: "users",
        fields: "user_id, name, birth_date, gender, bio, photos_json, geohash, lat, lng, pref_min_age, pref_max_age, pref_genders, pref_radius_km, last_active_at",
        note: "Sharded by user_id. lat/lng never leave the backend; clients get rounded distance only.",
      },
      {
        name: "swipes",
        fields: "swiper_id, target_id, direction, created_at",
        note: "Primary key (swiper_id, target_id) makes replays idempotent. Sharded by swiper_id.",
      },
      {
        name: "matches",
        fields: "match_id, user_a_id, user_b_id, created_at, unmatched_at",
        note: "user_a_id < user_b_id enforced so the pair has one canonical row; unique index on (user_a_id, user_b_id).",
      },
      {
        name: "messages",
        fields: "message_id, match_id, sender_id, body, created_at, read_at",
        note: "Partitioned by match_id; ordered by (match_id, created_at).",
      },
    ],
    deepDives: [
      {
        heading: "Mutual-like detection without race conditions",
        body: "The classic bug: user A and user B like each other within the same millisecond on different app servers. Each server checks for the reverse like, sees nothing (the other insert has not committed), and neither creates a match, or both do and you get duplicates.\n\nThe fix is to serialize per pair. Normalize the pair to (min_id, max_id) and route both swipes through the same database shard or the same transaction scope. Inside one transaction: insert the swipe, then query for the reverse like, then insert the match protected by a unique constraint on the normalized pair. If two transactions race, one blocks on the row lock or fails the unique constraint and treats the conflict as match already exists, which is the correct outcome.\n\nAn alternative at higher scale is a Redis-based approach: SADD the like into a set keyed by the pair and check cardinality atomically in a Lua script. Redis executes scripts single-threaded per key, so the second like always observes the first. The match event then flows to the database asynchronously.",
      },
      {
        heading: "Geo filtering and the candidate pipeline",
        body: "Naive distance queries (haversine over every user) do not scale. Instead, encode each user's location as a geohash and bucket users into cells. A radius query becomes: compute the set of geohash cells covering the circle, union the user sets of those cells, then do an exact distance check on the survivors. Redis GEOADD/GEOSEARCH implements exactly this and handles 50M points comfortably in memory.\n\nAfter geo filtering, the pipeline applies preference filters (age, gender, both directions: you must match their preferences too), removes prior swipes, and ranks. Filtering both directions is easy to forget and produces bad feeds: showing someone a candidate who would never see them back wastes a like.\n\nDense cities and sparse rural areas need different cell sizes. Use a coarse geohash precision for rural users (bigger cells, more candidates) and finer precision for cities, or expand the search ring outward until you have enough candidates. Cap candidate set size per query to bound latency.",
      },
      {
        heading: "Recommendation scoring and the ELO question",
        body: "The MVP ranking is a simple weighted score: recency of activity (active users first, so likes get answered), distance (closer first), and profile completeness. This alone produces a usable product.\n\nTinder historically used an ELO-style desirability score: being liked by highly-liked users raises your score, and you are shown people in a similar band. This improves match rates because likes are reciprocated more often within bands. Implement it as a periodically recomputed score in a batch job, not on the hot path.\n\nWhatever the model, keep scoring out of the synchronous feed path. Precompute ranked candidate lists into a per-user Redis list during off-peak or on a trigger (user opens app), so the feed endpoint is a cheap LRANGE plus a freshness check. Stale-but-fast beats fresh-but-slow for a swipe feed.",
      },
      {
        heading: "The already-swiped problem",
        body: "A power user can accumulate hundreds of thousands of swipes. Excluding all of them from every feed query with a NOT IN over the swipes table becomes the slowest part of feed generation.\n\nTier the dedup. First line: a per-user Bloom filter in Redis sized for ~1M entries at 1% false positive rate (about 1.2 MB per heavy user, far less for typical users if sized dynamically). A Bloom filter false positive merely hides one candidate the user has not actually seen, which is harmless. No false negatives means you never re-show a swiped profile.\n\nSecond line: for candidates that pass the Bloom filter, no database check is needed at all, because the filter has no false negatives. The exact swipes table is only consulted when rebuilding a lost filter. Rebuilds stream the user's swipe history from the swipes shard, which is an offline, per-user operation.",
      },
    ],
    bottlenecks: [
      "Swipe write throughput: 70K peak QPS of tiny writes; solved by sharding the swipes table by swiper id and batching acknowledgments, never by synchronous cross-shard writes.",
      "Simultaneous mutual likes racing across servers; requires pair-keyed serialization (single-shard transaction or atomic Redis script) or you get missed or duplicate matches.",
      "Feed dedup against huge swipe histories; NOT IN queries collapse under power users, hence Bloom filters.",
      "Hot geo cells: a dense city cell can contain millions of users; mitigate with finer geohash precision and candidate caps per query.",
      "New or returning users in sparse areas get empty feeds; needs ring expansion and relaxed filters as a fallback.",
    ],
    keyTakeaways: [
      "Serialize match detection per user pair (normalized min/max id) so mutual likes are detected exactly once regardless of timing.",
      "Geohash bucketing turns radius queries into set unions; exact distance is only computed on a small survivor set.",
      "Bloom filters are the right tool for have I shown this profile before: false positives are harmless, false negatives are impossible.",
      "Precompute ranked candidate feeds asynchronously; the read path should be a cache pop, not a live geo query plus ranking.",
      "Filter preferences in both directions or your feed shows candidates who will never like back.",
    ],
    relatedTopics: [
      "probabilistic-data-structures",
      "sharding-and-partitioning",
      "caching",
      "message-queues",
      "realtime-communication",
    ],
    rapidImplementation: {
      stack: "Next.js + Postgres with PostGIS (Supabase free tier) + Redis (Upstash free tier) + web push for match notifications.",
      steps: [
        "Scaffold a Next.js app with Supabase auth; create users, swipes, matches, messages tables and enable the PostGIS extension.",
        "Build the profile screen: photo upload to Supabase storage, bio, preferences; store location as a PostGIS geography point captured from the browser geolocation API.",
        "Implement GET /api/feed: one SQL query with ST_DWithin for radius, preference filters both directions, and NOT EXISTS against swipes (fine at MVP scale).",
        "Implement POST /api/swipes as a single Postgres transaction that inserts the swipe, checks the reverse like, and inserts the match row on a unique pair constraint.",
        "Build the swipe UI: a card stack with drag gestures (framer-motion), calling the swipe endpoint optimistically.",
        "Build the matches list and a simple chat using Supabase Realtime channels per match id.",
        "Add the unique index on matches(least_id, greatest_id) and write a two-browser test: like from both sides, assert exactly one match row and both clients notified.",
      ],
      codeSketches: [
        {
          title: "Mutual-like detection in one SQL transaction",
          language: "sql",
          code: `BEGIN;

INSERT INTO swipes (swiper_id, target_id, direction)
VALUES (:me, :them, 'like')
ON CONFLICT (swiper_id, target_id) DO NOTHING;

-- Create the match only if the reverse like exists.
-- The unique index on (user_a_id, user_b_id) makes a racing
-- duplicate insert a no-op instead of a second match.
INSERT INTO matches (user_a_id, user_b_id)
SELECT LEAST(:me, :them), GREATEST(:me, :them)
WHERE EXISTS (
  SELECT 1 FROM swipes
  WHERE swiper_id = :them AND target_id = :me
    AND direction = 'like'
)
ON CONFLICT (user_a_id, user_b_id) DO NOTHING
RETURNING match_id;

COMMIT;
-- If RETURNING yields a row, respond matched: true.`,
        },
        {
          title: "Geo-filtered candidate feed query",
          language: "sql",
          code: `SELECT u.user_id, u.name, u.bio, u.photos_json,
       ROUND(ST_Distance(u.location, me.location) / 1000) AS km_away
FROM users u, users me
WHERE me.user_id = :me
  AND u.user_id <> :me
  AND ST_DWithin(u.location, me.location, me.pref_radius_km * 1000)
  -- my preferences about them
  AND date_part('year', age(u.birth_date)) BETWEEN me.pref_min_age AND me.pref_max_age
  AND u.gender = ANY (me.pref_genders)
  -- their preferences about me (both directions!)
  AND date_part('year', age(me.birth_date)) BETWEEN u.pref_min_age AND u.pref_max_age
  AND me.gender = ANY (u.pref_genders)
  AND NOT EXISTS (
    SELECT 1 FROM swipes s
    WHERE s.swiper_id = :me AND s.target_id = u.user_id
  )
ORDER BY u.last_active_at DESC
LIMIT 25;`,
        },
        {
          title: "Atomic pair-keyed like via Redis Lua (scale-up path)",
          language: "typescript",
          code: `import { Redis } from "ioredis";
const redis = new Redis(process.env.REDIS_URL as string);

// KEYS[1] = likes set for the normalized pair
// ARGV[1] = liker id. Returns 1 when both sides have liked.
const LUA =
  "redis.call('SADD', KEYS[1], ARGV[1]) " +
  "if redis.call('SCARD', KEYS[1]) >= 2 then return 1 end " +
  "return 0";

export async function recordLike(me: string, them: string): Promise<boolean> {
  const [a, b] = [me, them].sort();
  const key = "pairlikes:" + a + ":" + b;
  const matched = (await redis.eval(LUA, 1, key, me)) === 1;
  if (matched) {
    // enqueue durable match creation; Redis decided the race
    await redis.lpush("match_events", JSON.stringify({ a, b, at: Date.now() }));
  }
  return matched;
}`,
        },
      ],
    },
  },
  {
    slug: "email-service",
    title: "Design an Email Service (Gmail)",
    difficulty: "Hard",
    summary:
      "A web email service that receives mail from the open internet over SMTP, filters spam, stores mailboxes durably, supports fast full-text search over years of mail, and handles attachments. The hard parts are the untrusted ingestion boundary, a multi-stage spam pipeline, storage layout for billions of small messages, and search index freshness.",
    functionalRequirements: [
      "Receive email from any internet MTA via SMTP and deliver it to the correct user's mailbox, including plus-addressing and aliases.",
      "Send outbound email with proper SPF/DKIM signing and queued retries to remote servers.",
      "Classify incoming mail as inbox or spam with a multi-signal pipeline; users can correct classifications.",
      "Full-text search across a user's entire mail history including sender, subject, body, and attachment names, with operators like from: and has:attachment.",
      "Support attachments up to 25 MB, stored once even when sent to many recipients.",
      "Standard mailbox operations: read/unread, labels/folders, archive, delete, threads (conversation grouping).",
    ],
    nonFunctionalRequirements: [
      "Never lose an accepted message: once the SMTP 250 OK is returned, the message is durably replicated.",
      "Inbox load under 200 ms p99; search under 500 ms p99 over a 10-year mailbox.",
      "Spam pipeline decision within 2 seconds so delivery is not delayed noticeably.",
      "Scale to 1 billion accounts and roughly 100 billion messages received per day (most of it spam to be rejected cheaply).",
      "Strong isolation between tenants: one user's mail is never visible to another under any failure mode.",
      "Encryption at rest for message bodies and attachments; TLS for all SMTP and client connections.",
    ],
    backOfEnvelope: [
      {
        label: "Inbound SMTP rate",
        value: "~1.2M msgs/s attempted",
        note: "100B/day / 86,400 s ≈ 1.16M/s; the majority is rejected at the edge before full processing.",
      },
      {
        label: "Accepted mail rate",
        value: "~230K msgs/s",
        note: "If ~80% is rejected at connection/envelope stage, ~20B/day accepted ≈ 230K/s.",
      },
      {
        label: "Storage growth",
        value: "~1.5 PB/day",
        note: "20B accepted x ~75 KB average (body + headers, attachments amortized) ≈ 1.5 PB/day before dedup and compression.",
      },
      {
        label: "Per-user quota math",
        value: "15 GB x 1B users = 15 EB ceiling",
        note: "Actual usage far lower; average mailbox ~2 GB implies ~2 EB live data, hence erasure coding over replication for cold data.",
      },
      {
        label: "Search index size",
        value: "~10-15% of corpus",
        note: "Inverted index typically 10-15% of text size; per-user index of a 2 GB mailbox ≈ 200-300 MB.",
      },
    ],
    apiDesign: [
      {
        endpoint: "GET /v1/mailbox/threads?label=INBOX&cursor=...",
        description: "Paginated thread list for a label, newest first, with snippet, participants, and unread counts.",
      },
      {
        endpoint: "GET /v1/messages/{messageId}",
        description: "Full message: parsed headers, sanitized HTML body, attachment metadata with signed download URLs.",
      },
      {
        endpoint: "POST /v1/messages/send {to, cc, subject, body, attachmentIds}",
        description: "Queues an outbound message; returns immediately, delivery status is tracked asynchronously.",
      },
      {
        endpoint: "GET /v1/search?q=from:alice has:attachment invoice",
        description: "Full-text search over the user's mailbox with operator support; returns ranked message ids and snippets.",
      },
      {
        endpoint: "POST /v1/messages/{messageId}/labels {add, remove}",
        description: "Mutates labels (spam/not-spam corrections here feed the classifier training loop).",
      },
    ],
    highLevelDesign: [
      "The ingestion edge is a fleet of SMTP servers behind DNS MX records. They terminate TLS, apply connection-level defenses (IP reputation, rate limits, greylisting), and validate envelopes (SPF check, recipient exists). Most spam dies here with a cheap rejection before the message body is even transferred. Accepted messages are written to a durable write-ahead queue (Kafka) before the 250 OK is sent: the SMTP acknowledgment is a durability promise.",
      "From the queue, a processing pipeline runs stages in order: parse MIME, extract and detach attachments to blob storage (content-addressed by hash so a 10 MB attachment sent to 500 recipients is stored once), run the spam pipeline, then deliver. Delivery means writing message metadata to the mailbox database, the body to message storage, and emitting an index event for search.",
      "Mailbox storage is split by access pattern. Metadata (headers, flags, labels, thread ids) lives in a wide-row store like Bigtable or Cassandra keyed by (user id, message id) so an inbox page is one contiguous range read. Bodies live in blob storage, compressed, with hot recent messages cached. Threading is computed at delivery time using the References and In-Reply-To headers plus normalized subject fallback.",
      "Search uses per-user index partitions in a Lucene-style engine (Elasticsearch or self-managed). Sharding by user keeps every query single-shard and makes tenant isolation structural. The indexer consumes delivery events from the queue, so a message is searchable within seconds. Attachment text extraction (PDF, docx) runs as a lower-priority enrichment that updates the index document.",
      "Outbound mail is the mirror image: a submission service signs with DKIM, queues per destination domain, and retries with exponential backoff per SMTP rules (transient 4xx vs permanent 5xx). Sending reputation (IP warming, feedback loops, bounce handling) is its own operational discipline that determines whether your mail lands in other providers' inboxes.",
    ],
    dataModel: [
      {
        name: "messages_meta (wide-row store)",
        fields: "user_id, message_id, thread_id, from_addr, to_addrs, subject, snippet, labels, flags, size_bytes, body_blob_key, attachment_keys, received_at, spam_score",
        note: "Row key (user_id, reversed received_at, message_id) so newest-first inbox reads are one range scan.",
      },
      {
        name: "message_bodies (blob store)",
        fields: "blob_key, compressed_mime_content, encryption_key_id",
        note: "Bodies compressed with zstd; hot tier on SSD, cold tier erasure-coded on HDD.",
      },
      {
        name: "attachments (content-addressed blob store)",
        fields: "sha256_hash, content, content_type, size_bytes, refcount",
        note: "Content addressing dedupes identical attachments across all recipients globally.",
      },
      {
        name: "search_index (per-user partition)",
        fields: "user_id, message_id, tokenized_subject, tokenized_body, from_addr, has_attachment, label_set, received_at",
        note: "One logical index partition per user; queries never cross tenants.",
      },
    ],
    deepDives: [
      {
        heading: "The SMTP acceptance boundary and durability",
        body: "SMTP has a brutal contract: once you respond 250 OK to DATA, you own the message. The sending server deletes its copy. If you lose it after that, it is gone forever and silently. So the golden rule is: replicate before acknowledging. The edge server writes the raw message to a Kafka topic with acks=all (replicated to 3 brokers) and only then sends 250 OK. If Kafka is unavailable, respond 451 (transient failure) and the remote MTA will retry for days, which is a free durability mechanism.\n\nEverything before 250 OK should reject as much as possible because rejection is cheap and lossless: the sender is notified by their own MTA. Reject unknown recipients at RCPT TO, reject failed SPF from known-bad IPs at MAIL FROM, apply greylisting (temp-fail first contact from unknown IPs; real MTAs retry, most spam cannons do not). This edge filtering is why the accepted rate is a fraction of the attempted rate.\n\nAfter acceptance, filtering can only move mail to the spam folder, never drop it silently. Silent loss of a legitimate accepted message is the cardinal sin of email systems; a false positive in the spam folder is recoverable by the user.",
      },
      {
        heading: "Spam pipeline as staged filters",
        body: "Spam filtering is a funnel of increasingly expensive checks. Stage 1 (connection time, microseconds): IP reputation lists, rate limits per IP and per sender domain. Stage 2 (envelope, milliseconds): SPF alignment, recipient validation, greylisting state. Stage 3 (content, tens of milliseconds): DKIM verification, DMARC policy evaluation, URL blocklists, fuzzy hashes of known spam campaigns (a Bloom filter of recent spam signature hashes makes this check O(1)). Stage 4 (expensive, only for survivors): ML classifier over text features, sender history, and user-specific signals.\n\nThe classifier improves through a feedback loop: every user marks-as-spam and not-spam action becomes a labeled training example. Aggregate signals matter too: if 10,000 users mark the same campaign hash as spam within an hour, retroactively reclassify it for everyone who has not opened it yet.\n\nScore, do not binarize, until the end. Each stage adds to a spam score; final routing compares against per-user thresholds. This lets you tune aggressiveness globally and per user, and lets stage results be logged for offline analysis of misclassifications.",
      },
      {
        heading: "Mailbox storage layout and the small-object problem",
        body: "Email is billions of small objects with a skewed access pattern: the last 30 days are read constantly, everything else almost never. Storing each message as one row in a relational database dies on both size and write amplification. The proven layout separates metadata from bodies.\n\nMetadata goes in a wide-row/LSM store keyed by (user_id, time-reversed timestamp). An inbox page is then a single sequential range read of the newest N rows for that user, no index needed. Flags and labels are small mutable columns on those rows. Bodies go to blob storage in compressed form; group messages into larger append-only blocks per user to avoid filesystem small-file overhead, with an index mapping message id to (block, offset).\n\nTiering does the economics: recent blocks replicated 3x on SSD, blocks older than 90 days erasure-coded (e.g., 6+3 Reed-Solomon, 1.5x overhead instead of 3x) on HDD. Attachment dedup by content hash is a massive win because forwarded and mass-mailed attachments dominate raw bytes.",
      },
      {
        heading: "Search over a decade of mail",
        body: "The key structural decision is per-user index partitioning. A global index sharded by term would make every query hit every shard and make tenant isolation a filtering problem. Per-user partitions mean each query touches one small index (hundreds of MB), latency is naturally bounded, and a bug cannot leak results across users.\n\nIndexing rides the delivery event stream: after metadata write, an event triggers tokenization and index update, so mail is searchable within seconds of arrival. Deletes and label changes are index updates too. Attachment text extraction is asynchronous and lower priority: the message is findable by subject and body immediately, and by attachment content minutes later.\n\nQuery-time features that users expect: operator parsing (from:, to:, has:attachment, before:/after:), phrase matching, and ranking that blends relevance with recency (recent mail dominates intent). Snippet generation highlights matched terms from the stored body. For inactive users, their index partitions can be compacted and moved to cold storage, then rehydrated on first search.",
      },
    ],
    bottlenecks: [
      "Ingestion spikes during spam storms: solved by the edge rejecting before DATA and the Kafka buffer absorbing bursts; the pipeline consumes at its own pace.",
      "Small-object write amplification in mailbox storage: mitigated by batching bodies into append-only blocks and LSM-based metadata storage.",
      "Search index write throughput: every accepted message is an index update; per-user partitioning plus batched segment merges keep this tractable.",
      "Attachment bandwidth: large attachments dominate egress; signed direct-to-blob-storage URLs keep them off the application servers.",
      "Spam classifier latency vs accuracy: the expensive ML stage must be reserved for the minority of mail that survives cheap stages, or the pipeline backs up.",
    ],
    keyTakeaways: [
      "The SMTP 250 OK is a durability contract: replicate to a write-ahead queue before acknowledging, and use 4xx temp-fails to lean on sender retries when degraded.",
      "Structure spam filtering as a funnel of increasingly expensive stages that each accumulate a score; reject cheaply at the edge, classify expensively only for survivors.",
      "Separate mailbox metadata (wide-row store, range-readable by user and time) from bodies (compressed blobs, tiered and erasure-coded when cold).",
      "Per-user search index partitions give bounded query latency and structural tenant isolation; index from the delivery event stream for freshness in seconds.",
      "Content-addressed attachment storage dedupes the largest byte consumer in the system almost for free.",
    ],
    relatedTopics: [
      "message-queues",
      "storage-and-search",
      "event-driven-architecture",
      "probabilistic-data-structures",
      "security",
    ],
    rapidImplementation: {
      stack: "Node.js (smtp-server npm package) + Postgres with tsvector search + S3-compatible blob storage (Cloudflare R2 free tier) + Rspamd in Docker for spam scoring.",
      steps: [
        "Rent a cheap VPS with port 25 open (most clouds block it; Hetzner/OVH allow), set MX, SPF, DKIM, and DMARC DNS records for a test domain.",
        "Stand up an SMTP listener with the smtp-server package: validate RCPT TO against a users table, stream DATA to disk, respond 250 only after fsync.",
        "Parse stored raw mail with mailparser: extract headers, text/html bodies, and attachments; upload attachments to R2 keyed by sha256.",
        "Pipe each message through Rspamd over its HTTP API; store the score and route to INBOX or SPAM label accordingly.",
        "Create messages table with a generated tsvector column over subject and body, plus a GIN index; write the delivery insert.",
        "Build a minimal web UI (Next.js): thread list grouped by normalized subject + References header, message view with sanitized HTML (DOMPurify), search box hitting the tsvector query.",
        "Implement outbound send via nodemailer with DKIM signing, and a spam/not-spam button that relabels and logs the correction.",
        "Test end-to-end: send from a Gmail account, verify delivery, search, attachment download via signed URL, and reply back to Gmail.",
      ],
      codeSketches: [
        {
          title: "Durable SMTP acceptance (ack only after persist)",
          language: "typescript",
          code: `import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";
import { deliver } from "./pipeline";

const server = new SMTPServer({
  secure: false, // STARTTLS configured via key/cert opts in prod
  onRcptTo(addr, session, cb) {
    // Reject unknown recipients BEFORE the body is transferred.
    userExists(addr.address).then((ok) =>
      ok ? cb() : cb(Object.assign(new Error("5.1.1 No such user"), { responseCode: 550 }))
    );
  },
  onData(stream, session, cb) {
    simpleParser(stream)
      .then((mail) => deliver(session.envelope, mail)) // persist + fsync/replicate
      .then(() => cb(null)) // 250 OK: we now own the message
      .catch(() => {
        // Temp-fail: the remote MTA will retry. Never lose silently.
        const err = Object.assign(new Error("4.3.0 Try again later"), { responseCode: 451 });
        cb(err);
      });
  },
});
server.listen(25);`,
        },
        {
          title: "Mailbox schema with built-in full-text search",
          language: "sql",
          code: `CREATE TABLE messages (
  user_id      BIGINT NOT NULL,
  message_id   UUID DEFAULT gen_random_uuid(),
  thread_key   TEXT NOT NULL,        -- normalized subject or References root
  from_addr    TEXT NOT NULL,
  subject      TEXT NOT NULL DEFAULT '',
  body_text    TEXT NOT NULL DEFAULT '',
  labels       TEXT[] NOT NULL DEFAULT ARRAY['INBOX'],
  spam_score   REAL NOT NULL DEFAULT 0,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  search_vec   TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(subject, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body_text, '')), 'B')
  ) STORED,
  PRIMARY KEY (user_id, message_id)
);

CREATE INDEX idx_inbox ON messages (user_id, received_at DESC);
CREATE INDEX idx_search ON messages USING GIN (search_vec);

-- Search query with ranking blended toward recency:
SELECT message_id, subject,
       ts_rank(search_vec, q) * exp(-extract(epoch from now() - received_at) / 8.64e6) AS score
FROM messages, websearch_to_tsquery('english', 'invoice from alice') q
WHERE user_id = 42 AND search_vec @@ q
ORDER BY score DESC LIMIT 20;`,
        },
        {
          title: "Content-addressed attachment dedup",
          language: "typescript",
          code: `import { createHash } from "crypto";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ endpoint: process.env.R2_ENDPOINT, region: "auto" });
const BUCKET = "mail-attachments";

export async function storeAttachment(content: Buffer, contentType: string) {
  const hash = createHash("sha256").update(content).digest("hex");
  const key = hash.slice(0, 2) + "/" + hash; // prefix for key distribution
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return { key, deduped: true }; // identical bytes already stored
  } catch {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: content,
      ContentType: contentType,
    }));
    return { key, deduped: false };
  }
}`,
        },
      ],
    },
  },
  {
    slug: "digital-wallet",
    title: "Design a Digital Wallet",
    difficulty: "Hard",
    summary:
      "A digital wallet service where users hold balances and transfer money to each other instantly. Money must never be created, destroyed, or double-spent, so the design centers on a double-entry ledger, idempotent transfer operations, distributed transactions when wallets live on different shards, and the ability to audit and rebuild any balance by replaying the event log.",
    functionalRequirements: [
      "Users hold a wallet balance and can top up from an external payment method and withdraw to a bank account.",
      "Users transfer funds to other users; transfers are atomic: either both balances change or neither does.",
      "Every transfer is recorded as immutable double-entry ledger entries; balances are derivable from the ledger alone.",
      "Clients can safely retry any transfer without risk of double execution (idempotency keys).",
      "Users see their transaction history with running balance, and support staff can audit any account's full lineage.",
      "Balances can never go negative; insufficient funds fails the transfer atomically.",
    ],
    nonFunctionalRequirements: [
      "Correctness over availability: reject transfers during partitions rather than risk double-spending (CP system).",
      "Transfer commit latency under 500 ms p99 including durable replication.",
      "Scale to 100 million wallets and 20K transfers per second peak, which forces sharding and cross-shard transfers.",
      "The ledger is append-only and tamper-evident; no UPDATE or DELETE ever touches posted entries.",
      "Full recoverability: any wallet balance must be reconstructible by replaying its ledger entries from genesis.",
      "Regulatory-grade auditability: every state change traces to a request id, actor, and timestamp.",
    ],
    backOfEnvelope: [
      {
        label: "Transfer TPS",
        value: "20K peak, ~5K average",
        note: "100M wallets, ~4 transfers/user/day ≈ 400M/day ≈ 4.6K/s average; 4x peak.",
      },
      {
        label: "Ledger entries per transfer",
        value: "2 (plus 2 for fees if charged)",
        note: "Double entry: one debit, one credit per transfer leg; 20K TPS = 40K entry writes/s peak.",
      },
      {
        label: "Ledger growth",
        value: "~29 GB/day",
        note: "800M entries/day x ~36 bytes (ids, amount, currency, refs) ≈ 29 GB/day; ~10 TB/year, cheap to keep forever.",
      },
      {
        label: "Cross-shard transfer fraction",
        value: "~99% with random sharding",
        note: "With wallets hash-sharded across 32 shards, only ~3% of transfers land on the same shard, so the 2-phase path is the common case, not the exception.",
      },
      {
        label: "Idempotency key cache",
        value: "~35 GB for 7 days",
        note: "400M transfers/day x 7 days x ~12 bytes result reference; fits a modest Redis cluster or a TTL table.",
      },
    ],
    apiDesign: [
      {
        endpoint: "POST /v1/transfers {idempotencyKey, fromWalletId, toWalletId, amount, currency}",
        description: "Executes an atomic transfer. Retries with the same idempotencyKey return the original result, never a second execution.",
      },
      {
        endpoint: "GET /v1/transfers/{transferId}",
        description: "Returns transfer state: pending, completed, or failed, with the ledger entry ids it produced.",
      },
      {
        endpoint: "GET /v1/wallets/{walletId}/balance",
        description: "Current available balance plus any holds; consistent read served from the wallet's home shard.",
      },
      {
        endpoint: "GET /v1/wallets/{walletId}/entries?cursor=...",
        description: "Paginated immutable ledger entries with running balance for statements and audit.",
      },
      {
        endpoint: "POST /v1/topups {idempotencyKey, walletId, amount, paymentMethodId}",
        description: "Credits a wallet from an external processor; double-entry against a corporate clearing account.",
      },
    ],
    highLevelDesign: [
      "The system's source of truth is an append-only ledger. Every money movement produces balanced entries: a transfer of 50 from Alice to Bob writes a debit entry on Alice's account and a credit entry on Bob's account inside one transaction, and the invariant sum(debits) = sum(credits) holds over the whole ledger at all times. External money entering or leaving the system is balanced against internal clearing accounts, so even top-ups obey double entry. Balances are a materialized view: a cached aggregate per wallet, always rebuildable by replaying entries.",
      "The transfer service is the only writer to the ledger. Each request carries a client-generated idempotency key; the service records (key, result) atomically with the transfer itself, so a retried request short-circuits to the stored result. This makes at-least-once delivery from clients and queues safe.",
      "Wallets are sharded by wallet id across Postgres (or Spanner-style) shards. A same-shard transfer is one local ACID transaction: lock both wallet rows in a deterministic order (lower id first, preventing deadlock), check funds, write both entries, update both cached balances, commit. Cross-shard transfers use a saga with reserved funds: phase 1 debits and holds the money on the source shard (writing a pending ledger entry), phase 2 credits the destination shard, and a completion step marks the transfer done. A recovery worker scans for stuck pending transfers and either completes or compensates (releases the hold) based on the recorded state, giving effective atomicity without holding cross-shard locks.",
      "Every committed transfer also emits an event to a durable log (Kafka or the ledger table itself streamed via CDC). Downstream consumers build read models: transaction history, analytics, fraud scoring, and reconciliation jobs that continuously verify that cached balances equal replayed ledger sums and that the global ledger balances to zero. Any discrepancy pages a human; the ledger, not the cache, wins every dispute.",
      "For audit and disaster recovery, the event log enables replay: a corrupted balance table or a new read model is rebuilt by replaying entries in order. Periodic snapshots (balance as of entry N) bound replay time, exactly like snapshots in event sourcing.",
    ],
    dataModel: [
      {
        name: "wallets",
        fields: "wallet_id, user_id, currency, cached_balance, held_amount, version, updated_at",
        note: "cached_balance is a derived value; version supports optimistic checks. Sharded by wallet_id.",
      },
      {
        name: "ledger_entries",
        fields: "entry_id, transfer_id, wallet_id, direction (debit|credit), amount, currency, balance_after, created_at",
        note: "Append-only, no updates or deletes ever. amount stored as BIGINT minor units, never floating point.",
      },
      {
        name: "transfers",
        fields: "transfer_id, idempotency_key, from_wallet_id, to_wallet_id, amount, currency, state (pending|completed|failed|compensated), created_at, completed_at",
        note: "Unique index on idempotency_key enforces exactly-once effect; state machine drives cross-shard recovery.",
      },
      {
        name: "idempotency_results",
        fields: "idempotency_key, transfer_id, response_body, expires_at",
        note: "Lets retries return the exact original response; TTL 7 days.",
      },
    ],
    deepDives: [
      {
        heading: "Why double-entry, not a balance column",
        body: "A single balance column updated in place is how money silently disappears. A crashed process between two UPDATEs, a retried message, or a bug leaves no trail: you know the balance is wrong but not why. Double-entry bookkeeping, unchanged since the 15th century, fixes this structurally: every movement writes a debit in one account and an equal credit in another, both in one transaction. The global invariant sum(all debits) = sum(all credits) means money is conserved by construction; any bug that violates it is detectable by a reconciliation query.\n\nBalances become derived data: balance(wallet) = sum(credits) - sum(debits) over its entries. You cache this for reads, and you store balance_after on each entry so statements show running balances without aggregation, but the entries are the truth. When cache and ledger disagree, the ledger wins and the cache is rebuilt.\n\nTwo implementation rules that interviewers probe: store amounts as integer minor units (cents), never floats, because 0.1 + 0.2 problems are unacceptable in money; and make entries strictly append-only, with corrections done by reversing entries, never by mutation, so the audit trail is complete.",
      },
      {
        heading: "Idempotent transfers end to end",
        body: "Money movement over a network faces the classic uncertainty: the client sends a transfer, the response times out, and the client cannot know whether it executed. Without protection, the natural response (retry) double-spends. The fix is an idempotency key: the client generates a UUID per logical transfer and sends it on every retry of that transfer.\n\nServer side, the key must be recorded in the same atomic transaction as the transfer's effects. Insert the transfer row with a unique constraint on idempotency_key; if the insert conflicts, the transfer already happened (or is in flight), so read and return its stored result. Checking the key in a separate step before the transaction (check-then-act) reintroduces the race: two concurrent retries both pass the check and both execute. The unique constraint is the serialization point.\n\nIdempotency must extend through the whole pipeline. Queue consumers processing transfer events must be idempotent too (the ledger insert keyed by transfer_id conflicts on redelivery), and calls out to external payment processors must forward an idempotency key so the processor also will not double-charge. Exactly-once effect is achieved by at-least-once delivery plus idempotent handlers at every hop.",
      },
      {
        heading: "Cross-shard transfers: saga with reserved funds",
        body: "Once wallets are sharded, most transfers touch two shards and a single ACID transaction is off the table. Two-phase commit (2PC) is the textbook answer but couples availability of every transfer to a coordinator and holds locks across a network round trip; a wounded coordinator leaves participants blocked. Most production wallets instead use a saga: a sequence of local transactions with recorded state and compensations.\n\nThe flow: (1) On the source shard, atomically check funds, move the amount from available balance to held, write a pending debit entry, and set transfer state to source_debited. (2) On the destination shard, write the credit entry and update the balance; set state to completed and convert the hold into a posted debit. If step 2 fails permanently, a compensation releases the hold and reverses the pending debit, state becomes compensated. Every step is idempotent (keyed by transfer_id) so the recovery worker can re-drive any step after a crash.\n\nThe user-visible semantics are: money leaves the sender immediately (held), arrives at the receiver within milliseconds normally, and in the failure case returns to the sender. Money is never in both places and never in neither, from any observer's ledger view. This is the pattern to articulate in interviews: not distributed locks, but a state machine plus idempotent steps plus a recovery sweeper.",
      },
      {
        heading: "Audit, reconciliation, and replay",
        body: "The ledger doubles as an event log, which buys three capabilities. First, audit: every entry references its transfer, which references an idempotency key, actor, and timestamp, so any balance change traces to a cause. Regulators and support staff query lineage, not logs.\n\nSecond, reconciliation as a continuous process, not an incident response. A background job per shard recomputes sum-of-entries per wallet and compares to cached_balance; a global job verifies debits equal credits across shards for each time window; an external job matches processor settlement files against top-up and withdrawal entries. Discrepancies halt related accounts and page a human. Mature wallet systems treat reconciliation findings as sev-1 by default.\n\nThird, replay: because entries are ordered and immutable, any derived state (balance cache, history view, fraud features, a new analytics model) is rebuilt by replaying entries from genesis or from a periodic snapshot. Snapshots (wallet balance as of entry N, taken daily) bound replay time to one day of entries. This is event sourcing applied where it genuinely pays for itself: the events are legally required anyway, so deriving state from them is nearly free architecture.",
      },
    ],
    bottlenecks: [
      "Hot wallets (merchant accounts, promo accounts) serialize on their row lock; mitigate with sub-accounts that shard one logical balance into N rows summed on read.",
      "Cross-shard transfers dominate with random sharding; the saga path must be the optimized common case, and the recovery sweeper must keep pending-transfer count near zero.",
      "The idempotency-results store is on the critical path of every transfer; it must be as available and durable as the ledger itself.",
      "Reconciliation jobs scanning the full ledger contend with live traffic; run them on read replicas or CDC-fed copies.",
      "Ledger growth is unbounded by design; partition entries by time and archive cold partitions to cheap storage while keeping them queryable for audit.",
    ],
    keyTakeaways: [
      "Make the append-only double-entry ledger the source of truth and treat balances as rebuildable caches; sum(debits) = sum(credits) is a machine-checkable conservation law.",
      "Idempotency keys must be persisted atomically with the transfer via a unique constraint; check-then-act patterns reintroduce the double-spend race.",
      "Prefer a saga with reserved funds and an idempotent recovery sweeper over 2PC for cross-shard transfers; design the state machine, not a distributed lock.",
      "Store money as integer minor units, lock accounts in deterministic id order to avoid deadlocks, and never mutate posted entries; correct with reversing entries.",
      "Continuous reconciliation (cache vs ledger, ledger vs external processor) converts silent corruption into paged alerts.",
    ],
    relatedTopics: [
      "distributed-transactions",
      "consistency-and-cap",
      "sharding-and-partitioning",
      "event-driven-architecture",
      "fault-tolerance",
    ],
    rapidImplementation: {
      stack: "Node.js/TypeScript + Postgres (single instance is genuinely correct for an MVP: real ACID) + a nightly reconciliation script; Neon or Supabase free tier.",
      steps: [
        "Create the schema: wallets, transfers (unique idempotency_key), ledger_entries (append-only, BIGINT minor units), plus a REVOKE UPDATE, DELETE ON ledger_entries for everyone including the app role.",
        "Seed a corporate clearing wallet so top-ups and withdrawals are double-entry from day one.",
        "Implement POST /transfers as one Postgres transaction: insert transfer row (conflict on idempotency_key returns stored result), lock both wallets in id order with SELECT FOR UPDATE, check funds, insert debit and credit entries with balance_after, update cached balances, commit.",
        "Implement top-up as the same transfer primitive from the clearing wallet, gated by a fake payment-processor stub.",
        "Build the statement endpoint: ledger entries with running balance, paginated by entry_id.",
        "Write the reconciliation script: for every wallet assert cached_balance equals the entry sum, and assert the global ledger sums to zero; run it in CI and nightly.",
        "Torture-test idempotency: fire the same transfer 50 times in parallel (Promise.all) and assert exactly one execution and identical responses.",
        "Add a replay command that truncates cached balances and rebuilds them purely from ledger_entries, proving the ledger is sufficient.",
      ],
      codeSketches: [
        {
          title: "Idempotent double-entry transfer in one transaction",
          language: "sql",
          code: `BEGIN;

-- Serialization point: a retry conflicts here and we return the stored result.
INSERT INTO transfers (transfer_id, idempotency_key, from_wallet_id, to_wallet_id, amount, state)
VALUES (:tid, :ikey, :from, :to, :amount, 'completed')
ON CONFLICT (idempotency_key) DO NOTHING;
-- If 0 rows inserted: SELECT * FROM transfers WHERE idempotency_key = :ikey; return it. Done.

-- Lock both wallets in deterministic order to avoid deadlock.
SELECT wallet_id, cached_balance FROM wallets
WHERE wallet_id IN (:from, :to)
ORDER BY wallet_id
FOR UPDATE;

-- Insufficient funds aborts everything, including the transfer row.
UPDATE wallets SET cached_balance = cached_balance - :amount
WHERE wallet_id = :from AND cached_balance >= :amount;
-- If 0 rows updated: ROLLBACK and fail with INSUFFICIENT_FUNDS.

UPDATE wallets SET cached_balance = cached_balance + :amount
WHERE wallet_id = :to;

INSERT INTO ledger_entries (transfer_id, wallet_id, direction, amount, balance_after)
VALUES
  (:tid, :from, 'debit',  :amount, (SELECT cached_balance FROM wallets WHERE wallet_id = :from)),
  (:tid, :to,   'credit', :amount, (SELECT cached_balance FROM wallets WHERE wallet_id = :to));

COMMIT;`,
        },
        {
          title: "Transfer endpoint with idempotent retry handling",
          language: "typescript",
          code: `import { pool } from "./db";

export async function transfer(ikey: string, from: string, to: string, amount: bigint) {
  if (amount <= 0n) throw new Error("INVALID_AMOUNT");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ins = await client.query(
      "INSERT INTO transfers (idempotency_key, from_wallet_id, to_wallet_id, amount, state) " +
      "VALUES ($1, $2, $3, $4, 'completed') ON CONFLICT (idempotency_key) DO NOTHING RETURNING transfer_id",
      [ikey, from, to, amount]
    );
    if (ins.rowCount === 0) {
      await client.query("ROLLBACK");
      const prev = await pool.query("SELECT * FROM transfers WHERE idempotency_key = $1", [ikey]);
      return { replayed: true, ...prev.rows[0] }; // exact original outcome
    }
    const tid = ins.rows[0].transfer_id;
    const [a, b] = [from, to].sort(); // deterministic lock order
    await client.query("SELECT 1 FROM wallets WHERE wallet_id = ANY($1) ORDER BY wallet_id FOR UPDATE", [[a, b]]);
    const deb = await client.query(
      "UPDATE wallets SET cached_balance = cached_balance - $1 WHERE wallet_id = $2 AND cached_balance >= $1",
      [amount, from]
    );
    if (deb.rowCount === 0) { await client.query("ROLLBACK"); throw new Error("INSUFFICIENT_FUNDS"); }
    await client.query("UPDATE wallets SET cached_balance = cached_balance + $1 WHERE wallet_id = $2", [amount, to]);
    await client.query(
      "INSERT INTO ledger_entries (transfer_id, wallet_id, direction, amount, balance_after) VALUES " +
      "($1, $2, 'debit', $3, (SELECT cached_balance FROM wallets WHERE wallet_id = $2)), " +
      "($1, $4, 'credit', $3, (SELECT cached_balance FROM wallets WHERE wallet_id = $4))",
      [tid, from, amount, to]
    );
    await client.query("COMMIT");
    return { replayed: false, transfer_id: tid };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}`,
        },
        {
          title: "Reconciliation: prove the ledger balances",
          language: "sql",
          code: `-- 1. Global conservation law: all debits equal all credits.
SELECT
  COALESCE(SUM(amount) FILTER (WHERE direction = 'debit'), 0)  AS total_debits,
  COALESCE(SUM(amount) FILTER (WHERE direction = 'credit'), 0) AS total_credits
FROM ledger_entries;
-- Assert total_debits = total_credits; anything else is corruption.

-- 2. Every cached balance equals its replayed ledger sum.
SELECT w.wallet_id, w.cached_balance, l.ledger_balance
FROM wallets w
JOIN LATERAL (
  SELECT COALESCE(SUM(CASE direction WHEN 'credit' THEN amount ELSE -amount END), 0)
         AS ledger_balance
  FROM ledger_entries e WHERE e.wallet_id = w.wallet_id
) l ON true
WHERE w.cached_balance <> l.ledger_balance;
-- Assert zero rows; any row is a wallet to freeze and investigate.`,
        },
      ],
    },
  },
  {
    slug: "live-streaming",
    title: "Design Live Streaming (Twitch)",
    difficulty: "Hard",
    summary:
      "A live streaming platform where creators broadcast video that millions watch with a few seconds of delay, alongside a real-time chat. The pipeline is RTMP ingest, transcoding into a bitrate ladder, HLS segment packaging and CDN delivery, and a chat system whose fan-out can dwarf the video problem. The defining tradeoff is glass-to-glass latency versus scale and cost.",
    functionalRequirements: [
      "Creators broadcast from OBS or similar encoders via RTMP(S) using a stream key.",
      "Viewers watch live with adaptive bitrate: quality adjusts automatically to their bandwidth (1080p down to 240p).",
      "Playback starts within 2 seconds of pressing play, at a live edge a few seconds behind the broadcaster.",
      "Each stream has a chat room; messages appear to all viewers in near real time, with moderation (bans, slow mode).",
      "Viewers discover live channels via directory and get live viewer counts.",
      "Streams are optionally recorded for VOD replay.",
    ],
    nonFunctionalRequirements: [
      "Glass-to-glass latency of 3-8 seconds (LL-HLS territory); consistency of latency matters more than the absolute number.",
      "Support 100K concurrent streams and 10M concurrent viewers, with a single event peaking at 3M viewers on one stream.",
      "Ingest must survive encoder hiccups: brief disconnects resume the same stream without killing viewer sessions.",
      "Chat delivers messages within 1 second at up to 100K messages/minute in one room.",
      "The origin must be shielded: viewer traffic is served ~99% from CDN edge caches.",
      "Transcoding cost scales with streams, not viewers; delivery cost scales with viewers, not streams.",
    ],
    backOfEnvelope: [
      {
        label: "Ingest bandwidth",
        value: "~600 Gbps",
        note: "100K streams x ~6 Mbps source bitrate = 600 Gbps into ingest points of presence.",
      },
      {
        label: "Transcoding compute",
        value: "~100K GPU-accelerated jobs",
        note: "One ladder (5 renditions) per stream ≈ 1 GPU transcode slot; ~12K-25K GPUs at 4-8 streams per card.",
      },
      {
        label: "Egress bandwidth",
        value: "~30 Tbps",
        note: "10M viewers x ~3 Mbps average delivered bitrate = 30 Tbps, which is why CDN offload is non-negotiable.",
      },
      {
        label: "Segment request rate (one 3M-viewer stream)",
        value: "~1.5M req/s at edges, ~single-digit req/s at origin",
        note: "3M viewers polling a 2 s segment + playlist ≈ 3M req/2 s; per-edge request collapsing means the origin sees roughly one fetch per segment per edge cluster.",
      },
      {
        label: "Chat fan-out (one 3M-viewer room)",
        value: "~50M deliveries/s uncapped",
        note: "1K msgs/min sent ≈ 17/s x 3M recipients ≈ 50M/s; must be capped by sampling/batching, not delivered naively.",
      },
    ],
    apiDesign: [
      {
        endpoint: "rtmp://ingest.example.com/live/{streamKey}",
        description: "RTMP ingest endpoint; the stream key authenticates the broadcaster and maps to a channel.",
      },
      {
        endpoint: "GET /v1/channels/{channel}/master.m3u8",
        description: "Master HLS playlist listing the bitrate ladder renditions; the player picks based on measured bandwidth.",
      },
      {
        endpoint: "GET /hls/{channel}/{rendition}/segment_{n}.ts",
        description: "Media segments (2 s each), served from CDN edge; playlist and segments are the entire video read path.",
      },
      {
        endpoint: "WSS /v1/chat/{channel}",
        description: "WebSocket for chat: send messages, receive the room firehose (possibly sampled), moderation events.",
      },
      {
        endpoint: "GET /v1/channels?category=...&sort=viewers",
        description: "Directory of live channels with approximate concurrent viewer counts.",
      },
    ],
    highLevelDesign: [
      "Broadcasters push RTMP to the nearest ingest PoP (anycast or GeoDNS). The ingest server validates the stream key, and relays the source stream to the transcoding tier. Ingest keeps a short reconnect grace window so a flapping encoder resumes the same session instead of ending the broadcast.",
      "Transcoders (GPU-accelerated ffmpeg pipelines) decode the source once and encode a bitrate ladder: for example 1080p60 at 6 Mbps, 720p at 3 Mbps, 480p at 1.5 Mbps, 360p at 800 Kbps, 240p at 400 Kbps, all with aligned keyframes every 2 seconds so players can switch renditions at segment boundaries. Transcoding cost is per stream, so small channels can get a reduced ladder (or source-only passthrough) to save GPUs, while partner channels get the full ladder.",
      "The packager cuts each rendition into 2-second HLS segments, writes them to origin storage, and appends them to a rolling media playlist per rendition. Viewers fetch the master playlist once, then poll the media playlist and download segments over plain HTTPS. Because segments are immutable, static files, the CDN caches them perfectly: request collapsing means even 3M viewers of one stream produce only a handful of origin fetches per segment. Playlists get a 1-second TTL; segments are cached until evicted.",
      "Chat is architecturally separate: a fleet of WebSocket gateway servers, each holding tens of thousands of connections, subscribed to per-channel topics on a pub/sub backbone (Redis pub/sub or Kafka). A message goes sender -> gateway -> pub/sub -> every gateway with subscribers in that room -> local fan-out over WebSockets. Giant rooms need protection: rate limits per user, slow mode, and firehose sampling where each gateway forwards only a representative fraction of messages because no human can read 800 messages per second anyway.",
      "Viewer counts are approximate by design: gateways and players heartbeat, counts are aggregated with a streaming counter (or HyperLogLog for uniques) and published every few seconds. VOD recording is a parallel consumer of the segment stream: segments are appended to long-term storage and stitched into a VOD playlist when the stream ends.",
    ],
    dataModel: [
      {
        name: "channels",
        fields: "channel_id, user_id, stream_key_hash, title, category, is_live, current_session_id, viewer_count_estimate, updated_at",
        note: "stream_key stored only as a hash; viewer_count_estimate refreshed every few seconds, explicitly approximate.",
      },
      {
        name: "stream_sessions",
        fields: "session_id, channel_id, started_at, ended_at, ingest_pop, source_resolution, renditions_json, vod_playlist_key",
        note: "One row per broadcast; survives encoder reconnects within the grace window.",
      },
      {
        name: "segments (object store + playlist state)",
        fields: "session_id, rendition, seq_number, duration_ms, storage_key, created_at",
        note: "Immutable; the media playlist is generated from the latest N rows per rendition.",
      },
      {
        name: "chat_messages",
        fields: "message_id, channel_id, user_id, body, badges, created_at, deleted_by",
        note: "Persisted asynchronously for moderation/VOD replay; live delivery path never waits on this write.",
      },
    ],
    deepDives: [
      {
        heading: "The latency vs scale tradeoff, made explicit",
        body: "Live video latency and delivery scalability pull in opposite directions, and the segment length is the knob. HLS latency is roughly 3-4 segment durations (the player buffers a few segments to absorb jitter). With classic 6-second segments you get 20-30 seconds of latency but supreme cacheability and stability. With 2-second segments you get 6-10 seconds. LL-HLS pushes further by splitting segments into sub-second parts delivered with HTTP chunked transfer, reaching 2-5 seconds at the cost of many more requests and touchier CDN behavior. WebRTC achieves sub-second but abandons HTTP caching entirely: every viewer needs a stateful media session, so cost scales linearly with viewers and 3M-viewer streams become an SFU cascade problem.\n\nTwitch's actual position is instructive: a few seconds of delay is fine for most content because the interaction loop is chat, and chat round trips are 1-2 seconds anyway. Matching video latency to the interaction medium, rather than minimizing it absolutely, is the mature answer. Auctions and betting need WebRTC; game streaming does not.\n\nA second-order point interviewers reward: consistent latency beats low latency. If viewers drift (pausing, buffering), chat reactions desynchronize from the video. Players should quietly speed up playback by 2-5% when behind the target live edge to converge, which is invisible to users.",
      },
      {
        heading: "Why HLS over CDN wins the delivery economics",
        body: "The delivery insight that makes 30 Tbps affordable: convert live video into immutable static files. A 2-second segment of the 720p rendition is identical for all 3 million viewers, so the CDN edge caches it once and serves it millions of times. With request collapsing (the edge holds concurrent requests for an uncached object and issues one origin fetch), origin load is per-segment-per-edge, essentially independent of viewer count. The origin serves maybe hundreds of requests per second while edges serve millions.\n\nThe playlist is the only mutable object. It gets a 1-second TTL and is tiny, so even aggressive polling is cheap. A subtle failure mode: if the packager stalls and playlists stop advancing, millions of players poll an unchanging playlist and then all stampede for the next segment when it appears. Jittering player poll intervals and having edges serve slightly stale playlists during origin failures both blunt this.\n\nMulti-CDN is standard at this scale: no single CDN wants a surprise 30 Tbps, and per-region performance varies. A steering layer picks the CDN per session based on cost and measured throughput, and the player can fail over mid-stream because segments are addressable identically on any CDN.",
      },
      {
        heading: "Chat fan-out: the hidden hard problem",
        body: "The math is unforgiving: a modest 17 messages/second in a 3M-viewer room implies 50 million message deliveries per second if delivered naively. Video does not have this problem because segments are shared; chat messages are per-connection pushes. The architecture is two-tier fan-out: publish each message once to a per-channel topic, have only the gateway servers with viewers in that room subscribe, and let each gateway multicast to its local WebSocket connections from a single in-memory copy. Publishing cost is O(gateways in room), delivery cost is amortized socket writes.\n\nEven so, giant rooms need semantic load shedding. Humans cannot read more than roughly 10-20 messages per second, so beyond that the firehose is sampled: each gateway forwards a fair random fraction, always including messages from moderators, the streamer, and the viewer's own messages (which are echoed locally so the sender always sees their message). Slow mode (one message per user per N seconds) caps the publish rate at the source. These product features are actually backpressure mechanisms.\n\nModeration must propagate faster than messages: a ban or message deletion publishes a control event on the same topic at higher priority, and gateways drop queued messages from banned users before flushing. Persisting chat is off the hot path: the delivery pipeline writes to Kafka, and a consumer batches into storage for VOD replay and moderation audit.",
      },
      {
        heading: "Ingest resilience and the transcoding tier",
        body: "Ingest is the one stateful, non-cacheable part of the video path, so it gets the reliability attention. Broadcasters connect to the nearest PoP; the stream key maps to a channel and a transcoding assignment. If the encoder disconnects (home internet blip), the ingest holds the session open for a grace window of 30-90 seconds, and the packager inserts a slate or freezes the last frame, so the viewer-side playlist keeps advancing and players do not tear down. Reconnection resumes the same session id and segment numbering.",
      },
    ],
    bottlenecks: [
      "Origin stampedes when a playlist stalls and recovers: millions of players synchronize their next request; mitigated by request collapsing, poll jitter, and stale-while-revalidate on playlists.",
      "Transcoding GPU pool exhaustion during peak hours: mitigated by reduced ladders for small channels and passthrough-only mode as a degraded tier.",
      "Single mega-room chat fan-out saturating gateway CPUs on socket writes; requires per-gateway multicast from one buffer, sampling, and slow mode.",
      "Ingest PoP failure mid-broadcast: needs encoder reconnect to a backup ingest URL and session resumption without changing the viewer-facing playlist.",
      "Cross-CDN consistency: a segment present on one CDN but not yet on another breaks mid-session failover; solved by origin-pull (both CDNs pull from the same origin) rather than push.",
    ],
    keyTakeaways: [
      "Segment duration is the master knob: latency ≈ 3-4 segment lengths, so 2 s segments give 6-10 s latency with full CDN cacheability; go WebRTC only when sub-second latency is genuinely required.",
      "HLS turns live video into immutable static files, and CDN request collapsing makes origin load independent of viewer count; the playlist is the only mutable, short-TTL object.",
      "Transcode once per stream into a keyframe-aligned bitrate ladder; transcoding cost scales with streams while delivery cost scales with viewers, and the architecture should keep those independent.",
      "Chat fan-out cost is messages x viewers and can exceed the video problem; two-tier fan-out (pub/sub to gateways, local multicast) plus sampling and slow mode are backpressure disguised as features.",
      "Design for consistent latency, not minimal latency: players should micro-adjust playback speed to hold the live edge so chat and video stay synchronized.",
    ],
    relatedTopics: [
      "cdn",
      "realtime-communication",
      "caching",
      "message-queues",
      "load-balancing",
    ],
    rapidImplementation: {
      stack: "OBS (broadcaster) + nginx-rtmp or Node Media Server in Docker + ffmpeg for the ladder + hls.js in the browser + Redis pub/sub with a Node WebSocket server for chat; runs on one $10 VPS.",
      steps: [
        "Run nginx with the rtmp module in Docker, configured with an application block that exec-invokes ffmpeg on publish.",
        "Point OBS at rtmp://localhost/live with a stream key; verify the raw stream arrives (ffprobe).",
        "Write the ffmpeg command that produces two renditions (720p and 360p) as HLS with 2-second segments and aligned keyframes (-g 60 at 30 fps, -sc_threshold 0), emitting a master playlist.",
        "Serve the HLS output directory with proper cache headers: segments immutable for 1 hour, playlists max-age=1.",
        "Build the player page with hls.js pointed at master.m3u8; confirm adaptive switching by throttling in devtools.",
        "Build chat: a Node ws server where each connection subscribes to a Redis channel per room; publish on message, fan out to local sockets on pub/sub delivery.",
        "Add slow mode (per-user token bucket in Redis) and a viewer counter (heartbeat keys with TTL, count via SCARD every 5 s).",
        "Measure glass-to-glass latency: show a clock on the broadcaster screen, compare with the player; tune segment count in the playlist to trade startup time vs latency.",
      ],
      codeSketches: [
        {
          title: "Transcoding ladder + HLS packaging (single ffmpeg)",
          language: "python",
          code: `import subprocess

def start_transcode(stream_key: str, out_dir: str):
    # Two renditions, keyframes aligned every 2 s (gop 60 at 30 fps),
    # 2 s segments, rolling window of 6 segments per playlist.
    cmd = [
        "ffmpeg", "-i", "rtmp://localhost/live/" + stream_key,
        "-filter_complex",
        "[0:v]split=2[v1][v2];"
        "[v1]scale=w=1280:h=720[v1out];"
        "[v2]scale=w=640:h=360[v2out]",
        "-map", "[v1out]", "-c:v:0", "libx264", "-b:v:0", "3000k",
        "-g", "60", "-keyint_min", "60", "-sc_threshold", "0",
        "-map", "[v2out]", "-c:v:1", "libx264", "-b:v:1", "800k",
        "-map", "a:0", "-map", "a:0", "-c:a", "aac", "-b:a", "128k",
        "-f", "hls", "-hls_time", "2", "-hls_list_size", "6",
        "-hls_flags", "delete_segments+independent_segments",
        "-master_pl_name", "master.m3u8",
        "-var_stream_map", "v:0,a:0,name:720p v:1,a:1,name:360p",
        out_dir + "/stream_%v.m3u8",
    ]
    return subprocess.Popen(cmd)`,
        },
        {
          title: "Chat fan-out with Redis pub/sub and WebSockets",
          language: "typescript",
          code: `import { WebSocketServer, WebSocket } from "ws";
import { Redis } from "ioredis";

const pub = new Redis();
const sub = new Redis();
const rooms = new Map<string, Set<WebSocket>>(); // channel -> local sockets

sub.on("message", (channel, raw) => {
  // One pub/sub delivery per gateway, then local multicast:
  // the message is serialized once and written to every socket.
  const sockets = rooms.get(channel);
  if (!sockets) return;
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) ws.send(raw);
  }
});

const wss = new WebSocketServer({ port: 8081 });
wss.on("connection", (ws, req) => {
  const channel = "chat:" + new URL(req.url ?? "/", "http://x").searchParams.get("room");
  if (!rooms.has(channel)) {
    rooms.set(channel, new Set());
    sub.subscribe(channel); // subscribe only while we have local viewers
  }
  rooms.get(channel)!.add(ws);

  ws.on("message", async (data) => {
    const msg = JSON.stringify({ body: String(data).slice(0, 500), at: Date.now() });
    await pub.publish(channel, msg); // publish once; all gateways fan out
  });

  ws.on("close", () => {
    const set = rooms.get(channel)!;
    set.delete(ws);
    if (set.size === 0) { rooms.delete(channel); sub.unsubscribe(channel); }
  });
});`,
        },
        {
          title: "Slow mode: per-user rate limit with Redis",
          language: "typescript",
          code: `import { Redis } from "ioredis";
const redis = new Redis();

// Returns true if the user may send; enforces one message per
// slowModeSeconds per room using SET NX with expiry, which is atomic.
export async function allowMessage(
  room: string,
  userId: string,
  slowModeSeconds: number
): Promise<boolean> {
  if (slowModeSeconds <= 0) return true;
  const key = "slow:" + room + ":" + userId;
  const ok = await redis.set(key, "1", "EX", slowModeSeconds, "NX");
  return ok === "OK";
}

// Viewer count: heartbeat every 15 s from each player.
export async function heartbeat(room: string, viewerId: string) {
  await redis.set("viewer:" + room + ":" + viewerId, "1", "EX", 30);
}

export async function viewerCount(room: string): Promise<number> {
  let cursor = "0", count = 0;
  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", "viewer:" + room + ":*", "COUNT", 1000);
    cursor = next;
    count += keys.length;
  } while (cursor !== "0");
  return count;
}`,
        },
      ],
    },
  },
];
