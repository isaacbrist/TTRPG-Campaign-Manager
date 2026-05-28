/** @type {import('jest').Config} */
const testReactDir = '/tmp/jest-install/node_modules';

const config = {
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    // Force a single React instance — resolves the "multiple copies of React" problem
    // that arises when jest packages are installed in a separate node_modules tree.
    '^react$':                `${testReactDir}/react`,
    '^react-dom$':            `${testReactDir}/react-dom`,
    '^react-dom/client$':     `${testReactDir}/react-dom/client`,
    '^react-dom/(.*)$':       `${testReactDir}/react-dom/$1`,
    '^@testing-library/(.*)$':`${testReactDir}/@testing-library/$1`,
    // Resolve @/ path alias (matches tsconfig paths)
    '^@/(.*)$':               '<rootDir>/$1',
    // Stub CSS imports
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/fileMock.js',
  },
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': ['babel-jest', { configFile: './babel.test.config.js' }],
  },
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  transformIgnorePatterns: ['/node_modules/(?!(next)/)'],
};

module.exports = config;
