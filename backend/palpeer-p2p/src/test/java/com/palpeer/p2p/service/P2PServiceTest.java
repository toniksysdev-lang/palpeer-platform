package com.palpeer.p2p.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.palpeer.common.exception.BusinessException;
import com.palpeer.currency.service.CurrencyService;
import com.palpeer.ledger.domain.LedgerEntry;
import com.palpeer.ledger.domain.LedgerEntryType;
import com.palpeer.ledger.service.LedgerPostingRequest;
import com.palpeer.ledger.service.LedgerService;
import com.palpeer.p2p.domain.P2POrder;
import com.palpeer.p2p.domain.P2PRequest;
import com.palpeer.p2p.domain.P2PSide;
import com.palpeer.p2p.domain.P2PStatus;
import com.palpeer.p2p.repository.P2POrderRepository;
import com.palpeer.p2p.repository.P2PRequestRepository;
import com.palpeer.p2p.web.dto.CreateP2PRequestDto;
import com.palpeer.p2p.web.dto.P2POrderResponse;
import com.palpeer.p2p.web.dto.P2POrderSummaryResponse;
import com.palpeer.wallet.domain.Wallet;
import com.palpeer.wallet.repository.WalletRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class P2PServiceTest {

    @Mock private P2PRequestRepository p2PRequestRepository;
    @Mock private P2POrderRepository p2POrderRepository;
    @Mock private CurrencyService currencyService;
    @Mock private P2PRateBoundsService p2PRateBoundsService;
    @Mock private WalletRepository walletRepository;
    @Mock private LedgerService ledgerService;
    @Mock private com.palpeer.common.audit.AuditRecorder auditRecorder;
    @Mock private org.springframework.context.ApplicationEventPublisher eventPublisher;

    @InjectMocks private P2PService p2PService;

    private UUID ownerId;
    private UUID acceptorId;

    @BeforeEach
    void setUp() {
        ownerId = UUID.randomUUID();
        acceptorId = UUID.randomUUID();
    }

    @Test
    void create_persistsOpenRequest() {
        when(p2PRequestRepository.save(any(P2PRequest.class))).thenAnswer(inv -> {
            P2PRequest r = inv.getArgument(0);
            if (r.getId() == null) {
                r.setId(UUID.randomUUID());
            }
            return r;
        });

        var response = p2PService.create(ownerId, new CreateP2PRequestDto(
                P2PSide.BUY, "USD", "NGN",
                new BigDecimal("100.00"), new BigDecimal("1500.00"),
                null, "cash"));

        assertThat(response.status()).isEqualTo(P2PStatus.OPEN);
        assertThat(response.baseCurrencyCode()).isEqualTo("USD");
        verify(currencyService).requireExists("USD");
        verify(currencyService).requireExists("NGN");
        verify(ledgerService, never()).post(any());
    }

    @Test
    void create_sellPlacesHoldOnBaseWallet() {
        UUID walletId = UUID.randomUUID();
        UUID holdId = UUID.randomUUID();
        Wallet wallet = new Wallet();
        wallet.setId(walletId);
        wallet.setUserId(ownerId);
        wallet.setCurrencyCode("USD");
        when(walletRepository.findByUserIdAndCurrencyCodeIgnoreCase(ownerId, "USD"))
                .thenReturn(Optional.of(wallet));
        when(p2PRequestRepository.save(any(P2PRequest.class))).thenAnswer(inv -> {
            P2PRequest r = inv.getArgument(0);
            if (r.getId() == null) {
                r.setId(UUID.randomUUID());
            }
            return r;
        });
        when(ledgerService.post(any(LedgerPostingRequest.class))).thenAnswer(inv -> {
            LedgerEntry entry = new LedgerEntry();
            entry.setId(holdId);
            return entry;
        });

        var response = p2PService.create(ownerId, new CreateP2PRequestDto(
                P2PSide.SELL, "USD", "NGN",
                new BigDecimal("100.00"), new BigDecimal("1500.00"),
                null, null));

        assertThat(response.status()).isEqualTo(P2PStatus.OPEN);
        ArgumentCaptor<LedgerPostingRequest> post = ArgumentCaptor.forClass(LedgerPostingRequest.class);
        verify(ledgerService).post(post.capture());
        assertThat(post.getValue().entryType()).isEqualTo(LedgerEntryType.HOLD);
        assertThat(post.getValue().walletId()).isEqualTo(walletId);
        assertThat(post.getValue().amount()).isEqualByComparingTo("100.00");
    }

    @Test
    void accept_settlesWalletsAndMarksCompleted() {
        P2PRequest request = openRequest();
        UUID sellerBaseId = UUID.randomUUID();
        UUID buyerBaseId = UUID.randomUUID();
        UUID buyerQuoteId = UUID.randomUUID();
        UUID sellerQuoteId = UUID.randomUUID();
        request.setHoldWalletId(sellerBaseId);
        request.setHoldLedgerEntryId(UUID.randomUUID());

        when(p2PRequestRepository.findByIdForUpdate(request.getId())).thenReturn(Optional.of(request));
        when(p2PRequestRepository.save(any(P2PRequest.class))).thenAnswer(inv -> inv.getArgument(0));
        when(p2POrderRepository.save(any(P2POrder.class))).thenAnswer(inv -> {
            P2POrder o = inv.getArgument(0);
            o.setId(UUID.randomUUID());
            return o;
        });
        when(currencyService.getByCode("NGN"))
                .thenReturn(new com.palpeer.currency.web.dto.CurrencyResponse(
                        UUID.randomUUID(), "NGN", "₦", 2));
        when(walletRepository.findByUserIdAndCurrencyCodeIgnoreCase(ownerId, "USD"))
                .thenReturn(Optional.of(wallet(sellerBaseId, ownerId, "USD")));
        when(walletRepository.findByUserIdAndCurrencyCodeIgnoreCase(acceptorId, "USD"))
                .thenReturn(Optional.of(wallet(buyerBaseId, acceptorId, "USD")));
        when(walletRepository.findByUserIdAndCurrencyCodeIgnoreCase(acceptorId, "NGN"))
                .thenReturn(Optional.of(wallet(buyerQuoteId, acceptorId, "NGN")));
        when(walletRepository.findByUserIdAndCurrencyCodeIgnoreCase(ownerId, "NGN"))
                .thenReturn(Optional.of(wallet(sellerQuoteId, ownerId, "NGN")));
        when(ledgerService.post(any(LedgerPostingRequest.class))).thenAnswer(inv -> {
            LedgerEntry entry = new LedgerEntry();
            entry.setId(UUID.randomUUID());
            return entry;
        });

        P2POrderResponse order = p2PService.accept(acceptorId, request.getId());

        assertThat(order.status()).isEqualTo(P2PStatus.COMPLETED);
        assertThat(order.requesterId()).isEqualTo(ownerId);
        assertThat(order.acceptorId()).isEqualTo(acceptorId);
        assertThat(request.getStatus()).isEqualTo(P2PStatus.COMPLETED);
        verify(eventPublisher).publishEvent(new P2PRequestClosedEvent(request.getId(), P2PStatus.COMPLETED));

        ArgumentCaptor<LedgerPostingRequest> posts = ArgumentCaptor.forClass(LedgerPostingRequest.class);
        verify(ledgerService, org.mockito.Mockito.atLeast(4)).post(posts.capture());
        assertThat(posts.getAllValues().stream().map(LedgerPostingRequest::entryType).toList())
                .contains(LedgerEntryType.RELEASE, LedgerEntryType.DEBIT, LedgerEntryType.CREDIT);
    }

    private static Wallet wallet(UUID id, UUID userId, String currency) {
        Wallet wallet = new Wallet();
        wallet.setId(id);
        wallet.setUserId(userId);
        wallet.setCurrencyCode(currency);
        return wallet;
    }

    @Test
    void accept_expiredRequestPublishesClosedAndRefuses() {
        P2PRequest request = openRequest();
        request.setExpiresAt(java.time.Instant.now().minusSeconds(60));
        when(p2PRequestRepository.findByIdForUpdate(request.getId())).thenReturn(Optional.of(request));

        assertThatThrownBy(() -> p2PService.accept(acceptorId, request.getId()))
                .isInstanceOf(BusinessException.class)
                .extracting("code")
                .isEqualTo("P2P_NOT_OPEN");
        verify(eventPublisher).publishEvent(new P2PRequestClosedEvent(request.getId(), P2PStatus.EXPIRED));
    }

    @Test
    void accept_rejectsSelfAccept() {
        P2PRequest request = openRequest();
        when(p2PRequestRepository.findByIdForUpdate(request.getId())).thenReturn(Optional.of(request));

        assertThatThrownBy(() -> p2PService.accept(ownerId, request.getId()))
                .isInstanceOf(BusinessException.class)
                .extracting("code")
                .isEqualTo("P2P_SELF_ACCEPT");
        verify(p2POrderRepository, never()).save(any());
    }

    @Test
    void delete_cancelsOpenRequest() {
        P2PRequest request = openRequest();
        when(p2PRequestRepository.findByIdAndUserId(request.getId(), ownerId)).thenReturn(Optional.of(request));
        when(p2PRequestRepository.save(any(P2PRequest.class))).thenAnswer(inv -> inv.getArgument(0));

        p2PService.delete(ownerId, request.getId());

        ArgumentCaptor<P2PRequest> captor = ArgumentCaptor.forClass(P2PRequest.class);
        verify(p2PRequestRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(P2PStatus.CANCELLED);
        verify(eventPublisher).publishEvent(new P2PRequestClosedEvent(request.getId(), P2PStatus.CANCELLED));
    }

    @Test
    void expireIfDue_expiresPastDueOpenRequestAndPublishesClosed() {
        P2PRequest request = openRequest();
        request.setExpiresAt(java.time.Instant.now().minusSeconds(1));
        when(p2PRequestRepository.findByIdForUpdate(request.getId())).thenReturn(Optional.of(request));

        assertThat(p2PService.expireIfDue(request.getId())).isTrue();
        assertThat(request.getStatus()).isEqualTo(P2PStatus.EXPIRED);
        verify(p2PRequestRepository).save(request);
        verify(eventPublisher).publishEvent(new P2PRequestClosedEvent(request.getId(), P2PStatus.EXPIRED));
    }

    @Test
    void expireIfDue_leavesRequestsThatChangedMeanwhile() {
        P2PRequest accepted = openRequest();
        accepted.setStatus(P2PStatus.ACCEPTED);
        accepted.setExpiresAt(java.time.Instant.now().minusSeconds(1));
        P2PRequest extended = openRequest();
        extended.setExpiresAt(java.time.Instant.now().plusSeconds(600));
        when(p2PRequestRepository.findByIdForUpdate(accepted.getId())).thenReturn(Optional.of(accepted));
        when(p2PRequestRepository.findByIdForUpdate(extended.getId())).thenReturn(Optional.of(extended));

        assertThat(p2PService.expireIfDue(accepted.getId())).isFalse();
        assertThat(p2PService.expireIfDue(extended.getId())).isFalse();
        assertThat(p2PService.expireIfDue(UUID.randomUUID())).isFalse();
        verify(p2PRequestRepository, never()).save(any());
        verify(eventPublisher, never()).publishEvent(any());
    }

    @Test
    void listMyOrders_includesRequestPairAndSide() {
        P2PRequest request = openRequest();
        P2POrder order = new P2POrder();
        order.setId(UUID.randomUUID());
        order.setRequestId(request.getId());
        order.setRequesterId(ownerId);
        order.setAcceptorId(acceptorId);
        order.setAmount(new BigDecimal("100.00"));
        order.setRate(new BigDecimal("1500.00"));
        order.setStatus(P2PStatus.ACCEPTED);
        when(p2POrderRepository.findByRequesterIdOrAcceptorIdOrderByCreatedAtDesc(acceptorId, acceptorId))
                .thenReturn(List.of(order));
        when(p2PRequestRepository.findAllById(Set.of(request.getId()))).thenReturn(List.of(request));

        List<P2POrderSummaryResponse> orders = p2PService.listMyOrders(acceptorId);

        assertThat(orders).hasSize(1);
        assertThat(orders.get(0).id()).isEqualTo(order.getId());
        assertThat(orders.get(0).side()).isEqualTo(P2PSide.SELL);
        assertThat(orders.get(0).baseCurrencyCode()).isEqualTo("USD");
        assertThat(orders.get(0).quoteCurrencyCode()).isEqualTo("NGN");
    }

    @Test
    void listMyOrders_emptySkipsRequestLookup() {
        when(p2POrderRepository.findByRequesterIdOrAcceptorIdOrderByCreatedAtDesc(ownerId, ownerId))
                .thenReturn(List.of());

        assertThat(p2PService.listMyOrders(ownerId)).isEmpty();
        verify(p2PRequestRepository, never()).findAllById(any());
    }

    private P2PRequest openRequest() {
        P2PRequest request = new P2PRequest();
        request.setId(UUID.randomUUID());
        request.setUserId(ownerId);
        request.setSide(P2PSide.SELL);
        request.setBaseCurrencyCode("USD");
        request.setQuoteCurrencyCode("NGN");
        request.setAmount(new BigDecimal("100.00"));
        request.setRate(new BigDecimal("1500.00"));
        request.setStatus(P2PStatus.OPEN);
        return request;
    }
}
