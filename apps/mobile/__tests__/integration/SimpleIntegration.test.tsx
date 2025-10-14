import { IntegrationTestHelper } from "./IntegrationTestUtils.util";

describe("Simple Integration Test", () => {
  let testHelper: IntegrationTestHelper;

  beforeEach(() => {
    testHelper = new IntegrationTestHelper();
  });

  afterEach(async () => {
    await testHelper.teardownTestServer();
  });

  it("should create and destroy test server", async () => {
    await testHelper.setupTestServer();

    expect(testHelper.getTestServer()).toBeTruthy();
    expect(testHelper.getTestServer()?.getConnectionCount()).toBe(0);

    await testHelper.teardownTestServer();

    expect(testHelper.getTestServer()).toBeNull();
  });

  it("should generate test URLs", () => {
    const wsUrl = testHelper.getWebSocketUrl();
    const mjpegUrl = testHelper.getMjpegUrl();
    const photoUrl = testHelper.getPhotoUrl();

    expect(wsUrl).toContain("ws://localhost:");
    expect(mjpegUrl).toContain("http://localhost:");
    expect(photoUrl).toContain("http://localhost:");
  });
});
