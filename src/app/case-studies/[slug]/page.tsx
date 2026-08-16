import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { allCaseStudies, getCaseStudy, getTopic } from "@/lib/content";
import Badge from "@/components/Badge";
import Paragraphs from "@/components/Paragraphs";

export function generateStaticParams() {
  return allCaseStudies.map((c) => ({ slug: c.slug }));
}

export const dynamicParams = false;

export async function generateMetadata(
  props: PageProps<"/case-studies/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const study = getCaseStudy(slug);
  if (!study) return {};
  return { title: study.title, description: study.summary };
}

function SectionHeading({ step, title }: { step: number; title: string }) {
  return (
    <h2 className="mb-4 flex items-center gap-3 text-xl font-semibold text-white">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 font-mono text-sm text-indigo-400">
        {step}
      </span>
      {title}
    </h2>
  );
}

export default async function CaseStudyPage(
  props: PageProps<"/case-studies/[slug]">,
) {
  const { slug } = await props.params;
  const study = getCaseStudy(slug);
  if (!study) notFound();

  const related = study.relatedTopics
    .map((r) => getTopic(r))
    .filter((t) => t !== undefined);

  return (
    <article className="mx-auto max-w-3xl">
      <div className="mb-2">
        <Badge label={study.difficulty} />
      </div>
      <h1 className="text-3xl font-bold text-white">{study.title}</h1>
      <p className="mt-3 mb-10 text-lg text-slate-400">{study.summary}</p>

      <section className="mb-10">
        <SectionHeading step={1} title="Requirements" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-400">
              Functional
            </h3>
            <ul className="space-y-2 text-sm text-slate-300">
              {study.functionalRequirements.map((r) => (
                <li key={r}>• {r}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-sky-400">
              Non-functional
            </h3>
            <ul className="space-y-2 text-sm text-slate-300">
              {study.nonFunctionalRequirements.map((r) => (
                <li key={r}>• {r}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <SectionHeading step={2} title="Back-of-envelope estimation" />
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <tbody>
              {study.backOfEnvelope.map((row, i) => (
                <tr
                  key={row.label}
                  className={i % 2 === 0 ? "bg-slate-900/60" : "bg-slate-900/20"}
                >
                  <td className="px-4 py-3 font-medium text-slate-200">
                    {row.label}
                  </td>
                  <td className="px-4 py-3 font-mono text-indigo-300">
                    {row.value}
                  </td>
                  <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">
                    {row.note}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <SectionHeading step={3} title="API design" />
        <div className="space-y-3">
          {study.apiDesign.map((api) => (
            <div
              key={api.endpoint}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
            >
              <code className="font-mono text-sm text-emerald-400">
                {api.endpoint}
              </code>
              <p className="mt-1 text-sm text-slate-400">{api.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <SectionHeading step={4} title="High-level design" />
        {study.highLevelDesign.map((p, i) => (
          <p key={i} className="mb-4 leading-relaxed text-slate-300 last:mb-0">
            {p}
          </p>
        ))}
      </section>

      <section className="mb-10">
        <SectionHeading step={5} title="Data model" />
        <div className="space-y-3">
          {study.dataModel.map((m) => (
            <div
              key={m.name}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
            >
              <h3 className="font-medium text-white">{m.name}</h3>
              <code className="mt-1 block font-mono text-xs leading-relaxed text-slate-400">
                {m.fields}
              </code>
              {m.note && (
                <p className="mt-2 text-sm text-slate-500">{m.note}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <SectionHeading step={6} title="Deep dives" />
        <div className="space-y-6">
          {study.deepDives.map((d) => (
            <div key={d.heading}>
              <h3 className="mb-2 text-lg font-medium text-white">
                {d.heading}
              </h3>
              <Paragraphs text={d.body} />
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <SectionHeading step={7} title="Rapid implementation: build the MVP" />
        <p className="mb-4 text-sm text-slate-400">
          Theory is table stakes. Here is how you would stand up a working
          version fast, on a budget, with the core algorithm in real code.
        </p>
        <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
            Stack
          </p>
          <p className="mt-1 font-mono text-sm text-slate-200">
            {study.rapidImplementation.stack}
          </p>
        </div>
        <ol className="mb-6 space-y-2">
          {study.rapidImplementation.steps.map((s, i) => (
            <li key={s} className="flex gap-3 text-sm leading-relaxed text-slate-300">
              <span className="shrink-0 font-mono text-emerald-400">
                {String(i + 1).padStart(2, "0")}
              </span>
              {s}
            </li>
          ))}
        </ol>
        <div className="space-y-4">
          {study.rapidImplementation.codeSketches.map((sketch) => (
            <div
              key={sketch.title}
              className="overflow-hidden rounded-xl border border-slate-800"
            >
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2">
                <p className="text-sm font-medium text-slate-200">
                  {sketch.title}
                </p>
                <span className="font-mono text-xs text-slate-500">
                  {sketch.language}
                </span>
              </div>
              <pre className="overflow-x-auto bg-[#0a0f1c] p-4 text-xs leading-relaxed text-slate-300">
                <code>{sketch.code}</code>
              </pre>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10 rounded-xl border border-rose-500/30 bg-rose-500/5 p-6">
        <h2 className="mb-3 text-lg font-semibold text-rose-300">
          Bottlenecks & failure modes
        </h2>
        <ul className="space-y-2">
          {study.bottlenecks.map((b) => (
            <li key={b} className="flex gap-2 text-slate-300">
              <span className="text-rose-400">⚠</span>
              {b}
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-10 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-6">
        <h2 className="mb-3 text-lg font-semibold text-indigo-300">
          Key takeaways
        </h2>
        <ul className="space-y-2">
          {study.keyTakeaways.map((t) => (
            <li key={t} className="flex gap-2 text-slate-300">
              <span className="text-indigo-400">▸</span>
              {t}
            </li>
          ))}
        </ul>
      </section>

      {related.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">
            Brush up on the underlying topics
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
