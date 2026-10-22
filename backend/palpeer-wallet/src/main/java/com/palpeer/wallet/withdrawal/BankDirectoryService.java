package com.palpeer.wallet.withdrawal;

import com.fasterxml.jackson.databind.JsonNode;
import com.palpeer.wallet.provider.korapay.KorapayClient;
import com.palpeer.wallet.provider.kuda.KudaClient;
import com.palpeer.wallet.withdrawal.dto.BankOptionResponse;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class BankDirectoryService {

    private final KudaClient kudaClient;
    private final KorapayClient korapayClient;

    public List<BankOptionResponse> listBanks(String countryCode) {
        String country = countryCode == null || countryCode.isBlank()
                ? "NG"
                : countryCode.trim().toUpperCase(Locale.ROOT);
        if (!"NG".equals(country)) {
            return List.of();
        }

        // Prefer Kuda BANK_LIST — same environment/codes used for NGN withdrawals.
        if (kudaClient.isConfigured()) {
            try {
                List<BankOptionResponse> fromKuda = fromProviderBanks(kudaClient.listBanks());
                if (!fromKuda.isEmpty()) {
                    return fromKuda;
                }
            } catch (Exception ex) {
                log.warn("Kuda BANK_LIST failed — trying Korapay/static catalog. cause={}", ex.getMessage());
            }
        }

        if (korapayClient.isConfigured()) {
            try {
                List<BankOptionResponse> fromProvider = fromProviderBanks(korapayClient.listBanks(country));
                if (!fromProvider.isEmpty()) {
                    return fromProvider;
                }
            } catch (Exception ex) {
                log.warn("Korapay list-banks failed — using static NG catalog. cause={}", ex.getMessage());
            }
        }

        return NigerianBanksCatalog.all().stream()
                .sorted(Comparator.comparing(BankOptionResponse::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private static List<BankOptionResponse> fromProviderBanks(JsonNode data) {
        if (data == null || !data.isArray()) {
            return List.of();
        }
        Map<String, BankOptionResponse> unique = new LinkedHashMap<>();
        for (JsonNode node : data) {
            String code = firstText(node, "code", "bank_code", "bankCode", "BankCode");
            String name = firstText(node, "name", "bank_name", "bankName", "BankName");
            if (code == null || code.isBlank() || name == null || name.isBlank()) {
                continue;
            }
            String slug = firstText(node, "slug");
            if (slug == null || slug.isBlank()) {
                slug = slugify(name);
            }
            unique.putIfAbsent(code.trim(), new BankOptionResponse(code.trim(), name.trim(), slug));
        }
        List<BankOptionResponse> banks = new ArrayList<>(unique.values());
        banks.sort(Comparator.comparing(BankOptionResponse::name, String.CASE_INSENSITIVE_ORDER));
        return banks;
    }

    private static String slugify(String name) {
        return name.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    }

    private static String firstText(JsonNode node, String... fields) {
        if (node == null) {
            return null;
        }
        for (String field : fields) {
            JsonNode child = node.path(field);
            if (!child.isMissingNode() && !child.isNull() && !child.asText().isBlank()) {
                return child.asText();
            }
        }
        return null;
    }
}
