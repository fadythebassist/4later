import React, { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import './Modal.css';

interface AddListModalProps {
  onClose: () => void;
}

const iconOptions = ['📥', '⭐', '📺', '📚', '💼', '🎮', '🎵', '🏋️', '✈️', '🍕'];

const AddListModal: React.FC<AddListModalProps> = ({ onClose }) => {
  const { createList } = useData();
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('📁');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      alert('Please enter a list name');
      return;
    }

    setLoading(true);

    try {
      await createList({
        name: name.trim(),
        icon: selectedIcon
      });
      
      onClose();
    } catch (err) {
      alert('Failed to create list');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content slide-in-bottom" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create List</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="name">List Name *</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Watch Later, Reading List"
              required
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Icon</label>
            <div className="icon-picker">
              {iconOptions.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  className={`icon-option ${selectedIcon === icon ? 'selected' : ''}`}
                  onClick={() => setSelectedIcon(icon)}
                  disabled={loading}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create List'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddListModal;
