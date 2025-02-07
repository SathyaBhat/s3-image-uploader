import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import imageCompression from 'browser-image-compression';

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
    initialQuality: 1, // Keep quality high since we're only resizing
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

function UploadZone({ currentPrefix, onUploadComplete }) {
  const onDrop = useCallback(async (acceptedFiles) => {
    for (const file of acceptedFiles) {
      try {
        const optimizedFile = await optimizeImage(file);
        const buffer = await optimizedFile.arrayBuffer();

        const command = new PutObjectCommand({
          Bucket: import.meta.env.VITE_AWS_BUCKET_NAME,
          Key: `${currentPrefix}${file.name}`,
          Body: buffer,
          ContentType: file.type,
        });

        await s3Client.send(command);
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    }
    onUploadComplete();
  }, [currentPrefix, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    // Optional: Add file type restrictions 
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif'],
      // Add more file types as needed
    }
  });

  return (
    <div {...getRootProps()} className="upload-zone">
      <input {...getInputProps()} />
      {isDragActive ? (
        <p>Drop the files here...</p>
      ) : (
        <p>Drag 'n' drop files here, or click to select files</p>
      )}
    </div>
  );
}

export default UploadZone; 