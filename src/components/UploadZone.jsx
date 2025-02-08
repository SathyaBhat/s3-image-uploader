import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import imageCompression from 'browser-image-compression';
import UploadProgress from './UploadProgress';

const s3Client = new S3Client({
  region: import.meta.env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
});

const optimizeImage = async (file) => {
  if (!file.type.startsWith('image/')) {
    return file; // Return non-image files as-is
  }

  // Create a temporary image element to get dimensions
  const img = new Image();
  const imgPromise = new Promise((resolve) => {
    img.onload = () => resolve();
    img.src = URL.createObjectURL(file);
  });
  await imgPromise;

  const options = {
    maxSizeMB: 10,
    maxWidthOrHeight: Math.max(img.width, img.height) / 2, // 50% of original size
    useWebWorker: true,
    initialQuality: file.type === 'image/jpeg' ? 0.7 : 1, // 70% quality for JPEGs
  };

  try {
    const optimizedFile = await imageCompression(file, options);
    // Keep original filename
    const renamedFile = new File([optimizedFile], file.name, {
      type: optimizedFile.type,
    });
    return renamedFile;
  } catch (error) {
    console.error('Error optimizing image:', error);
    return file; // Return original file if optimization fails
  } finally {
    URL.revokeObjectURL(img.src); // Clean up
  }
};

const uploadToS3 = async (file, currentPrefix, onProgress) => {
  try {
    const optimizedFile = await optimizeImage(file);
    const buffer = await optimizedFile.arrayBuffer();

    const command = new PutObjectCommand({
      Bucket: import.meta.env.VITE_AWS_BUCKET_NAME,
      Key: `${currentPrefix}${file.name}`,
      Body: buffer,
      ContentType: file.type,
    });

    // Upload with progress tracking
    await s3Client.send(command, {
      // This is a workaround since AWS SDK v3 doesn't directly support progress
      requestHandler: {
        handle: async (request) => {
          const uploader = await request.requestHandler.handle(request);
          const total = buffer.byteLength;
          let loaded = 0;

          uploader.on('uploadProgress', (progress) => {
            loaded = progress.loaded;
            const percentComplete = (loaded / total) * 100;
            onProgress(percentComplete);
          });

          return uploader;
        }
      }
    });

    return true;
  } catch (error) {
    console.error('Error uploading file:', error);
    return false;
  }
};

function UploadZone({ currentPrefix, onUploadComplete }) {
  const [uploads, setUploads] = useState(new Map());

  const updateProgress = (file, progress) => {
    setUploads(prev => new Map(prev).set(file.name, progress));
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    // Initialize progress for each file
    setUploads(new Map(acceptedFiles.map(file => [file.name, 0])));

    try {
      const uploadResults = await Promise.all(
        acceptedFiles.map(file =>
          uploadToS3(
            file,
            currentPrefix,
            (progress) => updateProgress(file, progress)
          )
        )
      );

      const allSuccessful = uploadResults.every(result => result === true);
      if (allSuccessful) {
        onUploadComplete();
        // Clear progress after a short delay
        setTimeout(() => setUploads(new Map()), 1000);
      } else {
        console.error('Some files failed to upload');
      }
    } catch (error) {
      console.error('Upload process failed:', error);
    }
  }, [currentPrefix, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif'],
    }
  });

  return (
    <div className="upload-container">
      <div {...getRootProps()} className="upload-zone">
        <input {...getInputProps()} />
        {isDragActive ? (
          <p>Drop the files here...</p>
        ) : (
          <p>Drag 'n' drop files here, or click to select files</p>
        )}
      </div>

      {uploads.size > 0 && (
        <div className="upload-progress-list">
          {Array.from(uploads).map(([filename, progress]) => (
            <UploadProgress
              key={filename}
              file={{ name: filename }}
              progress={progress}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default UploadZone; 