# System Design Prep

Everything you need to ace the system design interview, in one fully static Next.js app.

## Features

- **25 core topic deep dives** - scalability, load balancing, caching, sharding, replication, consistency & CAP, consistent hashing, message queues, event-driven architecture, distributed transactions, fault tolerance, observability, security, probabilistic data structures, and more
- **12 classic case studies** worked end to end (requirements → estimation → API → high-level design → data model → deep dives → bottlenecks): URL shortener, rate limiter, news feed, chat, video streaming, web crawler, typeahead, notifications, ride sharing, key-value store, cloud storage, payment system
- **Back-of-envelope calculator** - DAU and usage assumptions in, QPS / storage / bandwidth / cache-size estimates out
- **50 flashcards** with category filtering, shuffle, and known/review tracking
- **45-minute interview framework** - a four-step arc with timing, scripts, dos and don'ts
- **Glossary (70+ terms) & latency numbers** every engineer should know

## Performance architecture

The app practices what it preaches (inspired by ["50 Million HTTP Requests/Month ($15 Budget)"](https://www.youtube.com/watch?v=wL3maSWEoh8)):

- **100% static generation** - every route, including all dynamic `[slug]` pages, is prerendered at build time via `generateStaticParams` with `dynamicParams = false`. Zero server compute per request; every page is CDN-cacheable at the edge.
- **RSC-first, minimal client JS** - only the genuinely interactive pieces (calculator, flashcards, search filter, mobile nav) are client components. Topic and case-study content never ships as JavaScript.
- **Slim client payloads** - the topic explorer receives a projection (slug/title/category/summary) instead of full topic objects.
- **Self-hosted fonts** via `next/font` (zero layout shift, no third-party requests), static `sitemap.xml` and `robots.txt`.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS 4

## Development

```bash
npm install
npm run dev
```

## Deployment

Deployed on Vercel. Because every route is static, it serves entirely from the edge network - effectively free at almost any traffic level.
