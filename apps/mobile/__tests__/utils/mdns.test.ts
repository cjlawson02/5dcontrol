import {
  discoveredServerFromBrowse,
  parseMdnsTxt,
  pickIPv4,
  txtArrayToMap,
} from "../../utils/mdns";
import {
  clamp01,
  liveViewUrlForHost,
  resolveServerPorts,
  wsUrlForHost,
} from "../../utils/serverEndpoints";

describe("mdns TXT contract", () => {
  it("reads ws_port and http_port from TXT", () => {
    const parsed = parseMdnsTxt(
      { version: "1.0", http_port: "8080", ws_port: "8888" },
      9999
    );
    expect(parsed).toMatchObject({
      httpPort: 8080,
      wsPort: 8888,
      version: "1.0",
    });
  });

  it("falls back to the SRV port for HTTP when TXT omits http_port", () => {
    const parsed = parseMdnsTxt({ version: "1.0" }, 8080);
    expect(parsed.httpPort).toBe(8080);
    expect(parsed.wsPort).toBe(8888);
  });

  it("parses key=value arrays from Go zeroconf", () => {
    expect(txtArrayToMap(["version=1.0", "ws_port=8888"])).toEqual({
      version: "1.0",
      ws_port: "8888",
    });
    const parsed = parseMdnsTxt(
      ["version=1.0", "http_port=8080", "ws_port=8888"],
      1
    );
    expect(parsed.httpPort).toBe(8080);
    expect(parsed.wsPort).toBe(8888);
  });

  it("prefers IPv4 addresses and builds a discovered server", () => {
    expect(pickIPv4(["fe80::1", "192.168.1.50"])).toBe("192.168.1.50");
    const server = discoveredServerFromBrowse({
      name: "5DControl",
      host: "5DControl.local.",
      port: 8080,
      addresses: ["192.168.1.50"],
      txt: { http_port: "8080", ws_port: "8888", version: "1.0" },
    });
    expect(server).toEqual({
      id: "5DControl@192.168.1.50:8080:8888",
      name: "5DControl",
      host: "192.168.1.50",
      ports: { httpPort: 8080, wsPort: 8888 },
      version: "1.0",
    });
  });
});

describe("serverEndpoints", () => {
  it("builds dual-port URLs", () => {
    expect(wsUrlForHost("10.0.0.1")).toBe("ws://10.0.0.1:8888/ws");
    expect(liveViewUrlForHost("10.0.0.1")).toBe(
      "http://10.0.0.1:8080/live.mjpeg"
    );
    expect(wsUrlForHost("10.0.0.1", 18888)).toBe("ws://10.0.0.1:18888/ws");
  });

  it("resolves missing ports to defaults", () => {
    expect(resolveServerPorts()).toEqual({ wsPort: 8888, httpPort: 8080 });
    expect(resolveServerPorts({ wsPort: 0, httpPort: 99999 })).toEqual({
      wsPort: 8888,
      httpPort: 8080,
    });
  });

  it("clamps normalized focus coords", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.25)).toBe(0.25);
  });
});
