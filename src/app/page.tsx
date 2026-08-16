import Link from "next/link";
import { allCaseStudies, allTopics } from "@/lib/content";
import { flashcards } from "@/lib/flashcards";
import { glossary } from "@/lib/glossary";
import Badge from "@/components/Badge";

const features = [
  {
    href: "/topics",
    title: "Core Topics",
    description:
      "Deep dives into every building block: load balancing, caching, sharding, consistency, queues, and more.",
  },
  {
    href: "/case-studies",
    title: "Case Studies",
    description:
      "Classic interview questions solved end to end - requirements, estimation, APIs, deep dives, and a rapid MVP build with real code.",
  },
  {
    href: "/framework",
    title: "Interview Framework",
    description:
      "A battle-tested 4-step framework with a minute-by-minute plan for a 45-minute interview.",
  },
  {
    href: "/calculator",
    title: "Back-of-Envelope Calculator",
    description:
      "Turn DAU and usage assumptions into QPS, storage, bandwidth, and cache estimates instantly.",
  },
  {
    href: "/flashcards",
    title: "Flashcards",
    description:
      "Rapid-fire Q&A across all categories to pressure-test your recall before the interview.",
  },
  {
    href: "/glossary",
    title: "Glossary & Latency Numbers",
    description:
      "Every term you might get asked, plus the latency numbers every engineer should know.",
  },
];

export default function Home() {
  const stats = [
    { value: allTopics.length, label: "core topics" },
    { value: allCaseStudies.length, label: "case studies" },
    { value: flashcards.length, label: "flashcards" },
    { value: glossary.length, label: "glossary terms" },
  ];

  return (
    <div>
      <section className="py-12 text-center">
        <p className="mb-4 font-mono text-sm text-indigo-400">
          statically generated · served from the edge · zero servers to melt
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Everything you need to ace the{" "}
          <span className="text-indigo-400">system design interview</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-400">
          Concept deep dives, fully worked case studies, estimation tools, and
          drills - in one place, with the tradeoff-driven thinking interviewers
          actually look for.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/framework"
            className="rounded-lg bg-indigo-500 px-5 py-2.5 font-medium text-white transition-colors hover:bg-indigo-400"
          >
            Start with the framework
          </Link>
          <Link
            href="/topics"
            className="rounded-lg border border-slate-700 px-5 py-2.5 font-medium text-slate-200 transition-colors hover:bg-slate-800"
          >
            Browse topics
          </Link>
        </div>
        <dl className="mx-auto mt-10 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <dd className="text-2xl font-bold text-white">{s.value}</dd>
              <dt className="text-sm text-slate-500">{s.label}</dt>
            </div>
          ))}
        </dl>
      </section>

      <section className="py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className="group rounded-xl border border-slate-800 bg-slate-900/40 p-6 transition-colors hover:border-indigo-500/50 hover:bg-slate-900"
            >
              <h2 className="font-semibold text-white group-hover:text-indigo-400">
                {f.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {f.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="py-10">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-xl font-semibold text-white">
            Popular case studies
          </h2>
          <Link href="/case-studies" className="text-sm text-indigo-400 hover:text-indigo-300">
            View all →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allCaseStudies.slice(0, 6).map((c) => (
            <Link
              key={c.slug}
              href={`/case-studies/${c.slug}`}
              className="group rounded-xl border border-slate-800 bg-slate-900/40 p-5 transition-colors hover:border-indigo-500/50 hover:bg-slate-900"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="font-medium text-white group-hover:text-indigo-400">
                  {c.title}
                </h3>
                <Badge label={c.difficulty} />
              </div>
              <p className="line-clamp-3 text-sm text-slate-400">{c.summary}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
