const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../../../models/User');
const totpService = require('../../../services/totpService');
const logger = require('../../../utils/logger');

router.get('/generate', async (req, res, next) => {
  try {
    const exists = await totpService.exist(req.user.uid);
    if (exists) {
      return res.status(409).json({ errors: ['resource.otp.already_exists'] });
    }

    const otpData = await totpService.create(req.user.uid, req.user.email);

    return res.json({
      secret: otpData.secret,
      qr_code_url: otpData.qrCodeUrl,
      otpauth_url: otpData.otpauth_url,
    });
  } catch (error) {
    logger.error('Generate OTP error:', error);
    next(error);
  }
});

router.post(
  '/enable',
  [
    body('code').notEmpty().withMessage('OTP code is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const exists = await totpService.exist(req.user.uid);
      if (!exists) {
        return res.status(404).json({ errors: ['resource.otp.not_found'] });
      }

      const isValid = await totpService.validate(req.user.uid, req.body.code);
      if (!isValid) {
        return res.status(422).json({ errors: ['resource.otp.invalid_code'] });
      }

      await req.user.update({ otp: true });

      return res.json({ message: 'OTP enabled' });
    } catch (error) {
      logger.error('Enable OTP error:', error);
      next(error);
    }
  }
);

router.post(
  '/disable',
  [
    body('code').notEmpty().withMessage('OTP code is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const isValid = await totpService.validate(req.user.uid, req.body.code);
      if (!isValid) {
        return res.status(422).json({ errors: ['resource.otp.invalid_code'] });
      }

      await totpService.delete(req.user.uid);
      await req.user.update({ otp: false });

      return res.json({ message: 'OTP disabled' });
    } catch (error) {
      logger.error('Disable OTP error:', error);
      next(error);
    }
  }
);

module.exports = router;

