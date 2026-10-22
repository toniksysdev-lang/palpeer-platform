package com.palpeer.transaction.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

import com.palpeer.common.exception.ResourceNotFoundException;

import com.palpeer.exchange.domain.ExchangeTransaction;
import com.palpeer.exchange.domain.ExchangeTransactionStatus;
import com.palpeer.exchange.repository.ExchangeTransactionRepository;
import com.palpeer.p2p.domain.P2POrder;
import com.palpeer.p2p.domain.P2PRequest;
import com.palpeer.p2p.domain.P2PSide;
import com.palpeer.p2p.domain.P2PStatus;
import com.palpeer.p2p.repository.P2POrderRepository;
import com.palpeer.p2p.repository.P2PRequestRepository;
import com.palpeer.promotion.domain.BonusStatus;
import com.palpeer.promotion.repository.BonusRepository;
import com.palpeer.transaction.domain.TransactionActivityType;
import com.palpeer.transaction.web.dto.TransactionItemResponse;
import com.palpeer.transaction.web.dto.TransactionPageResponse;
import com.palpeer.transaction.web.dto.TransactionSummaryResponse;
import com.palpeer.wallet.domain.Wallet;
import com.palpeer.wallet.funding.FundingTransaction;
import com.palpeer.wallet.funding.FundingTransactionRepository;
import com.palpeer.wallet.funding.MoneyMovementStatus;
import com.palpeer.user.domain.User;
import com.palpeer.user.repository.UserRepository;
import com.palpeer.wallet.repository.WalletRepository;
import com.palpeer.wallet.transfer.WalletTransferRepository;
import com.palpeer.wallet.withdrawal.WithdrawalTransaction;
import com.palpeer.wallet.withdrawal.WithdrawalTransactionRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
class TransactionQueryServiceTest {

    @Mock private FundingTransactionRepository fundingRepository;
    @Mock private WithdrawalTransactionRepository withdrawalRepository;
    @Mock private ExchangeTransactionRepository exchangeRepository;
    @Mock private WalletTransferRepository transferRepository;
    @Mock private P2POrderRepository p2pOrderRepository;
    @Mock private P2PRequestRepository p2pRequestRepository;
    @Mock private BonusRepository bonusRepository;
    @Mock private WalletRepository walletRepository;
    @Mock private UserRepository userRepository;

    @InjectMocks private TransactionQueryService service;

    @BeforeEach
    void stubBonusesEmpty() {
        lenient()
                .when(bonusRepository.findByUserIdAndStatusOrderByCreatedAtDesc(any(), eq(BonusStatus.GRANTED)))
                .thenReturn(List.of());
        lenient()
                .when(bonusRepository.findByUserIdAndStatusAndCreatedAtBetween(any(), eq(BonusStatus.GRANTED), any(), any()))
                .thenReturn(List.of());
        lenient()
                .when(bonusRepository
                        .findByUserIdAndStatusAndCreatedAtGreaterThanEqualAndCreatedAtLessThanEqualOrderByCreatedAtDesc(
                                any(), eq(BonusStatus.GRANTED), any(), any(), any(Pageable.class)))
                .thenReturn(org.springframework.data.domain.Page.empty());
    }

    @Test
    void recent_mergesAndOrdersByCreatedAt() {
        UUID userId = UUID.randomUUID();
        Instant t1 = Instant.parse("2026-01-01T10:00:00Z");
        Instant t2 = Instant.parse("2026-01-02T10:00:00Z");

        FundingTransaction funding = funding(userId, "USD", "10.00", MoneyMovementStatus.SUCCESS, t1);
        WithdrawalTransaction withdrawal = withdrawal(userId, "USD", "5.00", MoneyMovementStatus.SUCCESS, t2);

        when(fundingRepository.findByUserIdOrderByCreatedAtDesc(eq(userId), any(Pageable.class)))
                .thenReturn(List.of(funding));
        when(withdrawalRepository.findByUserIdOrderByCreatedAtDesc(eq(userId), any(Pageable.class)))
                .thenReturn(List.of(withdrawal));
        when(exchangeRepository.findByUserIdOrderByCreatedAtDesc(eq(userId), any(Pageable.class)))
                .thenReturn(List.of());
        when(transferRepository.findByPartyUserIdOrderByCreatedAtDesc(eq(userId), any(Pageable.class)))
                .thenReturn(List.of());
        when(p2pOrderRepository.findByPartyUserIdAndStatusInOrderByCreatedAtDesc(
                        eq(userId), any(), any(Pageable.class)))
                .thenReturn(List.of());

        List<TransactionItemResponse> recent = service.recent(userId, 20);

        assertThat(recent).hasSize(2);
        assertThat(recent.get(0).type()).isEqualTo(TransactionActivityType.WITHDRAWAL);
        assertThat(recent.get(1).type()).isEqualTo(TransactionActivityType.FUNDING);
    }

    @Test
    void details_returnsFundingForOwner() {
        UUID userId = UUID.randomUUID();
        FundingTransaction funding = funding(userId, "NGN", "100.00", MoneyMovementStatus.SUCCESS, Instant.now());
        when(fundingRepository.findByIdAndUserId(funding.getId(), userId)).thenReturn(Optional.of(funding));

        TransactionItemResponse item = service.details(userId, TransactionActivityType.FUNDING, funding.getId());

        assertThat(item.type()).isEqualTo(TransactionActivityType.FUNDING);
        assertThat(item.amount()).isEqualByComparingTo("100.00");
        assertThat(item.currencyCode()).isEqualTo("NGN");
    }

    @Test
    void details_hidesOtherUsersTransaction() {
        UUID ownerId = UUID.randomUUID();
        UUID otherUserId = UUID.randomUUID();
        FundingTransaction funding = funding(ownerId, "USD", "10.00", MoneyMovementStatus.SUCCESS, Instant.now());
        when(fundingRepository.findByIdAndUserId(funding.getId(), otherUserId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.details(otherUserId, TransactionActivityType.FUNDING, funding.getId()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void history_filtersByType() {
        UUID userId = UUID.randomUUID();
        Instant from = Instant.parse("2026-01-01T00:00:00Z");
        Instant to = Instant.parse("2026-01-31T23:59:59Z");
        FundingTransaction funding = funding(userId, "USD", "10.00", MoneyMovementStatus.SUCCESS, Instant.parse("2026-01-15T12:00:00Z"));

        when(fundingRepository.findByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanEqualOrderByCreatedAtDesc(
                        eq(userId), eq(from), eq(to), any(Pageable.class)))
                .thenReturn(List.of(funding));
        when(fundingRepository.findByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanEqual(userId, from, to))
                .thenReturn(List.of(funding));

        TransactionPageResponse page = service.history(userId, TransactionActivityType.FUNDING, from, to, 0, 10);

        assertThat(page.totalElements()).isEqualTo(1);
        assertThat(page.items()).hasSize(1);
        assertThat(page.items().getFirst().type()).isEqualTo(TransactionActivityType.FUNDING);
    }

    @Test
    void recent_includesSettledP2POrders() {
        UUID userId = UUID.randomUUID();
        Instant t1 = Instant.parse("2026-01-03T10:00:00Z");
        P2POrder order = p2pOrder(userId, UUID.randomUUID(), P2PStatus.COMPLETED, t1);
        P2PRequest request = p2pRequest(order.getRequestId(), userId, "CAD", "NGN");

        when(fundingRepository.findByUserIdOrderByCreatedAtDesc(eq(userId), any(Pageable.class)))
                .thenReturn(List.of());
        when(withdrawalRepository.findByUserIdOrderByCreatedAtDesc(eq(userId), any(Pageable.class)))
                .thenReturn(List.of());
        when(exchangeRepository.findByUserIdOrderByCreatedAtDesc(eq(userId), any(Pageable.class)))
                .thenReturn(List.of());
        when(transferRepository.findByPartyUserIdOrderByCreatedAtDesc(eq(userId), any(Pageable.class)))
                .thenReturn(List.of());
        when(p2pOrderRepository.findByPartyUserIdAndStatusInOrderByCreatedAtDesc(
                        eq(userId), any(), any(Pageable.class)))
                .thenReturn(List.of(order));
        when(p2pRequestRepository.findAllById(any())).thenReturn(List.of(request));

        List<TransactionItemResponse> recent = service.recent(userId, 20);

        assertThat(recent).hasSize(1);
        assertThat(recent.getFirst().type()).isEqualTo(TransactionActivityType.P2P);
        assertThat(recent.getFirst().status()).isEqualTo("COMPLETED");
        assertThat(recent.getFirst().currencyCode()).isEqualTo("CAD");
        assertThat(recent.getFirst().secondaryCurrencyCode()).isEqualTo("NGN");
        assertThat(recent.getFirst().secondaryAmount()).isEqualByComparingTo("150000.00");
    }

    @Test
    void adminDetails_enrichesOwnerEmail() {
        UUID userId = UUID.randomUUID();
        FundingTransaction funding = funding(userId, "CAD", "25.00", MoneyMovementStatus.SUCCESS, Instant.now());
        when(fundingRepository.findById(funding.getId())).thenReturn(Optional.of(funding));
        User user = new User();
        user.setId(userId);
        user.setEmail("member@example.com");
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        TransactionItemResponse item =
                service.adminDetails(TransactionActivityType.FUNDING, funding.getId());

        assertThat(item.userEmail()).isEqualTo("member@example.com");
        assertThat(item.userId()).isEqualTo(userId);
    }

    @Test
    void summary_aggregatesSuccessfulAmounts() {
        UUID userId = UUID.randomUUID();
        Instant from = Instant.parse("2026-01-01T00:00:00Z");
        Instant to = Instant.parse("2026-01-31T23:59:59Z");

        when(fundingRepository.findByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanEqual(userId, from, to))
                .thenReturn(List.of(
                        funding(userId, "USD", "10.00", MoneyMovementStatus.SUCCESS, from),
                        funding(userId, "USD", "5.00", MoneyMovementStatus.FAILED, from)));
        when(withdrawalRepository.findByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanEqual(userId, from, to))
                .thenReturn(List.of());
        when(exchangeRepository.findByUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanEqual(userId, from, to))
                .thenReturn(List.of(exchange(userId, ExchangeTransactionStatus.SUCCESS, from)));
        when(transferRepository.findByPartyUserIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanEqual(
                        userId, from, to))
                .thenReturn(List.of());
        when(p2pOrderRepository.findByPartyUserIdAndStatusInAndCreatedAtBetween(
                        eq(userId), any(), eq(from), eq(to)))
                .thenReturn(List.of());

        Wallet source = new Wallet();
        source.setId(UUID.randomUUID());
        source.setCurrencyCode("USD");
        // exchange mapping not needed for summary

        TransactionSummaryResponse summary = service.summary(userId, from, to);

        assertThat(summary.totalCount()).isEqualTo(3);
        assertThat(summary.countByType().get("FUNDING")).isEqualTo(2);
        assertThat(summary.countByType().get("TRANSFER")).isEqualTo(0);
        assertThat(summary.successfulFundingByCurrency()).hasSize(1);
        assertThat(summary.successfulFundingByCurrency().getFirst().totalAmount()).isEqualByComparingTo("10.00");
        assertThat(summary.successfulExchangeCount()).isEqualTo(1);
    }

    private FundingTransaction funding(
            UUID userId, String currency, String amount, MoneyMovementStatus status, Instant createdAt) {
        FundingTransaction f = new FundingTransaction();
        f.setId(UUID.randomUUID());
        f.setUserId(userId);
        f.setWalletId(UUID.randomUUID());
        f.setCurrencyCode(currency);
        f.setAmount(new BigDecimal(amount));
        f.setStatus(status);
        f.setIdempotencyKey("f-" + UUID.randomUUID());
        f.setCreatedAt(createdAt);
        f.setUpdatedAt(createdAt);
        return f;
    }

    private WithdrawalTransaction withdrawal(
            UUID userId, String currency, String amount, MoneyMovementStatus status, Instant createdAt) {
        WithdrawalTransaction w = new WithdrawalTransaction();
        w.setId(UUID.randomUUID());
        w.setUserId(userId);
        w.setWalletId(UUID.randomUUID());
        w.setCurrencyCode(currency);
        w.setAmount(new BigDecimal(amount));
        w.setStatus(status);
        w.setIdempotencyKey("w-" + UUID.randomUUID());
        w.setCreatedAt(createdAt);
        w.setUpdatedAt(createdAt);
        return w;
    }

    private ExchangeTransaction exchange(UUID userId, ExchangeTransactionStatus status, Instant createdAt) {
        ExchangeTransaction e = new ExchangeTransaction();
        e.setId(UUID.randomUUID());
        e.setUserId(userId);
        e.setQuoteId(UUID.randomUUID());
        e.setSourceWalletId(UUID.randomUUID());
        e.setTargetWalletId(UUID.randomUUID());
        e.setSourceAmount(new BigDecimal("10.00"));
        e.setTargetAmount(new BigDecimal("15000.00"));
        e.setAppliedRate(new BigDecimal("1500.00"));
        e.setStatus(status);
        e.setIdempotencyKey("e-" + UUID.randomUUID());
        e.setCreatedAt(createdAt);
        e.setUpdatedAt(createdAt);
        return e;
    }

    private P2POrder p2pOrder(UUID requesterId, UUID acceptorId, P2PStatus status, Instant createdAt) {
        P2POrder order = new P2POrder();
        order.setId(UUID.randomUUID());
        order.setRequestId(UUID.randomUUID());
        order.setRequesterId(requesterId);
        order.setAcceptorId(acceptorId);
        order.setAmount(new BigDecimal("100.00"));
        order.setRate(new BigDecimal("1500.00"));
        order.setStatus(status);
        order.setCreatedAt(createdAt);
        order.setUpdatedAt(createdAt);
        return order;
    }

    private P2PRequest p2pRequest(UUID requestId, UUID userId, String base, String quote) {
        P2PRequest request = new P2PRequest();
        request.setId(requestId);
        request.setUserId(userId);
        request.setSide(P2PSide.SELL);
        request.setBaseCurrencyCode(base);
        request.setQuoteCurrencyCode(quote);
        request.setAmount(new BigDecimal("100.00"));
        request.setRate(new BigDecimal("1500.00"));
        request.setStatus(P2PStatus.COMPLETED);
        return request;
    }
}
