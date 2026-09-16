const { withInfoPlist } = require("expo/config-plugins");

const SERVICE = "_5dcontrol._tcp";
const USAGE =
  "5DControl looks for the camera server on your Wi‑Fi so you can connect without typing an IP address.";

/**
 * Ensure the generated Info.plist allows browsing `_5dcontrol._tcp`.
 * Missing this yields NSNetServicesMissingRequiredConfigurationError (-72008).
 */
function withMdnsBrowse(config) {
  return withInfoPlist(config, (mod) => {
    const services = Array.isArray(mod.modResults.NSBonjourServices)
      ? [...mod.modResults.NSBonjourServices]
      : [];
    for (const type of [SERVICE, `${SERVICE}.`]) {
      if (!services.includes(type)) {
        services.push(type);
      }
    }
    mod.modResults.NSBonjourServices = services;
    if (!mod.modResults.NSLocalNetworkUsageDescription) {
      mod.modResults.NSLocalNetworkUsageDescription = USAGE;
    }
    return mod;
  });
}

module.exports = withMdnsBrowse;
