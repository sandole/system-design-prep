import type { MetadataRoute } from "next";
import { allCaseStudies, allTopics } from "@/lib/content";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://system-design-prep.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = [
    "",
    "/topics",
    "/case-studies",
    "/framework",
    "/calculator",
    "/flashcards",
    "/glossary",
  ].map((p) => ({ url: `${base}${p}` }));

  return [
    ...staticPages,
    ...allTopics.map((t) => ({ url: `${base}/topics/${t.slug}` })),
    ...allCaseStudies.map((c) => ({ url: `${base}/case-studies/${c.slug}` })),
  ];
}
