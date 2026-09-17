'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const permissions = [
      { action: 'ACCEPT', role: 'member', verb: 'GET', path: '/api/v2/nebryx/resource/users/me', topic: 'user' },
      { action: 'ACCEPT', role: 'member', verb: 'PUT', path: '/api/v2/nebryx/resource/users/me', topic: 'user' },
      { action: 'ACCEPT', role: 'member', verb: 'PUT', path: '/api/v2/nebryx/resource/users/password', topic: 'password' },
      { action: 'ACCEPT', role: 'member', verb: 'GET', path: '/api/v2/nebryx/resource/users/activity', topic: 'account' },
      { action: 'ACCEPT', role: 'member', verb: 'GET', path: '/api/v2/nebryx/resource/profiles', topic: 'profile' },
      { action: 'ACCEPT', role: 'member', verb: 'POST', path: '/api/v2/nebryx/resource/profiles', topic: 'profile' },
      { action: 'ACCEPT', role: 'member', verb: 'GET', path: '/api/v2/nebryx/resource/phones', topic: 'phone' },
      { action: 'ACCEPT', role: 'member', verb: 'POST', path: '/api/v2/nebryx/resource/phones', topic: 'phone' },
      { action: 'ACCEPT', role: 'member', verb: 'GET', path: '/api/v2/nebryx/resource/documents', topic: 'document' },
      { action: 'ACCEPT', role: 'member', verb: 'POST', path: '/api/v2/nebryx/resource/documents', topic: 'document' },
      { action: 'ACCEPT', role: 'member', verb: 'GET', path: '/api/v2/nebryx/resource/labels', topic: 'label' },
      { action: 'ACCEPT', role: 'member', verb: 'POST', path: '/api/v2/nebryx/resource/labels', topic: 'label' },
      { action: 'ACCEPT', role: 'member', verb: 'GET', path: '/api/v2/nebryx/resource/otp', topic: 'otp' },
      { action: 'ACCEPT', role: 'member', verb: 'POST', path: '/api/v2/nebryx/resource/otp', topic: 'otp' },
      { action: 'ACCEPT', role: 'member', verb: 'GET', path: '/api/v2/nebryx/resource/api_keys', topic: 'apikey' },
      { action: 'ACCEPT', role: 'member', verb: 'POST', path: '/api/v2/nebryx/resource/api_keys', topic: 'apikey' },
      { action: 'ACCEPT', role: 'member', verb: 'DELETE', path: '/api/v2/nebryx/resource/api_keys', topic: 'apikey' },
      { action: 'ACCEPT', role: 'member', verb: 'GET', path: '/api/v2/nebryx/resource/data_storage', topic: 'data_storage' },
      { action: 'ACCEPT', role: 'member', verb: 'POST', path: '/api/v2/nebryx/resource/data_storage', topic: 'data_storage' },
      { action: 'ACCEPT', role: 'admin', verb: 'ALL', path: '/api/v2/nebryx', topic: 'admin' },
      { action: 'ACCEPT', role: 'superadmin', verb: 'ALL', path: '/api/v2/nebryx', topic: 'admin' },
    ];

    await queryInterface.bulkInsert('permissions', permissions.map(p => ({
      ...p,
      created_at: new Date(),
      updated_at: new Date(),
    })));
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('permissions', null, {});
  }
};


