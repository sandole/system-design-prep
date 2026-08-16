const palettes: Record<string, string> = {
  Fundamentals: "bg-sky-500/10 text-sky-400 ring-sky-500/30",
  Networking: "bg-violet-500/10 text-violet-400 ring-violet-500/30",
  Data: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30",
  Architecture: "bg-amber-500/10 text-amber-400 ring-amber-500/30",
  Reliability: "bg-rose-500/10 text-rose-400 ring-rose-500/30",
  Easy: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30",
  Medium: "bg-amber-500/10 text-amber-400 ring-amber-500/30",
  Hard: "bg-rose-500/10 text-rose-400 ring-rose-500/30",
};

export default function Badge({ label }: { label: string }) {
  const palette = palettes[label] ?? "bg-slate-500/10 text-slate-400 ring-slate-500/30";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${palette}`}
    >
      {label}
    </span>
  );
}
