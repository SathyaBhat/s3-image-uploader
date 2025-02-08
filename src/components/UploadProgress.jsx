import React from 'react';

function UploadProgress({ file, progress }) {
  return (
    <div className="upload-progress">
      <div className="upload-progress-info">
        <span className="filename">{file.name}</span>
        <span className="percent">{Math.round(progress)}%</span>
      </div>
      <div className="progress-bar">
        <div
          className="progress-bar-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export default UploadProgress; 