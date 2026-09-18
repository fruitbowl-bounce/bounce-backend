const express = require('express');
const router = express.Router();
const { adminAuth } = require('../../../middleware/adminAuth');

const usersRouter = require('./users');
const permissionsRouter = require('./permissions');
const activitiesRouter = require('./activities');
const applicationsRouter = require('./applications');
const loanOfferTemplatesRouter = require('./loanOfferTemplates');

router.use(adminAuth);

// Self-contained session probe for the admin panel — deliberately not
// /resource/users/me, which goes through the generic `authorize` middleware
// and its JWT-minting step (config/keys/ has no RSA keypair yet).
router.get('/me', async (req, res, next) => {
  try {
    // Also hands back the session's existing CSRF token, so a page reload
    // doesn't strand the admin panel without one until they log in again.
    res.json({ ...(await req.user.asJsonForEventApi()), csrf_token: req.session.csrfToken });
  } catch (error) {
    next(error);
  }
});

router.use('/users', usersRouter);
router.use('/permissions', permissionsRouter);
router.use('/activities', activitiesRouter);
router.use('/applications', applicationsRouter);
router.use('/loan-offer-templates', loanOfferTemplatesRouter);

module.exports = router;



