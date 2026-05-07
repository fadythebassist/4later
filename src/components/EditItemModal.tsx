import React, { useState } from "react";
import { Item, List } from "@/types";
import { useData } from "@/contexts/DataContext";
import { categorizeContent } from "@/services/AutoCategorizationService";
import HashtagInput from "@/components/HashtagInput";
import "./Modal.css";

interface EditItemModalProps {
  item: Item;
  lists: List[];
  onClose: () => void;
  onSave: () => void;
}

const EditItemModal: React.FC<EditItemModalProps> = ({
  item,
  lists,
  onClose,
  onSave,
}) => {
  const { updateItem } = useData();
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content || "");
  const [listIds, setListIds] = useState<string[]>(item.listIds);
  const [tags, setTags] = useState<string[]>(item.tags || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestedTags = categorizeContent({
    title,
    content,
    url: item.url,
    source: item.source,
  }).tags.filter((tag) => !tags.includes(tag));

  const handleAddSuggestedTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
  };

  const addedToLists = lists.filter(
    (l) => listIds.includes(l.id) && !item.listIds.includes(l.id),
  );
  const removedFromLists = lists.filter(
    (l) => !listIds.includes(l.id) && item.listIds.includes(l.id),
  );
  const isChangingLists = addedToLists.length > 0 || removedFromLists.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await updateItem({
        id: item.id,
        title: title.trim() || item.title,
        content: content.trim() || undefined,
        listIds,
        tags,
      });
      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content slide-in-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Edit Item</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="title">Title</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Item title"
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="content">Notes</label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add any notes or description..."
              rows={4}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Tags</label>
            <HashtagInput
              tags={tags}
              onChange={setTags}
              placeholder="Add or remove tags..."
              maxTags={10}
            />
            {suggestedTags.length > 0 && (
              <div className="auto-category-panel">
                <div className="auto-category-title">Suggested tags</div>
                <div className="auto-category-tags">
                  {suggestedTags.slice(0, 8).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="auto-category-tag auto-category-tag-button"
                      onClick={() => handleAddSuggestedTag(tag)}
                    >
                      + #{tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>
              Lists
              {isChangingLists && (
                <span
                  style={{
                    color: "var(--accent-primary)",
                    marginLeft: "0.5rem",
                    fontSize: "0.85rem",
                  }}
                >
                  (modified)
                </span>
              )}
            </label>
            <div className="list-picker">
              {lists.map((list) => {
                const checked = listIds.includes(list.id);
                return (
                  <label
                    key={list.id}
                    className={`list-picker-item${checked ? " selected" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={loading}
                      onChange={() => {
                        setListIds((prev) =>
                          prev.includes(list.id)
                            ? prev.filter((id) => id !== list.id)
                            : [...prev, list.id],
                        );
                      }}
                    />
                    <span className="list-picker-icon">{list.icon}</span>
                    <span className="list-picker-name">{list.name}</span>
                  </label>
                );
              })}
            </div>
            {isChangingLists && (
              <div
                style={{
                  marginTop: "0.5rem",
                  padding: "0.75rem",
                  background: "var(--bg-tertiary)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.875rem",
                  color: "var(--text-secondary)",
                }}
              >
                {addedToLists.length > 0 && (
                  <span>
                    Adding to:{" "}
                    <strong>{addedToLists.map((l) => l.name).join(", ")}</strong>
                  </span>
                )}
                {addedToLists.length > 0 && removedFromLists.length > 0 && (
                  <span> &middot; </span>
                )}
                {removedFromLists.length > 0 && (
                  <span>
                    Removing from:{" "}
                    <strong>
                      {removedFromLists.map((l) => l.name).join(", ")}
                    </strong>
                  </span>
                )}
              </div>
            )}
          </div>

          {error && (
            <div
              style={{
                padding: "0.75rem",
                background: "rgba(239, 68, 68, 0.1)",
                color: "var(--error)",
                borderRadius: "var(--radius-md)",
                fontSize: "0.875rem",
              }}
            >
              {error}
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Saving..." : isChangingLists ? "Update Lists" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditItemModal;
