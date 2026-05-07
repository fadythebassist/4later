import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from "react";
import {
  Item,
  List,
  CreateItemDTO,
  UpdateItemDTO,
  CreateListDTO,
  UpdateListDTO,
} from "@/types";
import { StorageService } from "@/services/StorageService";
import { firebaseStorageService } from "@/services/FirebaseStorageService";
import { mockStorageService } from "@/services/MockStorageService";
import { useAuth } from "./AuthContext";

interface DataContextType {
  lists: List[];
  items: Item[];
  selectedListId: string | null;
  loading: boolean;
  error: string | null;

  // List operations
  selectList: (listId: string | null) => void;
  createList: (data: CreateListDTO) => Promise<List>;
  updateList: (data: UpdateListDTO) => Promise<void>;
  deleteList: (listId: string) => Promise<void>;

  // Item operations
  createItem: (data: CreateItemDTO) => Promise<Item>;
  updateItem: (data: UpdateItemDTO) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  archiveItem: (itemId: string) => Promise<void>;

  // User operations
  updateAvatarStyle: (style: string) => Promise<void>;

  // Refresh data
  refreshData: (listId?: string | null) => Promise<void>;
  hasMoreItems: boolean;
  loadMoreItems: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Service instance — swap to mock when VITE_USE_MOCK is set (e.g. in Playwright tests)
const storageService: StorageService =
  import.meta.env.VITE_USE_MOCK === "true"
    ? mockStorageService
    : firebaseStorageService;

interface DataProviderProps {
  children: ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const { user, refreshUser } = useAuth();
  const [lists, setLists] = useState<List[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMoreItems, setHasMoreItems] = useState(false);
  const [cursorDate, setCursorDate] = useState<Date | null>(null);

  const PAGE_LIMIT = 20;

  // Use a ref so refreshData always reads the latest selectedListId
  // without needing to be re-created when it changes.
  const selectedListIdRef = useRef(selectedListId);
  useEffect(() => {
    selectedListIdRef.current = selectedListId;
  }, [selectedListId]);

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const refreshData = useCallback(async (listId?: string | null) => {
    const currentUser = userRef.current;
    // If listId is explicitly passed, use it; otherwise fall back to the ref
    const effectiveListId = listId !== undefined ? listId : selectedListIdRef.current;
    console.log("🔄 refreshData called, user:", currentUser, "listId:", effectiveListId);

    if (!currentUser) {
      console.log("⚠️ No user, clearing lists and items");
      setLists([]);
      setItems([]);
      setHasMoreItems(false);
      setCursorDate(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      console.log("📡 Fetching lists and items for user:", currentUser.id);
      const listsPromise = storageService.getLists(currentUser.id);
      const itemsPromise = storageService.getItems(
        currentUser.id,
        effectiveListId || undefined,
        { limit: PAGE_LIMIT },
      );

      const fetchedLists = await listsPromise;
      console.log("✅ Fetched lists:", fetchedLists);
      setLists(fetchedLists);

      const fetchedPage = await itemsPromise;
      console.log("✅ Fetched items:", fetchedPage.items);
      setItems(fetchedPage.items);
      setHasMoreItems(fetchedPage.hasMore);
      setCursorDate(fetchedPage.nextCursorDate);
    } catch (err) {
      console.error("❌ Error in refreshData:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []); // stable — reads user via ref; listId passed explicitly or read from ref

  const loadMoreItems = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser || !hasMoreItems || !cursorDate) return;

    setLoading(true);
    setError(null);
    try {
      const nextPage = await storageService.getItems(
        currentUser.id,
        selectedListIdRef.current || undefined,
        { limit: PAGE_LIMIT, cursorDate },
      );
      setItems((prev) => [...prev, ...nextPage.items]);
      setHasMoreItems(nextPage.hasMore);
      setCursorDate(nextPage.nextCursorDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more items");
      throw err;
    } finally {
      setLoading(false);
    }
  }, [cursorDate, hasMoreItems]);

  useEffect(() => {
    refreshData();
  }, [user, refreshData]); // selectedListId removed — selectList calls refreshData directly

  const selectList = useCallback((listId: string | null) => {
    // Update ref synchronously so loadMoreItems reads the correct value immediately
    selectedListIdRef.current = listId;
    setSelectedListId(listId);
    // Pass listId explicitly to avoid the ref-vs-state race condition
    void refreshData(listId);
  }, [refreshData]);

  const createList = useCallback(async (data: CreateListDTO): Promise<List> => {
    const currentUser = userRef.current;
    console.log("📋 DataContext.createList called", { data, user: currentUser });

    if (!currentUser) {
      console.error("❌ No user logged in");
      throw new Error("No user logged in");
    }

    setError(null);
    try {
      console.log("📤 Calling storageService.createList with userId:", currentUser.id);
      const newList = await storageService.createList(currentUser.id, data);
      setLists((prev) => [...prev, newList]);
      return newList;
    } catch (err) {
      console.error("❌ Error in DataContext.createList:", err);
      const errorMsg =
        err instanceof Error ? err.message : "Failed to create list";
      setError(errorMsg);
      throw err;
    }
  }, []);

  const updateList = useCallback(async (data: UpdateListDTO): Promise<void> => {
    setError(null);
    try {
      await storageService.updateList(data);
      setLists((prev) =>
        prev.map((list) =>
          list.id === data.id
            ? {
                ...list,
                ...data,
                updatedAt: new Date(),
              }
            : list,
        ),
      );
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to update list";
      setError(errorMsg);
      throw err;
    }
  }, []);

  const createItem = useCallback(async (data: CreateItemDTO): Promise<Item> => {
    const currentUser = userRef.current;
    if (!currentUser) throw new Error("No user logged in");

    setError(null);
    try {
      const newItem = await storageService.createItem(currentUser.id, data);
      setItems((prev) => {
        const selected = selectedListIdRef.current;
        if (selected && !newItem.listIds.includes(selected)) return prev;
        return [newItem, ...prev];
      });
      setLists((prev) =>
        prev.map((list) =>
          newItem.listIds.includes(list.id)
            ? { ...list, itemCount: (list.itemCount ?? 0) + 1 }
            : list,
        ),
      );
      return newItem;
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to create item";
      setError(errorMsg);
      throw err;
    }
  }, []);

  const updateItem = useCallback(async (data: UpdateItemDTO): Promise<void> => {
    setError(null);
    try {
      const current = items.find((item) => item.id === data.id);
      await storageService.updateItem(data);

      setItems((prev) =>
        prev
          .map((item) =>
            item.id === data.id
              ? {
                  ...item,
                  ...data,
                  updatedAt: new Date(),
                }
              : item,
          )
          .filter((item) => {
            const selected = selectedListIdRef.current;
            if (!selected) return true;
            return item.listIds.includes(selected);
          }),
      );

      if (current && Array.isArray(data.listIds)) {
        const prevIds = current.listIds;
        const nextIds = data.listIds;
        setLists((prev) =>
          prev.map((list) => {
            const wasIn = prevIds.includes(list.id);
            const isIn = nextIds.includes(list.id);
            if (wasIn === isIn) return list;
            return {
              ...list,
              itemCount: (list.itemCount ?? 0) + (isIn ? 1 : -1),
            };
          }),
        );
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to update item";
      setError(errorMsg);
      throw err;
    }
  }, [items]);

  const deleteItem = useCallback(async (itemId: string): Promise<void> => {
    setError(null);
    try {
      const target = items.find((item) => item.id === itemId);
      await storageService.deleteItem(itemId);
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      if (target) {
        setLists((prev) =>
          prev.map((list) =>
            target.listIds.includes(list.id)
              ? { ...list, itemCount: Math.max(0, (list.itemCount ?? 0) - 1) }
              : list,
          ),
        );
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to delete item";
      setError(errorMsg);
      throw err;
    }
  }, [items]);

  const deleteList = useCallback(async (listId: string): Promise<void> => {
    const currentUser = userRef.current;
    console.log("🗑️ DataContext.deleteList called", { listId, user: currentUser });

    if (!currentUser) {
      console.error("❌ No user logged in");
      throw new Error("No user logged in");
    }

    setError(null);
    try {
      console.log("📤 Calling storageService.deleteList with userId:", currentUser.id);
      await storageService.deleteList(listId, currentUser.id);
      setLists((prev) => prev.filter((list) => list.id !== listId));
      setItems((prev) =>
        prev
          .map((item) => ({
            ...item,
            listIds: item.listIds.filter((id) => id !== listId),
          }))
          .filter((item) => item.listIds.length > 0),
      );
    } catch (err) {
      console.error("❌ Error in DataContext.deleteList:", err);
      const errorMsg =
        err instanceof Error ? err.message : "Failed to delete list";
      setError(errorMsg);
      throw err;
    }
  }, []);

  const archiveItem = useCallback(async (itemId: string): Promise<void> => {
    setError(null);
    try {
      const target = items.find((item) => item.id === itemId);
      await storageService.archiveItem(itemId);

      // Haptic feedback if available
      if ("vibrate" in navigator) {
        navigator.vibrate(50);
      }

      setItems((prev) => prev.filter((item) => item.id !== itemId));
      if (target) {
        setLists((prev) =>
          prev.map((list) =>
            target.listIds.includes(list.id)
              ? { ...list, itemCount: Math.max(0, (list.itemCount ?? 0) - 1) }
              : list,
          ),
        );
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to archive item";
      setError(errorMsg);
      throw err;
    }
  }, [items]);

  const updateAvatarStyle = useCallback(async (style: string): Promise<void> => {
    const currentUser = userRef.current;
    setError(null);
    if (!currentUser) {
      throw new Error("No user logged in");
    }
    try {
      console.log(`🎨 Updating avatar style to: ${style}`);
      await storageService.updateAvatarStyle(currentUser.id, style);
      console.log("✅ Avatar style updated successfully");
      await refreshUser();
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to update avatar style";
      console.error("❌ Failed to update avatar style:", errorMsg);
      setError(errorMsg);
      throw err;
    }
  }, [refreshUser]);

  const contextValue = useMemo(() => ({
    lists,
    items,
    selectedListId,
    loading,
    error,
    selectList,
    createList,
    updateList,
    deleteList,
    createItem,
    updateItem,
    deleteItem,
    archiveItem,
    updateAvatarStyle,
    refreshData,
    hasMoreItems,
    loadMoreItems,
  }), [
    lists,
    items,
    selectedListId,
    loading,
    error,
    selectList,
    createList,
    updateList,
    deleteList,
    createItem,
    updateItem,
    deleteItem,
    archiveItem,
    updateAvatarStyle,
    refreshData,
    hasMoreItems,
    loadMoreItems,
  ]);

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
};
