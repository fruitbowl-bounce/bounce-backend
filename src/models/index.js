const { sequelize } = require('../config/database');
const User = require('./User');
const Activity = require('./Activity');
const Permission = require('./Permission');
const Profile = require('./Profile');
const Phone = require('./Phone');
const Document = require('./Document');
const APIKey = require('./APIKey');
const Label = require('./Label');
const Level = require('./Level');
const ServiceAccount = require('./ServiceAccount');
const Restriction = require('./Restriction');
const DataStorage = require('./DataStorage');
const Comment = require('./Comment');
const FormSubmission = require('./FormSubmission');
const FormSubmissionDirector = require('./FormSubmissionDirector');
const FormSubmissionDocument = require('./FormSubmissionDocument');
const FormSubmissionReminderEmail = require('./FormSubmissionReminderEmail');
const LoanOfferTemplate = require('./LoanOfferTemplate');

const initializeModels = async () => {
  User.hasMany(Profile, { foreignKey: 'user_id', as: 'profiles' });
  User.hasMany(Phone, { foreignKey: 'user_id', as: 'phones' });
  User.hasMany(Document, { foreignKey: 'user_id', as: 'documents' });
  User.hasMany(Activity, { foreignKey: 'user_id', as: 'activities' });
  User.hasMany(Label, { foreignKey: 'user_id', as: 'labels' });
  User.hasMany(DataStorage, { foreignKey: 'user_id', as: 'dataStorages' });
  User.hasMany(Comment, { foreignKey: 'user_id', as: 'comments' });
  User.hasMany(APIKey, { foreignKey: 'key_holder_account_id', as: 'apiKeys' });
  User.hasMany(ServiceAccount, { foreignKey: 'owner_id', as: 'serviceAccounts' });

  Profile.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  Phone.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  Document.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  Activity.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  Label.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  DataStorage.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  Comment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  APIKey.belongsTo(User, { foreignKey: 'key_holder_account_id', as: 'keyHolder' });
  ServiceAccount.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });

  FormSubmission.hasMany(FormSubmissionDirector, { foreignKey: 'form_submission_id', as: 'directors' });
  FormSubmissionDirector.belongsTo(FormSubmission, { foreignKey: 'form_submission_id', as: 'formSubmission' });

  FormSubmission.hasMany(FormSubmissionDocument, { foreignKey: 'form_submission_id', as: 'documents' });
  FormSubmissionDocument.belongsTo(FormSubmission, { foreignKey: 'form_submission_id', as: 'formSubmission' });

  FormSubmission.hasMany(FormSubmissionReminderEmail, { foreignKey: 'form_submission_id', as: 'reminderEmails' });
  FormSubmissionReminderEmail.belongsTo(FormSubmission, { foreignKey: 'form_submission_id', as: 'formSubmission' });

  return {
    User,
    Activity,
    Permission,
    Profile,
    Phone,
    Document,
    APIKey,
    Label,
    Level,
    ServiceAccount,
    Restriction,
    DataStorage,
    Comment,
    FormSubmission,
    FormSubmissionDirector,
    FormSubmissionDocument,
    FormSubmissionReminderEmail,
    LoanOfferTemplate,
  };
};

module.exports = { initializeModels };

