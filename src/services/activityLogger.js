const Activity = require('../models/Activity');
const logger = require('../utils/logger');

const logActivity = async (params) => {
  try {
    await Activity.create({
      user_id: params.user_id,
      target_uid: params.target_uid || null,
      category: params.category || 'user',
      user_ip: params.user_ip,
      user_ip_country: params.user_ip_country || null,
      user_agent: params.user_agent,
      topic: params.topic,
      action: params.action,
      result: params.result,
      data: params.data || null,
    });
  } catch (error) {
    logger.error('Activity logging error:', error);
  }
};

module.exports = { logActivity };

