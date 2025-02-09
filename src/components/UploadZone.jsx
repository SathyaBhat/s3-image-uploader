import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import imageCompression from 'browser-image-compression';
import { heicTo } from 'heic-to';
import UploadProgress from './UploadProgress';

const s3Client = new S3Client({
  region: import.meta.env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
});

const convertHeicToJpeg = async (file) => {

  console.log(file);
  try {
    const jpegBlob = await heicTo({
      blob: file,
      type: 'image/jpeg',
      quality: 0.7,
    });
    // Create new file with jpeg extension
    const newFilename = file.name.replace(/\.(heic|heif)$/i, '.jpg');
    return new File([jpegBlob], newFilename, { type: 'image/jpeg' });
  } catch (error) {
    console.error('Error converting HEIC:', error);
    return file;
  }
};

const optimizeImage = async (file) => {
  // First convert HEIC/HEIF if needed
  if (/\.(heic|heif)$/i.test(file.name)) {
    file = await convertHeicToJpeg(file);
  }

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
      Key: `${currentPrefix}${optimizedFile.name}`,
      Body: buffer,
      ContentType: optimizedFile.type,
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
  const [isDragging, setIsDragging] = useState(false);

  // Add global drag event handlers
  useEffect(() => {
    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDragEnter = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.types.includes('Files')) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Only set dragging to false if we're leaving the window
      if (e.clientX <= 0 || e.clientX >= window.innerWidth ||
        e.clientY <= 0 || e.clientY >= window.innerHeight) {
        setIsDragging(false);
      }
    };

    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  const updateProgress = (file, progress) => {
    setUploads(prev => new Map(prev).set(file.name, progress));
  };

  const handleDrop = useCallback(async (acceptedFiles) => {
    setIsDragging(false);
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

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: handleDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.heic', '.heif'],
    },
    noClick: true,
  });

  return (
    <>
      <div
        {...getRootProps()}
        className={`upload-zone ${isDragging ? 'active' : ''}`}
      >
        <input {...getInputProps()} />
        {isDragging && (
          <div className="upload-overlay">
            <p>Drop files here to upload</p>
          </div>
        )}
      </div>
      {uploads.size > 0 && (
        <div className="upload-progress-container">
          <div className="upload-progress-list">
            {Array.from(uploads).map(([filename, progress]) => (
              <UploadProgress
                key={filename}
                file={{ name: filename }}
                progress={progress}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default UploadZone; 