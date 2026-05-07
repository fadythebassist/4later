import React, { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import Masonry from "react-masonry-css";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import TopBar, { type SourceOption } from "@/components/TopBar";
import ContentCard from "@/components/ContentCard";
import FAB from "@/components/FAB";
import SettingsModal from "@/components/SettingsModal";
import { Item } from "@/types";
import "./Dashboard.css";

// Modal components are lazy-loaded so their JS only downloads when first opened.
const AddItemModal = React.lazy(() => import("@/components/AddItemModal"));
const AddListModal = React.lazy(() => import("@/components/AddListModal"));
const ItemDetailModal = React.lazy(() => import("@/components/ItemDetailModal"));
const EditItemModal = React.lazy(() => import("@/components/EditItemModal"));
const AvatarPickerModal = React.lazy(() => import("@/components/AvatarPickerModal"));

const SOURCE_LABELS: Record<string, string> = {
  twitter: "X",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  reddit: "Reddit",
  threads: "Threads",
  vimeo: "Vimeo",
  spotify: "Spotify",
  github: "GitHub",
  medium: "Medium",
  linkedin: "LinkedIn",
  anghami: "Anghami",
  pinterest: "Pinterest",
};

const Dashboard: React.FC = () => {
  const { user, signOut } = useAuth();
  const {
    lists,
    items,
    hasMoreItems,
    loadMoreItems,
    selectedListId,
    selectList,
    deleteList,
    deleteItem,
    archiveItem,
    refreshData,
  } = useData();
  const navigate = useNavigate();
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingMoreRef = useRef(false);
  const pullStartYRef = useRef<number | null>(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const [showAddItem, setShowAddItem] = useState(false);
  const [shareInitialUrl, setShareInitialUrl] = useState<string | undefined>(undefined);
  const [showAddList, setShowAddList] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const lastScrollYRef = useRef(0);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const topbarWrapperRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const isCompactRef = useRef(false);
  const accumulatedRef = useRef(0);
  const ignoreScrollUntilRef = useRef(0);

  // Dismiss mobile keyboard when the native "Search" button is tapped on the virtual keyboard.
  // The `search` event fires on <input type="search"> when the user submits via the keyboard action button.
  useEffect(() => {
    const input = searchInputRef.current;
    if (!input) return;
    const handleSearch = () => input.blur();
    input.addEventListener("search", handleSearch);
    return () => input.removeEventListener("search", handleSearch);
  }, []);

  // Scroll down: compact header + hide 3 bars. Scroll up: restore all.
  // Uses accumulation hysteresis to prevent blinking on inertial/jittery scroll.
  useEffect(() => {
    const HIDE_THRESHOLD = 40;   // px of downward scroll needed to hide
    const SHOW_THRESHOLD = 30;   // px of upward scroll needed to show
    const MIN_SCROLL_Y   = 60;   // don't hide until past this point on page
    const TOGGLE_COOLDOWN_MS = 280; // ignore scroll noise from the collapse/expand transition

    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const current = window.scrollY;
        const delta = current - lastScrollYRef.current;
        lastScrollYRef.current = current;
        ticking = false;

        if (performance.now() < ignoreScrollUntilRef.current) {
          accumulatedRef.current = 0;
          return;
        }

        if (Math.abs(delta) < 2) return;

        // Accumulate in the direction of scroll; reset if direction reverses
        if (delta > 0) {
          accumulatedRef.current = Math.max(0, accumulatedRef.current) + delta;
        } else {
          accumulatedRef.current = Math.min(0, accumulatedRef.current) + delta;
        }

        const shell = shellRef.current;
        if (!shell) return;

        if (!isCompactRef.current && accumulatedRef.current > HIDE_THRESHOLD && current > MIN_SCROLL_Y) {
          isCompactRef.current = true;
          accumulatedRef.current = 0;
          ignoreScrollUntilRef.current = performance.now() + TOGGLE_COOLDOWN_MS;
          shell.classList.add("dashboard-sticky-shell--compact");
        } else if (isCompactRef.current && accumulatedRef.current < -SHOW_THRESHOLD) {
          isCompactRef.current = false;
          accumulatedRef.current = 0;
          ignoreScrollUntilRef.current = performance.now() + TOGGLE_COOLDOWN_MS;
          shell.classList.remove("dashboard-sticky-shell--compact");
        }
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Track item count to detect when a new post is added
  const prevItemCountRef = useRef(items.length);
  const prevFirstItemIdRef = useRef<string | null>(items[0]?.id ?? null);

  // Scroll to top when a new item is added
  useEffect(() => {
    const currentFirstItemId = items[0]?.id ?? null;
    const hadNewItemPrepended =
      items.length > prevItemCountRef.current &&
      currentFirstItemId !== prevFirstItemIdRef.current;

    if (hadNewItemPrepended) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    prevItemCountRef.current = items.length;
    prevFirstItemIdRef.current = currentFirstItemId;
  }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally tracks length only; items[0] read inside is stable

  // Listen for shares from the native Android layer (warm-start path).
  // MainActivity fires a 'capacitor-share' CustomEvent when the app is already
  // running and the user shares a URL into it via the Android share sheet.
  // Also checks window.__pendingCapacitorShare on mount to catch cold-start
  // shares that fired before this listener was registered.
  useEffect(() => {
    const handleCapacitorShare = (e: Event) => {
      const detail = (e as CustomEvent<{ url: string }>).detail;
      if (detail?.url) {
        setShareInitialUrl(detail.url);
        setShowAddItem(true);
      }
    };
    window.addEventListener("capacitor-share", handleCapacitorShare);

    // Check for a pending share that was set before this listener mounted
    // (cold-start: Java sets window.__pendingCapacitorShare before/alongside the event).
    const win = window as unknown as { __pendingCapacitorShare?: { url: string } };
    if (win.__pendingCapacitorShare?.url) {
      setShareInitialUrl(win.__pendingCapacitorShare.url);
      setShowAddItem(true);
      win.__pendingCapacitorShare = undefined;
    }

    return () => window.removeEventListener("capacitor-share", handleCapacitorShare);
  }, []);

  // Collect all unique tags from items for the TopBar filter
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const item of items) {
      for (const tag of item.tags ?? []) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  }, [items]);

  // Items after applying tag + search filters (but before source filter)
  // Used as the base for source option counts so each chip shows accurate counts.
  const tagAndSearchFilteredItems = useMemo(() => {
    let result = items;
    if (selectedTags.length > 0) {
      result = result.filter((item) =>
        selectedTags.every((tag) => item.tags?.includes(tag)),
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (item) =>
          item.title?.toLowerCase().includes(q) ||
          item.url?.toLowerCase().includes(q) ||
          item.content?.toLowerCase().includes(q) ||
          item.tags?.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [items, selectedTags, searchQuery]);

  // Source filter options derived from tag+search-filtered items
  const sourceOptions = useMemo<SourceOption[]>(() => {
    const counts = new Map<string, number>();
    for (const item of tagAndSearchFilteredItems) {
      if (item.source) {
        counts.set(item.source, (counts.get(item.source) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([id, count]) => ({
        id,
        label: SOURCE_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1),
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [tagAndSearchFilteredItems]);

  // Final filtered items (all three filters combined)
  const filteredItems = useMemo(() => {
    if (!selectedSourceFilter) return tagAndSearchFilteredItems;
    return tagAndSearchFilteredItems.filter((item) => item.source === selectedSourceFilter);
  }, [tagAndSearchFilteredItems, selectedSourceFilter]);

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleClearTags = () => {
    setSelectedTags([]);
  };

  const handleSelectList = (listId: string | null) => {
    // Clicking the already-active list deselects it (back to All)
    selectList(selectedListId === listId ? null : listId);
  };

  const handleSourceFilterChange = (source: string | null) => {
    // Clicking the already-active source deselects it (back to All Sources)
    setSelectedSourceFilter(selectedSourceFilter === source ? null : source);
  };

  // Apply theme from user settings
  useEffect(() => {
    const theme = user?.settings?.theme || 'light';
    document.documentElement.setAttribute('data-theme', theme);
  }, [user?.settings?.theme]);

  // Reset avatar error state when photoURL changes (e.g. after avatar picker)
  useEffect(() => {
    setAvatarError(false);
  }, [user?.photoURL]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const handleDeleteList = async (listId: string, listName: string) => {
    try {
      await deleteList(listId);
      // If the deleted list was selected, switch to "All"
      if (selectedListId === listId) {
        selectList(null);
      }
    } catch (error) {
      console.error("Failed to delete list:", error);
      alert(`Failed to delete "${listName}". Please try again.`);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (confirm("Are you sure you want to delete this item?")) {
      await deleteItem(itemId);
    }
  };

  const handleArchiveItem = async (itemId: string) => {
    await archiveItem(itemId);
  };

  const PULL_THRESHOLD = 72; // px of drag needed to trigger refresh
  const PULL_MAX = 110;      // max visual pull distance (elastic damping beyond threshold)

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      pullStartYRef.current = e.touches[0]?.clientY ?? null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (pullStartYRef.current === null || pullRefreshing) return;
    const dy = (e.touches[0]?.clientY ?? 0) - pullStartYRef.current;
    if (dy <= 0) {
      setPullDistance(0);
      return;
    }
    // Apply rubber-band damping: full resistance before threshold, extra damping beyond
    const damped = dy < PULL_THRESHOLD
      ? dy * 0.55
      : PULL_THRESHOLD * 0.55 + (dy - PULL_THRESHOLD) * 0.2;
    setPullDistance(Math.min(damped, PULL_MAX));
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (pullStartYRef.current === null) return;
    const dy = (e.changedTouches[0]?.clientY ?? 0) - pullStartYRef.current;
    pullStartYRef.current = null;
    setPullDistance(0);
    if (dy >= PULL_THRESHOLD && !pullRefreshing) {
      navigator.vibrate?.(50);
      setPullRefreshing(true);
    }
  };

  useEffect(() => {
    if (!pullRefreshing) return;
    let cancelled = false;
    refreshData().finally(() => {
      if (!cancelled) setPullRefreshing(false);
    });
    return () => { cancelled = true; };
  }, [pullRefreshing, refreshData]);

  const isActiveFilter = selectedTags.length > 0 || searchQuery.trim() !== "" || selectedSourceFilter !== null;

  // Eagerly load all remaining pages in the background — only when viewing "All"
  // (no list selected), so list-scoped fetches aren't polluted with cross-list items.
  // This ensures source chips reflect the full dataset on first load.
  useEffect(() => {
    if (selectedListId !== null) return;
    if (!hasMoreItems) return;
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    void loadMoreItems().finally(() => {
      loadingMoreRef.current = false;
    });
  }, [hasMoreItems, loadMoreItems, selectedListId]);

  useEffect(() => {
    if (isActiveFilter || !hasMoreItems) return;

    const node = loadMoreSentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;
        if (loadingMoreRef.current) return;

        loadingMoreRef.current = true;
        void loadMoreItems().finally(() => {
          loadingMoreRef.current = false;
        });
      },
      {
        root: null,
        rootMargin: "1200px 0px",
        threshold: 0.1,
      },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [hasMoreItems, isActiveFilter, loadMoreItems]);

  useEffect(() => {
    if (!isActiveFilter || !hasMoreItems) return;
    if (loadingMoreRef.current) return;

    loadingMoreRef.current = true;
    const timer = window.setTimeout(() => {
      void loadMoreItems().finally(() => {
        loadingMoreRef.current = false;
      });
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [hasMoreItems, isActiveFilter, items.length, loadMoreItems]);

  return (
    <div
      className="dashboard"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 4 || pullRefreshing) && (
        <div
          className={`pull-refresh-indicator${pullRefreshing ? " pull-refresh-indicator--refreshing" : ""}`}
          style={!pullRefreshing ? { transform: `translateX(-50%) translateY(${pullDistance - 40}px)` } : undefined}
        >
          {pullRefreshing ? (
            <div className="pull-refresh-spinner" />
          ) : (
            <svg
              className={`pull-refresh-arrow${pullDistance >= PULL_THRESHOLD * 0.55 ? " pull-refresh-arrow--ready" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </div>
      )}
      {/* Sticky shell: header + topbar slide together, topbar hides on scroll-down */}
      <div ref={shellRef} className="dashboard-sticky-shell">
      {/* Header */}
      <header className="dashboard-header glass">
        <div className="header-content">
          <h1 className="dashboard-logo">4Stash</h1>
          <div className="header-actions">
            <div className="user-info">
              <button
                className="avatar-button"
                onClick={() => setShowAvatarPicker(true)}
                title="Change avatar"
              >
                {user?.photoURL && !avatarError ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "User"}
                    className="user-avatar"
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <div className="user-avatar-placeholder">
                    {user?.displayName?.[0] || user?.email?.[0] || "U"}
                  </div>
                )}
              </button>
              <span className="user-name">
                {user?.displayName || user?.email}
              </span>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="btn-icon header-settings-btn"
              title="Settings"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v6m0 6v6m-9-9h6m6 0h6" />
                <path d="m4.93 4.93 4.24 4.24m5.66 5.66 4.24 4.24M19.07 4.93l-4.24 4.24M9.17 14.83l-4.24 4.24" />
              </svg>
            </button>
            <div className="header-search header-search-inline">
              <input
                type="search"
                className="header-search-input"
                ref={searchInputRef}
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setSearchQuery("");
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                aria-label="Search saved items"
              />
              {searchQuery && (
                <button
                  className="header-search-clear"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
            <button
              onClick={handleSignOut}
              className="btn-icon header-logout-btn"
              title="Sign out"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Top Bar with Lists */}
      <div ref={topbarWrapperRef} className="topbar-wrapper">
      <TopBar
        lists={lists}
        selectedListId={selectedListId}
        availableTags={availableTags}
        selectedTags={selectedTags}
        sourceOptions={sourceOptions}
        selectedSourceFilter={selectedSourceFilter}
        onSelectList={handleSelectList}
        onToggleTag={handleToggleTag}
        onClearTags={handleClearTags}
        onSourceFilterChange={handleSourceFilterChange}
        onAddList={() => setShowAddList(true)}
        onDeleteList={handleDeleteList}
      />
      </div>
      </div> {/* end dashboard-sticky-shell */}

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="container">
          {filteredItems.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon-wrapper">
                <div className="empty-icon">📭</div>
              </div>
              <h2>No items yet</h2>
              <p>
                {selectedListId
                  ? "This list is empty. Add your first item!"
                  : "Start saving content by clicking the + button"}
              </p>
              <button
                className="empty-cta"
                onClick={() => setShowAddItem(true)}
              >
                Save your first item
              </button>
            </div>
          ) : user?.settings?.layoutMode === 'list' ? (
            <div
              className={`content-grid ${user?.settings?.viewDensity || 'comfortable'} layout-list`}
            >
              {filteredItems.map((item) => (
                <ContentCard
                  key={item.id}
                  item={item}
                  onDelete={() => handleDeleteItem(item.id)}
                  onArchive={() => handleArchiveItem(item.id)}
                  onClick={() => setSelectedItem(item)}
                  layoutMode="list"
                />
              ))}
            </div>
          ) : (
            <Masonry
              breakpointCols={{ default: 5, 1800: 5, 1400: 4, 1024: 3, 768: 2, 640: 1 }}
              className={`content-grid masonry-grid ${user?.settings?.viewDensity || 'comfortable'}`}
              columnClassName="masonry-grid-column"
            >
              {filteredItems.map((item) => (
                <ContentCard
                  key={item.id}
                  item={item}
                  onDelete={() => handleDeleteItem(item.id)}
                  onArchive={() => handleArchiveItem(item.id)}
                  onClick={() => setSelectedItem(item)}
                  layoutMode="grid"
                />
              ))}
            </Masonry>
          )}

          {!isActiveFilter && hasMoreItems && (
            <div className="load-more-sentinel" ref={loadMoreSentinelRef}>
              Loading more...
            </div>
          )}

          {isActiveFilter && hasMoreItems && (
            <div className="load-more-sentinel">
              Searching all items...
            </div>
          )}
        </div>
      </main>

      {/* FAB */}
      <FAB onClick={() => setShowAddItem(true)} />

      {/* Modals — inside Suspense; lazy chunks only download when first opened */}
      <Suspense fallback={null}>
      {showAddItem && (
        <AddItemModal
          onClose={() => { setShowAddItem(false); setShareInitialUrl(undefined); }}
          onAddList={() => setShowAddList(true)}
          initialUrl={shareInitialUrl}
        />
      )}

      {showAddList && <AddListModal onClose={() => setShowAddList(false)} />}

      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDelete={() => {
            handleDeleteItem(selectedItem.id);
            setSelectedItem(null);
          }}
          onEdit={() => {
            setEditingItem(selectedItem);
            setSelectedItem(null);
          }}
        />
      )}

      {editingItem && (
        <EditItemModal
          item={editingItem}
          lists={lists}
          onClose={() => setEditingItem(null)}
          onSave={() => {
            setEditingItem(null);
          }}
        />
      )}

      {showAvatarPicker && (
        <AvatarPickerModal onClose={() => setShowAvatarPicker(false)} />
      )}

      {showSettings && (
        <SettingsModal 
          isOpen={showSettings}
          onClose={() => setShowSettings(false)} 
        />
      )}
      </Suspense>
    </div>
  );
};

export default Dashboard;
