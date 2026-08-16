"use client";

import { useMemo, useState } from "react";
import type { Flashcard } from "@/lib/types";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function FlashcardDeck({ cards }: { cards: Flashcard[] }) {
  const categories = useMemo(
    () => ["All", ...Array.from(new Set(cards.map((c) => c.category)))],
    [cards],
  );
  const [category, setCategory] = useState("All");
  const [deck, setDeck] = useState<Flashcard[]>(cards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [reviewed, setReviewed] = useState(0);

  const reset = (cat: string, reshuffle: boolean) => {
    const pool = cat === "All" ? cards : cards.filter((c) => c.category === cat);
    setDeck(reshuffle ? shuffle(pool) : pool);
    setIndex(0);
    setFlipped(false);
    setKnown(0);
    setReviewed(0);
  };

  const card = deck[index];
  const done = index >= deck.length;

  const advance = (gotIt: boolean) => {
    if (gotIt) setKnown((k) => k + 1);
    setReviewed((r) => r + 1);
    setFlipped(false);
    setIndex((i) => i + 1);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => {
              setCategory(c);
              reset(c, false);
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              category === c
                ? "bg-indigo-500 text-white"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}
          >
            {c}
          </button>
        ))}
        <button
          onClick={() => reset(category, true)}
          className="ml-auto rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300 hover:border-indigo-500 hover:text-indigo-400"
        >
          ⇄ Shuffle & restart
        </button>
      </div>

      <div className="mb-4 flex items-center justify-between text-sm text-slate-500">
        <span>
          Card {Math.min(index + 1, deck.length)} of {deck.length}
        </span>
        <span>
          {known} known · {reviewed - known} to review
        </span>
      </div>
      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full bg-indigo-500 transition-all"
          style={{ width: `${deck.length ? (index / deck.length) * 100 : 0}%` }}
        />
      </div>

      {done ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-10 text-center">
          <p className="text-2xl font-bold text-white">
            {known}/{deck.length} known
          </p>
          <p className="mt-2 text-slate-400">
            {known === deck.length
              ? "Perfect run. You are ready."
              : "Shuffle and run it back until every card is instant."}
          </p>
          <button
            onClick={() => reset(category, true)}
            className="mt-6 rounded-lg bg-indigo-500 px-5 py-2.5 font-medium text-white hover:bg-indigo-400"
          >
            Go again
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={() => setFlipped(!flipped)}
            className="block w-full cursor-pointer rounded-2xl border border-slate-700 bg-slate-900/60 p-10 text-left transition-colors hover:border-indigo-500/60"
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-indigo-400">
              {flipped ? "Answer" : card.category}
            </p>
            <p className="text-lg leading-relaxed text-slate-100">
              {flipped ? card.answer : card.question}
            </p>
            {!flipped && (
              <p className="mt-6 text-sm text-slate-500">Tap to reveal answer</p>
            )}
          </button>
          {flipped && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => advance(false)}
                className="rounded-lg border border-rose-500/40 bg-rose-500/10 py-3 font-medium text-rose-300 hover:bg-rose-500/20"
              >
                Needs review
              </button>
              <button
                onClick={() => advance(true)}
                className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 py-3 font-medium text-emerald-300 hover:bg-emerald-500/20"
              >
                Got it
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
