const verifyCaptcha = async (response, endpoint) => {
  if (process.env.CAPTCHA_TYPE !== 'recaptcha') {
    return true;
  }

  if (!response) {
    return false;
  }

  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (!secretKey) {
    return true;
  }

  try {
    const fetch = require('node-fetch');
    const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${response}`;
    const result = await fetch(verifyUrl).then(res => res.json());
    return result.success === true;
  } catch (error) {
    return false;
  }
};

module.exports = { verifyCaptcha };

