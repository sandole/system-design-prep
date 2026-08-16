import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="font-mono text-6xl font-bold text-indigo-400">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-white">
        This page got sharded to a partition we can&apos;t find
      </h1>
      <p className="mt-2 text-slate-400">
        The hash ring says it should be here, but it isn&apos;t.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-lg bg-indigo-500 px-5 py-2.5 font-medium text-white hover:bg-indigo-400"
      >
        Back home
      </Link>
    </div>
  );
}
