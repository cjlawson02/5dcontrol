package server

// Dual-port listen addresses. mDNS advertises HTTP as the SRV port and
// publishes both ports in TXT (ws_port / http_port) so clients do not have
// to hardcode this split.
const (
	HTTPPort = 8080
	WSPort   = 8888
)
