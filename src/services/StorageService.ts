import {
  Item,
  List,
  User,
  CreateItemDTO,
  UpdateItemDTO,
  CreateListDTO,
  UpdateListDTO,
  AppSettings,
} from "@/types";

// Abstract interface that both Mock and Firebase services will implement
export interface StorageService {
  // Authentication
  signInWithGoogle(): Promise<User>;
  signInWithTwitter(): Promise<User>;
  signInWithEmail(email: string, password: string): Promise<User>;
  signUpWithEmail(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<User>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
  updateAvatarStyle(userId: string, style: string): Promise<void>;
  updateUserSettings(userId: string, settings: AppSettings): Promise<void>;

  // Lists
  getLists(userId: string): Promise<List[]>;
  getList(listId: string): Promise<List | null>;
  createList(userId: string, data: CreateListDTO): Promise<List>;
  updateList(data: UpdateListDTO): Promise<void>;
  deleteList(listId: string, userId: string): Promise<void>;

  // Items
  getItems(
    userId: string,
    listId?: string,
    options?: { limit?: number; cursorDate?: Date | null },
  ): Promise<{ items: Item[]; hasMore: boolean; nextCursorDate: Date | null }>;
  getItem(itemId: string): Promise<Item | null>;
  createItem(userId: string, data: CreateItemDTO): Promise<Item>;
  updateItem(data: UpdateItemDTO): Promise<void>;
  deleteItem(itemId: string): Promise<void>;
  archiveItem(itemId: string): Promise<void>;

  // Utility
  detectContentType(url: string): { type: string; source?: string };
}
