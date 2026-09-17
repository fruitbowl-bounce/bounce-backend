const fs = require('fs').promises;
const path = require('path');
const logger = require('../../utils/logger');

class LocalStorage {
  constructor() {
    this.uploadDir = path.join(__dirname, '../../../uploads');
    this.ensureUploadDir();
  }

  async ensureUploadDir() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create upload directory:', error);
    }
  }

  async upload(file, options = {}) {
    const { userId, documentId, filename } = options;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    const finalFilename = filename || `upload-${baseName}-${uniqueSuffix}${ext}`;
    
    const userDir = userId ? path.join(this.uploadDir, `user_${userId}`) : this.uploadDir;
    const docDir = documentId ? path.join(userDir, `document_${documentId}`) : userDir;
    
    await fs.mkdir(docDir, { recursive: true });
    
    const filePath = path.join(docDir, finalFilename);
    await fs.writeFile(filePath, file.buffer);

    const relativePath = path.relative(this.uploadDir, filePath);
    logger.info(`File uploaded locally: ${relativePath}`);

    return {
      path: relativePath,
      url: `/uploads/${relativePath}`,
      filename: finalFilename,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  async getUrl(filePath) {
    const fullPath = path.join(this.uploadDir, filePath);
    try {
      await fs.access(fullPath);
      return `/uploads/${filePath}`;
    } catch (error) {
      logger.error(`File not found: ${filePath}`, error);
      return null;
    }
  }

  async delete(filePath) {
    try {
      const fullPath = path.join(this.uploadDir, filePath);
      await fs.unlink(fullPath);
      logger.info(`File deleted: ${filePath}`);
      return true;
    } catch (error) {
      logger.error(`Failed to delete file: ${filePath}`, error);
      return false;
    }
  }

  async exists(filePath) {
    try {
      const fullPath = path.join(this.uploadDir, filePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = LocalStorage;

