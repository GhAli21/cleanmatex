import { Client } from 'minio';

// MinIO client configuration
const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'cleanmatex-uploads';

// Ensure bucket exists
export async function ensureBucket() {
  try {
    const exists = await minioClient.bucketExists(BUCKET_NAME);
    if (!exists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      console.log(`Bucket ${BUCKET_NAME} created successfully`);

      // Set bucket policy to allow public read access
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`],
          },
        ],
      };
      await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
    }
  } catch (error) {
    console.error('Error ensuring bucket:', error);
    throw error;
  }
}

// Upload file to MinIO
export async function uploadFile(
  file: Buffer,
  fileName: string,
  contentType: string,
  metadata?: Record<string, string>
): Promise<string> {
  try {
    await ensureBucket();

    // Upload file
    await minioClient.putObject(BUCKET_NAME, fileName, file, file.length, {
      'Content-Type': contentType,
      ...metadata,
    });

    // Generate URL
    const url = await getFileUrl(fileName);
    return url;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new Error('Failed to upload file');
  }
}

// Get file URL
export async function getFileUrl(fileName: string): Promise<string> {
  try {
    // For production with public bucket, construct direct URL
    const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = process.env.MINIO_PORT || '9000';
    const useSSL = process.env.MINIO_USE_SSL === 'true';
    const protocol = useSSL ? 'https' : 'http';

    return `${protocol}://${endpoint}:${port}/${BUCKET_NAME}/${fileName}`;
  } catch (error) {
    console.error('Error getting file URL:', error);
    throw new Error('Failed to get file URL');
  }
}

// Delete file from MinIO
export async function deleteFile(fileName: string): Promise<void> {
  try {
    await minioClient.removeObject(BUCKET_NAME, fileName);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw new Error('Failed to delete file');
  }
}

// Upload order photo
export async function uploadOrderPhoto(
  orderId: string,
  file: Buffer,
  originalName: string,
  tenantId: string
): Promise<string> {
  try {
    // Generate unique filename
    const timestamp = Date.now();
    const extension = originalName.split('.').pop() || 'jpg';
    const fileName = `orders/${tenantId}/${orderId}/${timestamp}-${originalName}`;

    // Upload to MinIO
    const url = await uploadFile(file, fileName, `image/${extension}`, {
      orderId,
      tenantId,
      uploadedAt: new Date().toISOString(),
    });

    return url;
  } catch (error) {
    console.error('Error uploading order photo:', error);
    throw new Error('Failed to upload order photo');
  }
}

// List files in order folder
export async function listOrderPhotos(
  orderId: string,
  tenantId: string
): Promise<string[]> {
  try {
    const prefix = `orders/${tenantId}/${orderId}/`;
    const stream = minioClient.listObjects(BUCKET_NAME, prefix, true);
    const urls: string[] = [];

    return new Promise((resolve, reject) => {
      stream.on('data', (obj) => {
        if (obj.name) {
          urls.push(getFileUrl(obj.name));
        }
      });
      stream.on('error', reject);
      stream.on('end', () => resolve(Promise.all(urls)));
    });
  } catch (error) {
    console.error('Error listing order photos:', error);
    throw new Error('Failed to list order photos');
  }
}

export default minioClient;
