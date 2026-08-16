export type TopicCategory =
  | "Fundamentals"
  | "Networking"
  | "Data"
  | "Architecture"
  | "Reliability";

export interface Topic {
  slug: string;
  title: string;
  category: TopicCategory;
  summary: string; // 1-2 sentence overview
  sections: { heading: string; body: string }[]; // body: plain-text paragraphs separated by "\n\n"
  keyPoints: string[]; // interview talking points
  tradeoffs: { option: string; pros: string[]; cons: string[] }[];
  interviewTips: string[];
  related: string[]; // slugs of related topics
}

export type Difficulty = "Easy" | "Medium" | "Hard";

export interface CaseStudy {
  slug: string;
  title: string;
  difficulty: Difficulty;
  summary: string;
  functionalRequirements: string[];
  nonFunctionalRequirements: string[];
  backOfEnvelope: { label: string; value: string; note?: string }[];
  apiDesign: { endpoint: string; description: string }[];
  highLevelDesign: string[]; // paragraphs walking through the architecture
  dataModel: { name: string; fields: string; note?: string }[];
  deepDives: { heading: string; body: string }[]; // body: paragraphs separated by "\n\n"
  bottlenecks: string[];
  keyTakeaways: string[];
  relatedTopics: string[]; // topic slugs
}

export interface Flashcard {
  question: string;
  answer: string;
  category: string;
}

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export interface LatencyNumber {
  operation: string;
  latency: string;
  comparison?: string;
}
