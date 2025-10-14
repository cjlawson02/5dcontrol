import { ControlType, Message, MessageType, Status } from "@proto/control";
import { Builder, ByteBuffer } from "flatbuffers";
import { Server } from "http";
import { WebSocketServer } from "ws";

export interface TestServerConfig {
  port: number;
  mjpegPort: number;
  mockCamera?: boolean;
  batteryLevel?: number;
  cameraConnected?: boolean;
}

export class TestServer {
  private httpServer: Server | null = null;
  private wsServer: WebSocketServer | null = null;
  private mjpegServer: Server | null = null;
  private config: TestServerConfig;
  private connections: Set<any> = new Set();
  private frameCount = 0;

  constructor(config: TestServerConfig) {
    this.config = {
      mockCamera: true,
      batteryLevel: 85,
      cameraConnected: true,
      ...config,
    };
  }

  async start(): Promise<void> {
    await this.startWebSocketServer();
    await this.startMjpegServer();
  }

  async stop(): Promise<void> {
    // Close all WebSocket connections
    this.connections.forEach((conn) => {
      if (conn.readyState === conn.OPEN) {
        conn.close();
      }
    });
    this.connections.clear();

    // Close servers
    if (this.wsServer) {
      this.wsServer.close();
      this.wsServer = null;
    }
    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
    }
    if (this.mjpegServer) {
      this.mjpegServer.close();
      this.mjpegServer = null;
    }
  }

  private async startWebSocketServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      const http = require("http");
      this.httpServer = http.createServer();
      this.wsServer = new WebSocketServer({ server: this.httpServer });

      this.wsServer.on("connection", (ws) => {
        this.connections.add(ws);
        console.log("Test server: WebSocket client connected");

        // Send initial status
        this.sendStatus(ws);

        ws.on("message", (data: Buffer) => {
          this.handleMessage(ws, data);
        });

        ws.on("close", () => {
          this.connections.delete(ws);
          console.log("Test server: WebSocket client disconnected");
        });

        ws.on("error", (error) => {
          console.error("Test server: WebSocket error:", error);
          this.connections.delete(ws);
        });
      });

      this.httpServer.listen(this.config.port, (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          console.log(
            `Test server: WebSocket server listening on port ${this.config.port}`
          );
          resolve();
        }
      });
    });
  }

  private async startMjpegServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      const http = require("http");
      this.mjpegServer = http.createServer((req: any, res: any) => {
        if (req.url === "/live.mjpeg") {
          this.handleMjpegRequest(res);
        } else if (req.url === "/photo.jpg") {
          this.handlePhotoRequest(res);
        } else {
          res.writeHead(404);
          res.end("Not Found");
        }
      });

      this.mjpegServer.listen(this.config.mjpegPort, (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          console.log(
            `Test server: MJPEG server listening on port ${this.config.mjpegPort}`
          );
          resolve();
        }
      });
    });
  }

  private sendStatus(ws: any): void {
    const builder = new Builder(64);

    // Build Status table
    Status.startStatus(builder);
    Status.addCameraConnected(builder, this.config.cameraConnected!);
    Status.addBatteryLevel(builder, this.config.batteryLevel!);
    const statusOffset = Status.endStatus(builder);

    // Build Message table
    Message.startMessage(builder);
    Message.addMessageType(builder, MessageType.STATUS);
    Message.addStatus(builder, statusOffset);
    const messageOffset = Message.endMessage(builder);

    builder.finish(messageOffset);
    const data = builder.asUint8Array();

    if (ws.readyState === ws.OPEN) {
      ws.send(data);
    }
  }

  private handleMessage(ws: any, data: Buffer): void {
    try {
      const buffer = new ByteBuffer(data);
      const message = Message.getRootAsMessage(buffer);

      if (message.messageType() === MessageType.COMMAND) {
        const command = message.command();
        if (command) {
          switch (command.type()) {
            case ControlType.FOCUS:
              console.log("Test server: Focus command received");
              // Simulate focus delay
              setTimeout(() => {
                this.sendStatus(ws);
              }, 100);
              break;
            case ControlType.CAPTURE:
              console.log("Test server: Capture command received");
              // Simulate capture delay
              setTimeout(() => {
                this.sendStatus(ws);
              }, 200);
              break;
            case ControlType.QUERY_STATUS:
              console.log("Test server: Status query received");
              this.sendStatus(ws);
              break;
          }
        }
      }
    } catch (error) {
      console.error("Test server: Error handling message:", error);
    }
  }

  private handleMjpegRequest(res: any): void {
    res.writeHead(200, {
      "Content-Type": "multipart/x-mixed-replace; boundary=frame",
      "Cache-Control": "no-cache",
      Connection: "close",
    });

    const sendFrame = () => {
      if (res.destroyed) return;

      // Create a simple test frame (1x1 pixel JPEG)
      const frame = this.createTestFrame();
      const boundary = "\r\n--frame\r\n";
      const headers =
        "Content-Type: image/jpeg\r\nContent-Length: " +
        frame.length +
        "\r\n\r\n";

      res.write(boundary + headers);
      res.write(frame);
      res.write("\r\n");

      this.frameCount++;

      // Send next frame after 33ms (30fps)
      setTimeout(sendFrame, 33);
    };

    sendFrame();
  }

  private handlePhotoRequest(res: any): void {
    const frame = this.createTestFrame();
    res.writeHead(200, {
      "Content-Type": "image/jpeg",
      "Content-Length": frame.length,
    });
    res.end(frame);
  }

  private createTestFrame(): Buffer {
    // Create a simple 1x1 pixel JPEG for testing
    // This is a minimal valid JPEG file
    const jpegData = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
      0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
      0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
      0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
      0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xff, 0xc4,
      0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xda, 0x00, 0x0c,
      0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3f, 0x00, 0x80, 0xff,
      0xd9,
    ]);
    return jpegData;
  }

  // Test helper methods
  getConnectionCount(): number {
    return this.connections.size;
  }

  getFrameCount(): number {
    return this.frameCount;
  }

  updateBatteryLevel(level: number): void {
    this.config.batteryLevel = level;
    // Send status update to all connected clients
    this.connections.forEach((conn) => {
      if (conn.readyState === conn.OPEN) {
        this.sendStatus(conn);
      }
    });
  }

  updateCameraStatus(connected: boolean): void {
    this.config.cameraConnected = connected;
    // Send status update to all connected clients
    this.connections.forEach((conn) => {
      if (conn.readyState === conn.OPEN) {
        this.sendStatus(conn);
      }
    });
  }

  getWebSocketUrl(): string {
    return `ws://localhost:${this.config.port}`;
  }

  getMjpegUrl(): string {
    return `http://localhost:${this.config.mjpegPort}/live.mjpeg`;
  }

  getPhotoUrl(): string {
    return `http://localhost:${this.config.mjpegPort}/photo.jpg`;
  }
}
