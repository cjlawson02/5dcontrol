export type NativeMdnsServiceEvent = {
  name?: string;
  host?: string;
  port?: number;
  addresses?: string[];
  txt?: Record<string, string>;
};

type NativeEvent = NativeMdnsServiceEvent & { name?: string; message?: string };

type MdnsBrowseNative = {
  isSupported(): boolean;
  startBrowsing(serviceType: string, domain: string): void;
  stopBrowsing(): void;
  addListener(
    event: string,
    listener: (event: NativeEvent) => void
  ): { remove: () => void };
};

function getNative(): MdnsBrowseNative | null {
  try {
    // Optional: Expo Go and Jest have no native module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const expo = require("expo") as {
      requireOptionalNativeModule?: <T>(name: string) => T | null;
    };
    return expo.requireOptionalNativeModule?.("MdnsBrowse") ?? null;
  } catch {
    return null;
  }
}

export function isMdnsBrowseSupported(): boolean {
  const native = getNative();
  try {
    return !!native?.isSupported();
  } catch {
    return false;
  }
}

export function startMdnsBrowse(
  serviceType = "_5dcontrol._tcp",
  domain = "local."
): void {
  getNative()?.startBrowsing(serviceType, domain);
}

export function stopMdnsBrowse(): void {
  getNative()?.stopBrowsing();
}

export function addMdnsListener(
  event: string,
  listener: (event: NativeEvent) => void
): { remove: () => void } {
  const native = getNative();
  if (!native) {
    return { remove: () => undefined };
  }
  return native.addListener(event, listener);
}
