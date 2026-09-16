import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addMdnsListener,
  isMdnsBrowseSupported,
  startMdnsBrowse,
  stopMdnsBrowse,
} from "../modules/mdns-browse";
import {
  discoveredServerFromBrowse,
  MDNS_DOMAIN,
  MDNS_SERVICE_TYPE,
  type DiscoveredServer,
} from "../utils/mdns";
import { logger } from "../utils/logger";

export type MdnsBrowseState = {
  servers: DiscoveredServer[];
  supported: boolean;
  scanning: boolean;
  error: string | null;
  rescan: () => void;
};

/**
 * Browse `_5dcontrol._tcp` on iOS (dev client / prebuild). Expo Go and
 * Android return supported=false; the connection screen keeps manual IP.
 */
export function useMdnsBrowse(): MdnsBrowseState {
  const supported = useMemo(() => isMdnsBrowseSupported(), []);
  const [servers, setServers] = useState<DiscoveredServer[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);

  const rescan = useCallback(() => {
    setGeneration((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!supported) {
      setScanning(false);
      return;
    }

    setServers([]);
    setError(null);
    setScanning(true);

    const upsert = addMdnsListener("onServiceUpsert", (event) => {
      const server = discoveredServerFromBrowse(event);
      if (!server) {
        return;
      }
      logger.info(
        `mDNS: found ${server.name} at ${server.host} http=${server.ports.httpPort} ws=${server.ports.wsPort}`
      );
      setServers((prev) => {
        const without = prev.filter(
          (item) => item.name !== server.name && item.id !== server.id
        );
        return [...without, server].sort((a, b) => a.name.localeCompare(b.name));
      });
    });

    const removed = addMdnsListener("onServiceRemoved", (event) => {
      if (!event?.name) {
        return;
      }
      setServers((prev) => prev.filter((item) => item.name !== event.name));
    });

    const failed = addMdnsListener("onError", (event) => {
      logger.warn("mDNS browse error", event?.message);
      setError(event?.message ?? "Local network browse failed");
    });

    try {
      startMdnsBrowse(MDNS_SERVICE_TYPE, MDNS_DOMAIN);
    } catch (err) {
      logger.warn("mDNS startBrowse failed", err);
      setError("Could not start local network browse");
      setScanning(false);
    }

    const settle = setTimeout(() => setScanning(false), 4000);

    return () => {
      clearTimeout(settle);
      upsert.remove();
      removed.remove();
      failed.remove();
      stopMdnsBrowse();
    };
  }, [supported, generation]);

  return { servers, supported, scanning, error, rescan };
}
