import AWS from 'aws-sdk';

// Configure AWS
AWS.config.update({
  region: process.env.REACT_APP_AWS_REGION,
  accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();
const BUCKET_NAME = process.env.REACT_APP_S3_BUCKET;

export const uploadToS3 = async (file) => {
  const params = {
    Bucket: BUCKET_NAME,
    Key: `images/${Date.now()}-${file.name}`,
    Body: file,
    ContentType: file.type,
    ACL: 'public-read',
  };

  const { Location } = await s3.upload(params).promise();
  return Location;
};

export const updateFileNameInS3 = async (oldName, newName) => {
  const params = {
    Bucket: BUCKET_NAME,
    CopySource: `${BUCKET_NAME}/images/${oldName}`,
    Key: `images/${newName}`,
    ACL: 'public-read',
  };

  await s3.copyObject(params).promise();

  // Delete the old object
  await s3
    .deleteObject({
      Bucket: BUCKET_NAME,
      Key: `images/${oldName}`,
    })
    .promise();
};
