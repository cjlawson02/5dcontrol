import {
  DEFAULT_HTTP_PORT,
  DEFAULT_WS_PORT,
  normalizePort,
  type ServerPorts,
} from "./serverEndpoints";

export const MDNS_SERVICE_TYPE = "_5dcontrol._tcp";
export const MDNS_DOMAIN = "local.";

export type TxtMap = Record<string, string>;

export type DiscoveredServer = {
  id: string;
  name: string;
  host: string;
  ports: ServerPorts;
  version?: string;
};

export function txtArrayToMap(records: string[]): TxtMap {
  const out: TxtMap = {};
  for (const rec of records) {
    const cut = rec.indexOf("=");
    if (cut <= 0) {
      continue;
    }
    const key = rec.slice(0, cut).trim().toLowerCase();
    const val = rec.slice(cut + 1).trim();
    if (key) {
      out[key] = val;
    }
  }
  return out;
}

export function parseMdnsTxt(
  txt: TxtMap | string[] | undefined,
  srvPort: number
): ServerPorts & { version?: string } {
  const map = Array.isArray(txt) ? txtArrayToMap(txt) : txt ?? {};
  const httpFromTxt = Number.parseInt(map.http_port ?? "", 10);
  const wsFromTxt = Number.parseInt(map.ws_port ?? "", 10);
  return {
    httpPort: normalizePort(
      Number.isFinite(httpFromTxt) ? httpFromTxt : srvPort,
      srvPort > 0 ? srvPort : DEFAULT_HTTP_PORT
    ),
    wsPort: normalizePort(wsFromTxt, DEFAULT_WS_PORT),
    version: map.version || undefined,
  };
}

export function pickIPv4(addresses: string[] | undefined): string | null {
  if (!addresses?.length) {
    return null;
  }
  const ipv4 = addresses.find((addr) => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(addr));
  return ipv4 ?? null;
}

export function hostFromMdns(host: string | undefined): string | null {
  if (!host) {
    return null;
  }
  const trimmed = host.replace(/\.$/, "");
  return trimmed || null;
}

export function discoveredServerFromBrowse(event: {
  name?: string;
  host?: string;
  port?: number;
  addresses?: string[];
  txt?: TxtMap | string[];
}): DiscoveredServer | null {
  const host = pickIPv4(event.addresses) ?? hostFromMdns(event.host);
  if (!host) {
    return null;
  }
  const srvPort = typeof event.port === "number" ? event.port : 0;
  const parsed = parseMdnsTxt(event.txt, srvPort);
  const name = (event.name ?? "5DControl").trim() || "5DControl";
  return {
    id: `${name}@${host}:${parsed.httpPort}:${parsed.wsPort}`,
    name,
    host,
    ports: { httpPort: parsed.httpPort, wsPort: parsed.wsPort },
    version: parsed.version,
  };
}
