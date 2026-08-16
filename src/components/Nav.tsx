"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/topics", label: "Topics" },
  { href: "/case-studies", label: "Case Studies" },
  { href: "/framework", label: "Framework" },
  { href: "/calculator", label: "Calculator" },
  { href: "/flashcards", label: "Flashcards" },
  { href: "/glossary", label: "Glossary" },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-[#070b14]/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold text-slate-100">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500 font-mono text-sm text-white">
            SD
          </span>
          System Design Prep
        </Link>
        <button
          className="rounded-md p-2 text-slate-300 hover:bg-slate-800 md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            {open ? (
              <path d="M4.3 4.3a1 1 0 011.4 0L10 8.6l4.3-4.3a1 1 0 111.4 1.4L11.4 10l4.3 4.3a1 1 0 01-1.4 1.4L10 11.4l-4.3 4.3a1 1 0 01-1.4-1.4L8.6 10 4.3 5.7a1 1 0 010-1.4z" />
            ) : (
              <path d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm1 4a1 1 0 100 2h12a1 1 0 100-2H4z" />
            )}
          </svg>
        </button>
        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                pathname.startsWith(l.href)
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </nav>
      {open && (
        <div className="border-t border-slate-800 px-4 pb-3 md:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`block rounded-md px-3 py-2 text-sm ${
                pathname.startsWith(l.href)
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:bg-slate-800/60"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
