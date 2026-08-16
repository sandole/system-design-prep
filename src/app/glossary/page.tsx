import type { Metadata } from "next";
import { glossary, latencyNumbers } from "@/lib/glossary";

export const metadata: Metadata = {
  title: "Glossary & Latency Numbers",
  description:
    "Every system design term you might get asked, plus the latency numbers every programmer should know.",
};

export default function GlossaryPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold text-white">
        Glossary & Latency Numbers
      </h1>
      <p className="mt-2 mb-10 text-slate-400">
        Speak the language fluently. Interviewers notice when you use terms
        precisely - and when you don&apos;t.
      </p>

      <section className="mb-12">
        <h2 className="mb-4 text-xl font-semibold text-white">
          Latency numbers every engineer should know
        </h2>
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900 text-left text-slate-400">
                <th className="px-4 py-3 font-medium">Operation</th>
                <th className="px-4 py-3 font-medium">Latency</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">
                  Perspective
                </th>
              </tr>
            </thead>
            <tbody>
              {latencyNumbers.map((l, i) => (
                <tr
                  key={l.operation}
                  className={i % 2 === 0 ? "bg-slate-900/60" : "bg-slate-900/20"}
                >
                  <td className="px-4 py-3 text-slate-200">{l.operation}</td>
                  <td className="px-4 py-3 font-mono text-indigo-300">
                    {l.latency}
                  </td>
                  <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">
                    {l.comparison}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-white">Glossary</h2>
        <dl className="space-y-4">
          {glossary.map((g) => (
            <div
              key={g.term}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
            >
              <dt className="font-medium text-white">{g.term}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-slate-400">
                {g.definition}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
