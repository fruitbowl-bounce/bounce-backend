const logger = require('../../utils/logger');

let storageProvider = null;
let providerInstance = null;

const initializeProvider = () => {
  if (providerInstance) {
    return providerInstance;
  }

  const storageType = process.env.STORAGE_TYPE || 'local';

  try {
    switch (storageType) {
      case 's3': {
        const S3Storage = require('./s3Storage');
        providerInstance = new S3Storage();
        logger.info('Storage Provider initialized: AWS S3');
        break;
      }
      case 'local': {
        const LocalStorage = require('./localStorage');
        providerInstance = new LocalStorage();
        logger.info('Storage Provider initialized: Local');
        break;
      }
      default:
        throw new Error(`Unknown storage type: ${storageType}`);
    }

    storageProvider = storageType;
    return providerInstance;
  } catch (error) {
    logger.error('Failed to initialize storage provider:', error);
    throw error;
  }
};

const getProvider = () => {
  if (!providerInstance) {
    return initializeProvider();
  }
  return providerInstance;
};

const upload = async (file, options = {}) => {
  const provider = getProvider();
  return await provider.upload(file, options);
};

const getUrl = async (filePath, options = {}) => {
  const provider = getProvider();
  return await provider.getUrl(filePath, options);
};

const deleteFile = async (filePath, options = {}) => {
  const provider = getProvider();
  return await provider.delete(filePath, options);
};

const exists = async (filePath, options = {}) => {
  const provider = getProvider();
  return await provider.exists(filePath, options);
};

const resetProvider = () => {
  providerInstance = null;
  storageProvider = null;
};

module.exports = {
  upload,
  getUrl,
  deleteFile,
  exists,
  getProvider,
  resetProvider,
  initializeProvider,
};

