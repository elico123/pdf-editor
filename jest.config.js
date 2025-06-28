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
  moduleFileExtensions: ['js', 'mjs', 'json', 'jsx', 'ts', 'tsx', 'node'],

  // The root directory that Jest should scan for tests and modules within
  rootDir: '.',

  // A list of paths to directories that Jest should use to search for files in.
  // Default is <rootDir>
  roots: [
    '<rootDir>/tests'
  ],

  // The glob patterns Jest uses to detect test files.
  testMatch: [
    '**/tests/**/*.(spec|test).mjs', // For files like utils.spec.mjs or utils.test.mjs in tests/
    '**/tests/**/?(*.)+(spec|test).js', // Keep if you might have .js tests too
    '**/?(*.)+(spec|test).mjs', // For files like utils.test.mjs anywhere
    '**/?(*.)+(spec|test).js' // Keep default for .js files anywhere
  ],

  // The test environment that will be used for testing
  testEnvironment: 'jest-environment-jsdom',

  // Jest's default resolver does not support export maps.
  // If you encounter issues with imports from packages that use export maps (like uuid),
  // you might need a custom resolver or to adjust your Node version/flags.
  // For Node's ESM support, you might need to run jest with --experimental-vm-modules
  // "scripts": { "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js" } in package.json

  // If you are NOT using Babel for transpilation (i.e., relying on native Node ESM support for .mjs)
  // and Jest tries to transform .mjs files, you might need to tell it not to:
  transform: {
    // '^.+\\.mjs$': 'babel-jest', // Use this if you want Babel to process .mjs files
  },
  // Or, if you want no transformation for .mjs and are sure Node handles it:
  // transform: {}, // This might be needed if Jest tries to transform .mjs files by default with an older setup

  // To ensure Jest processes .mjs files as ES modules if "type": "module" isn't enough for Jest's context
  // extensionsToTreatAsEsm: ['.mjs'], // This can sometimes help Jest recognize .mjs as ESM
};

export default config;
