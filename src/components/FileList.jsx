import React from 'react';
import { FaFolder, FaFile } from 'react-icons/fa';

function FileList({ objects, onFolderClick, currentPrefix }) {
  return (
    <div className="file-list">
      {objects.map((item, index) => {
        const name = item.isFolder
          ? item.Prefix.slice(currentPrefix.length, -1)
          : item.Key.slice(currentPrefix.length);

        return (
          <div
            key={index}
            className={`file-item ${item.isFolder ? 'folder' : 'file'}`}
            onClick={() => item.isFolder && onFolderClick(item.Prefix)}
          >
            {item.isFolder ? <FaFolder className="icon" /> : <FaFile className="icon" />}
            <span>{name}</span>
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