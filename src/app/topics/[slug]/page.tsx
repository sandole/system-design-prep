import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { allTopics, getTopic } from "@/lib/content";
import Badge from "@/components/Badge";
import Paragraphs from "@/components/Paragraphs";

export function generateStaticParams() {
  return allTopics.map((t) => ({ slug: t.slug }));
}

export const dynamicParams = false;

export async function generateMetadata(
  props: PageProps<"/topics/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const topic = getTopic(slug);
  if (!topic) return {};
  return { title: topic.title, description: topic.summary };
}

export default async function TopicPage(props: PageProps<"/topics/[slug]">) {
  const { slug } = await props.params;
  const topic = getTopic(slug);
  if (!topic) notFound();

  const related = topic.related
    .map((r) => getTopic(r))
    .filter((t) => t !== undefined);

  return (
    <article className="mx-auto max-w-3xl">
      <div className="mb-2">
        <Badge label={topic.category} />
      </div>
      <h1 className="text-3xl font-bold text-white">{topic.title}</h1>
      <p className="mt-3 mb-10 text-lg text-slate-400">{topic.summary}</p>

      {topic.sections.map((s) => (
        <section key={s.heading} className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-white">{s.heading}</h2>
          <Paragraphs text={s.body} />
        </section>
      ))}

      <section className="mb-8 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-6">
        <h2 className="mb-3 text-lg font-semibold text-indigo-300">
          Key points
        </h2>
        <ul className="space-y-2">
          {topic.keyPoints.map((p) => (
            <li key={p} className="flex gap-2 text-slate-300">
              <span className="text-indigo-400">▸</span>
              {p}
            </li>
          ))}
        </ul>
      </section>

      {topic.tradeoffs.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-white">Tradeoffs</h2>
          <div className="space-y-4">
            {topic.tradeoffs.map((t) => (
              <div
                key={t.option}
                className="rounded-xl border border-slate-800 bg-slate-900/40 p-5"
              >
                <h3 className="mb-3 font-medium text-white">{t.option}</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-400">
                      Pros
                    </p>
                    <ul className="space-y-1 text-sm text-slate-300">
                      {t.pros.map((p) => (
                        <li key={p}>+ {p}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-400">
                      Cons
                    </p>
                    <ul className="space-y-1 text-sm text-slate-300">
                      {t.cons.map((c) => (
                        <li key={c}>− {c}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
        <h2 className="mb-3 text-lg font-semibold text-amber-300">
          In the interview
        </h2>
        <ul className="space-y-2">
          {topic.interviewTips.map((tip) => (
            <li key={tip} className="flex gap-2 text-slate-300">
              <span className="text-amber-400">★</span>
              {tip}
            </li>
          ))}
        </ul>
      </section>

      {related.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">
            Related topics
          </h2>
          <div className="flex flex-wrap gap-2">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/topics/${r.slug}`}
                className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300 transition-colors hover:border-indigo-500 hover:text-indigo-400"
              >
                {r.title}
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
