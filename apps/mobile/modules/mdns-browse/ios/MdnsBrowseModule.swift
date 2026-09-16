import Darwin
import ExpoModulesCore
import Foundation

public class MdnsBrowseModule: Module {
  private var session: BrowseSession?

  public func definition() -> ModuleDefinition {
    Name("MdnsBrowse")
    Events("onServiceUpsert", "onServiceRemoved", "onError")

    Function("isSupported") {
      true
    }

    Function("startBrowsing") { (serviceType: String, domain: String) in
      self.stop()
      let session = BrowseSession(
        onUpsert: { [weak self] payload in
          self?.sendEvent("onServiceUpsert", payload)
        },
        onRemoved: { [weak self] name in
          self?.sendEvent("onServiceRemoved", ["name": name])
        },
        onError: { [weak self] message in
          self?.sendEvent("onError", ["message": message])
        }
      )
      session.start(type: serviceType, domain: domain)
      self.session = session
    }

    Function("stopBrowsing") {
      self.stop()
    }

    OnDestroy {
      self.stop()
    }
  }

  private func stop() {
    session?.stop()
    session = nil
  }
}

private final class BrowseSession: NSObject, NetServiceBrowserDelegate, NetServiceDelegate {
  private let browser = NetServiceBrowser()
  private var resolving = Set<NetService>()
  private let onUpsert: ([String: Any]) -> Void
  private let onRemoved: (String) -> Void
  private let onError: (String) -> Void

  init(
    onUpsert: @escaping ([String: Any]) -> Void,
    onRemoved: @escaping (String) -> Void,
    onError: @escaping (String) -> Void
  ) {
    self.onUpsert = onUpsert
    self.onRemoved = onRemoved
    self.onError = onError
    super.init()
    browser.delegate = self
  }

  func start(type: String, domain: String) {
    let serviceType = type.hasSuffix(".") ? type : "\(type)."
    let serviceDomain = domain.isEmpty ? "local." : domain
    browser.searchForServices(ofType: serviceType, inDomain: serviceDomain)
  }

  func stop() {
    browser.stop()
    for service in resolving {
      service.stop()
    }
    resolving.removeAll()
  }

  func netServiceBrowser(_ browser: NetServiceBrowser, didFind service: NetService, moreComing: Bool) {
    service.delegate = self
    resolving.insert(service)
    service.resolve(withTimeout: 5)
  }

  func netServiceBrowser(_ browser: NetServiceBrowser, didRemove service: NetService, moreComing: Bool) {
    resolving.remove(service)
    onRemoved(service.name)
  }

  func netServiceBrowser(_ browser: NetServiceBrowser, didNotSearch errorDict: [String: NSNumber]) {
    onError("Bonjour browse failed: \(errorDict)")
  }

  func netServiceDidResolveAddress(_ sender: NetService) {
    let txt = txtMap(from: sender)
    let addresses = ipv4Addresses(from: sender)
    onUpsert([
      "name": sender.name,
      "host": sender.hostName ?? "",
      "port": sender.port,
      "addresses": addresses,
      "txt": txt
    ])
  }

  func netService(_ sender: NetService, didNotResolve errorDict: [String: NSNumber]) {
    onError("Bonjour resolve failed for \(sender.name): \(errorDict)")
  }

  private func txtMap(from service: NetService) -> [String: String] {
    guard let data = service.txtRecordData() else {
      return [:]
    }
    let raw = NetService.dictionary(fromTXTRecord: data)
    var out: [String: String] = [:]
    for (key, value) in raw {
      if let string = String(data: value, encoding: .utf8) {
        out[key] = string
      }
    }
    return out
  }

  private func ipv4Addresses(from service: NetService) -> [String] {
    var result: [String] = []
    for addrData in service.addresses ?? [] {
      var addr = sockaddr_in()
      guard addrData.count >= MemoryLayout<sockaddr_in>.size else {
        continue
      }
      _ = withUnsafeMutableBytes(of: &addr) { dest in
        addrData.copyBytes(
          to: dest.bindMemory(to: UInt8.self),
          count: min(addrData.count, dest.count)
        )
      }
      guard addr.sin_family == sa_family_t(AF_INET) else {
        continue
      }
      var buf = [CChar](repeating: 0, count: Int(INET_ADDRSTRLEN))
      var sinAddr = addr.sin_addr
      inet_ntop(AF_INET, &sinAddr, &buf, socklen_t(INET_ADDRSTRLEN))
      let ip = String(cString: buf)
      if !ip.isEmpty && ip != "0.0.0.0" && !result.contains(ip) {
        result.append(ip)
      }
    }
    return result
  }
}
