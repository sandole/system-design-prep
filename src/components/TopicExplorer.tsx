"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Badge from "./Badge";

export interface TopicSummary {
  slug: string;
  title: string;
  category: string;
  summary: string;
}

const categories = [
  "All",
  "Fundamentals",
  "Networking",
  "Data",
  "Architecture",
  "Reliability",
];

export default function TopicExplorer({ topics }: { topics: TopicSummary[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return topics.filter(
      (t) =>
        (category === "All" || t.category === category) &&
        (q === "" ||
          t.title.toLowerCase().includes(q) ||
          t.summary.toLowerCase().includes(q)),
    );
  }, [topics, query, category]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search topics…"
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500 sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                category === c
                  ? "bg-indigo-500 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t) => (
          <Link
            key={t.slug}
            href={`/topics/${t.slug}`}
            className="group rounded-xl border border-slate-800 bg-slate-900/40 p-5 transition-colors hover:border-indigo-500/50 hover:bg-slate-900"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <h2 className="font-medium text-white group-hover:text-indigo-400">
                {t.title}
              </h2>
              <Badge label={t.category} />
            </div>
            <p className="line-clamp-3 text-sm text-slate-400">{t.summary}</p>
          </Link>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="py-12 text-center text-slate-500">
          No topics match your search.
        </p>
      )}
    </div>
  );
}
