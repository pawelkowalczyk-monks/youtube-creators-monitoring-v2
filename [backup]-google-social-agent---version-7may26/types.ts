
export interface Mention {
  id: string;
  mention: string;
  author: string;
  platform: string;
  date: string;
  rawDate?: Date;
  url: string;
  source: 'EARNED' | 'OWNED' | 'SLRR';
}

export enum ProductArea {
  Pixel = "Pixel",
  Search = "Search",
  Gemini = "Gemini",
  BrandCulture = "Brand/Culture",
  Education = "Education",
  Android = "Android",
}

export interface ShortlistedMention extends Mention {
  tag: ProductArea[];
  opportunityScore: number;
  respectsGuidelines: boolean;
}

export interface ModerationCandidate {
  id: string;
  action: 'Hide' | 'Delete';
  reason: string;
}

export interface LikeCandidate {
  id: string;
  reason: string;
  tag: ProductArea[];
}

export interface GeneratedResponse {
  tone: string;
  responseText: string;
  guidelinesAdherence: boolean;
  guidelinesComment: string;
}
export type GeneratedResponseSet = GeneratedResponse[];

export interface ToneMatrixItem {
  descriptor: string;
  intensity: number;
  context: string;
}

export enum AppStep {
  Welcome,
  MentionsLoaded,
  Analyzing,
  Validating,
  Generating,
  Results,
  Export,
  Error,
}

export interface Trait {
  trait: string;
  score: number;
  description: string;
}

export interface AIPersonality {
  personalityName: string;
  summary: string;
  traits: Trait[];
  dos: string[];
  donts: string[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export type GeoMood = 'idle' | 'happy' | 'thinking' | 'winking';
