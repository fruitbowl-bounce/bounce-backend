const express = require('express');
const router = express.Router();
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const Document = require('../../../models/Document');
const storageService = require('../../../services/storage/storageService');
const logger = require('../../../utils/logger');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.UPLOAD_MAX_SIZE || '10485760'),
  },
});

router.get('/me', async (req, res, next) => {
  try {
    const documents = await Document.findAll({
      where: { user_id: req.user.id },
    });

    const documentsData = await Promise.all(
      documents.map(async (doc) => {
        let uploadUrl = doc.upload;
        
        if (doc.upload) {
          try {
            const url = await storageService.getUrl(doc.upload, {
              userId: doc.user_id,
              documentId: doc.id,
            });
            if (url) {
              uploadUrl = url;
            }
          } catch (error) {
            logger.warn(`Failed to get URL for document ${doc.id}:`, error);
          }
        }

        return {
          id: doc.id,
          user_id: doc.user_id,
          upload: uploadUrl,
          doc_type: doc.doc_type,
          doc_expire: doc.doc_expire,
          doc_number: doc.doc_number,
          doc_issue: doc.doc_issue,
          doc_category: doc.doc_category,
          identificator: doc.identificator,
          metadata: doc.metadata,
          created_at: doc.created_at,
          updated_at: doc.updated_at,
        };
      })
    );

    return res.json(documentsData);
  } catch (error) {
    logger.error('Get documents error:', error);
    next(error);
  }
});

router.post(
  '/',
  upload.single('upload'),
  [
    body('doc_type').notEmpty().withMessage('Document type is required'),
    body('doc_number').optional().isLength({ max: 128 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      if (!req.file) {
        return res.status(422).json({ errors: ['resource.document.upload_required'] });
      }

      const fileExtension = req.file.originalname.split('.').pop().toLowerCase();
      const allowedExtensions = (process.env.UPLOAD_EXTENSIONS || 'pdf,jpg,jpeg,png').split(',').map(ext => ext.trim().toLowerCase());
      
      if (!allowedExtensions.includes(fileExtension)) {
        return res.status(422).json({ errors: [`resource.document.invalid_extension. Allowed: ${allowedExtensions.join(', ')}`] });
      }

      const document = await Document.create({
        user_id: req.user.id,
        upload: null,
        doc_type: req.body.doc_type,
        doc_expire: req.body.doc_expire || null,
        doc_number: req.body.doc_number || null,
        doc_issue: req.body.doc_issue || null,
        doc_category: req.body.doc_category || null,
        identificator: req.body.identificator || null,
        metadata: req.body.metadata || null,
      });

      try {
        const uploadResult = await storageService.upload(req.file, {
          userId: req.user.id,
          documentId: document.id,
        });

        document.upload = uploadResult.path;
        await document.save();

        const uploadUrl = await storageService.getUrl(uploadResult.path, {
          userId: req.user.id,
          documentId: document.id,
        });

        logger.info(`Document uploaded successfully: ${uploadResult.path}`);

        return res.status(201).json({
          id: document.id,
          user_id: document.user_id,
          upload: uploadUrl || uploadResult.path,
          doc_type: document.doc_type,
          doc_expire: document.doc_expire,
          doc_number: document.doc_number,
          doc_issue: document.doc_issue,
          doc_category: document.doc_category,
          identificator: document.identificator,
          metadata: document.metadata,
          created_at: document.created_at,
          updated_at: document.updated_at,
        });
      } catch (uploadError) {
        await document.destroy();
        logger.error('File upload error:', uploadError);
        return res.status(500).json({ errors: ['resource.document.upload_failed'] });
      }
    } catch (error) {
      logger.error('Create document error:', error);
      next(error);
    }
  }
);

router.delete('/:id', async (req, res, next) => {
  try {
    const document = await Document.findOne({
      where: {
        id: req.params.id,
        user_id: req.user.id,
      },
    });

    if (!document) {
      return res.status(404).json({ errors: ['resource.document.not_found'] });
    }

    if (document.upload) {
      try {
        await storageService.deleteFile(document.upload, {
          userId: req.user.id,
          documentId: document.id,
        });
      } catch (deleteError) {
        logger.warn(`Failed to delete file for document ${document.id}:`, deleteError);
      }
    }

    await document.destroy();

    return res.status(200).json({ message: 'Document deleted successfully' });
  } catch (error) {
    logger.error('Delete document error:', error);
    next(error);
  }
});

module.exports = router;
