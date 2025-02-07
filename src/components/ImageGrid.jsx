import React, { useState } from 'react';
import './ImageGrid.css';

function ImageGrid({ images, onRename }) {
  const [editingId, setEditingId] = useState(null);
  const [newName, setNewName] = useState('');

  const handleEditClick = (id, currentName) => {
    setEditingId(id);
    setNewName(currentName);
  };

  const handleSave = async (id) => {
    if (newName.trim()) {
      await onRename(id, newName.trim());
      setEditingId(null);
    }
  };

  return (
    <div className="image-grid">
      {images.map((image) => (
        <div key={image.id} className="image-item">
          <img src={image.url} alt={image.name} />
          {editingId === image.id ? (
            <div className="edit-name">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSave(image.id)}
              />
              <button onClick={() => handleSave(image.id)}>Save</button>
              <button onClick={() => setEditingId(null)}>Cancel</button>
            </div>
          ) : (
            <div className="image-name">
              <span>{image.name}</span>
              <button onClick={() => handleEditClick(image.id, image.name)}>
                Rename
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default ImageGrid; 