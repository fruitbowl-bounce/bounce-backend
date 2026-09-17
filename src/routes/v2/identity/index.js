const express = require('express');
const router = express.Router();

const sessionsRouter = require('./sessions');
const usersRouter = require('./users');
const generalRouter = require('./general');

router.use('/sessions', sessionsRouter);
router.use('/users', usersRouter);
router.use('/', generalRouter);

module.exports = router;

