package com.palpeer.wallet.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.palpeer.wallet.funding.FundingTransactionRepository;
import com.palpeer.wallet.funding.MoneyMovementStatus;
import com.palpeer.wallet.provider.apaylo.ApayloClient;
import com.palpeer.wallet.provider.korapay.KorapayClient;
import com.palpeer.wallet.provider.kuda.KudaClient;
import com.palpeer.wallet.repository.InstantExPoolContributionRepository;
import com.palpeer.wallet.web.dto.PoolFundsBalanceResponse;
import com.palpeer.wallet.withdrawal.WithdrawalTransactionRepository;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PoolFundsServiceTest {

    @Mock private ApayloClient apayloClient;
    @Mock private KorapayClient korapayClient;
    @Mock private KudaClient kudaClient;
    @Mock private FundingTransactionRepository fundingTransactionRepository;
    @Mock private WithdrawalTransactionRepository withdrawalTransactionRepository;
    @Mock private InstantExPoolContributionRepository instantExPoolContributionRepository;

    @InjectMocks private PoolFundsService poolFundsService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void balances_booksFundingWithdrawalsAndInstantEx() {
        when(apayloClient.isConfigured()).thenReturn(true);
        when(kudaClient.isConfigured()).thenReturn(true);
        when(korapayClient.isConfigured()).thenReturn(true);
        when(apayloClient.getAccountBalance()).thenReturn(new BigDecimal("999.00"));
        ObjectNode data = objectMapper.createObjectNode();
        data.putObject("NGN").put("available_balance", "50.00").put("pending_balance", "0");
        when(korapayClient.getBalances()).thenReturn(data);

        when(fundingTransactionRepository.sumAmountByProviderAndCurrency(MoneyMovementStatus.SUCCESS))
                .thenReturn(List.of(
                        new Object[] {"APAYLO", "CAD", new BigDecimal("300.00")},
                        new Object[] {null, "NGN", new BigDecimal("10000.00")},
                        new Object[] {"KORAPAY", "NGN", new BigDecimal("5000.00")}));
        when(withdrawalTransactionRepository.sumAmountByProviderAndCurrency(MoneyMovementStatus.SUCCESS))
                .thenReturn(List.of(
                        new Object[] {"APAYLO", "CAD", new BigDecimal("50.00")},
                        new Object[] {"KORAPAY", "NGN", new BigDecimal("2000.00")}));
        // CAD→NGN InstantEX: pool receives CAD, pays NGN
        when(instantExPoolContributionRepository.sumReceivedByCurrency())
                .thenReturn(List.<Object[]>of(new Object[] {"CAD", new BigDecimal("100.00")}));
        when(instantExPoolContributionRepository.sumPaidByCurrency())
                .thenReturn(List.<Object[]>of(new Object[] {"NGN", new BigDecimal("120000.00")}));

        PoolFundsBalanceResponse response = poolFundsService.balances();

        assertThat(response.apaylo().fundedTotal()).isEqualByComparingTo("300.00");
        assertThat(response.apaylo().withdrawnTotal()).isEqualByComparingTo("50.00");
        assertThat(response.apaylo().instantExReceivedTotal()).isEqualByComparingTo("100.00");
        assertThat(response.apaylo().instantExPaidTotal()).isEqualByComparingTo("0");
        // booked: 300 − 50 + 100 − 0
        assertThat(response.apaylo().balance()).isEqualByComparingTo("350.00");
        // live: 999 + 300 − 50 + 100 − 0
        assertThat(response.apaylo().liveBalance()).isEqualByComparingTo("1349.00");

        assertThat(response.korapay().fundedTotal()).isEqualByComparingTo("5000.00");
        assertThat(response.korapay().withdrawnTotal()).isEqualByComparingTo("2000.00");
        assertThat(response.korapay().balance()).isEqualByComparingTo("3000.00");

        // InstantEX NGN is attributed to Kuda (active NGN rail)
        assertThat(response.kuda().instantExPaidTotal()).isEqualByComparingTo("120000.00");
        assertThat(response.kuda().fundedTotal()).isEqualByComparingTo("10000.00");
        assertThat(response.kuda().configured()).isTrue();
    }
}
