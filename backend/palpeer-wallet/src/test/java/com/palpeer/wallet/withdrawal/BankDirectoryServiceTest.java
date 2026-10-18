package com.palpeer.wallet.withdrawal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.palpeer.wallet.provider.korapay.KorapayClient;
import com.palpeer.wallet.withdrawal.dto.BankOptionResponse;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class BankDirectoryServiceTest {

    @Mock private KorapayClient korapayClient;
    @InjectMocks private BankDirectoryService bankDirectoryService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void listBanks_usesKorapayWhenConfigured() {
        when(korapayClient.isConfigured()).thenReturn(true);
        ArrayNode data = objectMapper.createArrayNode();
        data.addObject().put("code", "058").put("name", "Guaranty Trust Bank").put("slug", "gtbank");
        data.addObject().put("code", "033").put("name", "United Bank For Africa").put("slug", "uba");
        when(korapayClient.listBanks("NG")).thenReturn(data);

        List<BankOptionResponse> banks = bankDirectoryService.listBanks("NG");

        assertThat(banks).extracting(BankOptionResponse::code).containsExactly("058", "033");
    }

    @Test
    void listBanks_fallsBackToStaticCatalog() {
        when(korapayClient.isConfigured()).thenReturn(false);

        List<BankOptionResponse> banks = bankDirectoryService.listBanks("NG");

        assertThat(banks).isNotEmpty();
        assertThat(banks).extracting(BankOptionResponse::code).contains("058", "090267");
    }

    @Test
    void listBanks_fallsBackWhenKorapayFails() {
        when(korapayClient.isConfigured()).thenReturn(true);
        when(korapayClient.listBanks(anyString())).thenThrow(new RuntimeException("timeout"));

        List<BankOptionResponse> banks = bankDirectoryService.listBanks("ng");

        assertThat(banks).isNotEmpty();
        assertThat(banks.get(0).name()).isLessThanOrEqualTo(banks.get(banks.size() - 1).name());
    }
}
