import type { Metadata } from "next";
import { allTopics } from "@/lib/content";
import TopicExplorer from "@/components/TopicExplorer";

export const metadata: Metadata = {
  title: "Core Topics",
  description:
    "Deep dives into every system design building block: scalability, load balancing, caching, sharding, consistency, message queues, and more.",
};

export default function TopicsPage() {
  // Slim projection keeps the client bundle payload small.
  const summaries = allTopics.map(({ slug, title, category, summary }) => ({
    slug,
    title,
    category,
    summary,
  }));

  return (
    <div>
      <h1 className="text-3xl font-bold text-white">Core Topics</h1>
      <p className="mt-2 mb-8 max-w-2xl text-slate-400">
        The building blocks every design gets assembled from. Master the
        tradeoffs here and you can reason about any question they throw at you.
      </p>
      <TopicExplorer topics={summaries} />
    </div>
  );
}
