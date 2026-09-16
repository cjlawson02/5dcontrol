export const DEFAULT_HTTP_PORT = 8080;
export const DEFAULT_WS_PORT = 8888;

export type ServerPorts = {
  wsPort: number;
  httpPort: number;
};

export function normalizePort(
  value: number | undefined,
  fallback: number
): number {
  if (!value || !Number.isFinite(value) || value <= 0 || value > 65535) {
    return fallback;
  }
  return Math.trunc(value);
}

export function resolveServerPorts(
  ports?: Partial<ServerPorts>
): ServerPorts {
  return {
    wsPort: normalizePort(ports?.wsPort, DEFAULT_WS_PORT),
    httpPort: normalizePort(ports?.httpPort, DEFAULT_HTTP_PORT),
  };
}

export function wsUrlForHost(host: string, wsPort = DEFAULT_WS_PORT): string {
  return `ws://${host}:${wsPort}/ws`;
}

export function liveViewUrlForHost(
  host: string,
  httpPort = DEFAULT_HTTP_PORT
): string {
  return `http://${host}:${httpPort}/live.mjpeg`;
}

export function mediaUrlForHost(
  host: string,
  path: string,
  httpPort = DEFAULT_HTTP_PORT
): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `http://${host}:${httpPort}${normalized}`;
}

export function photoUrlForHost(
  host: string,
  httpPort = DEFAULT_HTTP_PORT
): string {
  return mediaUrlForHost(host, "/photo.jpg", httpPort);
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
