import React, { useState } from 'react';
import './HashtagInput.css';

interface HashtagInputProps {
  tags?: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
}

const HashtagInput: React.FC<HashtagInputProps> = ({
  tags = [],
  onChange,
  placeholder = 'Add hashtags... (press Enter or comma)',
  maxTags = 10
}) => {
  const [inputValue, setInputValue] = useState('');

  const addTag = (tag: string) => {
    const cleanTag = tag.trim().toLowerCase().replace(/^#+/, ''); // Remove # prefix if exists
    
    if (!cleanTag) return;
    
    if (tags.includes(cleanTag)) {
      setInputValue('');
      return;
    }

    if (tags.length >= maxTags) {
      alert(`Maximum ${maxTags} tags allowed`);
      return;
    }

    onChange([...tags, cleanTag]);
    setInputValue('');
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Check for comma-separated input
    if (value.includes(',')) {
      const parts = value.split(',');
      parts.slice(0, -1).forEach(part => addTag(part));
      setInputValue(parts[parts.length - 1].trim());
    } else {
      setInputValue(value);
    }
  };

  return (
    <div className="hashtag-input-container">
      <div className="hashtag-tags">
        {tags.map((tag, index) => (
          <div key={`${tag}-${index}`} className="hashtag-tag">
            <span className="hashtag-text">#{tag}</span>
            <button
              type="button"
              className="hashtag-remove"
              onClick={() => removeTag(index)}
              aria-label={`Remove ${tag} tag`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <input
        type="text"
        className="hashtag-input"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={tags.length >= maxTags}
        maxLength={50}
      />
      {tags.length >= maxTags && (
        <div className="hashtag-limit-message">
          Maximum {maxTags} tags reached
        </div>
      )}
    </div>
  );
};

export default HashtagInput;
