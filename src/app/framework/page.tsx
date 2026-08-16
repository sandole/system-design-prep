import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Interview Framework",
  description:
    "A battle-tested 4-step framework for the 45-minute system design interview, with timing, scripts, and common mistakes to avoid.",
};

const steps = [
  {
    title: "Understand the problem & scope it",
    time: "5–10 min",
    color: "border-sky-500/40 bg-sky-500/5",
    accent: "text-sky-400",
    points: [
      "Ask clarifying questions before designing anything. Who are the users? What are the top 3 features? Mobile, web, or both?",
      "Split requirements into functional (what it does) and non-functional (scale, latency, availability, consistency).",
      "Explicitly cut scope: \"I'll focus on posting and the feed; I'll skip ads and DMs unless you want them.\"",
      "Get numbers: DAU, read:write ratio, data size, growth. If the interviewer won't give them, propose reasonable ones.",
    ],
    script:
      "\"Before I design, let me make sure I understand the problem. Are we optimizing for read-heavy traffic? What scale are we targeting - millions or billions of users?\"",
  },
  {
    title: "Back-of-envelope estimation",
    time: "3–5 min",
    color: "border-emerald-500/40 bg-emerald-500/5",
    accent: "text-emerald-400",
    points: [
      "Compute QPS (average and peak), storage per year, and bandwidth. Round aggressively - 86,400 seconds/day ≈ 100K.",
      "Use the results to justify decisions: 20K QPS means a single Postgres box won't cut it; 500 TB/year points at object storage.",
      "Estimate cache size with the 80/20 rule: 20% of objects generate 80% of reads.",
      "Don't over-invest here. Get the order of magnitude and move on.",
    ],
    script:
      "\"10M DAU x 10 reads/day is 100M reads/day, roughly 1,200 QPS average, call it 2,500 at peak. That's comfortably within a cached read path but too hot for a single unindexed table.\"",
  },
  {
    title: "High-level design",
    time: "10–15 min",
    color: "border-amber-500/40 bg-amber-500/5",
    accent: "text-amber-400",
    points: [
      "Draw the boxes: client → DNS/CDN → load balancer → stateless app servers → cache → database → async workers/queues.",
      "Define the core APIs first (3-5 endpoints) - they anchor the whole diagram.",
      "Sketch the data model: main entities, keys, and which store they live in (SQL vs NoSQL vs blob).",
      "Walk through the two critical flows end to end: the main write path and the main read path.",
      "Keep it simple at this stage. Buy-in on the skeleton before adding muscle.",
    ],
    script:
      "\"Here's my starting skeleton. Writes go through the API to the primary DB and fan out async via a queue; reads hit cache first. Shall I deep-dive into the fan-out service or the storage layer?\"",
  },
  {
    title: "Deep dives & wrap-up",
    time: "10–15 min",
    color: "border-rose-500/40 bg-rose-500/5",
    accent: "text-rose-400",
    points: [
      "Let the interviewer steer, but proactively attack your own bottlenecks: hot partitions, thundering herds, single points of failure.",
      "For each problem, present 2 options with tradeoffs, then commit to one with a reason. That's the senior signal.",
      "Cover the reliability story: replication, failover, monitoring, and how the system degrades under partial failure.",
      "Close with a summary: what you built, its known limits, and what you'd do next with more time.",
    ],
    script:
      "\"The celebrity problem breaks pure fan-out-on-write. I'd go hybrid: precompute feeds for normal users, but pull celebrity posts at read time and merge. It costs read latency but caps write amplification.\"",
  },
];

const donts = [
  "Jumping straight into the architecture without clarifying requirements",
  "Designing for 1B users when the interviewer said 100K - or ignoring scale entirely",
  "Naming technologies (\"I'd use Kafka\") without saying why or what tradeoff you're accepting",
  "Staying silent while thinking - narrate your reasoning",
  "Treating the interviewer as an examiner instead of a collaborator - check in after each phase",
  "Over-engineering: microservices, multi-region, and exactly-once semantics for an MVP question",
];

const dos = [
  "Drive the interview - you own the whiteboard and the agenda",
  "State assumptions out loud and write them down",
  "Quantify everything: QPS, storage, latency budgets",
  "Present tradeoffs in pairs, then decide - never present a choice without making it",
  "Tie every component back to a requirement",
  "Leave 2-3 minutes to summarize and list future improvements",
];

export default function FrameworkPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold text-white">
        The 45-Minute Interview Framework
      </h1>
      <p className="mt-2 mb-10 text-slate-400">
        System design interviews are open-ended by design. Structure is what
        keeps you from rambling - this four-step arc works for any question,
        from URL shortener to global payment system.
      </p>

      <div className="space-y-6">
        {steps.map((s, i) => (
          <section key={s.title} className={`rounded-xl border p-6 ${s.color}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-3 text-lg font-semibold text-white">
                <span className={`font-mono text-2xl font-bold ${s.accent}`}>
                  {i + 1}
                </span>
                {s.title}
              </h2>
              <span className={`shrink-0 font-mono text-sm ${s.accent}`}>
                {s.time}
              </span>
            </div>
            <ul className="mb-4 space-y-2">
              {s.points.map((p) => (
                <li key={p} className="flex gap-2 text-sm leading-relaxed text-slate-300">
                  <span className={s.accent}>▸</span>
                  {p}
                </li>
              ))}
            </ul>
            <p className="rounded-lg bg-slate-900/60 p-4 text-sm italic leading-relaxed text-slate-400">
              {s.script}
            </p>
          </section>
        ))}
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
          <h2 className="mb-3 text-lg font-semibold text-emerald-300">Do</h2>
          <ul className="space-y-2 text-sm text-slate-300">
            {dos.map((d) => (
              <li key={d}>✓ {d}</li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-6">
          <h2 className="mb-3 text-lg font-semibold text-rose-300">
            Don&apos;t
          </h2>
          <ul className="space-y-2 text-sm text-slate-300">
            {donts.map((d) => (
              <li key={d}>✗ {d}</li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-10 rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-center">
        <p className="text-slate-300">
          Ready to apply it? Practice against the{" "}
          <Link href="/case-studies" className="text-indigo-400 hover:text-indigo-300">
            case studies
          </Link>{" "}
          or warm up your estimation with the{" "}
          <Link href="/calculator" className="text-indigo-400 hover:text-indigo-300">
            calculator
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
