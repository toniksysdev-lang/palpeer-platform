package com.palpeer.wallet.withdrawal;

import com.palpeer.wallet.withdrawal.dto.BankOptionResponse;
import java.util.List;

/**
 * Static NIP bank directory used when Korapay's list-banks API is unavailable.
 * Codes match common Nigerian payout rails (Korapay / NIBSS).
 */
final class NigerianBanksCatalog {

    private NigerianBanksCatalog() {
    }

    static List<BankOptionResponse> all() {
        return List.of(
                bank("044", "Access Bank", "access-bank"),
                bank("063", "Access Bank (Diamond)", "access-diamond"),
                bank("035A", "ALAT by WEMA", "alat-wema"),
                bank("401", "ASO Savings and Loans", "aso-savings"),
                bank("050", "Ecobank Nigeria", "ecobank-nigeria"),
                bank("070", "Fidelity Bank", "fidelity-bank"),
                bank("011", "First Bank of Nigeria", "first-bank"),
                bank("214", "First City Monument Bank", "fcmb"),
                bank("058", "Guaranty Trust Bank", "gtbank"),
                bank("030", "Heritage Bank", "heritage-bank"),
                bank("301", "Jaiz Bank", "jaiz-bank"),
                bank("082", "Keystone Bank", "keystone-bank"),
                bank("526", "Parallex Bank", "parallex-bank"),
                bank("076", "Polaris Bank", "polaris-bank"),
                bank("101", "Providus Bank", "providus-bank"),
                bank("221", "Stanbic IBTC Bank", "stanbic-ibtc"),
                bank("068", "Standard Chartered Bank", "standard-chartered"),
                bank("232", "Sterling Bank", "sterling-bank"),
                bank("100", "Suntrust Bank", "suntrust-bank"),
                bank("032", "Union Bank of Nigeria", "union-bank"),
                bank("033", "United Bank For Africa", "uba"),
                bank("215", "Unity Bank", "unity-bank"),
                bank("035", "Wema Bank", "wema-bank"),
                bank("057", "Zenith Bank", "zenith-bank"),
                bank("999", "NIP Virtual Bank", "nip-virtual"),
                bank("090267", "Kuda Bank", "kuda-bank"),
                bank("090110", "VFD Microfinance Bank", "vfd-mfb"),
                bank("090175", "Mint Microfinance Bank", "mint-mfb"),
                bank("090286", "Safe Haven MFB", "safe-haven-mfb"),
                bank("100004", "Opay", "opay"),
                bank("100033", "PalmPay", "palmpay"),
                bank("100002", "Paga", "paga"),
                bank("100031", "Carbon", "carbon"),
                bank("090405", "Moniepoint MFB", "moniepoint-mfb"),
                bank("090328", "Eyowo", "eyowo"),
                bank("090325", "Sparkle Microfinance Bank", "sparkle-mfb"),
                bank("090115", "TCF MFB", "tcf-mfb"),
                bank("090180", "AMJU Unique MFB", "amju-mfb"),
                bank("090097", "Ekondo MFB", "ekondo-mfb"),
                bank("090156", "Fedpoly Offa MFB", "fedpoly-offa-mfb"),
                bank("090317", "PatrickGold MFB", "patrickgold-mfb"),
                bank("090194", "NIRSAL MFB", "nirsal-mfb"),
                bank("090251", "CitiTrust MFB", "cititrust-mfb"),
                bank("090270", "AB MFB", "ab-mfb"),
                bank("000", "Test Bank", "test-bank")
        );
    }

    private static BankOptionResponse bank(String code, String name, String slug) {
        return new BankOptionResponse(code, name, slug);
    }
}
