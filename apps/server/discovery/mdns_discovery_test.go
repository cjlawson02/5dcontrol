package discovery

import (
	"reflect"
	"testing"
)

func TestTXTRecords_DualPortContract(t *testing.T) {
	ad := DefaultAdvertisement()
	got := TXTRecords(ad)
	want := []string{"version=1.0", "http_port=8080", "ws_port=8888"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("TXTRecords() = %v, want %v", got, want)
	}
}

func TestTXTRecords_CustomPorts(t *testing.T) {
	got := TXTRecords(Advertisement{
		HTTPPort: 18080,
		WSPort:   18888,
		Version:  "1.0",
	})
	want := []string{"version=1.0", "http_port=18080", "ws_port=18888"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("TXTRecords() = %v, want %v", got, want)
	}
}

func TestParseTXT_PrefersTxtOverSrv(t *testing.T) {
	ep := ParseTXT([]string{
		"version=1.0",
		"http_port=8080",
		"ws_port=8888",
	}, 9999)
	if ep.HTTPPort != 8080 {
		t.Errorf("HTTPPort = %d, want 8080", ep.HTTPPort)
	}
	if ep.WSPort != 8888 {
		t.Errorf("WSPort = %d, want 8888", ep.WSPort)
	}
	if ep.Version != "1.0" {
		t.Errorf("Version = %q, want 1.0", ep.Version)
	}
}

func TestParseTXT_MissingHttpFallsBackToSrv(t *testing.T) {
	ep := ParseTXT([]string{"version=1.0"}, 8080)
	if ep.HTTPPort != 8080 {
		t.Errorf("HTTPPort = %d, want SRV 8080", ep.HTTPPort)
	}
	if ep.WSPort != DefaultWSPort {
		t.Errorf("WSPort = %d, want default %d", ep.WSPort, DefaultWSPort)
	}
}

func TestParseTXT_LegacyVersionOnly(t *testing.T) {
	// Pre-M3 advertisement was SRV 8080 + version=1.0 only.
	ep := ParseTXT([]string{"version=1.0"}, 8080)
	if ep.HTTPPort != 8080 || ep.WSPort != 8888 {
		t.Fatalf("legacy TXT should still yield HTTP 8080 / WS 8888, got %+v", ep)
	}
}

func TestParseTXT_IgnoresInvalidPorts(t *testing.T) {
	ep := ParseTXT([]string{
		"http_port=not-a-number",
		"ws_port=99999",
		"http_port=0",
	}, 8080)
	if ep.HTTPPort != 8080 {
		t.Errorf("HTTPPort = %d, want 8080 fallback", ep.HTTPPort)
	}
	if ep.WSPort != DefaultWSPort {
		t.Errorf("WSPort = %d, want default", ep.WSPort)
	}
}

func TestDefaultAdvertisement_MatchesListenPorts(t *testing.T) {
	ad := DefaultAdvertisement()
	if ad.Instance != InstanceName {
		t.Errorf("Instance = %q", ad.Instance)
	}
	if ad.HTTPPort != 8080 || ad.WSPort != 8888 {
		t.Errorf("ports HTTP=%d WS=%d", ad.HTTPPort, ad.WSPort)
	}
	if ServiceType != "_5dcontrol._tcp" {
		t.Errorf("ServiceType = %q", ServiceType)
	}
	if Domain != "local." {
		t.Errorf("Domain = %q", Domain)
	}
}

func TestParseTXT_RoundTrip(t *testing.T) {
	ad := Advertisement{HTTPPort: 8080, WSPort: 8888, Version: "1.0"}
	ep := ParseTXT(TXTRecords(ad), 1)
	if ep.HTTPPort != 8080 || ep.WSPort != 8888 || ep.Version != "1.0" {
		t.Fatalf("round-trip %+v", ep)
	}
}
