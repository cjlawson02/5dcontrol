// Global setup for Jest integration tests
// This runs once before all tests

module.exports = async () => {
  console.log("🚀 Setting up integration test environment...");

  // Set up global test environment
  process.env.NODE_ENV = "test";

  console.log("✅ Integration test environment ready");
};
