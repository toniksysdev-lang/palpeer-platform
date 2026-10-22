package com.palpeer.common.settings;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PhoneCountryResolverTest {

    @Test
    void resolvesCorridorPhones() {
        assertThat(PhoneCountryResolver.iso2FromE164("+2348012345678")).isEqualTo("NG");
        assertThat(PhoneCountryResolver.iso2FromE164("+233241234567")).isEqualTo("GH");
        assertThat(PhoneCountryResolver.iso2FromE164("+254712345678")).isEqualTo("KE");
        assertThat(PhoneCountryResolver.iso2FromE164("+447911123456")).isEqualTo("GB");
        assertThat(PhoneCountryResolver.iso2FromE164("+15062100661")).isEqualTo("CA");
    }

    @Test
    void currencyForResolvedCountry() {
        assertThat(RegistrationCorridorCurrencies.currencyForIso2(
                        PhoneCountryResolver.iso2FromE164("+2348012345678")))
                .isEqualTo("NGN");
        assertThat(RegistrationCorridorCurrencies.currencyForIso2(
                        PhoneCountryResolver.iso2FromE164("+15062100661")))
                .isEqualTo("CAD");
    }
}
