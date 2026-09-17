require('dotenv').config();
const repl = require('repl');
const vm = require('vm');
const { sequelize } = require('./src/config/database');
const { initializeModels } = require('./src/models');
const logger = require('./src/utils/logger');

const jwtService = require('./src/services/jwtService');
const encryptionService = require('./src/services/encryptionService');
const passwordStrengthChecker = require('./src/services/passwordStrengthChecker');
const totpService = require('./src/services/totpService');
const captchaService = require('./src/services/captchaService');
const apiKeyVerifier = require('./src/services/apiKeyVerifier');
const activityLogger = require('./src/services/activityLogger');
const sessionService = require('./src/services/sessionService');

const uidGenerator = require('./src/utils/uidGenerator');
const saltedCrc32 = require('./src/utils/saltedCrc32');

const { Sequelize } = require('sequelize');

const asyncEval = async (cmd, context, filename, callback) => {
  try {
    const trimmedCmd = cmd.trim();
    const hasAwait = /\bawait\s+/.test(trimmedCmd);
    
    let result;
    if (hasAwait) {
      const vmContext = vm.createContext({});
      Object.keys(context).forEach(key => {
        vmContext[key] = context[key];
      });
      
      const wrappedCmd = trimmedCmd.startsWith('await ')
        ? `(async () => { return ${trimmedCmd} })()`
        : `(async () => { ${trimmedCmd} })()`;
      
      const script = new vm.Script(wrappedCmd, { filename });
      result = await script.runInContext(vmContext);
      
      Object.keys(vmContext).forEach(key => {
        if (!(key in context) || vmContext[key] !== context[key]) {
          context[key] = vmContext[key];
        }
      });
    } else {
      result = eval(trimmedCmd);
      if (result && typeof result.then === 'function') {
        result = await result;
      }
    }
    callback(null, result);
  } catch (error) {
    if (error.constructor.name === 'SyntaxError' || error.constructor.name === 'ReferenceError') {
      callback(error);
    } else {
      callback(null, error);
    }
  }
};

(async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established');

    const models = await initializeModels();
    logger.info('Models initialized');

    const r = repl.start({
      prompt: 'barong > ',
      eval: asyncEval,
      useColors: true,
      ignoreUndefined: true,
    });

    r.context.sequelize = sequelize;
    r.context.Sequelize = Sequelize;
    r.context.Op = Sequelize.Op;

    Object.keys(models).forEach(modelName => {
      r.context[modelName] = models[modelName];
    });

    r.context.models = models;
    r.context.db = models;

    r.context.services = {
      jwt: jwtService,
      encryption: encryptionService,
      password: passwordStrengthChecker,
      totp: totpService,
      captcha: captchaService,
      apiKey: apiKeyVerifier,
      activity: activityLogger,
      session: sessionService,
    };

    r.context.utils = {
      uid: uidGenerator,
      crc32: saltedCrc32,
      logger: logger,
    };

    r.context.help = () => {
      console.log('\n=== Barong Console Help ===\n');
      console.log('Models:');
      Object.keys(models).forEach(name => {
        console.log(`  - ${name}`);
      });
      console.log('\nServices:');
      Object.keys(r.context.services).forEach(name => {
        console.log(`  - services.${name}`);
      });
      console.log('\nUtilities:');
      Object.keys(r.context.utils).forEach(name => {
        console.log(`  - utils.${name}`);
      });
      console.log('\nDatabase:');
      console.log('  - sequelize (Sequelize instance)');
      console.log('  - Sequelize (Sequelize class)');
      console.log('  - Op (Sequelize operators)');
      console.log('\nExamples:');
      console.log('  await User.findAll()');
      console.log('  await User.findOne({ where: { email: "test@example.com" } })');
      console.log('  await User.create({ email: "new@example.com", password: "password123" })');
      console.log('  await sequelize.query("SELECT * FROM users LIMIT 5")');
      console.log('  services.jwt.encode({ uid: "123" })');
      console.log('\n');
    };

    r.context.reload = async () => {
      delete require.cache[require.resolve('./src/models')];
      delete require.cache[require.resolve('./src/config/database')];
      const { initializeModels: reloadModels } = require('./src/models');
      const reloadedModels = await reloadModels();
      Object.keys(reloadedModels).forEach(modelName => {
        r.context[modelName] = reloadedModels[modelName];
      });
      r.context.models = reloadedModels;
      r.context.db = reloadedModels;
      console.log('Models reloaded');
    };

    r.context.exit = () => {
      console.log('Exiting console...');
      sequelize.close().then(() => {
        process.exit(0);
      });
    };

    r.on('exit', () => {
      sequelize.close().then(() => {
        logger.info('Database connection closed');
        process.exit(0);
      });
    });

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║           Barong Console - Rails-like REPL                ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    console.log('Available models:', Object.keys(models).join(', '));
    console.log('Type help() for more information');
    console.log('Type exit() or press Ctrl+D to exit\n');

  } catch (error) {
    logger.error('Failed to start console:', error);
    process.exit(1);
  }
})();

