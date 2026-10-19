const express = require('express');
const router = express.Router();

const sessionsRouter = require('./sessions');
const usersRouter = require('./users');
const generalRouter = require('./general');
const invitesRouter = require('./invites');

router.use('/sessions', sessionsRouter);
router.use('/users', usersRouter);
router.use('/invites', invitesRouter);
router.use('/', generalRouter);

module.exports = router;

