import { getApp, getApps, initializeApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  Auth,
  signInWithPopup,
  GoogleAuthProvider,
  TwitterAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  type UserCredential,
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import {
  nativeSignInWithGoogle,
  nativeSignInWithTwitter,
} from "./NativeAuthService";
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as limitTo,
  startAfter,
  increment,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
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

// Helper Functions (Module-level for reusability)
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
      return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
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

// When running inside Capacitor with server.url = "https://4stash.com", the
// WebView origin is 4stash.com.  Firebase Auth's JS SDK opens an internal
// /__/auth/iframe for session persistence — if authDomain points to the default
// firebaseapp.com subdomain, this becomes a cross-origin iframe inside the
// WebView, which Android renders as a blank white page after Google sign-in.
// Overriding authDomain to "4stash.com" makes the iframe same-origin (Firebase
// Hosting automatically serves /__/auth/ on any connected custom domain).
// On the web PWA the page also loads from 4stash.com, so the override is safe
// there too — this effectively makes 4stash.com the canonical auth domain.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "4stash.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Validate Firebase configuration
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error(
    "❌ Firebase configuration is missing! Please add Firebase credentials to your .env file.",
  );
  console.error("Required env variables:");
  console.error("  - VITE_FIREBASE_API_KEY");
  console.error("  - VITE_FIREBASE_PROJECT_ID");
  console.error("  - VITE_FIREBASE_STORAGE_BUCKET");
  console.error("  - VITE_FIREBASE_MESSAGING_SENDER_ID");
  console.error("  - VITE_FIREBASE_APP_ID");
}

/**
 * FirebaseStorageService - Production storage implementation
 * To use this instead of MockStorageService:
 * 1. Add your Firebase config above
 * 2. In AuthContext.tsx and DataContext.tsx, change the import:
 *    from: import { mockStorageService } from '@/services/MockStorageService';
 *    to: import { firebaseStorageService } from '@/services/FirebaseStorageService';
 * 3. Change: const storageService: StorageService = mockStorageService;
 *    to: const storageService: StorageService = firebaseStorageService;
 */
export class FirebaseStorageService implements StorageService {
  private app: FirebaseApp;
  private auth: Auth;
  private db: Firestore;
  private googleProvider: GoogleAuthProvider;
  private twitterProvider: TwitterAuthProvider;

  constructor() {
    this.app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    this.auth = getAuth(this.app);
    this.db = getFirestore(this.app);
    this.googleProvider = new GoogleAuthProvider();
    this.twitterProvider = new TwitterAuthProvider();
  }

  // Helper Methods
  private async getUserPreferences(
    userId: string,
  ): Promise<{ avatarStyle?: string; settings?: AppSettings }> {
    try {
      const userDoc = await getDoc(doc(this.db, "users", userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          avatarStyle: data.avatarStyle,
          settings: data.settings,
        };
      }
    } catch (error) {
      console.error("Failed to get user preferences:", error);
    }
    return {};
  }

  private generateDiceBearUrl(
    userId: string,
    style: string = "lorelei",
  ): string {
    return `https://api.dicebear.com/7.x/${style}/png?seed=${userId}&size=64`;
  }

  // Authentication Methods

  /**
   * Shared helper: given a Firebase UserCredential (from popup or native SDK),
   * build the app User object, create default lists for new users, and return.
   */
  private async buildUserFromCredential(
    result: UserCredential,
    provider: "google" | "twitter",
  ): Promise<User> {
    const firebaseUser = result.user;
    const prefs = await this.getUserPreferences(firebaseUser.uid);

    const photoURL = prefs.avatarStyle
      ? this.generateDiceBearUrl(firebaseUser.uid, prefs.avatarStyle)
      : firebaseUser.photoURL ||
        this.generateDiceBearUrl(firebaseUser.uid, "lorelei");

    const user: User = {
      id: firebaseUser.uid,
      email:
        firebaseUser.email ||
        (provider === "twitter"
          ? `${firebaseUser.uid}@twitter.placeholder`
          : firebaseUser.email!),
      displayName: firebaseUser.displayName || undefined,
      photoURL,
      avatarStyle: prefs.avatarStyle,
      settings: prefs.settings,
      createdAt: new Date(firebaseUser.metadata.creationTime!),
      provider,
    };

    // Create default lists for new users
    const listsSnapshot = await getDocs(
      query(collection(this.db, "lists"), where("userId", "==", user.id)),
    );
    if (listsSnapshot.empty) {
      await this.createList(user.id, { name: "Quick Bin", icon: "📥" });
      await this.createList(user.id, { name: "Favorites", icon: "⭐" });
    }

    return user;
  }

  async signInWithGoogle(): Promise<User> {
    console.log("🔐 Starting Google sign-in...");
    try {
      // On Android/iOS use the native Google Sign-In SDK to avoid WebView
      // popup limitations.  On web keep the standard popup flow.
      const result = Capacitor.isNativePlatform()
        ? await nativeSignInWithGoogle()
        : await signInWithPopup(this.auth, this.googleProvider);

      console.log("✅ Google authentication successful");
      return this.buildUserFromCredential(result, "google");
    } catch (error) {
      console.error("❌ Error during Google sign-in:", error);
      throw error;
    }
  }

  async signInWithTwitter(): Promise<User> {
    try {
      const result = Capacitor.isNativePlatform()
        ? await nativeSignInWithTwitter()
        : await signInWithPopup(this.auth, this.twitterProvider);

      return this.buildUserFromCredential(result, "twitter");
    } catch (error) {
      console.error("❌ Error during Twitter sign-in:", error);
      throw error;
    }
  }

  async signInWithEmail(email: string, password: string): Promise<User> {
    const result = await signInWithEmailAndPassword(this.auth, email, password);
    const firebaseUser = result.user;

    // Get user preferences (avatar style)
    const prefs = await this.getUserPreferences(firebaseUser.uid);

    // If user has chosen a DiceBear style, use that; otherwise use default
    const photoURL = prefs.avatarStyle
      ? this.generateDiceBearUrl(firebaseUser.uid, prefs.avatarStyle)
      : firebaseUser.photoURL ||
        this.generateDiceBearUrl(firebaseUser.uid, "lorelei");

    return {
      id: firebaseUser.uid,
      email: firebaseUser.email!,
      displayName: firebaseUser.displayName || undefined,
      photoURL,
      settings: prefs.settings,
      avatarStyle: prefs.avatarStyle,
      createdAt: new Date(firebaseUser.metadata.creationTime!),
      provider: "email",
    };
  }

  async signUpWithEmail(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<User> {
    const result = await createUserWithEmailAndPassword(
      this.auth,
      email,
      password,
    );
    const firebaseUser = result.user;

    if (displayName) {
      await updateProfile(firebaseUser, { displayName });
    }

    const user: User = {
      id: firebaseUser.uid,
      email: firebaseUser.email!,
      displayName: displayName,
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
      photoURL: this.generateDiceBearUrl(firebaseUser.uid, "lorelei"),
      avatarStyle: "lorelei",
      createdAt: new Date(),
      provider: "email",
    };

    // Create default lists
    await this.createList(user.id, { name: "Quick Bin", icon: "📥" });
    await this.createList(user.id, { name: "Favorites", icon: "⭐" });

    return user;
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(this.auth);
  }

  async getCurrentUser(): Promise<User | null> {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(
        this.auth,
        async (firebaseUser) => {
          unsubscribe();
          if (firebaseUser) {
            const prefs = await this.getUserPreferences(firebaseUser.uid);

            // If user has chosen a DiceBear style, use that; otherwise use social photo or default
            const photoURL = prefs.avatarStyle
              ? this.generateDiceBearUrl(firebaseUser.uid, prefs.avatarStyle)
              : firebaseUser.photoURL ||
                this.generateDiceBearUrl(firebaseUser.uid, "lorelei");

            const user: User = {
              id: firebaseUser.uid,
              email: firebaseUser.email!,
              displayName: firebaseUser.displayName || undefined,
              photoURL,
              avatarStyle: prefs.avatarStyle,
              settings: prefs.settings,
              createdAt: new Date(firebaseUser.metadata.creationTime!),
              provider:
                firebaseUser.providerData[0]?.providerId === "google.com"
                  ? ("google" as const)
                  : ("email" as const),
            };
            console.log("👤 Current user:", user);
            resolve(user);
          } else {
            console.log("👤 No user authenticated");
            resolve(null);
          }
        },
      );
    });
  }

  async updateAvatarStyle(userId: string, style: string): Promise<void> {
    try {
      await setDoc(
        doc(this.db, "users", userId),
        { avatarStyle: style },
        { merge: true },
      );
      console.log(`✅ Avatar style updated to: ${style}`);
    } catch (error: unknown) {
      console.error("❌ Failed to update avatar style:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to update avatar style";
      throw new Error(errorMessage);
    }
  }

  async updateUserSettings(userId: string, settings: AppSettings): Promise<void> {
    try {
      await setDoc(
        doc(this.db, "users", userId),
        { settings },
        { merge: true },
      );
      console.log(`✅ User settings updated:`, settings);
    } catch (error: unknown) {
      console.error("❌ Failed to update user settings:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to update user settings";
      throw new Error(errorMessage);
    }
  }

  // Lists Methods
  async getLists(userId: string): Promise<List[]> {
    console.log("📋 getLists called for userId:", userId);

    try {
      const q = query(
        collection(this.db, "lists"),
        where("userId", "==", userId),
        orderBy("createdAt", "asc"),
      );

      const snapshot = await getDocs(q);
      console.log(`📊 Found ${snapshot.size} lists in Firestore`);

      const lists = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate(),
      })) as List[];

      let hasMissingCounts = false;
      for (const list of lists) {
        if (typeof list.itemCount !== "number") {
          hasMissingCounts = true;
          list.itemCount = 0;
        }
      }

      if (hasMissingCounts) {
        const itemsQuery = query(
          collection(this.db, "items"),
          where("userId", "==", userId),
          where("archived", "==", false),
        );
        const itemsSnapshot = await getDocs(itemsQuery);
        const counts = new Map<string, number>();
        for (const itemDoc of itemsSnapshot.docs) {
          const listIds = itemDoc.data().listIds as string[] | undefined;
          if (!Array.isArray(listIds)) continue;
          for (const listId of listIds) {
            counts.set(listId, (counts.get(listId) ?? 0) + 1);
          }
        }

        await Promise.all(
          lists.map(async (list) => {
            const count = counts.get(list.id) ?? 0;
            list.itemCount = count;
            await updateDoc(doc(this.db, "lists", list.id), {
              itemCount: count,
              updatedAt: serverTimestamp(),
            });
          }),
        );
      }

      console.log("✅ Returning lists:", lists);
      return lists;
    } catch (error) {
      console.error("❌ Error in getLists:", error);
      throw error;
    }
  }

  async getList(listId: string): Promise<List | null> {
    const docRef = doc(this.db, "lists", listId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
    } as List;
  }

  async createList(userId: string, data: CreateListDTO): Promise<List> {
    console.log("📝 Creating list:", { userId, data });

    try {
      // Build listData, only including defined fields (Firestore doesn't accept undefined)
      const listData: Record<string, unknown> = {
        name: data.name,
        userId,
        itemCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Only add optional fields if they're defined
      if (data.color !== undefined) {
        listData.color = data.color;
      }
      if (data.icon !== undefined) {
        listData.icon = data.icon;
      }

      console.log("📤 Sending to Firestore:", listData);
      const docRef = await addDoc(collection(this.db, "lists"), listData);
      console.log("✅ Document created with ID:", docRef.id);

      const docSnap = await getDoc(docRef);
      const savedData = docSnap.data()!;

      const newList = {
        id: docRef.id,
        ...savedData,
        createdAt: savedData.createdAt.toDate(),
        updatedAt: savedData.updatedAt.toDate(),
      } as List;

      console.log("✅ List created successfully:", newList);
      return newList;
    } catch (error) {
      console.error("❌ Error creating list:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error code:", (error as unknown as { code?: string }).code);
      }
      throw error;
    }
  }

  async updateList(data: UpdateListDTO): Promise<void> {
    const docRef = doc(this.db, "lists", data.id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }

  async deleteList(listId: string, userId: string): Promise<void> {
    console.log("🗑️ deleteList called:", { listId, userId });

    try {
      // Find all items that include this listId
      const itemsQuery = query(
        collection(this.db, "items"),
        where("userId", "==", userId),
        where("listIds", "array-contains", listId),
      );
      const itemsSnapshot = await getDocs(itemsQuery);
      console.log(`🗑️ Processing ${itemsSnapshot.size} items from list...`);

      const updateOrDeletePromises = itemsSnapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        const remainingListIds = (data.listIds as string[]).filter(
          (id) => id !== listId,
        );
        if (remainingListIds.length === 0) {
          // Item only belonged to this list — delete it
          return deleteDoc(docSnap.ref);
        } else {
          // Item belongs to other lists too — just remove this listId
          return updateDoc(docSnap.ref, { listIds: remainingListIds });
        }
      });
      await Promise.all(updateOrDeletePromises);
      console.log("✅ All items processed");

      // Then delete the list itself
      await deleteDoc(doc(this.db, "lists", listId));
      console.log("✅ List deleted successfully");
    } catch (error) {
      console.error("❌ Error in deleteList:", error);
      throw error;
    }
  }

  // Items Methods
  async getItems(
    userId: string,
    listId?: string,
    options?: { limit?: number; cursorDate?: Date | null },
  ): Promise<{ items: Item[]; hasMore: boolean; nextCursorDate: Date | null }> {
    const pageLimit = options?.limit ?? 20;
    let q = query(
      collection(this.db, "items"),
      where("userId", "==", userId),
      where("archived", "==", false),
      orderBy("createdAt", "desc"),
      limitTo(pageLimit + 1),
    );

    if (listId) {
      q = query(
        collection(this.db, "items"),
        where("userId", "==", userId),
        where("listIds", "array-contains", listId),
        where("archived", "==", false),
        orderBy("createdAt", "desc"),
        limitTo(pageLimit + 1),
      );
    }

    if (options?.cursorDate) {
      q = query(q, startAfter(Timestamp.fromDate(options.cursorDate)));
    }

    const snapshot = await getDocs(q);
    const docs = snapshot.docs;
    const hasMore = docs.length > pageLimit;
    const pageDocs = hasMore ? docs.slice(0, pageLimit) : docs;
    const items = pageDocs.map((doc) => {
      const data = doc.data();
      const item = {
        id: doc.id,
        ...data,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
      } as Item;
      // Re-detect source for items stored as "other" — covers platforms added
      // after initial save (Vimeo, Spotify, GitHub, Medium, LinkedIn, etc.)
      if ((item.source === "other" || !item.source) && item.url) {
        const detected = detectContentType(item.url);
        if (detected.source && detected.source !== "other") {
          item.source = detected.source as Item["source"];
        }
      }
      return item;
    }) as Item[];
    const nextCursorDate = items.length > 0 ? items[items.length - 1].createdAt : null;

    return {
      items,
      hasMore,
      nextCursorDate,
    };
  }

  async getItem(itemId: string): Promise<Item | null> {
    const docRef = doc(this.db, "items", itemId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
    } as Item;
  }

  async createItem(userId: string, data: CreateItemDTO): Promise<Item> {
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

    // Build itemData, only including defined fields (Firestore doesn't accept undefined)
    const itemData: Record<string, unknown> = {
      type: detectedInfo.type,
      title: data.title,
      listIds: data.listIds,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      tags: data.tags || [],
      archived: false,
    };

    // Only add optional fields if they're defined
    if (data.url !== undefined) {
      itemData.url = data.url;
    }
    if (data.content !== undefined) {
      itemData.content = data.content;
    }
    if (thumbnail !== undefined) {
      itemData.thumbnail = thumbnail;
    }
    if (detectedInfo.source !== undefined) {
      itemData.source = detectedInfo.source;
    }
    if (data.nsfw === true) {
      itemData.nsfw = true;
    }

    const docRef = await addDoc(collection(this.db, "items"), itemData);
    const docSnap = await getDoc(docRef);
    const savedData = docSnap.data()!;

    await Promise.all(
      data.listIds.map(async (listId) => {
        await updateDoc(doc(this.db, "lists", listId), {
          itemCount: increment(1),
          updatedAt: serverTimestamp(),
        });
      }),
    );

    return {
      id: docRef.id,
      ...savedData,
      createdAt: savedData.createdAt.toDate(),
      updatedAt: savedData.updatedAt.toDate(),
    } as Item;
  }

  async updateItem(data: UpdateItemDTO): Promise<void> {
    const docRef = doc(this.db, "items", data.id);
    const existingSnap = await getDoc(docRef);
    const existing = existingSnap.exists() ? existingSnap.data() : null;

    const prevListIds = Array.isArray(existing?.listIds)
      ? (existing.listIds as string[])
      : [];
    const nextListIds = Array.isArray(data.listIds)
      ? data.listIds
      : prevListIds;
    const toIncrement: string[] = [];
    const toDecrement: string[] = [];
    const isArchived = existing?.archived === true;
    if (!isArchived) {
      for (const listId of nextListIds) {
        if (!prevListIds.includes(listId)) {
          toIncrement.push(listId);
        }
      }
      for (const listId of prevListIds) {
        if (!nextListIds.includes(listId)) {
          toDecrement.push(listId);
        }
      }
    }

    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });

    await Promise.all([
      ...toIncrement.map(async (listId) =>
        updateDoc(doc(this.db, "lists", listId), {
          itemCount: increment(1),
          updatedAt: serverTimestamp(),
        }),
      ),
      ...toDecrement.map(async (listId) =>
        updateDoc(doc(this.db, "lists", listId), {
          itemCount: increment(-1),
          updatedAt: serverTimestamp(),
        }),
      ),
    ]);
  }

  async deleteItem(itemId: string): Promise<void> {
    const docRef = doc(this.db, "items", itemId);
    const existingSnap = await getDoc(docRef);
    if (existingSnap.exists()) {
      const existing = existingSnap.data();
      const listIds = Array.isArray(existing.listIds)
        ? (existing.listIds as string[])
        : [];
      const archived = existing.archived === true;
      if (!archived && listIds.length > 0) {
        await Promise.all(
          listIds.map(async (listId) =>
            updateDoc(doc(this.db, "lists", listId), {
              itemCount: increment(-1),
              updatedAt: serverTimestamp(),
            }),
          ),
        );
      }
    }
    await deleteDoc(doc(this.db, "items", itemId));
  }

  async archiveItem(itemId: string): Promise<void> {
    const docRef = doc(this.db, "items", itemId);
    const existingSnap = await getDoc(docRef);
    if (existingSnap.exists()) {
      const existing = existingSnap.data();
      if (existing.archived !== true) {
        const listIds = Array.isArray(existing.listIds)
          ? (existing.listIds as string[])
          : [];
        await Promise.all(
          listIds.map(async (listId) =>
            updateDoc(doc(this.db, "lists", listId), {
              itemCount: increment(-1),
              updatedAt: serverTimestamp(),
            }),
          ),
        );
      }
    }
    await updateDoc(docRef, {
      archived: true,
      updatedAt: serverTimestamp(),
    });
  }

  // Utility Methods (delegates to module-level functions)
  detectContentType(url: string): { type: string; source?: string } {
    return detectContentType(url);
  }
}

// Export singleton instance
export const firebaseStorageService = new FirebaseStorageService();
