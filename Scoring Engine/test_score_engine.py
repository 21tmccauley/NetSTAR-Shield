"""
Unit tests for score_engine.py

This test suite provides comprehensive coverage for all scoring functions
in the NetSTAR security scoring engine.

Run tests with:
    pytest test_score_engine.py -v
    pytest test_score_engine.py --cov=score_engine --cov-report=html
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
import json
import subprocess

# Import the module to test
import score_engine


# ============================================================================
# FIXTURES - Reusable test data
# ============================================================================

@pytest.fixture
def valid_cert_data():
    """Valid certificate data with 60 days until expiration"""
    return {
        "data": [{
            "not_after": "2025-12-15T20:07:01.252",
            "not_before": "2025-09-16T20:11:24"
        }]
    }


@pytest.fixture
def expired_cert_data():
    """Expired certificate data"""
    return {
        "data": [{
            "not_after": "2020-01-01T00:00:00",
            "not_before": "2019-01-01T00:00:00"
        }]
    }


@pytest.fixture
def optimal_dns_data():
    """Optimal DNS configuration with redundancy"""
    return {
        "rcode": 31,
        "a": ["162.159.153.4", "162.159.152.4"],
        "aaaa": ["2606:4700:7::a29f:9804", "2606:4700:7::a29f:9904"]
    }


@pytest.fixture
def poor_dns_data():
    """Poor DNS configuration - single A record, no IPv6"""
    return {
        "rcode": 1,
        "a": ["192.168.1.1"],
        "aaaa": []
    }


@pytest.fixture
def optimal_hval_data():
    """Optimal HVAL scan - HTTPS enforced, modern TLS, all security headers"""
    return {
        "head": [
            {"status": 301, "url": "http://example.com"},
            {"status": 200, "url": "https://example.com/", "tls": "TLS_AES_128_GCM_SHA256"}
        ],
        "n": 2,
        "security": 127  # All flags: HSTS + CSP + XCTO + ACAO + COOP + CORP + COEP
    }


@pytest.fixture
def poor_hval_data():
    """Poor HVAL scan - HTTP only, no security headers"""
    return {
        "head": [
            {"status": 200, "url": "http://example.com", "tls": "NONE"}
        ],
        "n": 1,
        "security": 0
    }


@pytest.fixture
def optimal_mail_data():
    """Optimal mail configuration - DMARC reject, SPF hardfail, MX redundancy"""
    return {
        "mx": ["mx1.example.com", "mx2.example.com", "mx3.example.com"],
        "spf": ["v=spf1 include:_spf.example.com -all"],
        "dmarc": ["v=DMARC1; p=reject; sp=reject; pct=100"]
    }


@pytest.fixture
def poor_mail_data():
    """Poor mail configuration - no DMARC, weak SPF, single MX"""
    return {
        "mx": ["mx1.example.com"],
        "spf": ["v=spf1 +all"],
        "dmarc": []
    }


@pytest.fixture
def optimal_method_data():
    """Optimal method scan - only HEAD and GET"""
    return {
        "flag": 3  # HEAD (1) + GET (2)
    }


@pytest.fixture
def dangerous_method_data():
    """Dangerous method scan - PUT, DELETE, TRACE enabled"""
    return {
        "flag": 111  # Multiple dangerous methods
    }


@pytest.fixture
def optimal_rdap_data():
    """Optimal RDAP - multiple nameservers, diverse vendors"""
    return {
        "nameserver": [
            "ns1.google.com",
            "ns2.google.com",
            "ns1.cloudflare.com",
            "ns2.cloudflare.com"
        ]
    }


@pytest.fixture
def poor_rdap_data():
    """Poor RDAP - single nameserver"""
    return {
        "nameserver": ["ns1.example.com"]
    }


@pytest.fixture
def scan_date():
    """Fixed scan date for reproducible tests"""
    return datetime(2025, 10, 15)


# ============================================================================
# CERTIFICATE SCORING TESTS
# ============================================================================

class TestCertScoring:
    """Tests for score_cert_scan() function"""
    
    def test_valid_cert_good_expiration(self, valid_cert_data, scan_date):
        """Test valid certificate with good expiration (60+ days)"""
        score = score_engine.score_cert_scan(valid_cert_data, scan_date)
        assert score == 100, "Valid cert with 60+ days should score 100"
    
    def test_expired_cert(self, expired_cert_data, scan_date):
        """Test expired certificate returns minimum score"""
        score = score_engine.score_cert_scan(expired_cert_data, scan_date)
        assert score == 1, "Expired certificate should return score of 1"
    
    def test_cert_expiring_soon_15_days(self, scan_date):
        """Test certificate expiring in 15 days gets appropriate deduction"""
        cert_data = {
            "data": [{
                "not_after": (scan_date + timedelta(days=15)).isoformat(),
                "not_before": (scan_date - timedelta(days=60)).isoformat()
            }]
        }
        score = score_engine.score_cert_scan(cert_data, scan_date)
        # 15 days should result in -15 deduction (gradient)
        assert 80 <= score <= 90, f"Cert expiring in 15 days should be ~85, got {score}"
    
    def test_cert_expiring_very_soon_5_days(self, scan_date):
        """Test certificate expiring in 5 days gets heavy deduction"""
        cert_data = {
            "data": [{
                "not_after": (scan_date + timedelta(days=5)).isoformat(),
                "not_before": (scan_date - timedelta(days=60)).isoformat()
            }]
        }
        score = score_engine.score_cert_scan(cert_data, scan_date)
        # 5 days should result in -25 deduction
        assert 70 <= score <= 80, f"Cert expiring in 5 days should be ~75, got {score}"
    
    def test_missing_cert_data(self, scan_date):
        """Test missing certificate data returns minimum score"""
        score = score_engine.score_cert_scan({"data": []}, scan_date)
        assert score == 1, "Missing cert data should return score of 1"
    
    def test_malformed_cert_dates(self, scan_date):
        """Test malformed date fields return minimum score"""
        cert_data = {
            "data": [{
                "not_after": "invalid-date",
                "not_before": "2025-01-01T00:00:00"
            }]
        }
        score = score_engine.score_cert_scan(cert_data, scan_date)
        assert score == 1, "Malformed cert dates should return score of 1"
    
    def test_cert_not_yet_valid(self, scan_date):
        """Test certificate not yet valid gets deduction"""
        cert_data = {
            "data": [{
                "not_after": (scan_date + timedelta(days=365)).isoformat(),
                "not_before": (scan_date + timedelta(days=1)).isoformat()
            }]
        }
        score = score_engine.score_cert_scan(cert_data, scan_date)
        assert score == 50, "Cert not yet valid should get -50 deduction"


# ============================================================================
# DNS SCORING TESTS
# ============================================================================

class TestDNSScoring:
    """Tests for score_dns_scan() function"""
    
    def test_optimal_dns_config(self, optimal_dns_data):
        """Test optimal DNS configuration scores 100"""
        score = score_engine.score_dns_scan(optimal_dns_data)
        assert score == 100, "Optimal DNS should score 100"
    
    def test_poor_dns_config(self, poor_dns_data):
        """Test poor DNS configuration gets appropriate deductions"""
        score = score_engine.score_dns_scan(poor_dns_data)
        # Should have deductions for: low rcode (-15), single A (-10), no IPv6 (-5)
        assert score <= 75, f"Poor DNS should score <= 75, got {score}"
    
    def test_no_ipv6_support(self):
        """Test DNS without IPv6 gets minor deduction"""
        dns_data = {
            "rcode": 31,
            "a": ["1.1.1.1", "1.0.0.1"],
            "aaaa": []
        }
        score = score_engine.score_dns_scan(dns_data)
        assert score == 95, "No IPv6 should result in -5 deduction"
    
    def test_single_a_record(self):
        """Test single A record (SPOF) gets deduction"""
        dns_data = {
            "rcode": 31,
            "a": ["1.1.1.1"],
            "aaaa": ["2606:4700:4700::1111", "2606:4700:4700::1001"]
        }
        score = score_engine.score_dns_scan(dns_data)
        assert score == 90, "Single A record should result in -10 deduction"
    
    def test_single_aaaa_record(self):
        """Test single AAAA record gets minor deduction"""
        dns_data = {
            "rcode": 31,
            "a": ["1.1.1.1", "1.0.0.1"],
            "aaaa": ["2606:4700:4700::1111"]
        }
        score = score_engine.score_dns_scan(dns_data)
        assert score == 95, "Single AAAA record should result in -5 deduction"
    
    def test_incomplete_rcode(self):
        """Test incomplete rcode gets appropriate deduction"""
        dns_data = {
            "rcode": 15,  # Between 8-30
            "a": ["1.1.1.1", "1.0.0.1"],
            "aaaa": ["2606:4700:4700::1111", "2606:4700:4700::1001"]
        }
        score = score_engine.score_dns_scan(dns_data)
        assert score == 90, "Incomplete rcode should result in -10 deduction"


# ============================================================================
# HVAL SCORING TESTS
# ============================================================================

class TestHVALScoring:
    """Tests for score_hval_scan() function"""
    
    def test_optimal_hval_config(self, optimal_hval_data):
        """Test optimal HVAL configuration scores 100"""
        score = score_engine.score_hval_scan(optimal_hval_data)
        assert score == 100, "Optimal HVAL should score 100"
    
    def test_http_only_site(self, poor_hval_data):
        """Test HTTP-only site gets major deduction"""
        score = score_engine.score_hval_scan(poor_hval_data)
        # Should have deductions for: not HTTPS (-45), no TLS (-45), missing headers (-40)
        assert score <= 20, f"HTTP-only site should score very low, got {score}"
    
    def test_missing_one_critical_header(self):
        """Test missing one critical security header"""
        hval_data = {
            "head": [
                {"status": 200, "url": "https://example.com/", "tls": "TLS_AES_128_GCM_SHA256"}
            ],
            "security": 7  # HSTS + CSP + XCTO, missing COOP/CORP/COEP
        }
        score = score_engine.score_hval_scan(hval_data)
        assert score == 95, "Missing advanced headers should result in -5 deduction"


# ============================================================================
# MAIL SCORING TESTS
# ============================================================================

class TestMailScoring:
    """Tests for score_mail_scan() function"""
    
    def test_optimal_mail_config(self, optimal_mail_data):
        """Test optimal mail configuration scores 100"""
        score = score_engine.score_mail_scan(optimal_mail_data)
        assert score == 100, "Optimal mail config should score 100"
    
    def test_no_mx_records(self):
        """Test no MX records gets critical deduction"""
        mail_data = {
            "mx": [],
            "spf": ["v=spf1 -all"],
            "dmarc": ["v=DMARC1; p=reject"]
        }
        score = score_engine.score_mail_scan(mail_data)
        assert score == 60, "No MX records should result in -40 deduction"
    
    def test_single_mx_record(self):
        """Test single MX record (SPOF) gets deduction"""
        mail_data = {
            "mx": ["mx1.example.com"],
            "spf": ["v=spf1 -all"],
            "dmarc": ["v=DMARC1; p=reject"]
        }
        score = score_engine.score_mail_scan(mail_data)
        assert score == 90, "Single MX record should result in -10 deduction"
    
    def test_no_dmarc(self):
        """Test missing DMARC gets major deduction"""
        mail_data = {
            "mx": ["mx1.example.com", "mx2.example.com"],
            "spf": ["v=spf1 -all"],
            "dmarc": []
        }
        score = score_engine.score_mail_scan(mail_data)
        assert score == 55, "Missing DMARC should result in -45 deduction"
    
    def test_weak_dmarc_policy(self):
        """Test weak DMARC policy (p=none) gets deduction"""
        mail_data = {
            "mx": ["mx1.example.com", "mx2.example.com"],
            "spf": ["v=spf1 -all"],
            "dmarc": ["v=DMARC1; p=none"]
        }
        score = score_engine.score_mail_scan(mail_data)
        # -15 for weak policy + -5 for weak subdomain policy (defaults to 'none') = -20
        assert score == 80, "Weak DMARC policy should result in -20 deduction (policy + subdomain)"
    
    def test_no_spf(self):
        """Test missing SPF gets major deduction"""
        mail_data = {
            "mx": ["mx1.example.com", "mx2.example.com"],
            "spf": [],
            "dmarc": ["v=DMARC1; p=reject"]
        }
        score = score_engine.score_mail_scan(mail_data)
        assert score == 80, "Missing SPF should result in -20 deduction"
    
    def test_spf_softfail(self):
        """Test SPF softfail (~all) gets minor deduction"""
        mail_data = {
            "mx": ["mx1.example.com", "mx2.example.com"],
            "spf": ["v=spf1 include:_spf.example.com ~all"],
            "dmarc": ["v=DMARC1; p=reject"]
        }
        score = score_engine.score_mail_scan(mail_data)
        assert score == 90, "SPF softfail should result in -10 deduction"
    
    def test_weak_subdomain_policy(self):
        """Test weak DMARC subdomain policy gets minor deduction"""
        mail_data = {
            "mx": ["mx1.example.com", "mx2.example.com"],
            "spf": ["v=spf1 -all"],
            "dmarc": ["v=DMARC1; p=reject; sp=none"]
        }
        score = score_engine.score_mail_scan(mail_data)
        assert score == 95, "Weak subdomain policy should result in -5 deduction"


# ============================================================================
# METHOD SCORING TESTS
# ============================================================================

class TestMethodScoring:
    """Tests for score_method_scan() function"""
    
    def test_optimal_methods(self, optimal_method_data):
        """Test optimal methods (HEAD + GET only) scores 100"""
        score = score_engine.score_method_scan(optimal_method_data)
        assert score == 100, "Optimal methods should score 100"
    
    def test_acceptable_methods(self):
        """Test acceptable methods (HEAD + GET + POST) scores 100"""
        method_data = {"flag": 7}  # HEAD (1) + GET (2) + POST (4)
        score = score_engine.score_method_scan(method_data)
        assert score == 100, "HEAD + GET + POST should score 100"
    
    def test_dangerous_methods_put_delete_trace(self):
        """Test dangerous methods (PUT, DELETE, TRACE) get major deduction"""
        method_data = {"flag": 104}  # PUT (8) + DELETE (32) + TRACE (64)
        score = score_engine.score_method_scan(method_data)
        assert score == 60, "PUT/DELETE/TRACE should result in -40 deduction"
    
    def test_connect_patch_methods(self):
        """Test CONNECT and PATCH methods get deduction"""
        method_data = {"flag": 144}  # CONNECT (128) + PATCH (16)
        score = score_engine.score_method_scan(method_data)
        assert score == 85, "CONNECT/PATCH should result in -15 deduction"
    
    def test_all_dangerous_methods(self):
        """Test all dangerous methods enabled"""
        method_data = {"flag": 248}  # PUT + PATCH + DELETE + TRACE + CONNECT
        score = score_engine.score_method_scan(method_data)
        # Should get both deductions: -40 and -15 = -55
        assert score == 45, "All dangerous methods should result in -55 total deduction"


# ============================================================================
# RDAP SCORING TESTS
# ============================================================================

class TestRDAPScoring:
    """Tests for score_rdap_scan() function"""
    
    def test_optimal_rdap_config(self, optimal_rdap_data):
        """Test optimal RDAP configuration scores 100"""
        score = score_engine.score_rdap_scan(optimal_rdap_data)
        assert score == 100, "Optimal RDAP should score 100"
    
    def test_single_nameserver(self, poor_rdap_data):
        """Test single nameserver (SPOF) gets critical deduction"""
        score = score_engine.score_rdap_scan(poor_rdap_data)
        assert score == 70, "Single nameserver should result in -30 deduction"
    
    def test_two_nameservers_same_vendor(self):
        """Test two nameservers from same vendor gets minor deduction"""
        rdap_data = {
            "nameserver": ["ns1.cloudflare.com", "ns2.cloudflare.com"]
        }
        score = score_engine.score_rdap_scan(rdap_data)
        # -5 for only 2 nameservers, -5 for same vendor = -10
        assert score == 90, "Two nameservers, same vendor should result in -10 deduction"
    
    def test_three_nameservers_diverse(self):
        """Test three nameservers with diversity scores 100"""
        rdap_data = {
            "nameserver": [
                "ns1.google.com",
                "ns1.cloudflare.com",
                "ns1.amazon.com"
            ]
        }
        score = score_engine.score_rdap_scan(rdap_data)
        assert score == 100, "Three diverse nameservers should score 100"
    
    def test_empty_nameserver_list(self):
        """Test empty nameserver list gets critical deduction"""
        rdap_data = {"nameserver": []}
        score = score_engine.score_rdap_scan(rdap_data)
        assert score == 70, "Empty nameserver list should result in -30 deduction"


# ============================================================================
# FINAL SCORE CALCULATION TESTS
# ============================================================================

class TestFinalScoreCalculation:
    """Tests for calculate_final_score() function"""
    
    def test_all_perfect_scores(self):
        """Test all perfect scores (100) results in 100"""
        weights = score_engine.WEIGHTS
        scores = {
            'HVAL_Score': 100,
            'Cert_Score': 100,
            'DNS_Score': 100,
            'Method_Score': 100,
            'Mail_Score': 100,
            'RDAP_Score': 100
        }
        final = score_engine.calculate_final_score(weights, scores)
        # Use approximate comparison for floating point precision
        assert abs(final - 100.0) < 0.01, f"All perfect scores should result in ~100, got {final}"
    
    def test_mixed_scores(self):
        """Test mixed scores uses weighted harmonic mean correctly"""
        weights = score_engine.WEIGHTS
        scores = {
            'HVAL_Score': 90,
            'Cert_Score': 85,
            'DNS_Score': 95,
            'Method_Score': 100,
            'Mail_Score': 80,
            'RDAP_Score': 90
        }
        final = score_engine.calculate_final_score(weights, scores)
        # Harmonic mean should be lower than arithmetic mean
        assert 85 <= final <= 95, f"Mixed scores should result in ~88-92, got {final}"
    
    def test_zero_score_returns_one(self):
        """Test zero score in any component returns 1"""
        weights = score_engine.WEIGHTS
        scores = {
            'HVAL_Score': 100,
            'Cert_Score': 0,  # Zero score
            'DNS_Score': 100,
            'Method_Score': 100,
            'Mail_Score': 100,
            'RDAP_Score': 100
        }
        final = score_engine.calculate_final_score(weights, scores)
        assert final == 1, "Zero score should return 1"
    
    def test_partial_scores(self):
        """Test calculation with only some components"""
        weights = score_engine.WEIGHTS
        scores = {
            'HVAL_Score': 90,
            'Cert_Score': 85
            # Missing other components
        }
        final = score_engine.calculate_final_score(weights, scores)
        # Should calculate based only on provided scores
        assert 85 <= final <= 90, "Partial scores should calculate correctly"
    
    def test_empty_scores(self):
        """Test empty scores dict returns 0"""
        weights = score_engine.WEIGHTS
        scores = {}
        final = score_engine.calculate_final_score(weights, scores)
        assert final == 0.0, "Empty scores should return 0"


# ============================================================================
# INTEGRATION TESTS
# ============================================================================

class TestSecurityScoreCalculation:
    """Integration tests for calculate_security_score() orchestrator"""
    
    def test_complete_scan_optimal(self, scan_date):
        """Test complete scan with all optimal data"""
        all_scans = {
            'cert_scan': {
                "data": [{
                    "not_after": "2025-12-15T20:07:01.252",
                    "not_before": "2025-09-16T20:11:24"
                }]
            },
            'dns_scan': {
                "rcode": 31,
                "a": ["1.1.1.1", "1.0.0.1"],
                "aaaa": ["2606:4700:4700::1111", "2606:4700:4700::1001"]
            },
            'hval_scan': {
                "head": [
                    {"status": 200, "url": "https://example.com/", "tls": "TLS_AES_128_GCM_SHA256"}
                ],
                "security": 127  # All flags
            },
            'mail_scan': {
                "mx": ["mx1.example.com", "mx2.example.com"],
                "spf": ["v=spf1 -all"],
                "dmarc": ["v=DMARC1; p=reject"]
            },
            'method_scan': {"flag": 3},
            'rdap_scan': {
                "nameserver": ["ns1.google.com", "ns2.cloudflare.com", "ns3.amazon.com"]
            }
        }
        
        results = score_engine.calculate_security_score(all_scans, scan_date)
        
        assert 'Aggregated_Score' in results
        assert results['Aggregated_Score'] >= 95, "Optimal scan should score >= 95"
    
    def test_partial_scan_data(self, scan_date):
        """Test calculation with only some scan types"""
        all_scans = {
            'cert_scan': {
                "data": [{
                    "not_after": "2025-12-15T20:07:01.252",
                    "not_before": "2025-09-16T20:11:24"
                }]
            },
            'dns_scan': {
                "rcode": 31,
                "a": ["1.1.1.1", "1.0.0.1"],
                "aaaa": ["2606:4700:4700::1111", "2606:4700:4700::1001"]
            }
        }
        
        results = score_engine.calculate_security_score(all_scans, scan_date)
        
        assert 'Aggregated_Score' in results
        assert 'Cert_Score' in results
        assert 'DNS_Score' in results
        assert 'HVAL_Score' not in results


# ============================================================================
# SUBPROCESS/CURL MOCKING TESTS
# ============================================================================

class TestCurlExecution:
    """Tests for execute_curl_command() function"""
    
    @patch('subprocess.run')
    def test_successful_curl_execution(self, mock_run):
        """Test successful curl command execution"""
        mock_run.return_value = Mock(
            returncode=0,
            stdout='{"test": "data"}',
            stderr=''
        )
        
        result = score_engine.execute_curl_command(['curl', '-s', 'https://example.com'])
        
        assert result == '{"test": "data"}'
        mock_run.assert_called_once()
    
    @patch('subprocess.run')
    def test_failed_curl_execution(self, mock_run):
        """Test failed curl command execution"""
        mock_run.return_value = Mock(
            returncode=1,
            stdout='',
            stderr='Connection failed'
        )
        
        result = score_engine.execute_curl_command(['curl', '-s', 'https://example.com'])
        
        assert result is None
    
    @patch('subprocess.run')
    def test_curl_timeout(self, mock_run):
        """Test curl command timeout"""
        mock_run.side_effect = subprocess.TimeoutExpired('curl', 15)
        
        result = score_engine.execute_curl_command(['curl', '-s', 'https://example.com'])
        
        assert result is None
    
    @patch('subprocess.run')
    def test_curl_not_found(self, mock_run):
        """Test curl command not found"""
        mock_run.side_effect = FileNotFoundError()
        
        result = score_engine.execute_curl_command(['curl', '-s', 'https://example.com'])
        
        assert result is None


class TestFetchScanData:
    """Tests for fetch_scan_data() function"""
    
    @patch('score_engine.execute_curl_command')
    def test_successful_data_fetch(self, mock_curl):
        """Test successful data fetching from all endpoints"""
        mock_curl.return_value = '{"test": "data"}'
        
        result = score_engine.fetch_scan_data('example.com')
        
        # Should have called curl for each endpoint
        assert mock_curl.call_count == len(score_engine.API_ENDPOINTS)
        assert 'cert_scan' in result
        assert 'dns_scan' in result
    
    @patch('score_engine.execute_curl_command')
    def test_partial_fetch_failure(self, mock_curl):
        """Test handling of partial fetch failures"""
        # First call succeeds, second fails
        mock_curl.side_effect = ['{"test": "data"}', None, '{"test": "data2"}', None, None, None]
        
        result = score_engine.fetch_scan_data('example.com')
        
        # Should have some data but not all
        assert len(result) < len(score_engine.API_ENDPOINTS)
    
    @patch('score_engine.execute_curl_command')
    def test_invalid_json_response(self, mock_curl):
        """Test handling of invalid JSON responses"""
        mock_curl.return_value = 'not valid json'
        
        result = score_engine.fetch_scan_data('example.com')
        
        # Should return empty dict or skip invalid responses
        assert isinstance(result, dict)


# ============================================================================
# EDGE CASE TESTS
# ============================================================================

class TestEdgeCases:
    """Tests for edge cases and boundary conditions"""
    
    def test_score_never_exceeds_100(self):
        """Ensure scores are capped at 100"""
        # Even with perfect data, score shouldn't exceed 100
        dns_data = {
            "rcode": 999,  # Artificially high
            "a": ["1.1.1.1"] * 10,  # Many A records
            "aaaa": ["::1"] * 10  # Many AAAA records
        }
        score = score_engine.score_dns_scan(dns_data)
        assert score <= 100, "Score should never exceed 100"
    
    def test_score_never_below_1(self):
        """Ensure scores are never below 1"""
        # Worst possible cert scenario
        cert_data = {
            "data": [{
                "not_after": "2000-01-01T00:00:00",
                "not_before": "1999-01-01T00:00:00"
            }]
        }
        score = score_engine.score_cert_scan(cert_data, datetime.now())
        assert score >= 1, "Score should never be below 1"
    
    def test_empty_data_structures(self):
        """Test handling of empty data structures"""
        # Empty lists/dicts should be handled gracefully
        assert score_engine.score_dns_scan({}) >= 1
        assert score_engine.score_mail_scan({}) >= 1
        assert score_engine.score_rdap_scan({}) >= 1
    
    def test_none_values(self):
        """Test handling of None values in data"""
        dns_data = {
            "rcode": None,
            "a": None,
            "aaaa": None
        }
        # Should handle None gracefully without crashing
        score = score_engine.score_dns_scan(dns_data)
        assert isinstance(score, int), "Function should handle None values gracefully"
        assert score >= 1, "Score should be at least 1 even with None values"


if __name__ == '__main__':
    pytest.main([__file__, '-v'])