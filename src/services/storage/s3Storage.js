const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');
const logger = require('../../utils/logger');

class S3Storage {
  constructor() {
    this.accessKeyId = process.env.AWS_S3_ACCESS_KEY_ID;
    this.secretAccessKey = process.env.AWS_S3_SECRET_ACCESS_KEY;
    this.region = process.env.AWS_S3_REGION || 'us-east-1';
    this.bucket = process.env.AWS_S3_BUCKET;
    this.urlExpiration = parseInt(process.env.AWS_S3_URL_EXPIRATION || '3600');

    if (!this.accessKeyId || !this.secretAccessKey || !this.bucket) {
      throw new Error('Invalid S3 config: AWS_S3_ACCESS_KEY_ID, AWS_S3_SECRET_ACCESS_KEY, and AWS_S3_BUCKET are required');
    }

    this.client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });
  }

  getKey(filePath, options = {}) {
    const { userId, documentId } = options;
    let key = 'uploads';
    
    if (userId) {
      key = `${key}/user_${userId}`;
    }
    if (documentId) {
      key = `${key}/document_${documentId}`;
    }
    
    return `${key}/${filePath}`;
  }

  async upload(file, options = {}) {
    const { userId, documentId, filename } = options;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    const finalFilename = filename || `upload-${baseName}-${uniqueSuffix}${ext}`;
    
    const key = this.getKey(finalFilename, { userId, documentId });

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ServerSideEncryption: 'AES256',
      });

      await this.client.send(command);
      logger.info(`File uploaded to S3: ${key}`);

      return {
        path: key,
        url: key,
        filename: finalFilename,
        size: file.size,
        mimetype: file.mimetype,
      };
    } catch (error) {
      logger.error('S3 upload error:', error);
      throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
  }

  async getUrl(filePath, options = {}) {
    try {
      const key = filePath.startsWith('uploads/') ? filePath : this.getKey(filePath, options);
      
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const url = await getSignedUrl(this.client, command, { expiresIn: this.urlExpiration });
      return url;
    } catch (error) {
      logger.error(`Failed to generate S3 URL for ${filePath}:`, error);
      return null;
    }
  }

  async delete(filePath, options = {}) {
    try {
      const key = filePath.startsWith('uploads/') ? filePath : this.getKey(filePath, options);
      
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      logger.info(`File deleted from S3: ${key}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete file from S3: ${filePath}`, error);
      return false;
    }
  }

  async exists(filePath, options = {}) {
    try {
      const key = filePath.startsWith('uploads/') ? filePath : this.getKey(filePath, options);
      
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      logger.error(`Failed to check file existence in S3: ${filePath}`, error);
      return false;
    }
  }
}

module.exports = S3Storage;

