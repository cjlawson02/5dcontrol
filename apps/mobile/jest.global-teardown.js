// Global teardown for Jest integration tests
// This runs once after all tests

module.exports = async () => {
  console.log("🧹 Cleaning up integration test environment...");

  // Clean up any global resources
  // (Test servers should be cleaned up by individual tests)

  console.log("✅ Integration test environment cleaned up");
};
