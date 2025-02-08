import React, { useState, useEffect } from 'react';
import { FaFolder, FaFile, FaEdit, FaCheck, FaTimes } from 'react-icons/fa';

function FileList({ objects, onFolderClick, currentPrefix, onRename, onFileClick }) {
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  // Add event listener for Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && editingId) {
        cancelEditing();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [editingId]);

  const startEditing = (item) => {
    if (!item.isFolder) {
      const name = item.Key.slice(currentPrefix.length);
      setEditingId(item.Key);
      setEditingName(name);
    }
  };

  const handleRename = async (item) => {
    if (editingName.trim() === '') return;

    try {
      const oldKey = item.Key;
      const newKey = currentPrefix + editingName;

      await onRename(oldKey, newKey);
      setEditingId(null);
    } catch (error) {
      console.error('Failed to rename:', error);
      alert('Failed to rename file');
    }
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
  };

  return (
    <div className="file-list">
      {objects.map((item) => {
        const name = item.isFolder
          ? item.Prefix.slice(currentPrefix.length, -1)
          : item.Key.slice(currentPrefix.length);

        return (
          <div
            key={item.isFolder ? item.Prefix : item.Key}
            className={`file-item ${item.isFolder ? 'folder' : 'file'}`}
          >
            <div
              className="file-item-content"
              onClick={() => {
                if (item.isFolder) {
                  onFolderClick(item.Prefix);
                } else {
                  onFileClick(item);
                }
              }}
              onDoubleClick={() => !item.isFolder && startEditing(item)}
            >
              {item.isFolder ? <FaFolder className="icon" /> : <FaFile className="icon" />}

              {editingId === item.Key ? (
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleRename(item)}
                  onBlur={() => cancelEditing()}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span>{name}</span>
              )}
            </div>

            {!item.isFolder && editingId === item.Key && (
              <div className="file-actions">
                <button
                  className="action-button confirm"
                  onClick={() => handleRename(item)}
                >
                  <FaCheck />
                </button>
                <button
                  className="action-button cancel"
                  onClick={cancelEditing}
                >
                  <FaTimes />
                </button>
              </div>
            )}
          </div>
        );
      })}
      {objects.length === 0 && (
        <div className="empty-message">This folder is empty</div>
      )}
    </div>
  );
}

export default FileList; 