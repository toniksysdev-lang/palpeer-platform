package com.palpeer.wallet.withdrawal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.palpeer.wallet.provider.korapay.KorapayClient;
import com.palpeer.wallet.provider.kuda.KudaClient;
import com.palpeer.wallet.withdrawal.dto.BankOptionResponse;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class BankDirectoryServiceTest {

    @Mock private KudaClient kudaClient;
    @Mock private KorapayClient korapayClient;
    @InjectMocks private BankDirectoryService bankDirectoryService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void listBanks_prefersKudaBankListWhenConfigured() {
        when(kudaClient.isConfigured()).thenReturn(true);
        ArrayNode data = objectMapper.createArrayNode();
        data.addObject().put("bankCode", "000013").put("bankName", "Guaranty Trust Bank");
        data.addObject().put("bankCode", "090267").put("bankName", "Kuda");
        data.addObject().put("bankCode", "000014").put("bankName", "Access Bank");
        when(kudaClient.listBanks()).thenReturn(data);

        List<BankOptionResponse> banks = bankDirectoryService.listBanks("NG");

        assertThat(banks).extracting(BankOptionResponse::code).containsExactly("000014", "000013", "090267");
        assertThat(banks).extracting(BankOptionResponse::name)
                .containsExactly("Access Bank", "Guaranty Trust Bank", "Kuda");
        verify(korapayClient, never()).isConfigured();
    }

    @Test
    void listBanks_usesKorapayWhenKudaUnavailable() {
        when(kudaClient.isConfigured()).thenReturn(false);
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
        when(kudaClient.isConfigured()).thenReturn(false);
        when(korapayClient.isConfigured()).thenReturn(false);

        List<BankOptionResponse> banks = bankDirectoryService.listBanks("NG");

        assertThat(banks).isNotEmpty();
        assertThat(banks).extracting(BankOptionResponse::code).contains("058", "090267");
    }

    @Test
    void listBanks_fallsBackWhenProvidersFail() {
        when(kudaClient.isConfigured()).thenReturn(true);
        when(kudaClient.listBanks()).thenThrow(new RuntimeException("timeout"));
        when(korapayClient.isConfigured()).thenReturn(true);
        when(korapayClient.listBanks(anyString())).thenThrow(new RuntimeException("timeout"));

        List<BankOptionResponse> banks = bankDirectoryService.listBanks("ng");

        assertThat(banks).isNotEmpty();
        assertThat(banks.get(0).name()).isLessThanOrEqualTo(banks.get(banks.size() - 1).name());
    }
}
