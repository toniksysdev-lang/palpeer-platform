package com.palpeer.admin.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.InetAddress;
import java.util.List;
import org.junit.jupiter.api.Test;

class AdminIpAllowlistFilterTest {

    @Test
    void emptyCsvYieldsNoRules() {
        assertThat(AdminIpAllowlistFilter.parseAllowlist("")).isEmpty();
        assertThat(AdminIpAllowlistFilter.parseAllowlist(null)).isEmpty();
        assertThat(AdminIpAllowlistFilter.parseAllowlist("  ,  ")).isEmpty();
    }

    @Test
    void parsesExactIpAndCidr() throws Exception {
        List<AdminIpAllowlistFilter.Cidr> rules =
                AdminIpAllowlistFilter.parseAllowlist("203.0.113.10, 198.51.100.0/24, bad-entry");
        assertThat(rules).hasSize(2);

        InetAddress allowedHost = InetAddress.getByName("203.0.113.10");
        InetAddress allowedCidr = InetAddress.getByName("198.51.100.42");
        InetAddress denied = InetAddress.getByName("203.0.113.11");

        assertThat(rules.get(0).contains(allowedHost)).isTrue();
        assertThat(rules.get(0).contains(denied)).isFalse();
        assertThat(rules.get(1).contains(allowedCidr)).isTrue();
        assertThat(rules.get(1).contains(InetAddress.getByName("198.51.101.1"))).isFalse();
    }
}
