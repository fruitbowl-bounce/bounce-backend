const zxcvbn = require('zxcvbn');

const calculateEntropy = (password) => {
  const result = zxcvbn(password);
  return result.entropy;
};

const validate = (password) => {
  const minEntropy = parseInt(process.env.PASSWORD_MIN_ENTROPY || '50');
  const regexp = new RegExp(process.env.PASSWORD_REGEXP || '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$');
  
  if (!regexp.test(password)) {
    return { valid: false, reason: 'Password does not meet requirements' };
  }
  
  const entropy = calculateEntropy(password);
  if (entropy < minEntropy) {
    return { valid: false, reason: 'Password is too weak', entropy };
  }
  
  return { valid: true, entropy };
};

module.exports = { calculateEntropy, validate, validatePassword: validate };

