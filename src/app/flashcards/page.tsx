import type { Metadata } from "next";
import { flashcards } from "@/lib/flashcards";
import FlashcardDeck from "@/components/FlashcardDeck";

export const metadata: Metadata = {
  title: "Flashcards",
  description:
    "Rapid-fire system design flashcards across fundamentals, networking, data, architecture, and reliability.",
};

export default function FlashcardsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-white">Flashcards</h1>
      <p className="mt-2 mb-8 max-w-2xl text-slate-400">
        If you have to think about it, you don&apos;t know it well enough yet.
        Drill until the answers are instant.
      </p>
      <FlashcardDeck cards={flashcards} />
    </div>
  );
}
