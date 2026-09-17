const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Phone = require('../../../models/Phone');
const Label = require('../../../models/Label');
const { sendConfirmation, verifyCode } = require('../../../services/sms/smsService');
const { logActivity } = require('../../../services/activityLogger');
const { getRemoteIP } = require('../../../middleware/authorize');
const logger = require('../../../utils/logger');

router.get('/me', async (req, res, next) => {
  try {
    const phones = await Phone.findAll({
      where: { user_id: req.user.id },
    });

    const phonesData = phones.map(phone => ({
      id: phone.id,
      user_id: phone.user_id,
      country: phone.country,
      number: phone.number,
      validated_at: phone.validated_at,
      created_at: phone.created_at,
      updated_at: phone.updated_at,
    }));

    return res.json(phonesData);
  } catch (error) {
    logger.error('Get phones error:', error);
    next(error);
  }
});

router.post(
  '/',
  [
    body('number')
      .exists()
      .withMessage('Phone number is required')
      .bail()
      .trim()
      .notEmpty()
      .withMessage('Phone number cannot be empty')
      .bail()
      .isLength({ min: 1 })
      .withMessage('Phone number must be at least 1 character'),
    body('channel')
      .optional()
      .trim()
      .isIn(['sms', 'call'])
      .withMessage('Invalid channel. Must be "sms" or "call"'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(e => e.msg);
        return res.status(422).json({ errors: errorMessages });
      }

      if (!req.body.number || req.body.number.trim() === '') {
        logger.error('Number field is missing or empty after validation:', req.body);
        return res.status(422).json({ errors: ['Phone number is required'] });
      }

      const channel = req.body.channel || 'sms';
      const rawNumber = req.body.number.trim();
      
      const parsedNumber = Phone.parse(rawNumber);
      if (!parsedNumber || !parsedNumber.isValid()) {
        return res.status(422).json({ errors: ['resource.phone.invalid_num'] });
      }

      const internationalNumber = parsedNumber.number;
      const existingPhone = await Phone.findByNumber(internationalNumber, { user_id: req.user.id });

      if (existingPhone) {
        return res.status(422).json({ errors: ['resource.phone.number_exists'] });
      }

      const { encrypt } = require('../../../services/encryptionService');
      const { generateHash } = require('../../../utils/saltedCrc32');
      
      const phone = Phone.build({
        user_id: req.user.id,
        number_encrypted: encrypt(internationalNumber),
        number_index: generateHash(internationalNumber),
        country: parsedNumber.country || 'US',
      });
      await phone.save();

      try {
        await sendConfirmation(phone, channel);
      } catch (smsError) {
        logger.error('SMS send error:', smsError);
        await phone.destroy();
        return res.status(422).json({ errors: ['resource.phone.twillio'] });
      }

      await logActivity({
        user_id: req.user.id,
        action: 'create phone',
        result: 'succeed',
        topic: 'account',
        user_ip: getRemoteIP(req),
        user_agent: req.headers['user-agent'],
        path: req.path,
        verb: req.method,
      });

      return res.status(201).json({
        message: `Code was sent successfully via ${channel}`,
      });
    } catch (error) {
      logger.error('Create phone error:', error);
      next(error);
    }
  }
);

router.post(
  '/send_code',
  [
    body('number').notEmpty().withMessage('Phone number is required'),
    body('channel').optional().isIn(['sms', 'call']).withMessage('Invalid channel'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const channel = req.body.channel || 'sms';
      const rawNumber = req.body.number.trim();
      const internationalNumber = Phone.international(rawNumber);
      const phone = await Phone.findByNumber(internationalNumber, { user_id: req.user.id });

      if (!phone) {
        return res.status(404).json({ errors: ['resource.phone.doesnt_exist'] });
      }

      phone.code = Math.floor(10000 + Math.random() * 90000).toString();
      await phone.save();

      try {
        await sendConfirmation(phone, channel);
      } catch (smsError) {
        logger.error('SMS send error:', smsError);
        return res.status(422).json({ errors: ['resource.phone.twillio'] });
      }

      await logActivity({
        user_id: req.user.id,
        action: 'resend phone code',
        result: 'succeed',
        topic: 'account',
        user_ip: getRemoteIP(req),
        user_agent: req.headers['user-agent'],
        path: req.path,
        verb: req.method,
      });

      return res.status(200).json({
        message: `Code was sent successfully via ${channel}`,
      });
    } catch (error) {
      logger.error('Send code error:', error);
      next(error);
    }
  }
);

router.post(
  '/verify',
  [
    body('number').notEmpty().withMessage('Phone number is required'),
    body('verification_code').notEmpty().withMessage('Verification code is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map(e => e.msg) });
      }

      const rawNumber = req.body.number.trim();
      const internationalNumber = Phone.international(rawNumber);
      const verificationCode = req.body.verification_code;
      const phone = await Phone.findByNumber(internationalNumber, { user_id: req.user.id });

      if (!phone) {
        return res.status(404).json({ errors: ['resource.phone.doesnt_exist'] });
      }

      const isValid = await verifyCode({
        number: internationalNumber,
        code: verificationCode,
        user: req.user,
      });

      if (!isValid) {
        await logActivity({
          user_id: req.user.id,
          action: 'verify phone',
          result: 'failed',
          topic: 'account',
          user_ip: getRemoteIP(req),
          user_agent: req.headers['user-agent'],
          path: req.path,
          verb: req.method,
        });

        return res.status(404).json({ errors: ['resource.phone.verification_invalid'] });
      }

      phone.validated_at = new Date();
      await phone.save();

      const [label] = await Label.findOrCreate({
        where: {
          user_id: req.user.id,
          key: 'phone',
          scope: 'private',
        },
        defaults: {
          value: 'verified',
        },
      });

      if (label.value !== 'verified') {
        label.value = 'verified';
        await label.save();
      }

      await logActivity({
        user_id: req.user.id,
        action: 'verify phone',
        result: 'succeed',
        topic: 'account',
        user_ip: getRemoteIP(req),
        user_agent: req.headers['user-agent'],
        path: req.path,
        verb: req.method,
      });

      const User = require('../../../models/User');
      const Profile = require('../../../models/Profile');
      const user = await User.findByPk(req.user.id, {
        include: [
          { model: Profile, as: 'profiles' },
          { model: Phone, as: 'phones' },
          { model: Label, as: 'labels' },
        ],
      });

      return res.status(200).json(await user.asJsonForEventApi());
    } catch (error) {
      logger.error('Verify phone error:', error);
      next(error);
    }
  }
);

module.exports = router;

