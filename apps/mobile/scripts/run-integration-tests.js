#!/usr/bin/env node

/**
 * Integration Test Runner
 *
 * This script runs the integration test suite with proper setup and teardown.
 * It can be used for local development or CI/CD pipelines.
 */

const { spawn } = require("child_process");
const path = require("path");

// Configuration
const config = {
  testTimeout: 60000, // 60 seconds
  verbose: true,
  coverage: false,
  watch: false,
};

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  watch: args.includes("--watch"),
  coverage: args.includes("--coverage"),
  verbose: args.includes("--verbose") || !args.includes("--silent"),
  pattern: args.find((arg) => arg.startsWith("--pattern="))?.split("=")[1],
};

// Build Jest command
const jestArgs = [
  "--testPathPattern=integration",
  "--testTimeout=30000",
  "--maxWorkers=1", // Run integration tests sequentially
];

if (options.watch) {
  jestArgs.push("--watch");
}

if (options.coverage) {
  jestArgs.push("--coverage");
}

if (options.verbose) {
  jestArgs.push("--verbose");
}

if (options.pattern) {
  jestArgs.push(`--testNamePattern=${options.pattern}`);
}

// Add setup files
jestArgs.push("--setupFilesAfterEnv", path.join(__dirname, "../jest.setup.js"));

console.log("🚀 Starting Integration Test Suite...");
console.log(
  `📁 Test Directory: ${path.join(__dirname, "../__tests__/integration")}`
);
console.log(`⚙️  Jest Args: ${jestArgs.join(" ")}`);

// Run Jest
const jestProcess = spawn("npx", ["jest", ...jestArgs], {
  stdio: "inherit",
  cwd: path.join(__dirname, ".."),
  env: {
    ...process.env,
    NODE_ENV: "test",
    CI: process.env.CI || "false",
  },
});

jestProcess.on("close", (code) => {
  if (code === 0) {
    console.log("✅ Integration tests completed successfully!");
  } else {
    console.log(`❌ Integration tests failed with exit code ${code}`);
    process.exit(code);
  }
});

jestProcess.on("error", (error) => {
  console.error("❌ Failed to start Jest:", error);
  process.exit(1);
});

// Handle process termination
process.on("SIGINT", () => {
  console.log("\n🛑 Stopping integration tests...");
  jestProcess.kill("SIGINT");
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Stopping integration tests...");
  jestProcess.kill("SIGTERM");
});
