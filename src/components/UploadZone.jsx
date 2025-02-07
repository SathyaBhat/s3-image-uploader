import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: import.meta.env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
});

function UploadZone({ currentPrefix, onUploadComplete }) {
  const onDrop = useCallback(async (acceptedFiles) => {
    for (const file of acceptedFiles) {
      try {
        const command = new PutObjectCommand({
          Bucket: import.meta.env.VITE_AWS_BUCKET_NAME,
          Key: `${currentPrefix}${file.name}`,
          Body: file,
          ContentType: file.type,
        });

        await s3Client.send(command);
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    }
    onUploadComplete();
  }, [currentPrefix, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div {...getRootProps()} className="upload-zone">
      <input {...getInputProps()} />
      {isDragActive ? (
        <p>Drop the files here...</p>
      ) : (
        <p>Drag 'n' drop some files here, or click to select files</p>
      )}
    </div>
  );
}

export default UploadZone; 