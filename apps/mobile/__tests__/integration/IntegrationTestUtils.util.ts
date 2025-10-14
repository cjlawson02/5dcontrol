import { ControlType } from "@proto/control";
import { TestServer } from "./TestServer.util";

export interface IntegrationTestConfig {
  serverPort: number;
  mjpegPort: number;
  testTimeout: number;
}

export const DEFAULT_CONFIG: IntegrationTestConfig = {
  serverPort: 8889,
  mjpegPort: 8081,
  testTimeout: 10000,
};

export class IntegrationTestHelper {
  private testServer: TestServer | null = null;
  private config: IntegrationTestConfig;

  constructor(config: IntegrationTestConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  async setupTestServer(): Promise<TestServer> {
    this.testServer = new TestServer({
      port: this.config.serverPort,
      mjpegPort: this.config.mjpegPort,
      mockCamera: true,
      batteryLevel: 85,
      cameraConnected: true,
    });

    await this.testServer.start();
    return this.testServer;
  }

  async teardownTestServer(): Promise<void> {
    if (this.testServer) {
      await this.testServer.stop();
      this.testServer = null;
    }
  }

  getTestServer(): TestServer | null {
    return this.testServer;
  }

  // Helper to wait for WebSocket connection
  async waitForConnection(timeout: number = 5000): Promise<void> {
    if (!this.testServer) {
      throw new Error("Test server not initialized");
    }

    const startTime = Date.now();
    while (this.testServer.getConnectionCount() === 0) {
      if (Date.now() - startTime > timeout) {
        throw new Error("Timeout waiting for WebSocket connection");
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // Helper to wait for MJPEG frames
  async waitForFrames(
    frameCount: number,
    timeout: number = 5000
  ): Promise<void> {
    if (!this.testServer) {
      throw new Error("Test server not initialized");
    }

    const startTime = Date.now();
    while (this.testServer.getFrameCount() < frameCount) {
      if (Date.now() - startTime > timeout) {
        throw new Error(
          `Timeout waiting for ${frameCount} frames. Got ${this.testServer.getFrameCount()}`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // Helper to simulate camera status changes
  async simulateCameraDisconnect(): Promise<void> {
    if (!this.testServer) {
      throw new Error("Test server not initialized");
    }
    this.testServer.updateCameraStatus(false);
  }

  async simulateCameraReconnect(): Promise<void> {
    if (!this.testServer) {
      throw new Error("Test server not initialized");
    }
    this.testServer.updateCameraStatus(true);
  }

  // Helper to simulate battery level changes
  async simulateBatteryChange(level: number): Promise<void> {
    if (!this.testServer) {
      throw new Error("Test server not initialized");
    }
    this.testServer.updateBatteryLevel(level);
  }

  // Helper to create test URLs
  getWebSocketUrl(): string {
    return `ws://localhost:${this.config.serverPort}`;
  }

  getMjpegUrl(): string {
    return `http://localhost:${this.config.mjpegPort}/live.mjpeg`;
  }

  getPhotoUrl(): string {
    return `http://localhost:${this.config.mjpegPort}/photo.jpg`;
  }
}

// Mock implementations for testing
export const mockWebSocket = {
  close: jest.fn(),
  send: jest.fn(),
  onopen: null as (() => void) | null,
  onclose: null as ((event: any) => void) | null,
  onerror: null as ((error: any) => void) | null,
  onmessage: null as ((event: any) => void) | null,
  readyState: 1, // OPEN
};

export const mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

// Test data generators
export const createTestCommand = (type: ControlType): Uint8Array => {
  const { Command, Message, MessageType } = require("@proto/control");
  const { Builder } = require("flatbuffers");

  const builder = new Builder(64);

  Command.startCommand(builder);
  Command.addType(builder, type);
  const commandOffset = Command.endCommand(builder);

  Message.startMessage(builder);
  Message.addMessageType(builder, MessageType.COMMAND);
  Message.addCommand(builder, commandOffset);
  const messageOffset = Message.endMessage(builder);

  builder.finish(messageOffset);
  return builder.asUint8Array();
};

export const createTestStatus = (
  cameraConnected: boolean,
  batteryLevel: number
): Uint8Array => {
  const { Status, Message, MessageType } = require("@proto/control");
  const { Builder } = require("flatbuffers");

  const builder = new Builder(64);

  Status.startStatus(builder);
  Status.addCameraConnected(builder, cameraConnected);
  Status.addBatteryLevel(builder, batteryLevel);
  const statusOffset = Status.endStatus(builder);

  Message.startMessage(builder);
  Message.addMessageType(builder, MessageType.STATUS);
  Message.addStatus(builder, statusOffset);
  const messageOffset = Message.endMessage(builder);

  builder.finish(messageOffset);
  return builder.asUint8Array();
};

// Test assertions
export const expectWebSocketMessage = (
  mockSend: jest.Mock,
  expectedType: ControlType
) => {
  expect(mockSend).toHaveBeenCalled();
  const callArgs = mockSend.mock.calls[0][0];
  expect(callArgs).toBeInstanceOf(Uint8Array);
  expect(callArgs.length).toBeGreaterThan(0);
};

export const expectStatusUpdate = (
  status: any,
  cameraConnected: boolean,
  batteryLevel: number
) => {
  expect(status.cameraConnected).toBe(cameraConnected);
  expect(status.batteryLevel).toBe(batteryLevel);
};
