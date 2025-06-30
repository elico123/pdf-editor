// jest.config.js

/** @type {import('jest').Config} */
const config = {
  // Automatically clear mock calls and instances between every test
  clearMocks: true,

  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: true,

  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',

  // An array of regexp pattern strings used to skip coverage collection
  coveragePathIgnorePatterns: [
    '/node_modules/'
  ],

  // Indicates which provider should be used to instrument code for coverage
  coverageProvider: 'v8', // or 'babel' if you use Babel for transforms

  // An array of file extensions your modules use
  moduleFileExtensions: ['js', 'mjs', 'json', 'jsx', 'node'],

  // The root directory that Jest should scan for tests and modules within
  rootDir: '.',

  // A list of paths to directories that Jest should use to search for files in.
  // Default is <rootDir>
  roots: [
    '<rootDir>/tests'
  ],

  // The glob patterns Jest uses to detect test files.
  testMatch: [
    '**/tests/**/*.(spec|test).js?(x)',
    '**/tests/**/?(*.)+(spec|test).js?(x)',
    '**/?(*.)+(spec|test).js?(x)'
  ],

  // The test environment that will be used for testing
  testEnvironment: 'jest-environment-jsdom',

  // Jest's default resolver does not support export maps.
  // If you encounter issues with imports from packages that use export maps (like uuid),
  // you might need a custom resolver or to adjust your Node version/flags.
  // For Node's ESM support, you might need to run jest with --experimental-vm-modules
  // "scripts": { "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js" } in package.json

  transform: {},
};

export default config;
