import type { Topic } from "./types";

export const fundamentalsTopics: Topic[] = [
  {
    slug: "scalability",
    title: "Scalability",
    category: "Fundamentals",
    summary:
      "Scalability is a system's ability to handle growing load by adding resources, either by making individual machines bigger (vertical) or by adding more machines (horizontal). Nearly every system design interview hinges on how you scale past a single box.",
    sections: [
      {
        heading: "Vertical vs Horizontal Scaling",
        body:
          "Vertical scaling (scaling up) means adding more CPU, RAM, or faster disks to a single machine. It is the simplest path: no code changes, no distributed-systems complexity, and strong consistency comes for free because there is one node. Modern cloud instances go remarkably far, an AWS u-24tb1.metal offers 24 TB of RAM, and a single well-tuned Postgres box can serve tens of thousands of queries per second. Many companies run profitably on one large primary database for years.\n\nThe limits are hard, though. There is a ceiling on how big one machine can get, price grows super-linearly (a machine with 2x the specs often costs 3-4x), and a single machine is a single point of failure. Upgrades usually require downtime or a failover.\n\nHorizontal scaling (scaling out) adds more commodity machines behind a load balancer. Capacity grows roughly linearly with node count, failures of individual nodes are survivable, and you can scale incrementally. The cost is architectural: you now need load balancing, service discovery, and a strategy for data that no longer fits on one node (sharding, replication). Google, Amazon, and Netflix all built their platforms on the assumption that any individual commodity server can and will die.",
      },
      {
        heading: "Stateless Services",
        body:
          "The key enabler of horizontal scaling is statelessness: any request can be served by any instance because instances hold no client-specific state between requests. Session data moves out of process memory into a shared store such as Redis or Memcached, or into a signed token like a JWT that the client carries with each request.\n\nWith stateless app servers, the load balancer can spray traffic freely, autoscalers can add or remove instances at will, and deploys become trivial rolling replacements. Contrast this with sticky sessions, where a user is pinned to one server: if that server dies, the session is lost, and hot users create hot servers.\n\nState does not disappear, it gets pushed to the edges of the architecture: databases, caches, object stores like S3, and message queues. A common interview framing is that the stateless tier scales easily and the stateful tier (the database) is where scaling gets hard, which is why so much of system design is really about scaling data.",
      },
      {
        heading: "Elasticity and Autoscaling",
        body:
          "Elasticity is the ability to add and remove capacity automatically in response to demand. AWS Auto Scaling Groups, Kubernetes Horizontal Pod Autoscaler, and GCP managed instance groups watch signals like CPU utilization, request count per target, or queue depth and adjust instance counts. A typical policy might target 60 percent average CPU, scaling out fast and scaling in slowly to avoid flapping.\n\nElasticity matters because real traffic is bursty. A retail site might see 10x normal load on Black Friday, and a news site can spike 50x in minutes. Provisioning statically for peak wastes money the other 99 percent of the time; provisioning for average means falling over at peak. Autoscaling has lag, though, booting a VM can take 1-3 minutes, so systems still need headroom, and sudden spikes are often absorbed first by caches, CDNs, and load shedding.\n\nMention the difference between predictive scaling (scale up before a scheduled event, like a product launch) and reactive scaling (respond to metrics). Mature systems use both.",
      },
      {
        heading: "Scaling Reads and Writes Differently",
        body:
          "Most systems are read-heavy, ratios of 100:1 reads to writes are common for social or content products. Reads scale with caching (CDN, Redis, application-level caches) and read replicas, both of which are far cheaper than sharding. A single cache layer with a 90 percent hit rate cuts database read load by 10x.\n\nWrites are harder. Replicas do not help write throughput because every write must reach the primary. Options include sharding (partition data across many primaries), write batching, and absorbing bursts with a message queue so the database consumes at a steady rate. Each adds complexity, which is why interviewers respect answers that delay sharding until simpler levers are exhausted.\n\nA strong senior answer sequences the levers: optimize queries and indexes, add caching, add read replicas, scale vertically while it is cheap, then shard when write volume or data size truly demands it.",
      },
    ],
    keyPoints: [
      "Vertical scaling is simpler but has a hard ceiling, super-linear cost, and a single point of failure; horizontal scaling is near-limitless but forces distributed-systems complexity.",
      "Stateless services are the prerequisite for horizontal scaling; push state into Redis, databases, object storage, or client-held tokens.",
      "Elasticity (autoscaling) matches capacity to bursty demand, but scaling lag means you still need headroom and caches for sudden spikes.",
      "Scale reads with caching and replicas before touching writes; scale writes with sharding and queue-based buffering only when needed.",
      "Sequence your levers in an interview: indexes and query tuning, caching, replicas, vertical scaling, then sharding last.",
      "Design for failure at scale: with hundreds of commodity nodes, individual failures are routine, not exceptional.",
    ],
    tradeoffs: [
      {
        option: "Vertical scaling (scale up)",
        pros: [
          "No application changes or distributed-systems complexity",
          "Strong consistency is trivial on a single node",
          "Fast to execute; often just an instance resize",
        ],
        cons: [
          "Hard ceiling on maximum machine size",
          "Cost grows super-linearly with specs",
          "Single point of failure; upgrades often need downtime",
        ],
      },
      {
        option: "Horizontal scaling (scale out)",
        pros: [
          "Near-linear capacity growth with commodity hardware",
          "Fault tolerance: losing one node is survivable",
          "Enables elasticity and zero-downtime rolling deploys",
        ],
        cons: [
          "Requires load balancing, service discovery, and stateless design",
          "Data layer becomes hard: sharding, replication, consistency tradeoffs",
          "Operational complexity and observability burden grow",
        ],
      },
      {
        option: "Sticky sessions instead of externalized state",
        pros: [
          "Simple to implement; in-memory session access is fast",
          "No shared session store to operate",
        ],
        cons: [
          "Server loss destroys sessions",
          "Uneven load distribution and hot instances",
          "Blocks clean autoscaling and rolling deploys",
        ],
      },
    ],
    interviewTips: [
      "Do not jump straight to microservices and sharding; interviewers want to see you scale incrementally and justify each step with numbers.",
      "State the read:write ratio early, it determines whether caching and replicas solve the problem or whether you need to shard writes.",
      "Explicitly call out what is stateful in your design and where that state lives; it shows you understand why horizontal scaling works.",
      "Use concrete capacity math: for example, if one app server handles 1,000 RPS and you expect 50,000 RPS peak, you need roughly 50 instances plus headroom.",
    ],
    related: ["load-balancing", "caching", "sharding-and-partitioning", "replication"],
  },
  {
    slug: "load-balancing",
    title: "Load Balancing",
    category: "Networking",
    summary:
      "Load balancers distribute incoming traffic across multiple backend servers to maximize throughput, minimize latency, and tolerate server failures. They are the front door of almost every horizontally scaled system.",
    sections: [
      {
        heading: "Layer 4 vs Layer 7",
        body:
          "A Layer 4 (transport-layer) load balancer routes based on IP address and TCP/UDP port. It does not inspect payloads, so it is extremely fast and cheap per connection, AWS Network Load Balancer operates at L4 and handles millions of requests per second with sub-millisecond added latency, preserving the client's source IP. L4 is the right choice for raw TCP or UDP workloads, very high throughput, and cases where you terminate TLS on the backend.\n\nA Layer 7 (application-layer) load balancer terminates the connection, parses HTTP, and routes on content: path, host header, cookies, or query parameters. This enables path-based routing (/api to one service, /static to another), TLS termination, HTTP/2 and gRPC multiplexing, request rewriting, and WAF integration. AWS Application Load Balancer, Nginx, HAProxy, and Envoy all operate at L7. The cost is more CPU per request and slightly higher latency because the proxy fully processes each request.\n\nIn practice many architectures layer them: an L4 balancer for fast, resilient traffic distribution in front of a fleet of L7 proxies that do smart routing. Kubernetes commonly pairs a cloud L4 balancer with an Envoy or Nginx ingress at L7.",
      },
      {
        heading: "Balancing Algorithms",
        body:
          "Round robin cycles through backends in order and is the default nearly everywhere. It is fair when requests are uniform and servers are identical, but a few slow requests can pile onto an unlucky server. Weighted round robin assigns proportionally more traffic to bigger machines, useful during canary deploys, for example sending 5 percent of traffic to a new version.\n\nLeast connections routes each new request to the backend with the fewest active connections, which naturally adapts when request durations vary wildly, common with APIs where one endpoint takes 10 ms and another 2 seconds. Least response time and least loaded variants use latency or reported load instead. Power-of-two-choices, used by Envoy and Nginx, picks two random backends and sends to the less loaded one, capturing most of the benefit of least-connections without global state.\n\nConsistent hashing routes based on a hash of a key (client IP, user ID, cache key) so that the same key almost always lands on the same backend. This matters for cache locality: if each backend caches data for its users, hashing keeps hit rates high, and when a node is added or removed only about 1/N of keys move rather than nearly all of them. This is the same technique behind distributed caches and is worth knowing deeply for senior interviews.",
      },
      {
        heading: "Health Checks and Failure Handling",
        body:
          "Load balancers continuously probe backends and stop sending traffic to unhealthy ones. Active checks hit an endpoint like /healthz every 5-30 seconds and mark a node down after, say, 3 consecutive failures and up again after 2 successes, thresholds that prevent flapping. Passive checks watch real traffic and eject backends that return errors or time out, Envoy calls this outlier detection.\n\nHealth checks should be shallow enough to be cheap but deep enough to be meaningful. A check that only confirms the process is alive misses a wedged database connection pool; a check that queries the database can cause cascading failures where a brief database blip marks every app server unhealthy at once. Many teams use a liveness check (is the process running) separately from a readiness check (can it serve traffic), which is exactly the Kubernetes model.\n\nAlso consider connection draining: when removing a backend for deploys, the balancer stops new connections but lets in-flight requests finish, typically with a 30-300 second drain timeout. Without it, every deploy causes a burst of user-visible errors.",
      },
      {
        heading: "Global vs Local Load Balancing",
        body:
          "Local load balancing distributes traffic among servers within one data center or region. Global load balancing (GSLB) distributes users across regions, usually via DNS (Route 53 latency-based or geolocation routing) or anycast IPs (Cloudflare and Google's front ends advertise the same IP from hundreds of locations, and BGP routes each user to the nearest one).\n\nGlobal balancing serves three goals: latency (send a user in Frankfurt to eu-central rather than us-east, saving roughly 90 ms of round trip), disaster recovery (fail an entire region out by changing routing), and data sovereignty or capacity placement. DNS-based approaches are simple but blunted by TTL caching and resolvers that ignore TTLs; anycast fails over in seconds because BGP reconverges without waiting for client caches.\n\nA complete picture for an interview: GeoDNS or anycast picks the region, an L4 balancer distributes across L7 proxies in that region, and the L7 layer routes to service instances. Being able to sketch that three-tier funnel quickly is a strong senior signal.",
      },
    ],
    keyPoints: [
      "L4 balances on IP and port with very high throughput and low latency; L7 parses HTTP and enables path routing, TLS termination, and gRPC support at higher per-request cost.",
      "Round robin is fine for uniform requests; least connections adapts to variable request durations; consistent hashing preserves cache locality and minimizes remapping when nodes change.",
      "Health checks need tuned thresholds and connection draining, and should distinguish liveness from readiness to avoid cascading failures.",
      "Global load balancing (GeoDNS, anycast) routes users to the nearest healthy region; local balancing distributes within a region.",
      "Load balancers themselves must be redundant, typically active-passive pairs with a floating IP or managed services that are inherently multi-node.",
      "Weighted routing enables canary deploys, for example shifting 5 percent of traffic to a new version before full rollout.",
    ],
    tradeoffs: [
      {
        option: "L4 load balancer",
        pros: [
          "Millions of RPS with sub-millisecond overhead",
          "Protocol agnostic: works for any TCP/UDP traffic",
          "Preserves source IP; can pass TLS through end to end",
        ],
        cons: [
          "Cannot route on URL, headers, or cookies",
          "No request-level retries, rewrites, or WAF features",
        ],
      },
      {
        option: "L7 load balancer",
        pros: [
          "Content-based routing, TLS termination, HTTP/2 and gRPC handling",
          "Request-level observability, retries, and rate limiting",
        ],
        cons: [
          "Higher CPU cost and added latency per request",
          "Must keep pace with protocol evolution; larger attack surface",
        ],
      },
      {
        option: "Consistent hashing vs least connections",
        pros: [
          "Consistent hashing gives cache affinity and minimal key movement on topology change",
          "Deterministic routing simplifies debugging per-key issues",
        ],
        cons: [
          "Hot keys create hot servers that hashing cannot fix alone",
          "Least connections balances load better when requests are heterogeneous but destroys affinity",
        ],
      },
    ],
    interviewTips: [
      "Always place a load balancer in your diagram the moment you draw a second app server, and say whether it is L4 or L7 and why.",
      "If your design uses per-server caching or WebSockets, mention consistent hashing or sticky routing and the tradeoff versus even load distribution.",
      "Address the load balancer as a single point of failure: managed LBs are multi-node, self-hosted ones need an active-passive pair with VRRP or a floating IP.",
      "Name real systems, Nginx or Envoy at L7, AWS NLB at L4, Cloudflare anycast for global, to show hands-on familiarity.",
    ],
    related: ["scalability", "dns", "proxies", "consistent-hashing"],
  },
  {
    slug: "dns",
    title: "DNS",
    category: "Networking",
    summary:
      "The Domain Name System translates human-readable names like api.example.com into IP addresses through a globally distributed, heavily cached hierarchy. It is also a powerful, if blunt, tool for load balancing and regional failover.",
    sections: [
      {
        heading: "Resolution Flow",
        body:
          "When a client looks up api.example.com, it first checks local caches: the browser cache, then the OS resolver cache. On a miss, the query goes to a recursive resolver, typically the ISP's or a public one like Cloudflare 1.1.1.1 or Google 8.8.8.8. The recursive resolver does the real work: it asks a root nameserver (13 logical root server identities, each an anycast cluster of hundreds of machines), which points to the .com TLD servers, which point to example.com's authoritative nameservers (hosted by a provider like Route 53, Cloudflare, or NS1), which finally return the A or AAAA record.\n\nEvery hop caches aggressively, so in practice most lookups are answered from cache in single-digit milliseconds and never touch the root or TLD servers. A full cold resolution takes tens to a couple hundred milliseconds, which is why DNS latency matters for first-visit page load and why browsers do DNS prefetching.\n\nKnow the distinction between a recursive resolver (does the full walk on behalf of clients, caches results) and an authoritative server (owns the zone and gives definitive answers). Route 53 and Cloudflare DNS are authoritative services; 8.8.8.8 is a recursive service.",
      },
      {
        heading: "Record Types",
        body:
          "The records that matter in system design: A maps a name to an IPv4 address, AAAA to IPv6. CNAME aliases one name to another (www.example.com to example.com), with the constraint that a CNAME cannot coexist with other records at the same name, which is why zone apexes need A records or provider-specific ALIAS/ANAME flattening. NS records delegate a zone to authoritative nameservers, MX routes mail, and TXT carries arbitrary text used for domain verification, SPF, DKIM, and DMARC.\n\nSRV records carry port and priority information and appear in service discovery contexts, Consul and Kubernetes expose DNS SRV interfaces. CAA records restrict which certificate authorities may issue certs for a domain, a small but nice security detail to mention.\n\nA practical pattern: point a CNAME at a load balancer or CDN hostname (d123.cloudfront.net) rather than hardcoding IPs, so the provider can change underlying addresses freely.",
      },
      {
        heading: "TTL and Caching Behavior",
        body:
          "Every record carries a TTL (time to live) that tells resolvers how long to cache it. Long TTLs (3600 seconds to 24 hours) reduce query load and lookup latency; short TTLs (30-60 seconds) let you change answers quickly for failover or migrations. A common operational play is to lower TTL from 1 hour to 60 seconds a day before a planned migration, cut over, verify, then raise it back.\n\nThe catch is that TTLs are advisory. Some resolvers ignore very low TTLs, some applications and JVMs cache DNS results indefinitely unless configured otherwise, and mobile carriers are notorious for stale caches. So DNS failover is best-effort with a tail: after you change a record, most traffic moves within the TTL window, but a residual trickle can hit the old IP for hours. Any design that relies on DNS for failover should keep the old endpoint able to respond or redirect during that tail.\n\nNegative caching also exists: NXDOMAIN responses are cached according to the zone's SOA settings, which can make a freshly created record appear broken for a few minutes if someone queried it before it existed.",
      },
      {
        heading: "DNS Load Balancing, GeoDNS, and Anycast",
        body:
          "DNS can return multiple A records (round-robin DNS), and clients pick one, spreading load coarsely across servers. It is crude: no health awareness by default, no load feedback, and cache-skewed distribution. Managed DNS providers improve on this with health-checked records, Route 53 removes an IP from answers when its health check fails, plus routing policies: latency-based (answer with the region closest in measured latency), geolocation (answer based on where the user is, useful for data-residency rules), and weighted (send 10 percent of traffic to a new region).\n\nGeoDNS works by looking at the recursive resolver's IP (or the EDNS Client Subnet extension for better accuracy) to infer user location. This is how a single hostname sends European users to eu-central and US users to us-east, forming the top layer of global load balancing.\n\nAnycast is the complementary technique: advertise one IP from many locations via BGP, and the internet routes each user to the topologically nearest site. All large CDNs and public resolvers run anycast; Cloudflare serves its entire network from a small set of anycast IPs across 300+ cities. Anycast fails over in seconds via BGP reconvergence and needs no cache expiry, which is why it beats DNS-based failover for speed, but it offers less fine-grained control over traffic split percentages.",
      },
    ],
    keyPoints: [
      "Resolution walks browser cache, OS cache, recursive resolver, then root, TLD, and authoritative servers, with caching at every layer.",
      "Know the core record types: A/AAAA, CNAME (and the apex limitation), NS, MX, TXT, SRV, CAA.",
      "TTL controls the tradeoff between cache efficiency and change agility; lower it before planned migrations, and expect a stale tail because TTLs are advisory.",
      "DNS round robin is coarse load balancing; managed providers add health checks and latency, geo, and weighted routing policies.",
      "GeoDNS routes by resolver or client subnet location; anycast routes by BGP topology and fails over in seconds without cache expiry.",
      "DNS is a common outage root cause and a single point of failure if you use one provider; large properties multi-home across two DNS providers.",
    ],
    tradeoffs: [
      {
        option: "Short TTL (30-60s)",
        pros: [
          "Fast failover and migration cutovers",
          "Enables responsive DNS-based traffic shifting",
        ],
        cons: [
          "More queries against authoritative servers, higher cost",
          "Adds resolution latency for users on cache misses",
          "Some resolvers ignore very short TTLs anyway",
        ],
      },
      {
        option: "DNS-based global failover vs anycast",
        pros: [
          "DNS policies give fine-grained control: weights, geo rules, per-record health checks",
          "Works with ordinary unicast infrastructure, no BGP expertise needed",
        ],
        cons: [
          "Failover is delayed by TTL caching and misbehaving resolvers",
          "Anycast fails over in seconds but requires BGP operations and offers coarser traffic control",
        ],
      },
    ],
    interviewTips: [
      "Walk the resolution chain crisply, browser, OS, recursive resolver, root, TLD, authoritative, and note that caching means most queries never leave the resolver.",
      "When you propose DNS failover, proactively mention the TTL tail: some clients will hit the old IP after the switch, so plan for it.",
      "Use GeoDNS or latency-based routing as the top of your multi-region story, then hand off to regional load balancers.",
      "Mentioning EDNS Client Subnet, apex CNAME limitations, or multi-provider DNS redundancy signals real operational experience.",
    ],
    related: ["load-balancing", "cdn", "fault-tolerance"],
  },
  {
    slug: "cdn",
    title: "CDN (Content Delivery Network)",
    category: "Networking",
    summary:
      "A CDN caches content on edge servers close to users, cutting latency from hundreds of milliseconds to tens, absorbing traffic spikes, and shielding origin servers. Cloudflare, CloudFront, Akamai, and Fastly are the canonical providers.",
    sections: [
      {
        heading: "Edge Caching and Why It Works",
        body:
          "The speed of light is the constraint: a round trip from Sydney to a us-east origin is roughly 200 ms before the server does any work, and TLS setup multiplies that by several round trips. A CDN places points of presence (PoPs) in hundreds of cities, Cloudflare operates in 300+, so the user's TCP and TLS handshakes terminate perhaps 10-30 ms away. Cached content is served entirely from the edge; even uncached requests benefit because the edge maintains warm, long-lived connections to the origin over optimized routes.\n\nA request flow: user hits static.example.com, GeoDNS or anycast lands them on the nearest PoP, the edge checks its cache, on a hit it serves immediately, on a miss it fetches from the origin (or from a regional shield cache in tiered architectures), stores the response per its cache headers, and serves it. Subsequent users in that region get hits. Cache hit ratios of 90-99 percent are normal for static assets, meaning the origin sees 1-10 percent of raw traffic.\n\nCDNs also provide origin shielding against traffic spikes and DDoS: a viral link or an attack is absorbed across hundreds of PoPs instead of concentrating on your servers. Request collapsing (coalescing many concurrent misses for the same object into one origin fetch) prevents thundering herds when a hot object expires.",
      },
      {
        heading: "Push vs Pull CDNs",
        body:
          "A pull (origin-pull) CDN populates its cache lazily: the first request for an object misses, the edge fetches it from the origin, then caches it. This is the default model for CloudFront, Cloudflare, and Fastly. It is nearly zero-maintenance, you just set cache headers, and storage is used only for content that is actually requested. The downsides are first-request latency in each region and origin dependence on misses.\n\nA push CDN requires you to upload content to the CDN's storage proactively, before any user requests it. This suits large, infrequently changing files with predictable demand, video releases, game patches, software installers, where you cannot afford a miss storm at launch. Netflix takes this to the extreme with Open Connect: it pre-positions popular titles onto appliances inside ISP networks during off-peak hours, so a new season is already sitting near viewers at release.\n\nMost web workloads use pull because content popularity follows a long tail and pushing everything everywhere wastes storage. A hybrid is common: pull for the general case, plus cache warming (scripted pre-fetching of known-hot URLs) before big events.",
      },
      {
        heading: "TTLs and Cache Invalidation",
        body:
          "Cache lifetime is controlled by HTTP headers: Cache-Control max-age governs browser caching and s-maxage governs shared caches like CDNs. The cleanest strategy is immutable, fingerprinted assets: build tools emit app.a1b2c3.js, you set Cache-Control public, max-age=31536000, immutable, and you never invalidate, deploying new HTML that references new filenames instead. Invalidation becomes a non-problem for the bulk of your bytes.\n\nFor content that changes in place (HTML pages, JSON APIs, images at stable URLs), you need active invalidation: purge APIs that remove objects from edge caches. Fastly executes purges globally in well under a second and supports surrogate keys, tags attached to responses so you can purge everything tagged product-123 when that product changes. CloudFront invalidations are slower (tens of seconds to minutes) and priced per path, which pushes teams toward versioned URLs.\n\nA powerful middle ground is stale-while-revalidate: serve the cached copy immediately while refreshing it in the background, so users never wait on origin latency, plus stale-if-error to keep serving stale content when the origin is down. The classic quip that cache invalidation is one of the two hard problems in computer science is worth taking seriously: prefer designs (fingerprinting, short TTLs plus SWR) that make correctness not depend on perfect purging.",
      },
      {
        heading: "Dynamic Content and Edge Compute",
        body:
          "CDNs are not only for static files. Dynamic content acceleration routes uncached API and HTML traffic through the CDN anyway: the user's TLS handshake happens at the nearby edge, and the edge relays the request to the origin over pre-warmed, congestion-tuned connections on optimized backbone routes. This alone can cut 30-50 percent off dynamic request latency for far-away users, which is why sites put their entire domain behind Cloudflare or CloudFront, not just /static.\n\nEdge compute goes further, running code in the PoP: Cloudflare Workers, CloudFront Functions and Lambda@Edge, and Fastly Compute handle authentication token checks, A/B test assignment, redirects, personalization, and API response stitching without a round trip to the origin. Cloudflare Workers cold-start in under 5 ms using V8 isolates, making per-request edge logic practical.\n\nBe ready to say what should not be CDN-cached: private, per-user responses (unless keyed carefully with Vary or cache keys including auth state), and anything where serving a stale answer is dangerous. A classic incident pattern is accidentally caching a Set-Cookie response and serving one user's session to others, so mention explicitly stripping cookies and setting Cache-Control private on personalized responses.",
      },
    ],
    keyPoints: [
      "Edge PoPs cut round-trip latency from 100-300 ms to 10-30 ms and terminate TLS close to users; hit ratios of 90-99 percent shield the origin.",
      "Pull CDNs populate lazily and suit long-tail web content; push CDNs pre-position large predictable content, exemplified by Netflix Open Connect.",
      "Fingerprinted immutable assets with max-age=31536000 sidestep invalidation entirely; purge APIs and surrogate keys handle content that changes in place.",
      "stale-while-revalidate and stale-if-error hide origin latency and origin outages from users.",
      "CDNs accelerate dynamic traffic too, via TLS at the edge, warm origin connections, and optimized routing; edge compute runs logic in the PoP.",
      "Never cache personalized responses carelessly; cookie-caching incidents that leak one user's data to another are a classic failure mode.",
    ],
    tradeoffs: [
      {
        option: "Pull CDN",
        pros: [
          "Near-zero operational effort; cache fills based on real demand",
          "Storage-efficient for long-tail content",
        ],
        cons: [
          "First request per region is slow (miss penalty)",
          "Origin must absorb miss traffic, including synchronized misses on expiry without request collapsing",
        ],
      },
      {
        option: "Push CDN",
        pros: [
          "No miss storms at launch; content is pre-positioned for predictable spikes",
          "Origin can be minimal or offline at serve time",
        ],
        cons: [
          "You manage uploads, versioning, and deletion yourself",
          "Wasteful for content with unpredictable or long-tail demand",
        ],
      },
      {
        option: "Long TTL with purge vs short TTL",
        pros: [
          "Long TTLs maximize hit ratio and minimize origin load",
          "Purge APIs and surrogate keys give precise, fast invalidation on providers like Fastly",
        ],
        cons: [
          "Purge is an extra operational dependency that can fail or lag",
          "Short TTLs are simpler and self-healing but raise origin traffic and tail latency",
        ],
      },
    ],
    interviewTips: [
      "Add a CDN the moment the problem mentions global users, media, or read-heavy traffic, and quantify the win: 200 ms cross-ocean round trips become 20 ms.",
      "State your invalidation strategy unprompted, fingerprinted immutable assets for static, surrogate-key purge or short TTL plus stale-while-revalidate for mutable content.",
      "For a video or feed-heavy design, discuss push vs pull and cite Netflix Open Connect as the push extreme.",
      "Mention what you will not cache (per-user authenticated responses) and how you prevent cookie-leak caching bugs.",
    ],
    related: ["dns", "caching", "load-balancing", "performance-metrics"],
  },
  {
    slug: "proxies",
    title: "Proxies and Gateways",
    category: "Networking",
    summary:
      "Proxies are intermediaries that sit between clients and servers: forward proxies act on behalf of clients, reverse proxies on behalf of servers, and modern variants like API gateways and service-mesh sidecars centralize cross-cutting concerns.",
    sections: [
      {
        heading: "Forward Proxies",
        body:
          "A forward proxy sits in front of clients and makes requests to the internet on their behalf; the destination server sees the proxy's IP, not the client's. Classic uses are corporate egress control (filter and log which sites employees reach), anonymity, and shared caching of outbound requests, Squid is the traditional example.\n\nIn backend systems the same pattern appears as an egress proxy: all outbound calls from your services to third-party APIs flow through one layer that centralizes TLS policy, credential injection, per-vendor rate limiting, and audit logging. This also gives you one place to add retries and circuit breakers for flaky external dependencies, and a stable set of source IPs that partners can allowlist.\n\nThe distinguishing question is who the proxy serves: a forward proxy is configured by and represents the client side; the server on the far end may not even know a proxy is involved.",
      },
      {
        heading: "Reverse Proxies",
        body:
          "A reverse proxy sits in front of servers and receives client traffic on their behalf; clients see one endpoint and never talk to backends directly. Nginx, HAProxy, Envoy, and Caddy are the standard tools, and every L7 load balancer is a reverse proxy. Typical responsibilities: TLS termination (decrypt once at the edge instead of on every app server), load balancing across backends, response caching and compression (gzip or brotli), serving static files, request buffering to insulate app servers from slow clients (the slowloris problem), and a first line of security including IP filtering, WAF rules, and basic rate limiting.\n\nA canonical deployment: Nginx terminates TLS on port 443, serves /static from local disk, and proxies /api to a pool of application servers over plain HTTP on a private network, adding X-Forwarded-For headers so apps still see real client IPs. Nginx handles tens of thousands of concurrent connections per node with its event-driven model, which is why a thin proxy tier in front of heavier app runtimes (Rails, Django, Node) is near-universal.\n\nFor interviews, keep the two directions straight: forward proxy hides and serves clients, reverse proxy hides and serves servers. CDN edges are effectively globally distributed reverse proxies.",
      },
      {
        heading: "API Gateways",
        body:
          "An API gateway is a reverse proxy specialized for API traffic, and it is the standard front door of a microservices architecture. Beyond routing (/orders to the order service, /users to the user service), it centralizes cross-cutting concerns: authentication and authorization (validate JWTs or API keys once, so 30 services do not each reimplement it), rate limiting and quotas per API key, request and response transformation, response caching, canary routing, and per-endpoint metrics and logging. Kong, AWS API Gateway, Apigee, and Envoy-based gateways like Ambassador are common implementations.\n\nGateways also decouple your public API shape from internal service topology: you can split a monolith behind a stable external contract, aggregate several internal calls into one client-facing endpoint, or translate external REST to internal gRPC. The backends-for-frontends (BFF) pattern takes this further with a gateway per client type, one shaped for mobile, one for web, each aggregating and trimming responses for its client.\n\nThe risks to name: the gateway can become a single point of failure (run it as a horizontally scaled fleet), a latency tax (usually 1-10 ms, acceptable), and an organizational bottleneck if every route change funnels through one team, teams mitigate that with declarative, self-service route configuration.",
      },
      {
        heading: "Sidecars and Service Mesh",
        body:
          "Once you have many services calling each other, the same concerns, mutual TLS, retries, timeouts, circuit breaking, observability, reappear on every internal hop. A service mesh solves this by deploying a sidecar proxy (almost always Envoy) next to every service instance; all traffic in and out of the service transparently passes through its sidecar. The mesh control plane, Istio and Linkerd being the leading examples, pushes configuration to all sidecars: certificates for automatic mTLS between every pair of services, traffic-split rules for canaries (shift 1 percent, then 10, then 100), retry and timeout policies, and uniform metrics, so you get latency and error-rate dashboards for every service-to-service edge without touching application code.\n\nThe sidecar pattern's core win is language independence: your polyglot fleet of Go, Java, and Python services all get identical networking behavior because it lives in the proxy, not in per-language libraries. This replaced the earlier library approach (Netflix Hystrix and Ribbon) that required every service to embed and upgrade fat clients.\n\nThe honest costs: every hop gains two proxy traversals (typically adding single-digit milliseconds), each sidecar consumes memory and CPU across thousands of pods, and the operational complexity of the mesh itself is substantial. A good senior answer is that a mesh earns its keep at dozens-to-hundreds of services with strict mTLS or traffic-management needs, while smaller systems do fine with an API gateway plus sensible client libraries. Newer designs like Istio ambient mode move proxying to a per-node layer to cut the per-pod cost.",
      },
    ],
    keyPoints: [
      "Forward proxies represent clients (egress control, anonymity, outbound policy); reverse proxies represent servers (TLS termination, load balancing, caching, buffering).",
      "Nginx, HAProxy, and Envoy are the standard reverse proxies; a thin event-driven proxy tier in front of app servers is near-universal.",
      "API gateways centralize auth, rate limiting, routing, and transformation at the edge of a microservices system, and decouple public API shape from internal topology.",
      "The BFF pattern uses a gateway per client type to aggregate and tailor responses for mobile vs web.",
      "Service meshes put an Envoy sidecar next to every instance for automatic mTLS, retries, canary traffic splits, and uniform telemetry, independent of language.",
      "Every proxy layer adds latency and operational burden; justify each hop, and scale gateways horizontally so they are not single points of failure.",
    ],
    tradeoffs: [
      {
        option: "API gateway at the edge",
        pros: [
          "One place for auth, rate limiting, and API metrics instead of N implementations",
          "Stable public contract while internal services evolve or split",
        ],
        cons: [
          "Added hop latency and a critical component to operate and scale",
          "Can become an organizational bottleneck if route changes are centralized",
        ],
      },
      {
        option: "Service mesh sidecars",
        pros: [
          "Automatic mTLS, retries, and observability for all internal traffic with zero app code changes",
          "Language-agnostic; replaces per-language resilience libraries",
        ],
        cons: [
          "Per-pod CPU/memory overhead and extra milliseconds on every hop",
          "Significant operational complexity; overkill below dozens of services",
        ],
      },
      {
        option: "Resilience in libraries instead of proxies",
        pros: [
          "No extra network hops or sidecar resource cost",
          "Fine-grained, application-aware behavior",
        ],
        cons: [
          "Must be reimplemented and kept current in every language and service",
          "Inconsistent behavior and upgrade drift across the fleet",
        ],
      },
    ],
    interviewTips: [
      "Get the direction right instantly: forward proxy serves the client side, reverse proxy serves the server side, and say it out loud when you draw one.",
      "In any microservices design, place an API gateway at the edge and enumerate exactly what it does (auth, rate limiting, routing) so it is not a magic box.",
      "Bring up a service mesh only when the design has many internal services and needs mTLS or canary traffic control, and acknowledge its overhead unprompted.",
      "Cite real tools, Nginx for TLS termination and static files, Envoy as the modern proxy engine, Kong or AWS API Gateway at the edge, Istio for mesh.",
    ],
    related: ["load-balancing", "api-design", "rate-limiting", "microservices-vs-monolith"],
  },
  {
    slug: "api-design",
    title: "API Design",
    category: "Fundamentals",
    summary:
      "API design covers the contract between clients and services: the protocol style (REST, GraphQL, gRPC), and the mechanics that make APIs safe and pleasant at scale, versioning, pagination, idempotency, and webhooks.",
    sections: [
      {
        heading: "REST vs GraphQL vs gRPC",
        body:
          "REST models resources as URLs manipulated with HTTP verbs: GET /users/123, POST /orders, DELETE /sessions/abc. Its strengths are ubiquity, human readability, and free riding on HTTP semantics, GET is cacheable by browsers and CDNs, status codes are standardized, every language and tool speaks it. Design conventions to voice: plural nouns, nesting for ownership (/users/123/orders), proper verb semantics (PUT idempotent full replace, PATCH partial update), and meaningful status codes (201 Created, 404, 409 Conflict, 429).\n\nGraphQL exposes a typed schema and lets clients ask for exactly the fields they need in one request, solving REST's over-fetching (downloading 40 fields to use 3) and under-fetching (needing 4 round trips to assemble one screen). It shines for complex frontends over rich data graphs, GitHub's public API v4 is GraphQL. The costs: caching is harder because everything is a POST to one endpoint, unbounded queries can be pathologically expensive so you need depth limits and query cost analysis, and naive resolvers create N+1 database query patterns that require batching (DataLoader).\n\ngRPC uses Protocol Buffers over HTTP/2: binary serialization several times smaller and faster than JSON, code-generated clients in every major language, strict contracts from .proto files, and native streaming (client, server, and bidirectional). It dominates internal service-to-service communication, latency-sensitive paths, and polyglot microservice fleets. It is a poor fit for public browser-facing APIs since browsers cannot speak native gRPC without a gRPC-Web translation layer. The standard senior answer: REST for public APIs, gRPC internally, GraphQL where a complex client owns aggregation, and these coexist in one system.",
      },
      {
        heading: "Versioning and Compatibility",
        body:
          "APIs outlive their first design, and the cardinal rule is never break existing clients. Additive changes (new optional fields, new endpoints) are safe; removing or renaming fields, changing types, or tightening validation are breaking and require a versioning strategy.\n\nThe common approaches: URL path versioning (/v1/users, most visible and most popular, used by Stripe-style public APIs and most REST services), header or media-type versioning (cleaner URLs, harder to test in a browser), and date-based versioning, Stripe's signature move, where each account pins to the API version from its first request and Stripe maintains transform layers between dozens of dated versions so ancient integrations keep working for years.\n\ngRPC and protobuf handle this at the field level: fields have numbered tags, old clients ignore unknown fields, and you never reuse or renumber tags. GraphQL prefers continuous evolution over versions: add fields freely, mark old ones deprecated, and monitor field usage before removal. Whatever the mechanism, the operational half matters: publish deprecation timelines, emit warnings (Sunset headers), track per-version usage, and keep the number of live versions small, every version is a permanent test and maintenance burden.",
      },
      {
        heading: "Pagination",
        body:
          "Any endpoint that returns a list needs pagination, unbounded responses are a reliability bug waiting for a big customer. Offset pagination (?limit=20&offset=40, or page numbers) is simple and lets users jump to page N, but it degrades and misbehaves at scale: OFFSET 100000 forces the database to scan and discard 100,000 rows, and if rows are inserted or deleted between page fetches, items shift so users see duplicates or gaps.\n\nCursor (keyset) pagination returns an opaque cursor encoding the position of the last item, typically its sort key: ?limit=20&cursor=xyz translates to WHERE (created_at, id) < (cursor values) ORDER BY created_at DESC, id DESC LIMIT 20. This is a pure index seek, constant cost at any depth, and stable under concurrent inserts, which is why Stripe, Slack, and Twitter/X APIs are cursor-based. Include the id as a tiebreaker so the sort is total, and keep the cursor opaque (base64) so clients cannot construct or misparse it.\n\nSay the limits too: cursors cannot jump to an arbitrary page and only support the predefined sort orders you indexed for. A pragmatic hybrid is offset for small admin datasets, cursors for anything user-facing or large. Also cap the limit parameter (max 100) or a client will ask for a million rows.",
      },
      {
        heading: "Idempotency Keys",
        body:
          "Networks fail in the worst way: the client times out without knowing whether the server processed the request. If the request was POST /payments for 50 dollars, blindly retrying risks a double charge, but not retrying risks a failed payment. Idempotency keys resolve this: the client generates a unique key (a UUID) per logical operation and sends it as a header, Idempotency-Key: abc-123. The server atomically records the key before processing and stores the response; a retry with the same key returns the stored response instead of re-executing. Stripe's API is the canonical implementation, retaining keys for 24 hours.\n\nImplementation details that interviewers probe: the key check and the operation should commit atomically (same database transaction, or an atomic insert of the key acting as a lock) or a race between two concurrent retries can still double-execute; concurrent duplicates should get a 409 or wait; keys need a TTL; and the stored response must be returned byte-identical so clients cannot distinguish a replay from the original.\n\nConnect this to HTTP semantics: GET, PUT, and DELETE are defined as idempotent, POST is not, which is exactly why POST endpoints with side effects (payments, orders, sends) are where idempotency keys matter. The same concept generalizes to queue consumers: at-least-once delivery means every consumer of a payment event needs idempotent handling too.",
      },
      {
        heading: "Webhooks",
        body:
          "Webhooks invert the API: instead of clients polling GET /orders/123 every few seconds, the server POSTs an event to a URL the client registered when something happens, order.completed, payment.failed. This eliminates polling waste (thousands of empty polls per real event) and cuts notification latency to near-real-time. Stripe, GitHub, Slack, and Twilio are all webhook-driven platforms.\n\nDelivering webhooks reliably is a real system: the receiver may be down, so you need retries with exponential backoff (Stripe retries for up to 3 days), which means at-least-once delivery, which means receivers must deduplicate by event ID. Senders sign payloads with HMAC (Stripe-Signature header) including a timestamp to block forgery and replay; receivers must verify the signature and respond 200 quickly, enqueueing heavy work rather than processing inline, or they will time out and trigger spurious retries. Order is not guaranteed, so events carry IDs and timestamps and receivers reconcile against the API as the source of truth.\n\nProvide an events log endpoint (GET /events) so consumers can backfill anything missed during an outage, and a dashboard showing delivery attempts, Stripe and GitHub both do this because debugging webhook failures is otherwise miserable. In an interview, webhooks pair naturally with a message queue on the sender side: the app emits events to a queue, and a delivery worker pool handles fan-out, retries, and dead-lettering.",
      },
    ],
    keyPoints: [
      "REST for public ubiquity and HTTP caching, GraphQL for flexible client-driven queries over complex data, gRPC for fast typed internal RPC with streaming; large systems use all three in different places.",
      "Never break existing clients: version via URL path or Stripe-style pinned dates, evolve protobufs by field-number discipline, deprecate GraphQL fields with usage monitoring.",
      "Cursor pagination is constant-cost at any depth and stable under writes; offset pagination degrades and skips or duplicates items. Cap page sizes.",
      "Idempotency keys make unsafe retries safe: client sends a UUID, server atomically records it and replays the stored response for duplicates. Essential for payments.",
      "Webhooks replace polling with pushed events but require HMAC signing, retries with backoff, receiver-side dedup by event ID, and a backfill endpoint.",
      "Design errors deliberately: correct status codes, machine-readable error bodies, and 429 with Retry-After for rate limits.",
    ],
    tradeoffs: [
      {
        option: "REST",
        pros: [
          "Universal tooling and developer familiarity",
          "Native HTTP caching, CDN-friendly GETs, standard status codes",
        ],
        cons: [
          "Over- and under-fetching for complex client views",
          "No formal contract unless you add OpenAPI discipline",
        ],
      },
      {
        option: "GraphQL",
        pros: [
          "Clients fetch exactly what they need in one round trip",
          "Strongly typed schema with introspection; smooth field-level evolution",
        ],
        cons: [
          "HTTP/CDN caching largely lost; needs query cost limits to prevent abuse",
          "N+1 resolver patterns and server complexity (batching, persisted queries)",
        ],
      },
      {
        option: "gRPC",
        pros: [
          "Compact binary protobufs and HTTP/2 multiplexing; low latency at high QPS",
          "Generated clients, strict contracts, and native bidirectional streaming",
        ],
        cons: [
          "Not browser-native; needs gRPC-Web or a REST gateway for public use",
          "Binary payloads are harder to debug with generic HTTP tools",
        ],
      },
    ],
    interviewTips: [
      "When asked to design an API, sketch 4-6 concrete endpoints with verbs, status codes, and pagination parameters rather than speaking abstractly.",
      "For anything involving money or side effects, volunteer idempotency keys and explain the retry-timeout ambiguity they solve, it is a strong senior signal.",
      "Default to cursor pagination for user-facing lists and say why offset breaks at depth and under concurrent writes.",
      "If your design notifies third parties, propose webhooks and immediately cover signing, retries, and receiver dedup so it does not sound hand-wavy.",
    ],
    related: ["rate-limiting", "proxies", "message-queues", "realtime-communication"],
  },
  {
    slug: "rate-limiting",
    title: "Rate Limiting",
    category: "Fundamentals",
    summary:
      "Rate limiting bounds how many requests a client can make in a window, protecting services from abuse, runaway clients, and overload while enforcing fair use and pricing tiers. The core algorithms are token bucket, leaky bucket, and window counters.",
    sections: [
      {
        heading: "Token Bucket and Leaky Bucket",
        body:
          "Token bucket is the workhorse. A bucket holds up to B tokens and refills at r tokens per second; each request consumes a token and is rejected (or queued) when the bucket is empty. The two parameters map directly to product language: r is the sustained rate, B is the burst allowance. With r = 10/s and B = 100, a client averaging 10 requests per second is never limited and can burst 100 at once after idling, matching real traffic, which is bursty, without permitting a sustained flood. Implementation is tiny: store tokens and last-refill timestamp per key, and compute the refill lazily on each request. This is what AWS API Gateway and Stripe describe for their limits, and Nginx's limit_req is the same family.\n\nLeaky bucket enforces a perfectly smooth output rate: requests enter a queue (the bucket) and drain at a constant rate; arrivals that overflow the queue are dropped. Where token bucket admits bursts immediately, leaky bucket shapes them into a steady stream, adding queueing delay. It suits downstream systems that genuinely need smooth inflow, calling a fragile third-party API at exactly its contracted rate, or pacing writes to a database, more than user-facing request limiting, where making a burst of 50 requests wait in line feels worse than serving them instantly from banked tokens.\n\nInterview shorthand: token bucket limits the average rate while allowing configurable bursts; leaky bucket limits the instantaneous output rate and smooths bursts into delay.",
      },
      {
        heading: "Fixed and Sliding Windows",
        body:
          "Fixed window counting is the simplest scheme: keep a counter per key per window (user 42, minute 10:04), increment on each request, reject above the limit, and let the counter expire. One Redis INCR plus EXPIRE per request. Its flaw is the boundary burst: with a limit of 100 per minute, a client can send 100 requests at 10:04:59 and 100 more at 10:05:01, 200 requests in two seconds, double the intended rate, because the counter reset.\n\nSliding window log fixes this exactly: store a timestamp per request (a Redis sorted set), and on each request drop entries older than the window and count the remainder. Precise, but memory scales with request volume per key, storing 10,000 timestamps for a high-limit key is wasteful.\n\nSliding window counter is the standard compromise, used by Cloudflare: keep fixed counters for the current and previous windows and estimate the rolling count as current + previous * (overlap fraction). If the previous minute saw 80 requests and we are 30 percent into the current minute which has 20, the estimate is 20 + 80 * 0.7 = 76. It assumes uniform distribution within the previous window, an approximation Cloudflare measured as accurate enough in practice, and costs two counters per key regardless of traffic. For most systems the practical choice is sliding window counter or token bucket; fixed window is acceptable when the boundary burst is tolerable.",
      },
      {
        heading: "Distributed Rate Limiting",
        body:
          "One server's in-memory bucket stops working the moment a load balancer spreads a client across 20 instances, each instance would allow the full limit, multiplying it by 20. The common fix is centralized state in Redis: counters or bucket state keyed by client, updated atomically. Because a get-compute-set sequence from multiple app servers races, the update must be atomic, which in practice means a Lua script executed inside Redis that reads the bucket, refills by elapsed time, decrements, and returns allow or deny in one step. A Redis node handles on the order of 100k such ops per second; beyond that you shard limiter keys across a Redis cluster, which is clean because each client's state lives on one shard.\n\nThe centralized approach adds a network round trip (commonly 1 ms in-region) and a dependency: decide explicitly whether the limiter fails open (Redis down means allow traffic, protecting availability) or fails closed (deny, protecting the backend), most user-facing systems fail open with an alert.\n\nThe alternative trades precision for speed: local limiting with synchronization. Each node enforces limit/N locally, or nodes keep local counters and asynchronously sync through Redis or a gossip layer, letting the effective global limit overshoot briefly. Envoy supports both patterns, a local token-bucket filter and a global rate limit service (gRPC calls to a Redis-backed limiter). A hybrid is common and worth naming: a generous local limit as a cheap first-pass shield against extreme floods, then the precise global check in Redis.",
      },
      {
        heading: "Client Experience and 429 Handling",
        body:
          "When rejecting, return HTTP 429 Too Many Requests with headers clients can act on: Retry-After (seconds until it is worth retrying) and the X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset trio popularized by GitHub, with an IETF draft standardizing RateLimit headers. Well-behaved SDKs read these and pace themselves, Stripe's client libraries retry 429s automatically with exponential backoff.\n\nClients must retry with exponential backoff plus jitter: 1s, 2s, 4s, 8s with a random offset. Without jitter, a thousand clients rejected at the same instant retry at the same instants, producing synchronized waves, the thundering herd, that keep the service pinned. This mirrors what TCP and every cloud SDK do internally.\n\nDesign the limiting dimensions and tiers explicitly: per API key or user for fairness and pricing (free tier 100 req/min, paid 10,000), per IP for unauthenticated abuse, per endpoint because an expensive search costs more than a status check, sometimes charging weighted costs against one budget, and a global concurrency cap as a load-shedding backstop. Distinguish rate limiting (per-client fairness and abuse control) from load shedding (dropping excess work under overload regardless of client) since both return 429 or 503 but answer different questions. Also decide reject versus throttle: user-facing APIs reject fast with 429; internal batch pipelines often prefer to delay, leaky-bucket style, rather than fail.",
      },
    ],
    keyPoints: [
      "Token bucket allows configurable bursts around a sustained rate and is the default choice; leaky bucket smooths output to a constant rate at the cost of queueing delay.",
      "Fixed windows permit up to 2x bursts at boundaries; sliding window counters (current + weighted previous window) fix this cheaply and are what Cloudflare uses.",
      "Distributed limiting needs atomic shared state, typically Redis with Lua scripts; decide fail-open vs fail-closed when the limiter itself is down.",
      "Return 429 with Retry-After and X-RateLimit-* headers; clients must back off exponentially with jitter to avoid thundering herds.",
      "Limit along multiple dimensions: per user or API key, per IP, per endpoint with weighted costs, plus a global load-shedding backstop.",
      "Rate limits are product policy as well as protection: tiers like 100 req/min free vs 10,000 paid are enforced by the same machinery.",
    ],
    tradeoffs: [
      {
        option: "Token bucket vs leaky bucket",
        pros: [
          "Token bucket serves realistic bursty traffic instantly from banked tokens",
          "Two intuitive knobs: sustained rate and burst size",
        ],
        cons: [
          "Bursts pass through to downstream systems that may not want them",
          "Leaky bucket protects fragile downstreams with smooth output but adds queueing latency and drops under sustained overload",
        ],
      },
      {
        option: "Fixed window vs sliding window",
        pros: [
          "Fixed window is one counter and one INCR, trivially cheap at any scale",
          "Sliding window counter closes the boundary loophole for the cost of two counters",
        ],
        cons: [
          "Fixed window allows double-rate bursts across boundaries",
          "Sliding window counter is an approximation; the exact log variant costs memory per request",
        ],
      },
      {
        option: "Centralized (Redis) vs local per-node limiting",
        pros: [
          "Centralized gives exact global limits regardless of how the LB spreads a client",
          "Local limiting adds zero network latency and keeps working when Redis is down",
        ],
        cons: [
          "Centralized adds about a millisecond per request and a critical dependency",
          "Local limits are inaccurate under uneven load balancing and drift with instance count",
        ],
      },
    ],
    interviewTips: [
      "Recommend token bucket by default and state both parameters with numbers, for example 10 req/s sustained with a burst of 100.",
      "Always address the distributed case: a per-instance limiter behind a load balancer silently multiplies the limit by the instance count.",
      "Mention the boundary-burst flaw of fixed windows before the interviewer does, then offer sliding window counter as the cheap fix.",
      "Cover the client side, 429, Retry-After, exponential backoff with jitter, and say explicitly whether your limiter fails open or closed.",
    ],
    related: ["api-design", "load-balancing", "proxies", "fault-tolerance"],
  },
  {
    slug: "realtime-communication",
    title: "Real-Time Communication",
    category: "Networking",
    summary:
      "Real-time features, chat, notifications, live dashboards, collaborative editing, need the server to get data to clients as it happens. The main techniques are short polling, long polling, Server-Sent Events, WebSockets, and WebRTC, each with distinct cost and capability profiles.",
    sections: [
      {
        heading: "Short and Long Polling",
        body:
          "Short polling is the naive baseline: the client requests updates on a timer, GET /messages?since=... every 3 seconds. It works through every proxy and firewall on earth and needs zero special infrastructure, but the tradeoff is stark: average latency is half the polling interval, and almost all requests return empty. A million clients polling every 5 seconds is 200,000 requests per second of mostly nothing. It remains reasonable for slow-changing data, a dashboard refreshing every 30-60 seconds, or as a dead-simple fallback.\n\nLong polling improves on this by parking the request: the server holds the connection open until data arrives or a timeout (commonly 30-60 seconds) fires, responds, and the client immediately re-requests. Latency drops to near-instant and empty responses mostly disappear, at the cost of the server holding one open request per client, which demands an event-driven server rather than a thread-per-request model. Long polling was the backbone of pre-WebSocket web chat and survives today as a fallback and in polling-based queue APIs, AWS SQS ReceiveMessage with WaitTimeSeconds=20 is exactly long polling.\n\nSubtleties worth naming: requests must carry a cursor or last-event ID so nothing is missed in the gap between responses, and intermediaries with shorter idle timeouts than yours (load balancer idle timeout, commonly 60 seconds default on AWS ALB) will sever held connections, so the server timeout must be set below them.",
      },
      {
        heading: "Server-Sent Events",
        body:
          "SSE is a one-directional stream from server to client over a single long-lived HTTP response with content type text/event-stream. The browser's built-in EventSource API handles it natively, including two things you get for free that WebSockets make you build: automatic reconnection, and resume via the Last-Event-ID header, the client reconnects and tells the server the last event it saw, so the server can replay the gap.\n\nBecause SSE is plain HTTP, it traverses proxies, corporate middleboxes, and L7 load balancers without special protocol handling, and works with standard HTTP auth and observability tooling. Over HTTP/1.1, browsers cap connections per origin at about 6, which SSE can exhaust, but over HTTP/2 streams multiplex on one connection and the problem disappears. The constraint is fundamental, though: server-to-client only; any client-to-server communication rides ordinary separate requests. It is also text-oriented (binary must be encoded).\n\nSSE is the right tool when the data flows one way: notification feeds, live scores and tickers, progress updates, and notably LLM token streaming, the OpenAI and Anthropic APIs stream completions as SSE. A useful interview line: if clients mostly listen, SSE plus normal POSTs for the occasional upstream message is simpler and more robust than a WebSocket.",
      },
      {
        heading: "WebSockets",
        body:
          "WebSockets provide a persistent, full-duplex, bidirectional channel. The client sends an HTTP request with Upgrade: websocket; after the 101 response, the TCP connection stops being HTTP and both sides exchange lightweight frames (text or binary) with 2-14 bytes of overhead, no per-message headers, at any time in either direction. This is the tool for genuinely interactive systems: chat (Slack), collaborative editing (Figma, Google Docs), multiplayer games, and live trading interfaces.\n\nThe engineering cost is state. Each connection holds server memory (tens of KB), and a server handles on the order of tens of thousands to hundreds of thousands of connections depending on message rates, so a million concurrent users means a fleet of connection servers and, critically, a routing problem: when user A messages user B, B's socket lives on some other server, so you need a pub/sub backplane, Redis pub/sub or Kafka, that connection servers subscribe to, plus a registry or topic scheme mapping users to servers. Load balancers must support the upgrade and have long idle timeouts, connections must be rebalanced gracefully during deploys, and both sides need heartbeats (ping/pong frames) to detect half-dead connections that TCP alone will not surface for minutes.\n\nClients must implement reconnection with backoff and message resync themselves, there is no built-in Last-Event-ID equivalent, which is why production systems layer a protocol on top (sequence numbers, acks, replay on reconnect) or use frameworks like Socket.IO that bundle heartbeats, rooms, and long-polling fallback. Managed options, AWS API Gateway WebSockets, Ably, Pusher, exist precisely because stateful connection fleets are operationally expensive.",
      },
      {
        heading: "WebRTC and Choosing Among Them",
        body:
          "WebRTC is the odd one out: peer-to-peer, UDP-based, and designed for media. It gives browsers direct low-latency channels for audio, video, and arbitrary data (DataChannel) without relaying through your servers, which is how Google Meet, Discord voice, and browser file-transfer tools work. The catch is connection establishment: peers behind NATs cannot simply dial each other, so WebRTC needs a signaling channel (usually a WebSocket to your server) to exchange session descriptions, STUN servers to discover public addresses, and TURN relay servers as a fallback when NAT traversal fails, roughly 10-20 percent of connections end up relayed through TURN, which costs you bandwidth. For multi-party calls beyond a handful of peers, full mesh explodes quadratically, so real products use an SFU (selective forwarding unit) that receives each stream once and forwards it to others.\n\nUse WebRTC when you need media or sub-100 ms peer latency; it is overkill for ordinary app real-time features, where its complexity buys nothing over a WebSocket through your backend.\n\nThe decision framework to recite: how fresh must data be, which directions does it flow, and at what scale? Updates every 30+ seconds: short polling. Server-push only: SSE, with its free reconnection and HTTP-friendliness. True bidirectional interaction: WebSockets, and budget for the stateful fleet and pub/sub backplane. Media or P2P: WebRTC with signaling, STUN/TURN, and an SFU. And regardless of primary choice, production systems keep a fallback path (Socket.IO's polling downgrade, or SSE falling back to polling) because some corporate networks still mangle upgraded or long-lived connections.",
      },
    ],
    keyPoints: [
      "Short polling: simplest, works everywhere, latency is half the interval and most requests are empty; fine for 30s+ freshness.",
      "Long polling: server holds the request until data or timeout; near-instant latency, but one open request per client and careful timeout alignment with load balancers (SQS WaitTimeSeconds is this pattern).",
      "SSE: one-way server push over plain HTTP with free auto-reconnect and Last-Event-ID resume; ideal for feeds, tickers, and LLM token streaming.",
      "WebSockets: full-duplex persistent connections for chat, collaboration, and games; requires a stateful connection fleet, pub/sub backplane, heartbeats, and reconnect logic.",
      "WebRTC: P2P UDP for media and sub-100 ms latency; needs signaling, STUN/TURN (10-20 percent of sessions relay through TURN), and an SFU for group calls.",
      "Ask three questions to choose: required freshness, direction of data flow, and connection scale; always keep a fallback transport.",
    ],
    tradeoffs: [
      {
        option: "Long polling vs WebSockets",
        pros: [
          "Long polling is plain HTTP: stateless-ish servers, standard LBs, easy auth, easy fallback",
          "Near-real-time latency without a persistent-connection fleet",
        ],
        cons: [
          "Reconnect-per-event overhead makes high message rates inefficient",
          "WebSockets are far cheaper per message but demand connection state, sticky routing, and a pub/sub backplane",
        ],
      },
      {
        option: "SSE vs WebSockets",
        pros: [
          "SSE gives auto-reconnect with event replay (Last-Event-ID) out of the box and traverses HTTP infrastructure cleanly",
          "Simpler server model; works with HTTP/2 multiplexing",
        ],
        cons: [
          "One-directional only; client-to-server messages need separate requests",
          "Text-oriented; binary and truly interactive use cases need WebSockets",
        ],
      },
      {
        option: "WebRTC P2P vs server-relayed delivery",
        pros: [
          "Lowest possible latency and zero media bandwidth through your servers when P2P succeeds",
          "Native browser support for audio, video, and data channels",
        ],
        cons: [
          "NAT traversal complexity: signaling plus STUN/TURN, with TURN relay costs for 10-20 percent of sessions",
          "Group scale requires SFU infrastructure; unnecessary complexity for non-media features",
        ],
      },
    ],
    interviewTips: [
      "Do not reflexively say WebSockets; walking through polling, SSE, and WebSockets and picking by direction, freshness, and scale is the senior move.",
      "If you choose WebSockets, immediately address the hard part: connection state, routing messages across servers via Redis or Kafka pub/sub, heartbeats, and reconnection.",
      "Estimate connection load: for example 10M concurrent users at 100k connections per server is a 100-server stateful fleet before redundancy.",
      "Name SSE for one-way streams and cite LLM APIs or notification feeds; distinguishing SSE from WebSockets correctly is a common differentiator.",
    ],
    related: ["load-balancing", "message-queues", "api-design", "event-driven-architecture"],
  },
  {
    slug: "performance-metrics",
    title: "Performance Metrics",
    category: "Fundamentals",
    summary:
      "Latency, throughput, percentiles, and availability targets are the vocabulary for every quantitative claim in a system design interview, and back-of-envelope math with these numbers separates hand-waving from engineering.",
    sections: [
      {
        heading: "Latency vs Throughput",
        body:
          "Latency is how long one operation takes, measured in milliseconds; throughput is how many operations complete per unit time, measured in requests per second or MB/s. They are related but not interchangeable, and the classic illustration is a truck full of hard drives driving across the country: enormous throughput, terrible latency. AWS Snowball is literally this, petabyte-scale transfer with days of latency.\n\nOptimizing one can hurt the other. Batching improves throughput (amortize per-request overhead across 100 items) while raising the latency of the first item in the batch; Kafka producers exploit exactly this with linger.ms. Conversely, minimizing latency (send each item immediately) sacrifices throughput. Pipelining, parallelism, and asynchrony raise throughput without improving, and sometimes while worsening, single-request latency.\n\nThe third variable is concurrency, tied together by Little's Law: concurrency = throughput x latency. A service handling 1,000 RPS at 50 ms average latency has 50 requests in flight, sized comfortably by a small connection pool; the same throughput at 2 s latency means 2,000 in flight and exhausted thread pools. This is also why latency degrades under load: as utilization approaches saturation, queueing theory takes over and wait times grow non-linearly, latency at 90 percent utilization is dramatically worse than at 70 percent, which is why services are capacity-planned to run around 50-70 percent.",
      },
      {
        heading: "Percentiles: p50, p95, p99",
        body:
          "Averages lie about latency because latency distributions are heavily right-skewed: many fast requests and a long tail of slow ones. A service can average 40 ms while 1 percent of requests take 2 seconds; the mean hides the 2-second experiences entirely. Percentiles expose the distribution: p50 (median) is the typical experience, p95 and p99 characterize the tail, and p99.9 matters at large scale. SLOs are therefore written against percentiles, for example p99 latency under 300 ms, never against means.\n\nThe tail matters more than its percentage suggests. First, heavy users make many requests: a user issuing 100 requests in a session has a 63 percent chance of hitting at least one p99-tail request. Second, tail amplification through fan-out: if one page load calls 100 backend services and each has a 1 percent chance of being slow, the page is slow 63 percent of the time, the page's latency is governed by the slowest of its fan-out calls. This is the central argument of Google's Tail at Scale paper, and the mitigations are worth knowing: hedged requests (send a duplicate to a second replica after the first exceeds the p95 mark and take whichever answers first), tight timeouts with retries against different replicas, and cutting fan-out.\n\nTwo practical notes: percentiles cannot be averaged across hosts or windows, aggregating requires histograms (the reason Prometheus uses histogram buckets), and always state which percentile you mean; p50 of 20 ms with p99 of 800 ms and p50 of 60 ms with p99 of 90 ms are very different services, and the second is often the better one.",
      },
      {
        heading: "Availability and the Nines",
        body:
          "Availability is the fraction of time (or of requests) a service works, expressed in nines. The downtime math to memorize per year: 99 percent (two nines) is 3.65 days; 99.9 percent is 8.76 hours; 99.99 percent is 52.6 minutes; 99.999 percent (five nines) is 5.26 minutes. Per 30-day month, 99.9 is about 43 minutes and 99.99 about 4.3 minutes, tighter than most teams' incident response time, which is the honest reason few services truly deliver four nines: at that level, recovery must be automatic because a human cannot even be paged and oriented in 4 minutes.\n\nComposition rules drive architecture. Serial dependencies multiply: a request touching five 99.9 percent services is at best 99.5 percent available, dependencies drag you down. Redundant parallel paths multiply failure probabilities instead: two independent 99 percent instances where either suffices give 99.99 percent. This one calculation is the mathematical core of why we deploy replicas, multi-AZ databases, and multi-region failover, and also why reducing hard dependencies (graceful degradation, serving cached data when a dependency is down) directly buys availability.\n\nEach additional nine costs disproportionately more, roughly an order of magnitude in engineering and infrastructure, so the right target is a product decision: an internal batch tool is fine at 99.5, a payments API is not. Also distinguish availability from durability: S3 offers 99.99 percent availability but eleven nines of durability, meaning it may occasionally be unreachable but essentially never loses your data.",
      },
      {
        heading: "SLA, SLO, and SLI",
        body:
          "The three terms form a hierarchy. An SLI (indicator) is the measurement itself: the fraction of requests returning success in under 300 ms, measured at the load balancer. An SLO (objective) is the internal target on that indicator: 99.9 percent of requests succeed within 300 ms over a rolling 30 days. An SLA (agreement) is the external contract with customers, with financial penalties: AWS EC2 credits 10 percent of the bill below 99.99 percent monthly uptime and 30 percent below 99.0. SLAs are deliberately looser than SLOs, you want to breach your internal target well before you owe customers money.\n\nThe operationally powerful concept is the error budget, popularized by Google SRE: a 99.9 percent SLO means 0.1 percent of requests may fail, about 43 minutes per month. That budget is spent on incidents, risky deploys, and experiments; while budget remains, teams ship fast, and when it is exhausted, feature work yields to reliability work. This converts the eternal velocity-versus-stability argument into a number both sides accept, and it explicitly rejects chasing 100 percent, which is unattainable and wastes the last increment of effort on diminishing returns.\n\nGood SLIs measure user experience, not machine vitals: success rate and latency percentiles at the edge, not CPU utilization. Define them precisely (measured where, over what window, excluding what) because every ambiguity becomes an argument during an incident review.",
      },
      {
        heading: "Back-of-Envelope Numbers",
        body:
          "Interviewers expect fluency with the latency ladder, descended from Jeff Dean's numbers every engineer should know: L1 cache about 1 ns; main memory reference about 100 ns; reading 1 MB sequentially from RAM about 10 microseconds; SSD random read about 100 microseconds; reading 1 MB from SSD about 1 ms; disk seek about 10 ms; same-datacenter round trip about 0.5 ms; same-region cloud RTT 1-2 ms; cross-continent (US East to Europe) about 80 ms; US to Asia 150-250 ms. The takeaways encoded in the ladder: memory is about 1,000x faster than SSD, SSD about 100x faster than disk for random access, an in-region network hop is cheaper than an SSD read, and crossing an ocean costs more than almost anything your code does.\n\nCapacity math starts with time constants: a day is 86,400 seconds, call it 10^5 for estimation. Ten million DAU making 10 requests each is 10^8 requests per day, about 1,200 RPS average, and peak is typically 2-5x average, say 5,000 RPS. Storage: 10^8 tweets per day at 500 bytes is 50 GB per day of text, about 18 TB per year, trivially small, but if 10 percent attach a 1 MB image, that is 10 TB per day, and suddenly the design is about blob storage and CDNs, not the database. Ballpark single-node throughputs for sanity checks: a tuned Postgres does thousands to low tens of thousands of transactions per second, Redis about 100k ops per second per node, Kafka hundreds of MB per second per broker, a stateless app server 1,000-10,000 RPS.\n\nThe purpose is decision-making, not precision: round aggressively to powers of ten, state assumptions out loud, and use the result to pick an architecture, 1,200 RPS average means a modest service where a single primary database with replicas is plausible; 500k RPS means sharding, heavy caching, and CDN offload are mandatory. An answer within 3x that drives the right design beats a precise answer that drives nothing.",
      },
    ],
    keyPoints: [
      "Latency is per-operation time, throughput is operations per second; batching trades latency for throughput, and Little's Law (concurrency = throughput x latency) links them.",
      "Latency explodes non-linearly as utilization nears saturation, so plan capacity around 50-70 percent utilization.",
      "Report percentiles, never averages: p50 is typical, p99 is the tail; fan-out amplifies the tail (100 calls at 1 percent slow makes 63 percent of pages slow) and hedged requests mitigate it.",
      "Nines to downtime per year: 99.9 is 8.8 hours, 99.99 is 53 minutes, 99.999 is 5.3 minutes; serial dependencies multiply availability down, redundancy multiplies failure probability down.",
      "SLI is the measurement, SLO the internal target, SLA the external contract with penalties; the error budget (0.1 percent for a 99.9 SLO) arbitrates velocity vs reliability.",
      "Memorize the latency ladder and standard throughput ballparks (Postgres ~10k TPS, Redis ~100k ops/s, app server ~1-10k RPS) and round to powers of ten when estimating.",
    ],
    tradeoffs: [
      {
        option: "Optimizing for latency vs throughput",
        pros: [
          "Low latency improves user-perceived quality and enables tight SLOs",
          "High throughput via batching and pipelining minimizes cost per request",
        ],
        cons: [
          "Batching and queueing add latency; per-request immediacy wastes capacity",
          "Pushing utilization high for throughput degrades tail latency sharply",
        ],
      },
      {
        option: "Chasing more nines",
        pros: [
          "Higher availability directly protects revenue and trust for critical paths like payments",
          "Forces good engineering: redundancy, automated failover, reduced hard dependencies",
        ],
        cons: [
          "Each nine costs roughly 10x more effort; beyond four nines requires fully automated recovery",
          "Error budgets shrink toward zero, throttling release velocity and experimentation",
        ],
      },
      {
        option: "Percentile SLOs vs average-based targets",
        pros: [
          "Percentiles capture the tail experience that averages mathematically hide",
          "Align engineering effort with worst affected users and fan-out behavior",
        ],
        cons: [
          "Require histogram-based aggregation; naive averaging of percentiles across hosts is wrong",
          "High percentiles are noisy at low traffic, making alerting on them tricky",
        ],
      },
    ],
    interviewTips: [
      "Open every design with two minutes of estimation: users, RPS average and peak, storage per day, read:write ratio, and let those numbers pick the architecture.",
      "Say per year, 99.9 percent is about 9 hours down and 99.99 is under an hour when the interviewer asks about availability targets, then discuss whether the product needs the next nine.",
      "Use the latency ladder to justify choices: cache in Redis at 100k ops/s and sub-millisecond instead of 10 ms disk-bound queries, or place a CDN because cross-ocean RTT is 150 ms.",
      "Frame reliability targets as SLOs with error budgets rather than promising 100 percent; explicitly rejecting 100 percent uptime as a goal is a senior signal.",
    ],
    related: ["scalability", "observability", "fault-tolerance", "caching"],
  },
];
