/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import "./Dashboard.css";

interface StoredData {
  users: any[];
  lists: any[];
  items: any[];
  currentUserId: string | null;
}

const Recovery: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [storedData, setStoredData] = useState<StoredData | null>(null);
  const [showItems, setShowItems] = useState<boolean>(false);
  const [allLocalStorageKeys, setAllLocalStorageKeys] = useState<string[]>([]);

  useEffect(() => {
    // Load data from localStorage
    const stored = localStorage.getItem("4stash_mock_data");
    if (stored) {
      const data = JSON.parse(stored);
      setStoredData(data);
      console.log("Found stored data:", data);
    }

    // Get all localStorage keys
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) keys.push(key);
    }
    setAllLocalStorageKeys(keys);
    console.log("All localStorage keys:", keys);
  }, []);

  const handleSwitchUser = (userId: string) => {
    if (!storedData) return;

    // Update currentUserId in localStorage
    const newData = {
      ...storedData,
      currentUserId: userId,
    };

    localStorage.setItem("4stash_mock_data", JSON.stringify(newData));
    console.log("Switched to user:", userId);

    // Reload page to apply changes
    window.location.href = "/dashboard";
  };

  const getUserInfo = (userId: string) => {
    if (!storedData) return null;
    const user = storedData.users.find((u: any) => u.id === userId);
    const userLists = storedData.lists.filter((l: any) => l.userId === userId);
    const userItems = storedData.items.filter((i: any) => i.userId === userId);

    return {
      user,
      listsCount: userLists.length,
      itemsCount: userItems.length,
    };
  };

  return (
    <div className="dashboard">
      <div className="top-bar">
        <h1>🔧 User Recovery</h1>
        <button onClick={() => navigate("/dashboard")} className="btn">
          Back to Dashboard
        </button>
      </div>

      <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
        <div
          style={{
            background: "var(--bg-secondary)",
            padding: "20px",
            borderRadius: "var(--radius-lg)",
            marginBottom: "20px",
          }}
        >
          <h2>Current User</h2>
          {user ? (
            <div>
              <p>
                <strong>ID:</strong> {user.id}
              </p>
              <p>
                <strong>Email:</strong> {user.email}
              </p>
              <p>
                <strong>Name:</strong> {user.displayName}
              </p>
            </div>
          ) : (
            <p>No user currently logged in</p>
          )}
        </div>

        {storedData ? (
          <>
            <div
              style={{
                background: "var(--bg-secondary)",
                padding: "20px",
                borderRadius: "var(--radius-lg)",
                marginBottom: "20px",
              }}
            >
              <h2>All Users in Storage</h2>
              <p>Found {storedData.users.length} user(s)</p>
              <p>Total Lists: {storedData.lists.length}</p>
              <p>Total Items: {storedData.items.length}</p>
              <button
                onClick={() => setShowItems(!showItems)}
                style={{
                  marginTop: "10px",
                  padding: "8px 16px",
                  background: "var(--accent-primary)",
                  color: "white",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                }}
              >
                {showItems ? "Hide All Items" : "Show All Items"}
              </button>
            </div>

            {showItems && (
              <div
                style={{
                  background: "var(--bg-secondary)",
                  padding: "20px",
                  borderRadius: "var(--radius-lg)",
                  marginBottom: "20px",
                }}
              >
                <h2>All Saved Items ({storedData.items.length})</h2>
                <div style={{ maxHeight: "500px", overflowY: "auto" }}>
                  {storedData.items.map((item: any, index: number) => {
                    const itemUser = storedData.users.find(
                      (u: any) => u.id === item.userId,
                    );
                    const itemList = storedData.lists.find(
                      (l: any) => l.id === item.listId,
                    );

                    return (
                      <div
                        key={item.id}
                        style={{
                          padding: "10px",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-sm)",
                          marginBottom: "8px",
                          fontSize: "0.875rem",
                        }}
                      >
                        <div
                          style={{ fontWeight: "bold", marginBottom: "5px" }}
                        >
                          {index + 1}. {item.title}
                        </div>
                        <div
                          style={{
                            color: "var(--text-secondary)",
                            fontSize: "0.8rem",
                          }}
                        >
                          <div>
                            User:{" "}
                            {itemUser?.displayName ||
                              itemUser?.email ||
                              "Unknown"}
                          </div>
                          <div>List: {itemList?.name || "Unknown"}</div>
                          {item.url && (
                            <div>URL: {item.url.substring(0, 60)}...</div>
                          )}
                          {item.source && <div>Source: {item.source}</div>}
                          <div>
                            Created: {new Date(item.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div
              style={{
                background: "var(--bg-secondary)",
                padding: "20px",
                borderRadius: "var(--radius-lg)",
              }}
            >
              <h2>Switch User</h2>
              {storedData.users.map((u: any) => {
                const info = getUserInfo(u.id);
                const isCurrent = u.id === storedData.currentUserId;

                return (
                  <div
                    key={u.id}
                    style={{
                      padding: "15px",
                      border: isCurrent
                        ? "2px solid var(--accent-primary)"
                        : "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      marginBottom: "10px",
                      background: isCurrent
                        ? "rgba(99, 102, 241, 0.1)"
                        : "transparent",
                    }}
                  >
                    <div style={{ marginBottom: "10px" }}>
                      <strong>{u.displayName || u.email}</strong>
                      {isCurrent && (
                        <span
                          style={{
                            color: "var(--accent-primary)",
                            marginLeft: "10px",
                          }}
                        >
                          ✓ Current
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: "0.875rem",
                        color: "var(--text-secondary)",
                        marginBottom: "10px",
                      }}
                    >
                      <p>Email: {u.email}</p>
                      <p>ID: {u.id}</p>
                      <p>
                        Lists: {info?.listsCount || 0} | Items:{" "}
                        {info?.itemsCount || 0}
                      </p>
                      <p>
                        Created: {new Date(u.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {!isCurrent && (
                      <button
                        onClick={() => handleSwitchUser(u.id)}
                        style={{
                          padding: "8px 16px",
                          background: "var(--accent-primary)",
                          color: "white",
                          border: "none",
                          borderRadius: "var(--radius-sm)",
                          cursor: "pointer",
                        }}
                      >
                        Switch to this user
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div
              style={{
                background: "var(--bg-tertiary)",
                padding: "15px",
                borderRadius: "var(--radius-md)",
                marginTop: "20px",
              }}
            >
              <h3>⚠️ Important</h3>
              <p>
                This is a development-only feature. In production, you'll use
                real Firebase authentication.
              </p>
              <p>
                Your data is stored in browser localStorage and will be lost if
                you clear browser data.
              </p>

              <details style={{ marginTop: "15px" }}>
                <summary style={{ cursor: "pointer", fontWeight: "bold" }}>
                  🔍 All LocalStorage Keys ({allLocalStorageKeys.length})
                </summary>
                <div style={{ marginTop: "10px", fontSize: "0.875rem" }}>
                  {allLocalStorageKeys.map((key, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "5px",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      {key}
                    </div>
                  ))}
                </div>
              </details>

              <div
                style={{
                  marginTop: "15px",
                  padding: "10px",
                  background: "var(--bg-secondary)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <strong>Missing your old data?</strong>
                <ul
                  style={{
                    marginTop: "5px",
                    fontSize: "0.875rem",
                    paddingLeft: "20px",
                  }}
                >
                  <li>
                    Check if you're using the same browser (Chrome vs Edge vs
                    Firefox)
                  </li>
                  <li>Check if you were in Incognito/Private mode before</li>
                  <li>
                    Check if the domain was different (localhost:5173 vs
                    localhost:5174)
                  </li>
                  <li>
                    Check browser developer tools → Application → Local Storage
                  </li>
                </ul>
              </div>
            </div>
          </>
        ) : (
          <div
            style={{
              background: "var(--bg-secondary)",
              padding: "20px",
              borderRadius: "var(--radius-lg)",
              textAlign: "center",
            }}
          >
            <p>No stored data found in localStorage</p>
            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--text-secondary)",
                marginTop: "10px",
              }}
            >
              The data might have been cleared. Try signing in again to create a
              new user.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Recovery;
