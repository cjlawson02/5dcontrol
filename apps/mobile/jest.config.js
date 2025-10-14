module.exports = {
  preset: "@testing-library/react-native",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testPathIgnorePatterns: ["/node_modules/", "/android/", "/ios/"],
  transformIgnorePatterns: [
    "node_modules/(?!(react-native|@react-native|@react-native-community|@testing-library|expo|@expo|react-native-.*|@react-native-.*|@rneui|ws)/)",
  ],
  collectCoverageFrom: [
    "**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!**/node_modules/**",
    "!**/coverage/**",
    "!**/jest.config.js",
    "!**/jest.setup.js",
    "!**/scripts/**",
    "!**/app.json",
    "!**/expo-env.d.ts",
    "!**/__tests__/integration/**",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@proto/(.*)$": "<rootDir>/../../packages/proto/dist/$1",
  },
  testEnvironment: "jsdom",
  testEnvironmentOptions: {
    customExportConditions: ["node", "node-addons"],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  testTimeout: 30000, // Increased timeout for integration tests
  setupFiles: ["<rootDir>/jest.setup.js"],
  globalSetup: "<rootDir>/jest.global-setup.js",
  globalTeardown: "<rootDir>/jest.global-teardown.js",
};
