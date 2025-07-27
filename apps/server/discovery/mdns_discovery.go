package discovery

import (
	"log"

	"github.com/grandcat/zeroconf"
)

// RunMDNSDiscovery registers this service via mDNS/Bonjour and
// blocks until the program exits (or server.Shutdown is called).
func RunMDNSDiscovery() {
	_, err := zeroconf.Register(
		"5DControl",             // service instance name
		"_5dcontrol._tcp",       // service type
		"local.",                // domain
		8080,                    // port
		[]string{"version=1.0"}, // TXT records
		nil,                     // use default network interfaces
	)
	if err != nil {
		log.Fatalf("mDNS register failed: %v", err)
	}
	log.Println("mDNS discovery running: _5dcontrol._tcp on port 8080")

	// Block here until process exit; if you need to stop:
	select {}
}
