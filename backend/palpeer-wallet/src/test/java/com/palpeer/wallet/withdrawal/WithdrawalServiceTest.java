package com.palpeer.wallet.withdrawal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.notify.UserNotifyEvent;
import com.palpeer.ledger.domain.LedgerEntry;
import com.palpeer.ledger.domain.LedgerEntryType;
import com.palpeer.ledger.service.LedgerPostingRequest;
import com.palpeer.ledger.service.LedgerService;
import com.palpeer.profile.repository.ProfileRepository;
import com.palpeer.user.domain.User;
import com.palpeer.user.repository.UserRepository;
import com.palpeer.wallet.domain.Wallet;
import com.palpeer.wallet.funding.MoneyMovementStatus;
import com.palpeer.wallet.provider.PaymentRailRouter;
import com.palpeer.wallet.repository.WalletRepository;
import com.palpeer.wallet.withdrawal.dto.CreateWithdrawalRequest;
import com.palpeer.wallet.withdrawal.dto.WithdrawalTransactionResponse;
import java.math.BigDecimal;
import java.util.List;
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
class WithdrawalServiceTest {

    @Mock private WithdrawalTransactionRepository withdrawalTransactionRepository;
    @Mock private WalletRepository walletRepository;
    @Mock private UserRepository userRepository;
    @Mock private ProfileRepository profileRepository;
    @Mock private LedgerService ledgerService;
    @Mock private com.palpeer.common.audit.AuditRecorder auditRecorder;
    @Mock private PaymentRailRouter paymentRailRouter;
    @Mock private org.springframework.context.ApplicationEventPublisher eventPublisher;
    @Mock private com.palpeer.wallet.service.PoolLiquidityGuard poolLiquidityGuard;
    @Mock private com.palpeer.wallet.service.PoolFundThresholdService poolFundThresholdService;
    @Mock private com.palpeer.wallet.service.WithdrawalUnverifiedLimitService withdrawalUnverifiedLimitService;

    @InjectMocks private WithdrawalService withdrawalService;

    private UUID userId;
    private UUID walletId;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        walletId = UUID.randomUUID();
    }

    @Test
    void initiate_holdsFundsAndMovesToPending() {
        when(withdrawalTransactionRepository.findByIdempotencyKey("w-1")).thenReturn(Optional.empty());

        Wallet wallet = new Wallet();
        wallet.setId(walletId);
        wallet.setUserId(userId);
        wallet.setCurrencyCode("NGN");
        when(walletRepository.findByIdAndUserId(walletId, userId)).thenReturn(Optional.of(wallet));
        User user = new User();
        user.setId(userId);
        user.setEmail("u@example.com");
        user.setPhone("+2348000000000");
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(paymentRailRouter.hasEnabledRail("NGN")).thenReturn(false);
        when(withdrawalTransactionRepository.saveAndFlush(any(WithdrawalTransaction.class))).thenAnswer(inv -> {
            WithdrawalTransaction tx = inv.getArgument(0);
            if (tx.getId() == null) {
                tx.setId(UUID.randomUUID());
            }
            return tx;
        });
        when(withdrawalTransactionRepository.save(any(WithdrawalTransaction.class))).thenAnswer(inv -> inv.getArgument(0));

        LedgerEntry hold = new LedgerEntry();
        hold.setId(UUID.randomUUID());
        when(ledgerService.post(any(LedgerPostingRequest.class))).thenReturn(hold);

        WithdrawalTransactionResponse response = withdrawalService.initiate(
                userId, "w-1", new CreateWithdrawalRequest(walletId, new BigDecimal("100.00"), "BANK-1"));

        assertThat(response.status()).isEqualTo(MoneyMovementStatus.PENDING);
        assertThat(response.holdLedgerEntryId()).isEqualTo(hold.getId());

        ArgumentCaptor<LedgerPostingRequest> captor = ArgumentCaptor.forClass(LedgerPostingRequest.class);
        verify(ledgerService).post(captor.capture());
        assertThat(captor.getValue().entryType()).isEqualTo(LedgerEntryType.HOLD);

        ArgumentCaptor<UserNotifyEvent> notify = ArgumentCaptor.forClass(UserNotifyEvent.class);
        verify(eventPublisher).publishEvent(notify.capture());
        assertThat(notify.getValue().referenceType()).isEqualTo("WITHDRAWAL");
        assertThat(notify.getValue().title()).isEqualTo("Withdrawal initiated");
        assertThat(notify.getValue().sendEmail()).isTrue();
        assertThat(notify.getValue().sendPush()).isTrue();
    }

    @Test
    void process_releasesThenDebits() {
        WithdrawalTransaction tx = baseWithdrawal(MoneyMovementStatus.PENDING);
        tx.setHoldLedgerEntryId(UUID.randomUUID());
        when(withdrawalTransactionRepository.findByIdForUpdate(tx.getId())).thenReturn(Optional.of(tx));
        when(withdrawalTransactionRepository.save(any(WithdrawalTransaction.class))).thenAnswer(inv -> inv.getArgument(0));

        LedgerEntry release = new LedgerEntry();
        release.setId(UUID.randomUUID());
        LedgerEntry debit = new LedgerEntry();
        debit.setId(UUID.randomUUID());
        when(ledgerService.post(any(LedgerPostingRequest.class))).thenReturn(release, debit);

        WithdrawalTransactionResponse response = withdrawalService.operatorProcess(UUID.randomUUID(), tx.getId());

        assertThat(response.status()).isEqualTo(MoneyMovementStatus.SUCCESS);
        assertThat(response.releaseLedgerEntryId()).isEqualTo(release.getId());
        assertThat(response.debitLedgerEntryId()).isEqualTo(debit.getId());

        ArgumentCaptor<LedgerPostingRequest> captor = ArgumentCaptor.forClass(LedgerPostingRequest.class);
        verify(ledgerService, times(2)).post(captor.capture());
        List<LedgerEntryType> types = captor.getAllValues().stream().map(LedgerPostingRequest::entryType).toList();
        assertThat(types).containsExactly(LedgerEntryType.RELEASE, LedgerEntryType.DEBIT);

        ArgumentCaptor<UserNotifyEvent> notify = ArgumentCaptor.forClass(UserNotifyEvent.class);
        verify(eventPublisher).publishEvent(notify.capture());
        assertThat(notify.getValue().referenceType()).isEqualTo("WITHDRAWAL");
        assertThat(notify.getValue().title()).isEqualTo("Withdrawal successful");
        assertThat(notify.getValue().sendEmail()).isTrue();
        assertThat(notify.getValue().sendPush()).isTrue();
    }

    @Test
    void fail_withoutHold_isInvalid() {
        // processable statuses without hold still fail process; fail path with hold releases
        WithdrawalTransaction tx = baseWithdrawal(MoneyMovementStatus.SUCCESS);
        when(withdrawalTransactionRepository.findByIdForUpdate(tx.getId())).thenReturn(Optional.of(tx));

        assertThatThrownBy(() -> withdrawalService.operatorFail(UUID.randomUUID(), tx.getId(), "too late"))
                .isInstanceOf(BusinessException.class)
                .extracting("code")
                .isEqualTo("WITHDRAWAL_INVALID_STATE");
    }

    private WithdrawalTransaction baseWithdrawal(MoneyMovementStatus status) {
        WithdrawalTransaction tx = new WithdrawalTransaction();
        tx.setId(UUID.randomUUID());
        tx.setUserId(userId);
        tx.setWalletId(walletId);
        tx.setAmount(new BigDecimal("100.00"));
        tx.setCurrencyCode("NGN");
        tx.setStatus(status);
        tx.setIdempotencyKey("w-1");
        return tx;
    }
}
