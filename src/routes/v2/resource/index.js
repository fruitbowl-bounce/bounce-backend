const express = require('express');
const router = express.Router();
const { authorize } = require('../../../middleware/authorize');

const usersRouter = require('./users');
const profilesRouter = require('./profiles');
const phonesRouter = require('./phones');
const documentsRouter = require('./documents');
const labelsRouter = require('./labels');
const otpRouter = require('./otp');
const apiKeysRouter = require('./apiKeys');
const dataStorageRouter = require('./dataStorage');

router.use(authorize);

router.use('/users', usersRouter);
router.use('/profiles', profilesRouter);
router.use('/phones', phonesRouter);
router.use('/documents', documentsRouter);
router.use('/labels', labelsRouter);
router.use('/otp', otpRouter);
router.use('/api_keys', apiKeysRouter);
router.use('/data_storage', dataStorageRouter);

module.exports = router;

