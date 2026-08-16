"use client";

import { useState } from "react";

function fmt(n: number): string {
  if (!isFinite(n)) return "—";
  if (n >= 1e15) return `${(n / 1e15).toFixed(2)} PB`;
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)} TB`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)} MB`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)} KB`;
  return `${Math.round(n)} B`;
}

function fmtNum(n: number): string {
  if (!isFinite(n)) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

interface Field {
  key: string;
  label: string;
  hint: string;
  defaultValue: number;
}

const fields: Field[] = [
  { key: "dau", label: "Daily active users", hint: "e.g. 10,000,000", defaultValue: 10_000_000 },
  { key: "writesPerUser", label: "Writes per user per day", hint: "posts, uploads, messages…", defaultValue: 2 },
  { key: "readRatio", label: "Read : write ratio", hint: "10 means 10 reads per write", defaultValue: 10 },
  { key: "objectSize", label: "Average object size (bytes)", hint: "e.g. 1 KB post = 1000", defaultValue: 1000 },
  { key: "peakMultiplier", label: "Peak traffic multiplier", hint: "usually 2-5x average", defaultValue: 2 },
  { key: "replication", label: "Replication factor", hint: "copies of each object, usually 3", defaultValue: 3 },
  { key: "retentionYears", label: "Retention (years)", hint: "how long data is kept", defaultValue: 5 },
];

const SECONDS_PER_DAY = 86_400;

export default function Calculator() {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, String(f.defaultValue)])),
  );

  const v = (key: string) => Number(values[key]) || 0;

  const writesPerDay = v("dau") * v("writesPerUser");
  const readsPerDay = writesPerDay * v("readRatio");
  const writeQps = writesPerDay / SECONDS_PER_DAY;
  const readQps = readsPerDay / SECONDS_PER_DAY;
  const peakQps = (readQps + writeQps) * v("peakMultiplier");
  const storagePerDay = writesPerDay * v("objectSize");
  const storageTotal = storagePerDay * 365 * v("retentionYears") * v("replication");
  const writeBandwidth = writeQps * v("objectSize");
  const readBandwidth = readQps * v("objectSize");
  // 80/20 rule: cache the hot 20% of a day's reads
  const cacheSize = readsPerDay * v("objectSize") * 0.2;

  const results = [
    { label: "Write QPS (avg)", value: fmtNum(writeQps), note: `${fmtNum(writesPerDay)} writes/day ÷ 86,400s` },
    { label: "Read QPS (avg)", value: fmtNum(readQps), note: `${fmtNum(readsPerDay)} reads/day ÷ 86,400s` },
    { label: "Peak total QPS", value: fmtNum(peakQps), note: `(read + write QPS) × ${v("peakMultiplier")}` },
    { label: "New storage / day", value: fmt(storagePerDay), note: "writes/day × object size (single copy)" },
    { label: "Total storage", value: fmt(storageTotal), note: `${v("retentionYears")}y retention × ${v("replication")}x replication` },
    { label: "Write bandwidth", value: `${fmt(writeBandwidth)}/s`, note: "ingress at average load" },
    { label: "Read bandwidth", value: `${fmt(readBandwidth)}/s`, note: "egress at average load" },
    { label: "Cache size (80/20 rule)", value: fmt(cacheSize), note: "hot 20% of a day's read volume" },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-4">
        {fields.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-sm font-medium text-slate-200">
              {f.label}
            </span>
            <input
              type="number"
              min="0"
              value={values[f.key]}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 font-mono text-sm text-slate-200 outline-none focus:border-indigo-500"
            />
            <span className="mt-1 block text-xs text-slate-500">{f.hint}</span>
          </label>
        ))}
      </div>

      <div>
        <div className="sticky top-20 space-y-3">
          {results.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-200">{r.label}</p>
                <p className="text-xs text-slate-500">{r.note}</p>
              </div>
              <p className="shrink-0 font-mono text-lg font-semibold text-indigo-300">
                {r.value}
              </p>
            </div>
          ))}
          <p className="pt-2 text-xs leading-relaxed text-slate-500">
            Interview tip: round aggressively (86,400 ≈ 100K seconds/day) and
            state your assumptions out loud. The interviewer cares about your
            reasoning, not decimal places.
          </p>
        </div>
      </div>
    </div>
  );
}
