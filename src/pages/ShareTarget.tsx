import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AddItemModal from "@/components/AddItemModal";
import "./ShareTarget.css";

const ShareTarget: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sharedData, setSharedData] = useState<{
    url?: string;
    title?: string;
    text?: string;
  } | null>(null);

  useEffect(() => {
    // Parse shared data from URL parameters
    const params = new URLSearchParams(window.location.search);
    const title = params.get("title") || "";
    const text = params.get("text") || "";
    const url = params.get("url") || "";

    // Sometimes the URL is embedded in the text (common with Facebook shares)
    let extractedUrl = url;
    let extractedText = text;

    if (!url && text) {
      // Try to extract URL from text
      const urlMatch = text.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        extractedUrl = urlMatch[0];
        // Remove the URL from text to get clean description
        extractedText = text.replace(urlMatch[0], "").trim();
      }
    }

    if (title || extractedUrl || extractedText) {
      setSharedData({
        title: title || undefined,
        url: extractedUrl || undefined,
        text: extractedText || undefined,
      });
    }

    // If not logged in, redirect to login with return URL
    if (!user) {
      navigate("/login?return=/share-target" + window.location.search);
    }
  }, [user, navigate]);

  const handleClose = () => {
    // After saving or canceling, redirect to dashboard
    navigate("/dashboard");
  };

  if (!user) {
    return (
      <div className="share-target-loading">
        <div className="spinner"></div>
        <p>Redirecting to login...</p>
      </div>
    );
  }

  if (!sharedData) {
    return (
      <div className="share-target-loading">
        <p>No content to share</p>
        <button
          onClick={() => navigate("/dashboard")}
          className="btn btn-primary"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="share-target">
      <AddItemModal
        onClose={handleClose}
        initialUrl={sharedData.url}
        initialTitle={sharedData.title}
        initialContent={sharedData.text}
      />
    </div>
  );
};

export default ShareTarget;
