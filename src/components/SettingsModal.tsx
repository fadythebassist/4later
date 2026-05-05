import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { setStoredAnalyticsConsent } from '@/services/AnalyticsService';
import './Modal.css';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'appearance' | 'behavior' | 'privacy' | 'account';

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { user, updateUserSettings } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('appearance');
  const [settings, setSettings] = useState({
    theme: (user?.settings?.theme as 'light' | 'dark') || 'light',
    viewDensity: user?.settings?.viewDensity || 'comfortable',
    layoutMode: user?.settings?.layoutMode || 'grid',
    defaultListId: user?.settings?.defaultListId || '',
    analyticsConsent: user?.settings?.analyticsConsent,
    autoFetchMetadata: user?.settings?.autoFetchMetadata !== false,
    confirmDelete: user?.settings?.confirmDelete !== false,
    thumbnailQuality: user?.settings?.thumbnailQuality || 'high',
    itemsPerPage: user?.settings?.itemsPerPage || 24,
    showSourceBadges: user?.settings?.showSourceBadges !== false,
    moderationLevel: user?.settings?.moderationLevel || 'moderate',
    autoArchiveDays: user?.settings?.autoArchiveDays || 0,
    autoplayVideos: user?.settings?.autoplayVideos !== false,
  });

  if (!isOpen) return null;

  const handleSettingChange = async (newSettings: Partial<typeof settings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);

    try {
      if (newSettings.analyticsConsent) {
        setStoredAnalyticsConsent(newSettings.analyticsConsent);
      }

      if (updateUserSettings) {
        await updateUserSettings(updated);
      }
      // Apply theme immediately if changed
      if (newSettings.theme) {
        document.documentElement.setAttribute('data-theme', newSettings.theme);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings. Please try again.');
    }
  };

  const handleExportData = async () => {
    try {
      // This would typically call a service method
      alert('Export feature coming soon! Your data will be downloaded as JSON.');
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This action cannot be undone and will delete all your saved content.'
    );
    if (confirmed) {
      const doubleConfirm = window.confirm(
        'This is your last chance! Type YES in the next prompt to confirm account deletion.'
      );
      if (doubleConfirm) {
        alert('Account deletion feature coming soon!');
        // TODO: Implement account deletion
      }
    }
  };

  const renderAppearanceTab = () => (
    <div className="settings-section">
      <div className="setting-group">
        <label className="setting-label">
          <strong>Theme</strong>
          <p className="setting-description">Choose your preferred color scheme</p>
        </label>
        <div className="setting-options">
          <button
            className={`option-btn ${settings.theme === 'light' ? 'active' : ''}`}
            onClick={() => handleSettingChange({ theme: 'light' })}
          >
            ☀️ Light
          </button>
          <button
            className={`option-btn ${settings.theme === 'dark' ? 'active' : ''}`}
            onClick={() => handleSettingChange({ theme: 'dark' })}
          >
            🌙 Dark
          </button>
        </div>
      </div>

      <div className="setting-group">
        <label className="setting-label">
          <strong>View Density</strong>
          <p className="setting-description">Adjust card size and spacing</p>
        </label>
        <div className="setting-options">
          <button
            className={`option-btn ${settings.viewDensity === 'compact' ? 'active' : ''}`}
            onClick={() => handleSettingChange({ viewDensity: 'compact' })}
          >
            Compact
          </button>
          <button
            className={`option-btn ${settings.viewDensity === 'comfortable' ? 'active' : ''}`}
            onClick={() => handleSettingChange({ viewDensity: 'comfortable' })}
          >
            Comfortable
          </button>
        </div>
      </div>

      <div className="setting-group">
        <label className="setting-label">
          <strong>Layout Mode</strong>
          <p className="setting-description">How items are displayed</p>
        </label>
        <div className="setting-options">
          <button
            className={`option-btn ${settings.layoutMode === 'grid' ? 'active' : ''}`}
            onClick={() => handleSettingChange({ layoutMode: 'grid' })}
          >
            🔲 Grid
          </button>
          <button
            className={`option-btn ${settings.layoutMode === 'list' ? 'active' : ''}`}
            onClick={() => handleSettingChange({ layoutMode: 'list' })}
          >
            📋 List
          </button>
        </div>
      </div>

      <div className="setting-group">
        <label className="setting-label">
          <strong>Thumbnail Quality</strong>
          <p className="setting-description">Higher quality uses more bandwidth</p>
        </label>
        <select
          value={settings.thumbnailQuality}
          onChange={(e) => handleSettingChange({ thumbnailQuality: e.target.value as 'low' | 'medium' | 'high' })}
          className="setting-select"
        >
          <option value="low">Low (faster loading)</option>
          <option value="medium">Medium</option>
          <option value="high">High (best quality)</option>
        </select>
      </div>
    </div>
  );

  const renderBehaviorTab = () => (
    <div className="settings-section">
      <div className="setting-group">
        <label className="setting-label">
          <strong>Default List</strong>
          <p className="setting-description">Where new items are saved by default</p>
        </label>
        <select
          value={settings.defaultListId}
          onChange={(e) => handleSettingChange({ defaultListId: e.target.value })}
          className="setting-select"
        >
          <option value="">Current selected list</option>
          {/* TODO: Populate with actual lists */}
        </select>
      </div>

      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.autoFetchMetadata}
            onChange={(e) => handleSettingChange({ autoFetchMetadata: e.target.checked })}
          />
          <div>
            <strong>Auto-fetch metadata</strong>
            <p className="setting-description">Automatically get titles and thumbnails from links</p>
          </div>
        </label>
      </div>

      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.confirmDelete}
            onChange={(e) => handleSettingChange({ confirmDelete: e.target.checked })}
          />
          <div>
            <strong>Confirm before deleting</strong>
            <p className="setting-description">Show confirmation dialog when deleting items or lists</p>
          </div>
        </label>
      </div>

      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.showSourceBadges}
            onChange={(e) => handleSettingChange({ showSourceBadges: e.target.checked })}
          />
          <div>
            <strong>Show source badges</strong>
            <p className="setting-description">Display social media icons on content cards</p>
          </div>
        </label>
      </div>

      <div className="setting-group">
        <label className="setting-checkbox">
          <input
            type="checkbox"
            checked={settings.autoplayVideos}
            onChange={(e) => handleSettingChange({ autoplayVideos: e.target.checked })}
          />
          <div>
            <strong>Autoplay videos</strong>
            <p className="setting-description">Automatically play embedded videos (TikTok, Instagram, etc.)</p>
          </div>
        </label>
      </div>

      <div className="setting-group">
        <label className="setting-label">
          <strong>Items Per Page</strong>
          <p className="setting-description">Number of items to display at once</p>
        </label>
        <select
          value={settings.itemsPerPage}
          onChange={(e) => handleSettingChange({ itemsPerPage: parseInt(e.target.value) })}
          className="setting-select"
        >
          <option value="12">12 items</option>
          <option value="24">24 items</option>
          <option value="48">48 items</option>
          <option value="0">All (no pagination)</option>
        </select>
      </div>

      <div className="setting-group">
        <label className="setting-label">
          <strong>Auto-archive Old Items</strong>
          <p className="setting-description">Automatically archive items after a certain time</p>
        </label>
        <select
          value={settings.autoArchiveDays}
          onChange={(e) => handleSettingChange({ autoArchiveDays: parseInt(e.target.value) })}
          className="setting-select"
        >
          <option value="0">Never (disabled)</option>
          <option value="30">After 30 days</option>
          <option value="90">After 90 days</option>
          <option value="180">After 6 months</option>
          <option value="365">After 1 year</option>
        </select>
      </div>
    </div>
  );

  const renderPrivacyTab = () => (
    <div className="settings-section">
      <div className="setting-group">
        <label className="setting-label">
          <strong>Usage Analytics</strong>
          <p className="setting-description">
            Control whether Google Analytics can collect anonymous page and feature
            usage data. Your saved items are never used for analytics.
          </p>
        </label>
        <div className="setting-options">
          <button
            className={`option-btn ${settings.analyticsConsent === 'granted' ? 'active' : ''}`}
            onClick={() => handleSettingChange({ analyticsConsent: 'granted' })}
          >
            Allow
          </button>
          <button
            className={`option-btn ${settings.analyticsConsent === 'denied' ? 'active' : ''}`}
            onClick={() => handleSettingChange({ analyticsConsent: 'denied' })}
          >
            Disable
          </button>
        </div>
      </div>

      <div className="setting-group">
        <label className="setting-label">
          <strong>Content Moderation</strong>
          <p className="setting-description">Filter potentially sensitive content</p>
        </label>
        <select
          value={settings.moderationLevel}
          onChange={(e) => handleSettingChange({ moderationLevel: e.target.value as 'strict' | 'moderate' | 'relaxed' | 'off' })}
          className="setting-select"
        >
          <option value="strict">Strict (maximum filtering)</option>
          <option value="moderate">Moderate (balanced)</option>
          <option value="relaxed">Relaxed (minimal filtering)</option>
          <option value="off">Off (no filtering)</option>
        </select>
      </div>

      <div className="setting-info">
        <p>
          🔒 Your saved content is private and only visible to you. 
          We don't share your data with third parties.
        </p>
      </div>
    </div>
  );

  const renderAccountTab = () => (
    <div className="settings-section">
      <div className="setting-group">
        <label className="setting-label">
          <strong>Account Information</strong>
        </label>
        <div className="account-info">
          <p><strong>Email:</strong> {user?.email}</p>
          <p><strong>Display Name:</strong> {user?.displayName || 'Not set'}</p>
          <p><strong>Account Type:</strong> {user?.provider || 'Unknown'}</p>
          <p><strong>Member Since:</strong> {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}</p>
        </div>
      </div>

      <div className="setting-group">
        <label className="setting-label">
          <strong>Data Management</strong>
        </label>
        <button className="btn-secondary" onClick={handleExportData}>
          📦 Export All Data
        </button>
        <p className="setting-description">Download all your saved content as JSON</p>
      </div>

      <div className="setting-group danger-zone">
        <label className="setting-label">
          <strong>⚠️ Danger Zone</strong>
        </label>
        <button className="btn-danger" onClick={handleDeleteAccount}>
          🗑️ Delete Account
        </button>
        <p className="setting-description">
          Permanently delete your account and all saved content. This action cannot be undone.
        </p>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚙️ Settings</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="settings-container">
          <div className="settings-tabs">
            <button
              className={`settings-tab ${activeTab === 'appearance' ? 'active' : ''}`}
              onClick={() => setActiveTab('appearance')}
            >
              🎨 Appearance
            </button>
            <button
              className={`settings-tab ${activeTab === 'behavior' ? 'active' : ''}`}
              onClick={() => setActiveTab('behavior')}
            >
              ⚙️ Behavior
            </button>
            <button
              className={`settings-tab ${activeTab === 'privacy' ? 'active' : ''}`}
              onClick={() => setActiveTab('privacy')}
            >
              🔒 Privacy
            </button>
            <button
              className={`settings-tab ${activeTab === 'account' ? 'active' : ''}`}
              onClick={() => setActiveTab('account')}
            >
              👤 Account
            </button>
          </div>

          <div className="settings-content">
            {activeTab === 'appearance' && renderAppearanceTab()}
            {activeTab === 'behavior' && renderBehaviorTab()}
            {activeTab === 'privacy' && renderPrivacyTab()}
            {activeTab === 'account' && renderAccountTab()}
          </div>
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;
