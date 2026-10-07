package com.palpeer.wallet.funding;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.ledger.domain.LedgerEntry;
import com.palpeer.ledger.domain.LedgerEntryType;
import com.palpeer.ledger.service.LedgerPostingRequest;
import com.palpeer.ledger.service.LedgerService;
import com.palpeer.user.repository.UserRepository;
import com.palpeer.wallet.domain.Wallet;
import com.palpeer.wallet.funding.dto.CreateFundingRequest;
import com.palpeer.wallet.funding.dto.FundingTransactionResponse;
import com.palpeer.wallet.provider.PaymentRailRouter;
import com.palpeer.wallet.repository.WalletRepository;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class FundingServiceTest {

    @Mock private FundingTransactionRepository fundingTransactionRepository;
    @Mock private WalletRepository walletRepository;
    @Mock private UserRepository userRepository;
    @Mock private LedgerService ledgerService;
    @Mock private com.palpeer.common.audit.AuditRecorder auditRecorder;
    @Mock private PaymentRailRouter paymentRailRouter;

    @InjectMocks private FundingService fundingService;

    private UUID userId;
    private UUID walletId;
    private Wallet wallet;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        walletId = UUID.randomUUID();
        wallet = new Wallet();
        wallet.setId(walletId);
        wallet.setUserId(userId);
        wallet.setCurrencyCode("USD");
        wallet.setAvailableBalance(BigDecimal.ZERO);
        wallet.setPendingBalance(BigDecimal.ZERO);
    }

    @Test
    void initiate_requiresIdempotencyKey() {
        assertThatThrownBy(() -> fundingService.initiate(
                        userId, " ", new CreateFundingRequest(walletId, new BigDecimal("10.00"), null)))
                .isInstanceOf(BusinessException.class)
                .extracting("code")
                .isEqualTo("IDEMPOTENCY_KEY_REQUIRED");
    }

    @Test
    void initiate_replaysMatchingIdempotencyKey() {
        FundingTransaction existing = baseFunding(MoneyMovementStatus.INITIATED);
        when(fundingTransactionRepository.findByIdempotencyKey("idem-1")).thenReturn(Optional.of(existing));

        FundingTransactionResponse response = fundingService.initiate(
                userId, "idem-1", new CreateFundingRequest(walletId, new BigDecimal("25.00"), null));

        assertThat(response.id()).isEqualTo(existing.getId());
        assertThat(response.status()).isEqualTo(MoneyMovementStatus.INITIATED);
        verify(fundingTransactionRepository, never()).saveAndFlush(any());
    }

    @Test
    void initiate_conflictsOnPayloadMismatch() {
        FundingTransaction existing = baseFunding(MoneyMovementStatus.INITIATED);
        when(fundingTransactionRepository.findByIdempotencyKey("idem-1")).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> fundingService.initiate(
                        userId, "idem-1", new CreateFundingRequest(walletId, new BigDecimal("99.00"), null)))
                .isInstanceOf(BusinessException.class)
                .extracting("code")
                .isEqualTo("FUNDING_IDEMPOTENCY_CONFLICT");
    }

    @Test
    void operatorProcess_postsCreditMarksSuccessAndAuditsOperator() {
        UUID operatorId = UUID.randomUUID();
        FundingTransaction tx = baseFunding(MoneyMovementStatus.INITIATED);
        when(fundingTransactionRepository.findByIdForUpdate(tx.getId())).thenReturn(Optional.of(tx));
        when(fundingTransactionRepository.save(any(FundingTransaction.class))).thenAnswer(inv -> inv.getArgument(0));

        LedgerEntry credit = new LedgerEntry();
        credit.setId(UUID.randomUUID());
        when(ledgerService.post(any(LedgerPostingRequest.class))).thenReturn(credit);

        FundingTransactionResponse response = fundingService.operatorProcess(operatorId, tx.getId());

        assertThat(response.status()).isEqualTo(MoneyMovementStatus.SUCCESS);
        assertThat(response.ledgerEntryId()).isEqualTo(credit.getId());

        ArgumentCaptor<LedgerPostingRequest> captor = ArgumentCaptor.forClass(LedgerPostingRequest.class);
        verify(ledgerService).post(captor.capture());
        assertThat(captor.getValue().entryType()).isEqualTo(LedgerEntryType.CREDIT);
        assertThat(captor.getValue().amount()).isEqualByComparingTo("25.00");

        ArgumentCaptor<AuditRecord> audits = ArgumentCaptor.forClass(AuditRecord.class);
        verify(auditRecorder, atLeastOnce()).record(audits.capture());
        assertThat(audits.getAllValues())
                .anySatisfy(a -> {
                    assertThat(a.action()).isEqualTo("FUNDING_OPERATOR_PROCESS");
                    assertThat(a.userRef()).isEqualTo(operatorId.toString());
                });
    }

    @Test
    void operatorReverse_requiresSuccess() {
        FundingTransaction tx = baseFunding(MoneyMovementStatus.INITIATED);
        when(fundingTransactionRepository.findByIdForUpdate(tx.getId())).thenReturn(Optional.of(tx));

        assertThatThrownBy(() -> fundingService.operatorReverse(UUID.randomUUID(), tx.getId()))
                .isInstanceOf(BusinessException.class)
                .extracting("code")
                .isEqualTo("FUNDING_INVALID_STATE");
    }

    private FundingTransaction baseFunding(MoneyMovementStatus status) {
        FundingTransaction tx = new FundingTransaction();
        tx.setId(UUID.randomUUID());
        tx.setUserId(userId);
        tx.setWalletId(walletId);
        tx.setAmount(new BigDecimal("25.00"));
        tx.setCurrencyCode("USD");
        tx.setStatus(status);
        tx.setIdempotencyKey("idem-1");
        return tx;
    }
}
