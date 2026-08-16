import type { CaseStudy, Topic } from "./types";
import { fundamentalsTopics } from "./topics-fundamentals";
import { dataTopics } from "./topics-data";
import { architectureTopics } from "./topics-architecture";
import { caseStudies1 } from "./case-studies-1";
import { caseStudies2 } from "./case-studies-2";
import { caseStudies3 } from "./case-studies-3";
import { caseStudies4 } from "./case-studies-4";
import { caseStudies5 } from "./case-studies-5";
import { caseStudies6 } from "./case-studies-6";

export const allTopics: Topic[] = [
  ...fundamentalsTopics,
  ...dataTopics,
  ...architectureTopics,
];

export const allCaseStudies: CaseStudy[] = [
  ...caseStudies1,
  ...caseStudies2,
  ...caseStudies3,
  ...caseStudies4,
  ...caseStudies5,
  ...caseStudies6,
];

export function getTopic(slug: string): Topic | undefined {
  return allTopics.find((t) => t.slug === slug);
}

export function getCaseStudy(slug: string): CaseStudy | undefined {
  return allCaseStudies.find((c) => c.slug === slug);
}

export const topicCategories = [
  "Fundamentals",
  "Networking",
  "Data",
  "Architecture",
  "Reliability",
] as const;
