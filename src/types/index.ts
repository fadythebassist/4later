// Content Types
export type ContentType = "text" | "video" | "image" | "link" | "article";

// Item represents a saved piece of content
export interface Item {
  id: string;
  type: ContentType;
  title: string;
  url?: string;
  content?: string;
  thumbnail?: string;
  listIds: string[];
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  source?: string;
  archived?: boolean;
  nsfw?: boolean;
}

// List represents a collection/category
export interface List {
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  color?: string;
  icon?: string;
  itemCount?: number;
}

// DiceBear avatar styles
export const DICEBEAR_STYLES = [
  { id: "lorelei", name: "Lorelei", description: "Illustrated characters" },
  { id: "avataaars", name: "Avataaars", description: "Cartoon characters" },
  { id: "bottts", name: "Bottts", description: "Cute robots" },
  { id: "personas", name: "Personas", description: "Simple & professional" },
  { id: "initials", name: "Initials", description: "Letter-based" },
  { id: "shapes", name: "Shapes", description: "Geometric patterns" },
] as const;

export type DiceBearStyle = (typeof DICEBEAR_STYLES)[number]["id"];

// User settings/preferences
export interface AppSettings {
  theme?: 'light' | 'dark';
  viewDensity?: 'compact' | 'comfortable';
  layoutMode?: 'grid' | 'list';
  defaultListId?: string;
  analyticsConsent?: 'granted' | 'denied';
  autoFetchMetadata?: boolean;
  confirmDelete?: boolean;
  thumbnailQuality?: 'low' | 'medium' | 'high';
  itemsPerPage?: number;
  showSourceBadges?: boolean;
  moderationLevel?: 'strict' | 'moderate' | 'relaxed' | 'off';
  autoArchiveDays?: number;
  autoplayVideos?: boolean;
}

// User profile
export interface User {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  avatarStyle?: string;
  createdAt: Date;
  provider: "google" | "email" | "facebook" | "twitter";
  settings?: AppSettings;
}

// Share target data (from Web Share API)
export interface ShareData {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
}

// UI State
export interface UIState {
  loading: boolean;
  error: string | null;
  selectedListId: string | null;
}

// Create/Update DTOs
export interface CreateItemDTO {
  type: ContentType;
  title: string;
  url?: string;
  content?: string;
  thumbnail?: string;
  listIds: string[];
  tags?: string[];
  source?: string;
  nsfw?: boolean;
}

export interface UpdateItemDTO extends Partial<CreateItemDTO> {
  id: string;
}

export interface CreateListDTO {
  name: string;
  color?: string;
  icon?: string;
}

export interface UpdateListDTO extends Partial<CreateListDTO> {
  id: string;
}

export interface AutoCategorySuggestion {
  name: string;
  icon: string;
  confidence: number;
  matchedKeywords: string[];
}

export interface AutoCategorizationResult {
  tags: string[];
  categories: AutoCategorySuggestion[];
  autoCategories: AutoCategorySuggestion[];
  autoCategory: AutoCategorySuggestion | undefined;
  suggestedCategory: AutoCategorySuggestion | undefined;
}
