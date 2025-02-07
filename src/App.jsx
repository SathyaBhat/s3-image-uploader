import React, { useState, useEffect } from 'react';
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
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
      {loading ? (
        <div>Loading...</div>
      ) : (
        <FileList
          objects={objects}
          onFolderClick={handleFolderClick}
          currentPrefix={currentPrefix}
        />
      )}
      <UploadZone
        currentPrefix={currentPrefix}
        onUploadComplete={() => fetchObjects(currentPrefix)}
      />
    </div>
  );
}

export default App;