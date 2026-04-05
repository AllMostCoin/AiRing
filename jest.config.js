'use strict';

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  // Reset mock state (calls + implementations) between every test so that
  // each test is fully independent of others.
  resetMocks: true,
};
