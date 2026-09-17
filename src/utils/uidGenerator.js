const crypto = require('crypto');

const generateUID = async (prefix = 'ID', checkUniqueness = null) => {
  let uid;
  let exists = true;
  let attempts = 0;
  const maxAttempts = 100;
  
  while (exists && attempts < maxAttempts) {
    const randomHex = crypto.randomBytes(5).toString('hex').toUpperCase();
    uid = `${prefix.toUpperCase()}${randomHex}`;
    
    if (checkUniqueness) {
      exists = await checkUniqueness(uid);
    } else {
      exists = false;
    }
    
    attempts++;
  }
  
  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique UID after maximum attempts');
  }
  
  return uid;
};

module.exports = { generateUID };

