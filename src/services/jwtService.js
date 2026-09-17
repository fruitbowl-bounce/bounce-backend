const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

let privateKey = null;
let publicKey = null;

const loadKeys = () => {
  if (!privateKey || !publicKey) {
    const privateKeyPath = process.env.JWT_PRIVATE_KEY_PATH || path.join(__dirname, '../../config/keys/private.pem');
    const publicKeyPath = process.env.JWT_PUBLIC_KEY_PATH || path.join(__dirname, '../../config/keys/public.pem');
    
    try {
      privateKey = fs.readFileSync(privateKeyPath, 'utf8');
      publicKey = fs.readFileSync(publicKeyPath, 'utf8');
    } catch (error) {
      throw new Error('JWT keys not found. Please generate them first.');
    }
  }
  return { privateKey, publicKey };
};

const encode = (payload, options = {}) => {
  const { privateKey } = loadKeys();
  const signOptions = {
    algorithm: 'RS256',
    ...options,
  };
  
  if (!payload.exp && !signOptions.expiresIn) {
    signOptions.expiresIn = '1h';
  }
  
  return jwt.sign(payload, privateKey, signOptions);
};

const decode = (token, options = {}) => {
  const { publicKey } = loadKeys();
  try {
    const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'], ...options });
    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
};

module.exports = { encode, decode };

