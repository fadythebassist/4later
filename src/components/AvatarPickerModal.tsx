import React, { useState } from "react";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { DICEBEAR_STYLES } from "@/types";
import "./Modal.css";
import "./AvatarPickerModal.css";

interface AvatarPickerModalProps {
  onClose: () => void;
}

const AvatarPickerModal: React.FC<AvatarPickerModalProps> = ({ onClose }) => {
  const { updateAvatarStyle } = useData();
  const { user } = useAuth();
  const [selectedStyle, setSelectedStyle] = useState(
    user?.avatarStyle || "lorelei",
  );
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);

    try {
      await updateAvatarStyle(selectedStyle);
      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      if (
        errorMsg.includes("permission") ||
        errorMsg.includes("Missing or insufficient")
      ) {
        alert(
          "⚠️ Firebase Security Rules Error\n\nYou need to add security rules for the users collection.\n\nGo to:\nFirebase Console → Firestore → Rules\n\nAdd this rule:\nmatch /users/{userId} {\n  allow read, write: if request.auth != null && request.auth.uid == userId;\n}\n\nThen click Publish.",
        );
      } else {
        alert("Failed to update avatar. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const generatePreviewUrl = (style: string) => {
    return `https://api.dicebear.com/7.x/${style}/png?seed=${user?.id || "preview"}&size=64`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content slide-in-bottom avatar-picker-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Choose Your Avatar</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body avatar-picker-body">
          <div className="avatar-style-grid">
            {DICEBEAR_STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
                className={`avatar-style-option ${selectedStyle === style.id ? "selected" : ""}`}
                onClick={() => setSelectedStyle(style.id)}
                disabled={loading}
              >
                <div className="avatar-preview">
                  <img src={generatePreviewUrl(style.id)} alt={style.name} />
                </div>
                <div className="avatar-style-info">
                  <div className="avatar-style-name">{style.name}</div>
                  <div className="avatar-style-description">
                    {style.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AvatarPickerModal;
