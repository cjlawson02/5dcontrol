package discovery

import (
	"fmt"
	"log"
	"strconv"
	"strings"

	"github.com/grandcat/zeroconf"
)

const (
	// InstanceName is the Bonjour instance (what clients show in the list).
	InstanceName = "5DControl"
	// ServiceType is the DNS-SD type iOS browses for.
	ServiceType = "_5dcontrol._tcp"
	// Domain is the default mDNS domain.
	Domain = "local."
	// Version is the TXT version key. Bump when the TXT map changes meaning.
	Version = "1.0"
	// DefaultHTTPPort is the HTTP/media listen port (MJPEG + stills).
	DefaultHTTPPort = 8080
	// DefaultWSPort is the WebSocket control listen port.
	DefaultWSPort = 8888
)

// Advertisement is the mDNS record the server publishes.
//
// DNS-SD SRV port is the HTTP/media port so a naive browser still lands on
// live view. Clients MUST read TXT for the dual-port split:
//
//	version=1.0
//	http_port=8080
//	ws_port=8888
//
// Then: ws://{ipv4}:{ws_port}/ws and http://{ipv4}:{http_port}/…
type Advertisement struct {
	Instance string
	HTTPPort int
	WSPort   int
	Version  string
}

// DefaultAdvertisement matches the Go server's listen ports.
func DefaultAdvertisement() Advertisement {
	return Advertisement{
		Instance: InstanceName,
		HTTPPort: DefaultHTTPPort,
		WSPort:   DefaultWSPort,
		Version:  Version,
	}
}

// TXTRecords is the advertised key=value map.
func TXTRecords(ad Advertisement) []string {
	version := ad.Version
	if version == "" {
		version = Version
	}
	httpPort := ad.HTTPPort
	if httpPort <= 0 {
		httpPort = DefaultHTTPPort
	}
	wsPort := ad.WSPort
	if wsPort <= 0 {
		wsPort = DefaultWSPort
	}
	return []string{
		"version=" + version,
		fmt.Sprintf("http_port=%d", httpPort),
		fmt.Sprintf("ws_port=%d", wsPort),
	}
}

// Endpoints are the dual ports a client should use after browsing.
type Endpoints struct {
	HTTPPort int
	WSPort   int
	Version  string
}

// ParseTXT reads ws_port / http_port / version. Missing http_port falls back
// to the DNS-SD SRV port (historically HTTP). Missing ws_port falls back to
// DefaultWSPort so older advertisements still connect.
func ParseTXT(txt []string, srvPort int) Endpoints {
	httpPort := srvPort
	if httpPort <= 0 {
		httpPort = DefaultHTTPPort
	}
	ep := Endpoints{
		HTTPPort: httpPort,
		WSPort:   DefaultWSPort,
	}
	for _, rec := range txt {
		key, val, ok := strings.Cut(rec, "=")
		if !ok {
			continue
		}
		key = strings.ToLower(strings.TrimSpace(key))
		val = strings.TrimSpace(val)
		switch key {
		case "http_port":
			if p, err := strconv.Atoi(val); err == nil && p > 0 && p <= 65535 {
				ep.HTTPPort = p
			}
		case "ws_port":
			if p, err := strconv.Atoi(val); err == nil && p > 0 && p <= 65535 {
				ep.WSPort = p
			}
		case "version":
			ep.Version = val
		}
	}
	return ep
}

// Register starts advertising and returns the zeroconf server.
// Caller must Shutdown() when done; keeping the *zeroconf.Server alive is
// what actually holds the registration.
func Register(ad Advertisement) (*zeroconf.Server, error) {
	if ad.Instance == "" {
		ad.Instance = InstanceName
	}
	if ad.HTTPPort <= 0 {
		ad.HTTPPort = DefaultHTTPPort
	}
	if ad.WSPort <= 0 {
		ad.WSPort = DefaultWSPort
	}
	if ad.Version == "" {
		ad.Version = Version
	}
	return zeroconf.Register(
		ad.Instance,
		ServiceType,
		Domain,
		ad.HTTPPort,
		TXTRecords(ad),
		nil,
	)
}

// RunMDNSDiscovery registers _5dcontrol._tcp and blocks until process exit.
// Advertise failure is logged (server still runs); demo/CI hosts without
// multicast should still serve WS + HTTP.
func RunMDNSDiscovery() {
	Run(DefaultAdvertisement())
}

// Run advertises the given ports and blocks.
func Run(ad Advertisement) {
	server, err := Register(ad)
	if err != nil {
		log.Printf("mDNS register failed (browse unavailable): %v", err)
		return
	}
	defer server.Shutdown()
	log.Printf(
		"mDNS advertising %s.%s HTTP :%d WS :%d TXT %v",
		ad.Instance,
		ServiceType,
		ad.HTTPPort,
		ad.WSPort,
		TXTRecords(ad),
	)
	select {}
}
