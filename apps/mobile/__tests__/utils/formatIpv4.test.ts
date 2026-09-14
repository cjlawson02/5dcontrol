import { formatIpv4Typing, isValidIpv4 } from "../../utils/formatIpv4";

describe("formatIpv4Typing", () => {
  it("auto-inserts periods after 3-digit octets", () => {
    expect(formatIpv4Typing("1", "")).toBe("1");
    expect(formatIpv4Typing("19", "1")).toBe("19");
    expect(formatIpv4Typing("192", "19")).toBe("192.");
    expect(formatIpv4Typing("192.1", "192.")).toBe("192.1");
    expect(formatIpv4Typing("192.168", "192.16")).toBe("192.168.");
  });

  it("clamps octets above 255", () => {
    expect(formatIpv4Typing("256", "25")).toBe("255.");
    expect(formatIpv4Typing("192.300", "192.30")).toBe("192.255.");
  });

  it("allows short octets with manual periods", () => {
    expect(formatIpv4Typing("10.", "10")).toBe("10.");
    expect(formatIpv4Typing("10.0.", "10.0")).toBe("10.0.");
    expect(formatIpv4Typing("10.0.0.1", "10.0.0.")).toBe("10.0.0.1");
  });

  it("strips invalid characters", () => {
    expect(formatIpv4Typing("192a.168b", "192.168")).toBe("192.168.");
  });

  it("supports deleting", () => {
    expect(formatIpv4Typing("192.16", "192.168")).toBe("192.16");
    expect(formatIpv4Typing("192.", "192.1")).toBe("192.");
  });

  it("limits to four octets", () => {
    expect(formatIpv4Typing("10.0.0.1.9", "10.0.0.1")).toBe("10.0.0.1");
  });
});

describe("isValidIpv4", () => {
  it("accepts valid addresses", () => {
    expect(isValidIpv4("192.168.1.1")).toBe(true);
    expect(isValidIpv4("10.0.0.1")).toBe(true);
    expect(isValidIpv4("0.0.0.0")).toBe(true);
    expect(isValidIpv4("255.255.255.255")).toBe(true);
  });

  it("rejects incomplete or invalid addresses", () => {
    expect(isValidIpv4("192.168.1")).toBe(false);
    expect(isValidIpv4("192.168.1.")).toBe(false);
    expect(isValidIpv4("192.168.1.256")).toBe(false);
    expect(isValidIpv4("abc")).toBe(false);
  });
});
