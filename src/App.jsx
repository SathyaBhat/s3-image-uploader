import React, { useState, useEffect } from 'react';
import { ListObjectsV2Command, S3Client, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import FileList from './components/FileList';
import UploadZone from './components/UploadZone';

const s3Client = new S3Client({
  region: import.meta.env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
});

function App() {
  const [currentPrefix, setCurrentPrefix] = useState('');
  const [objects, setObjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);

  const fetchObjects = async (prefix = '') => {
    try {
      setLoading(true);
      const command = new ListObjectsV2Command({
        Bucket: import.meta.env.VITE_AWS_BUCKET_NAME,
        Prefix: prefix,
        Delimiter: '/',
      });

      const response = await s3Client.send(command);

      // Combine CommonPrefixes (folders) and Contents (files)
      const folders = (response.CommonPrefixes || []).map(prefix => ({
        ...prefix,
        isFolder: true
      }));

      const files = (response.Contents || []).filter(item => item.Key !== prefix).map(item => ({
        ...item,
        isFolder: false
      }));

      setObjects([...folders, ...files]);
    } catch (error) {
      console.error('Error fetching objects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchObjects(currentPrefix);
  }, [currentPrefix]);

  const handleFolderClick = (prefix) => {
    setCurrentPrefix(prefix);
  };

  const handleBack = () => {
    const newPrefix = currentPrefix.split('/').slice(0, -2).join('/') + '/';
    setCurrentPrefix(newPrefix === '/' ? '' : newPrefix);
  };

  const handleRename = async (oldKey, newKey) => {
    try {
      // Copy the object to the new key
      const copyCommand = new CopyObjectCommand({
        Bucket: import.meta.env.VITE_AWS_BUCKET_NAME,
        CopySource: `${import.meta.env.VITE_AWS_BUCKET_NAME}/${oldKey}`,
        Key: newKey
      });
      await s3Client.send(copyCommand);

      // Delete the old object
      const deleteCommand = new DeleteObjectCommand({
        Bucket: import.meta.env.VITE_AWS_BUCKET_NAME,
        Key: oldKey
      });
      await s3Client.send(deleteCommand);

      // Refresh the file list
      fetchObjects(currentPrefix);
    } catch (error) {
      console.error('Error renaming file:', error);
      throw error;
    }
  };

  const handleFileClick = (file) => {
    if (!file.isFolder) {
      setSelectedFile({
        name: file.Key.slice(currentPrefix.length),
        url: `https://i.sathyabh.at/${file.Key}`
      });
    }
  };

  return (
    <div className="container">
      <h1>S3 File Browser</h1>
      {currentPrefix && (
        <button onClick={handleBack} className="back-button">
          ← Back
        </button>
      )}
      <div className="current-path">
        Current path: {currentPrefix || 'root'}
      </div>

      <div className="main-content">
        <div className="content-left">
          <UploadZone
            currentPrefix={currentPrefix}
            onUploadComplete={() => fetchObjects(currentPrefix)}
          />

          {loading ? (
            <div>Loading...</div>
          ) : (
            <FileList
              objects={objects}
              onFolderClick={handleFolderClick}
              currentPrefix={currentPrefix}
              onRename={handleRename}
              onFileClick={handleFileClick}
            />
          )}
        </div>

        {selectedFile && (
          <div className="preview-pane">
            <h3>{selectedFile.name}</h3>
            <img
              src={selectedFile.url}
              alt={selectedFile.name}
              className="preview-image"
            />
            <div className="preview-url">
              <input
                type="text"
                value={selectedFile.url}
                readOnly
                onClick={e => e.target.select()}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;