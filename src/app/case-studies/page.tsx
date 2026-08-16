import type { Metadata } from "next";
import Link from "next/link";
import { allCaseStudies } from "@/lib/content";
import Badge from "@/components/Badge";

export const metadata: Metadata = {
  title: "Case Studies",
  description:
    "Classic system design interview questions solved end to end: URL shortener, news feed, chat system, video streaming, payment system, and more.",
};

const order = ["Easy", "Medium", "Hard"] as const;

export default function CaseStudiesPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white">Case Studies</h1>
      <p className="mt-2 mb-8 max-w-2xl text-slate-400">
        The questions that actually get asked, each worked through the full
        interview arc: requirements → estimation → API → high-level design →
        deep dives → rapid MVP implementation with real code → bottlenecks.
      </p>
      {order.map((difficulty) => {
        const group = allCaseStudies.filter((c) => c.difficulty === difficulty);
        if (group.length === 0) return null;
        return (
          <section key={difficulty} className="mb-10">
            <div className="mb-4 flex items-center gap-3">
              <Badge label={difficulty} />
              <span className="text-sm text-slate-500">
                {group.length} {group.length === 1 ? "study" : "studies"}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.map((c) => (
                <Link
                  key={c.slug}
                  href={`/case-studies/${c.slug}`}
                  className="group rounded-xl border border-slate-800 bg-slate-900/40 p-5 transition-colors hover:border-indigo-500/50 hover:bg-slate-900"
                >
                  <h2 className="mb-2 font-medium text-white group-hover:text-indigo-400">
                    {c.title}
                  </h2>
                  <p className="line-clamp-3 text-sm text-slate-400">
                    {c.summary}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
