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
import { StorageService } from "./StorageService";
import { apiUrl } from "@/utils/apiBase";

/**
 * Helper functions for content detection
 */
function extractYouTubeThumbnail(url: string): string | undefined {
  try {
    let videoId: string | null = null;

    // Add protocol if missing
    let fullUrl = url;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      fullUrl = "https://" + url;
    }

    // Extract video ID from various YouTube URL formats
    if (fullUrl.includes("youtube.com/watch")) {
      const urlObj = new URL(fullUrl);
      videoId = urlObj.searchParams.get("v");
    } else if (fullUrl.includes("youtu.be/")) {
      const match = fullUrl.match(/youtu\.be\/([^?&]+)/);
      videoId = match ? match[1] : null;
    } else if (fullUrl.includes("youtube.com/embed/")) {
      const match = fullUrl.match(/embed\/([^?&]+)/);
      videoId = match ? match[1] : null;
    }

    if (videoId) {
      // Return high-quality thumbnail
      return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }
  } catch (err) {
    console.error("Failed to extract YouTube thumbnail:", err);
  }
  return undefined;
}

function detectContentType(url: string): { type: string; source?: string } {
  const urlLower = url.toLowerCase();

  // YouTube
  if (urlLower.includes("youtube.com") || urlLower.includes("youtu.be")) {
    return { type: "video", source: "youtube" };
  }

  // Twitter/X
  if (urlLower.includes("twitter.com") || urlLower.includes("x.com")) {
    return { type: "text", source: "twitter" };
  }

  // TikTok
  if (urlLower.includes("tiktok.com")) {
    return { type: "video", source: "tiktok" };
  }

  // Instagram
  if (urlLower.includes("instagram.com")) {
    return { type: "image", source: "instagram" };
  }

  // Reddit
  if (urlLower.includes("reddit.com") || urlLower.includes("redd.it")) {
    return { type: "link", source: "reddit" };
  }

  // Threads
  if (urlLower.includes("threads.net") || urlLower.includes("threads.com")) {
    return { type: "text", source: "threads" };
  }

  // Facebook
  if (urlLower.includes("facebook.com") || urlLower.includes("fb.watch")) {
    const isVideo =
      urlLower.includes("fb.watch") ||
      urlLower.includes("/watch") ||
      urlLower.includes("/videos") ||
      urlLower.includes("/reel") ||
      urlLower.includes("/share/v/") ||
      urlLower.includes("/share/r/");
    return { type: isVideo ? "video" : "link", source: "facebook" };
  }

  // Vimeo
  if (urlLower.includes("vimeo.com")) {
    return { type: "video", source: "vimeo" };
  }

  // Spotify
  if (urlLower.includes("spotify.com") || urlLower.includes("open.spotify.com")) {
    return { type: "link", source: "spotify" };
  }

  // GitHub
  if (urlLower.includes("github.com")) {
    return { type: "link", source: "github" };
  }

  // Medium
  if (urlLower.includes("medium.com")) {
    return { type: "link", source: "medium" };
  }

  // LinkedIn
  if (urlLower.includes("linkedin.com")) {
    return { type: "link", source: "linkedin" };
  }

  // Anghami
  if (urlLower.includes("anghami.com")) {
    return { type: "link", source: "anghami" };
  }

  // Pinterest
  if (urlLower.includes("pinterest.com") || urlLower.includes("pin.it")) {
    return { type: "image", source: "pinterest" };
  }

  // Image extensions
  if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)) {
    return { type: "image" };
  }

  // Video extensions
  if (/\.(mp4|webm|ogg|mov)$/i.test(url)) {
    return { type: "video" };
  }

  return { type: "link", source: "other" };
}

/**
 * MockStorageService - In-memory storage for development and testing
 * Data persists in localStorage to survive page refreshes
 */
export class MockStorageService implements StorageService {
  private readonly STORAGE_KEY = "4stash_mock_data";
  private data: {
    users: User[];
    lists: List[];
    items: Item[];
    currentUserId: string | null;
  };

  constructor() {
    this.data = this.loadFromStorage();
  }

  private loadFromStorage() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Convert date strings back to Date objects
      parsed.users = parsed.users.map((u: Omit<User, 'createdAt'> & { createdAt: string }) => ({
        ...u,
        createdAt: new Date(u.createdAt),
      }));
      parsed.lists = parsed.lists.map((l: Omit<List, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }) => ({
        ...l,
        createdAt: new Date(l.createdAt),
        updatedAt: new Date(l.updatedAt),
      }));

      // Track if data was enriched
      let dataEnriched = false;

      parsed.items = parsed.items.map((i: Omit<Item, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string; listId?: string }) => {
        const item = {
          ...i,
          createdAt: new Date(i.createdAt),
          updatedAt: new Date(i.updatedAt),
        };

        // Migrate old single-listId format to listIds array
        if (!Array.isArray(item.listIds)) {
          item.listIds = item.listId ? [item.listId] : [];
          delete item.listId;
          dataEnriched = true;
        }

        // Auto-detect and add source/thumbnail for existing items
        if (item.url && !item.source) {
          console.log(
            "[MockStorage] Enriching item:",
            item.title,
            "URL:",
            item.url,
          );
          const detected = detectContentType(item.url);
          item.source = detected.source;
          console.log("[MockStorage] Detected source:", detected.source);

          if (!item.thumbnail && detected.source === "youtube") {
            item.thumbnail = extractYouTubeThumbnail(item.url);
            console.log("[MockStorage] Generated thumbnail:", item.thumbnail);
            dataEnriched = true;
          }
        }

        return item;
      });

      // Save enriched data back to localStorage
      if (dataEnriched) {
        this.data = parsed;
        this.saveToStorage();
      }

      return parsed;
    }
    return {
      users: [],
      lists: [],
      items: [],
      currentUserId: null,
    };
  }

  private saveToStorage() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private delay(ms: number = 300): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private normalizeUrl(urlStr: string): string | null {
    const trimmed = urlStr.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://"))
      return trimmed;
    return `https://${trimmed}`;
  }

  private async unfurl(
    urlStr: string,
  ): Promise<{ description?: string; image?: string } | null> {
    try {
      const fullUrl = this.normalizeUrl(urlStr);
      if (!fullUrl) return null;

      const res = await fetch(apiUrl(`/api/unfurl?url=${encodeURIComponent(fullUrl)}`));
      if (!res.ok) return null;
      const data = await res.json();

      return {
        description:
          typeof data.description === "string" ? data.description : undefined,
        image: typeof data.image === "string" ? data.image : undefined,
      };
    } catch {
      // In static hosting, /api/unfurl won't exist; ignore.
      return null;
    }
  }

  // Authentication Methods
  async signInWithGoogle(): Promise<User> {
    await this.delay();
    // Mock Google sign-in
    const existingUser = this.data.users.find(
      (u) => u.email === "demo@4stash.com",
    );
    if (existingUser) {
      this.data.currentUserId = existingUser.id;
      this.saveToStorage();
      return existingUser;
    }

    const user: User = {
      id: this.generateId(),
      email: "demo@4stash.com",
      displayName: "Demo User",
      photoURL:
        "https://ui-avatars.com/api/?name=Demo+User&background=6366f1&color=fff",
      createdAt: new Date(),
      provider: "google",
      settings: {
        theme: 'light',
        viewDensity: 'comfortable',
        layoutMode: 'grid',
        autoFetchMetadata: true,
        confirmDelete: true,
        thumbnailQuality: 'high',
        itemsPerPage: 24,
        showSourceBadges: true,
        moderationLevel: 'moderate',
        autoArchiveDays: 0,
      },
    };

    this.data.users.push(user);
    this.data.currentUserId = user.id;

    // Create default list for new user
    await this.createList(user.id, { name: "Quick Bin", icon: "📥" });
    await this.createList(user.id, { name: "Favorites", icon: "⭐" });

    this.saveToStorage();
    return user;
  }

  async signInWithTwitter(): Promise<User> {
    await this.delay();
    // Mock Twitter sign-in - same as Google for development
    const existingUser = this.data.users.find(
      (u) => u.email === "demo@4stash.com",
    );
    if (existingUser) {
      this.data.currentUserId = existingUser.id;
      this.saveToStorage();
      return existingUser;
    }

    const user: User = {
      id: this.generateId(),
      email: "demo@4stash.com",
      displayName: "Demo User (Twitter)",
      photoURL:
        "https://ui-avatars.com/api/?name=Demo+User&background=1da1f2&color=fff",
      createdAt: new Date(),
      provider: "twitter",
    };

    this.data.users.push(user);
    this.data.currentUserId = user.id;

    // Create default list for new user
    await this.createList(user.id, { name: "Quick Bin", icon: "📥" });
    await this.createList(user.id, { name: "Favorites", icon: "⭐" });

    this.saveToStorage();
    return user;
  }

  async signInWithEmail(email: string, _password: string): Promise<User> {
    await this.delay();
    const user = this.data.users.find((u) => u.email === email);
    if (!user) {
      throw new Error("Invalid email or password");
    }
    this.data.currentUserId = user.id;
    this.saveToStorage();
    return user;
  }

  async signUpWithEmail(
    email: string,
    _password: string,
    displayName?: string,
  ): Promise<User> {
    await this.delay();
    if (this.data.users.find((u) => u.email === email)) {
      throw new Error("Email already in use");
    }

    const user: User = {
      id: this.generateId(),
      email,
      displayName: displayName || email.split("@")[0],
      createdAt: new Date(),
      provider: "email",
      settings: {
        theme: 'light',
        viewDensity: 'comfortable',
        layoutMode: 'grid',
        autoFetchMetadata: true,
        confirmDelete: true,
        thumbnailQuality: 'high',
        itemsPerPage: 24,
        showSourceBadges: true,
        moderationLevel: 'moderate',
        autoArchiveDays: 0,
      },
    };

    this.data.users.push(user);
    this.data.currentUserId = user.id;

    // Create default lists
    await this.createList(user.id, { name: "Quick Bin", icon: "📥" });
    await this.createList(user.id, { name: "Favorites", icon: "⭐" });

    this.saveToStorage();
    return user;
  }

  async signOut(): Promise<void> {
    await this.delay(100);
    this.data.currentUserId = null;
    this.saveToStorage();
  }

  async getCurrentUser(): Promise<User | null> {
    if (!this.data.currentUserId) return null;
    return (
      this.data.users.find((u) => u.id === this.data.currentUserId) || null
    );
  }

  async updateAvatarStyle(userId: string, style: string): Promise<void> {
    await this.delay(100);
    const user = this.data.users.find((u) => u.id === userId);
    if (user) {
      user.avatarStyle = style;
      user.photoURL = `https://api.dicebear.com/7.x/${style}/png?seed=${userId}&size=64`;
      this.saveToStorage();
    }
  }

  async updateUserSettings(userId: string, settings: AppSettings): Promise<void> {
    await this.delay(100);
    const user = this.data.users.find((u) => u.id === userId);
    if (user) {
      user.settings = settings;
      this.saveToStorage();
    }
  }

  // Lists Methods
  async getLists(userId: string): Promise<List[]> {
    await this.delay(200);
    return this.data.lists
      .filter((l) => l.userId === userId)
      .map((list) => ({
        ...list,
        itemCount: this.data.items.filter(
          (i) => i.listIds.includes(list.id) && !i.archived,
        ).length,
      }));
  }

  async getList(listId: string): Promise<List | null> {
    await this.delay(100);
    const list = this.data.lists.find((l) => l.id === listId);
    if (!list) return null;
    return {
      ...list,
      itemCount: this.data.items.filter(
        (i) => i.listIds.includes(listId) && !i.archived,
      ).length,
    };
  }

  async createList(userId: string, data: CreateListDTO): Promise<List> {
    await this.delay(200);
    const list: List = {
      id: this.generateId(),
      name: data.name,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      color: data.color,
      icon: data.icon,
      itemCount: 0,
    };
    this.data.lists.push(list);
    this.saveToStorage();
    return list;
  }

  async updateList(data: UpdateListDTO): Promise<void> {
    await this.delay(200);
    const list = this.data.lists.find((l) => l.id === data.id);
    if (!list) throw new Error("List not found");

    Object.assign(list, {
      ...data,
      updatedAt: new Date(),
    });
    this.saveToStorage();
  }

  async deleteList(listId: string, _userId: string): Promise<void> {
    await this.delay(200);
    this.data.lists = this.data.lists.filter((l) => l.id !== listId);
    // Remove listId from items that belong to this list; delete items with no remaining lists
    this.data.items = this.data.items
      .map((i) => ({ ...i, listIds: i.listIds.filter((id) => id !== listId) }))
      .filter((i) => i.listIds.length > 0);
    this.saveToStorage();
  }

  // Items Methods
  async getItems(
    userId: string,
    listId?: string,
    options?: { limit?: number; cursorDate?: Date | null },
  ): Promise<{ items: Item[]; hasMore: boolean; nextCursorDate: Date | null }> {
    await this.delay(200);
    const pageLimit = options?.limit ?? 20;
    let items = this.data.items.filter(
      (i) => i.userId === userId && !i.archived,
    );
    if (listId) {
      items = items.filter((i) => i.listIds.includes(listId));
    }

    let dataEnriched = false;

    // Enrich items with missing thumbnails and source info
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const enrichedItem = { ...item };
        let changed = false;

        if (item.url) {
          const detected = item.source
            ? { source: item.source }
            : detectContentType(item.url);

          if (!item.source && detected.source) {
            enrichedItem.source = detected.source as Item["source"];
            changed = true;
          }

          if (!item.thumbnail && detected.source === "youtube") {
            const thumb = extractYouTubeThumbnail(item.url);
            if (thumb) {
              enrichedItem.thumbnail = thumb;
              changed = true;
            }
          }

          // Instagram: try unfurl (dev/preview) to get og:image and og:description
          if (
            (detected.source === "instagram" || item.source === "instagram") &&
            (!item.thumbnail || !item.content)
          ) {
            const meta = await this.unfurl(item.url);
            if (!item.thumbnail && meta?.image) {
              enrichedItem.thumbnail = meta.image;
              changed = true;
            }
            if (!item.content && meta?.description) {
              enrichedItem.content = meta.description;
              changed = true;
            }
          }
        }

        if (changed) {
          const idx = this.data.items.findIndex((i) => i.id === item.id);
          if (idx !== -1) {
            this.data.items[idx] = { ...this.data.items[idx], ...enrichedItem };
            dataEnriched = true;
          }
        }

        return enrichedItem;
      }),
    );

    if (dataEnriched) {
      this.saveToStorage();
    }

    const sortedItems = enrichedItems.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );

    const pagedItems = options?.cursorDate
      ? sortedItems.filter((item) => item.createdAt < options.cursorDate!)
      : sortedItems;

    const hasMore = pagedItems.length > pageLimit;
    const pageItems = hasMore ? pagedItems.slice(0, pageLimit) : pagedItems;
    const nextCursorDate =
      pageItems.length > 0 ? pageItems[pageItems.length - 1].createdAt : null;

    return {
      items: pageItems,
      hasMore,
      nextCursorDate,
    };
  }

  async getItem(itemId: string): Promise<Item | null> {
    await this.delay(100);
    const item = this.data.items.find((i) => i.id === itemId);

    if (!item) return null;

    // Enrich item with missing thumbnails and source info
    const enrichedItem = { ...item };
    let changed = false;

    if (item.url) {
      const detected = item.source
        ? { source: item.source }
        : detectContentType(item.url);

      if (!item.source && detected.source) {
        enrichedItem.source = detected.source as Item["source"];
        changed = true;
      }

      if (!item.thumbnail && detected.source === "youtube") {
        const thumb = extractYouTubeThumbnail(item.url);
        if (thumb) {
          enrichedItem.thumbnail = thumb;
          changed = true;
        }
      }

      if (
        (detected.source === "instagram" || item.source === "instagram") &&
        (!item.thumbnail || !item.content)
      ) {
        const meta = await this.unfurl(item.url);
        if (!item.thumbnail && meta?.image) {
          enrichedItem.thumbnail = meta.image;
          changed = true;
        }
        if (!item.content && meta?.description) {
          enrichedItem.content = meta.description;
          changed = true;
        }
      }
    }

    if (changed) {
      const idx = this.data.items.findIndex((i) => i.id === item.id);
      if (idx !== -1) {
        this.data.items[idx] = { ...this.data.items[idx], ...enrichedItem };
        this.saveToStorage();
      }
    }

    return enrichedItem;
  }

  async createItem(userId: string, data: CreateItemDTO): Promise<Item> {
    await this.delay(200);

    // Auto-detect content type and source if URL provided
    let detectedInfo: { type: Item["type"]; source?: Item["source"] } = {
      type: data.type,
      source:
        typeof data.source === "string"
          ? (data.source as Item["source"])
          : undefined,
    };
    let thumbnail = data.thumbnail;

    if (data.url) {
      const detected = detectContentType(data.url);
      detectedInfo = {
        type: detected.type as Item["type"],
        source: detected.source as Item["source"],
      };

      // Extract YouTube thumbnail if not provided
      if (detected.source === "youtube" && !thumbnail) {
        thumbnail = extractYouTubeThumbnail(data.url);
      }
    }

    const item: Item = {
      id: this.generateId(),
      type: detectedInfo.type,
      title: data.title,
      url: data.url,
      content: data.content,
      thumbnail: thumbnail,
      listIds: data.listIds,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: data.tags || [],
      source: detectedInfo.source,
      archived: false,
      nsfw: data.nsfw,
    };

    this.data.items.push(item);
    this.saveToStorage();
    return item;
  }

  async updateItem(data: UpdateItemDTO): Promise<void> {
    await this.delay(200);
    const item = this.data.items.find((i) => i.id === data.id);
    if (!item) throw new Error("Item not found");

    Object.assign(item, {
      ...data,
      updatedAt: new Date(),
    });
    this.saveToStorage();
  }

  async deleteItem(itemId: string): Promise<void> {
    await this.delay(200);
    this.data.items = this.data.items.filter((i) => i.id !== itemId);
    this.saveToStorage();
  }

  async archiveItem(itemId: string): Promise<void> {
    await this.delay(200);
    const item = this.data.items.find((i) => i.id === itemId);
    if (item) {
      item.archived = true;
      item.updatedAt = new Date();
      this.saveToStorage();
    }
  }

  // Utility Methods (delegates to module-level functions)
  detectContentType(url: string): { type: string; source?: string } {
    return detectContentType(url);
  }
}

// Export singleton instance
export const mockStorageService = new MockStorageService();
