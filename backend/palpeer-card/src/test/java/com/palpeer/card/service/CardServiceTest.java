package com.palpeer.card.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.palpeer.card.domain.Card;
import com.palpeer.card.domain.CardStatus;
import com.palpeer.card.domain.CardTransaction;
import com.palpeer.card.domain.CardTransactionStatus;
import com.palpeer.card.domain.CardTransactionType;
import com.palpeer.card.provider.CardProvider;
import com.palpeer.card.provider.CardProvider.ProviderCardIssueResult;
import com.palpeer.card.provider.CardProvider.ProviderCardTransaction;
import com.palpeer.card.repository.CardRepository;
import com.palpeer.card.repository.CardTransactionRepository;
import com.palpeer.card.web.dto.CardResponse;
import com.palpeer.card.web.dto.CardTransactionResponse;
import com.palpeer.card.web.dto.IssueCardRequest;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.currency.service.CurrencyService;
import com.palpeer.wallet.domain.Wallet;
import com.palpeer.wallet.repository.WalletRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

@ExtendWith(MockitoExtension.class)
class CardServiceTest {

    @Mock private CardRepository cardRepository;
    @Mock private CardTransactionRepository cardTransactionRepository;
    @Mock private CardProvider cardProvider;
    @Mock private CurrencyService currencyService;
    @Mock private WalletRepository walletRepository;
    @Mock private com.palpeer.common.audit.AuditRecorder auditRecorder;

    @InjectMocks private CardService cardService;

    @Test
    void issue_persistsProviderResult() {
        UUID userId = UUID.randomUUID();
        when(cardProvider.providerName()).thenReturn("STUB");
        when(cardProvider.issueCard(any())).thenReturn(
                new ProviderCardIssueResult("pc-1", "4242", "VISA", 12, 2030));
        when(cardRepository.save(any(Card.class))).thenAnswer(inv -> {
            Card c = inv.getArgument(0);
            c.setId(UUID.randomUUID());
            return c;
        });

        CardResponse response = cardService.issue(userId, new IssueCardRequest("usd", null, "Jane Doe"));

        assertThat(response.lastFour()).isEqualTo("4242");
        assertThat(response.status()).isEqualTo(CardStatus.ACTIVE);
        assertThat(response.currencyCode()).isEqualTo("USD");
        verify(currencyService).requireExists("USD");
        ArgumentCaptor<Card> captor = ArgumentCaptor.forClass(Card.class);
        verify(cardRepository).save(captor.capture());
        assertThat(captor.getValue().getProviderCardId()).isEqualTo("pc-1");
    }

    @Test
    void issue_rejectsWalletCurrencyMismatch() {
        UUID userId = UUID.randomUUID();
        UUID walletId = UUID.randomUUID();
        Wallet wallet = new Wallet();
        wallet.setId(walletId);
        wallet.setUserId(userId);
        wallet.setCurrencyCode("NGN");
        when(walletRepository.findByIdAndUserId(walletId, userId)).thenReturn(Optional.of(wallet));

        assertThatThrownBy(() -> cardService.issue(userId, new IssueCardRequest("USD", walletId, null)))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Wallet currency");
    }

    @Test
    void block_callsProviderAndSetsBlocked() {
        UUID userId = UUID.randomUUID();
        Card card = ownedCard(userId, CardStatus.ACTIVE);
        when(cardRepository.findByIdAndUserId(card.getId(), userId)).thenReturn(Optional.of(card));
        when(cardRepository.save(any(Card.class))).thenAnswer(inv -> inv.getArgument(0));

        CardResponse response = cardService.block(userId, card.getId());

        assertThat(response.status()).isEqualTo(CardStatus.BLOCKED);
        verify(cardProvider).blockCard("pc-1");
    }

    @Test
    void get_requiresOwner() {
        UUID userId = UUID.randomUUID();
        UUID cardId = UUID.randomUUID();
        when(cardRepository.findByIdAndUserId(cardId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> cardService.get(userId, cardId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void block_requiresOwner() {
        UUID userId = UUID.randomUUID();
        UUID cardId = UUID.randomUUID();
        when(cardRepository.findByIdAndUserId(cardId, userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> cardService.block(userId, cardId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void syncAndList_importsProviderTransactionsIdempotently() {
        UUID userId = UUID.randomUUID();
        Card card = ownedCard(userId, CardStatus.ACTIVE);
        when(cardRepository.findByIdAndUserId(card.getId(), userId)).thenReturn(Optional.of(card));
        when(cardProvider.listTransactions("pc-1")).thenReturn(List.of(
                new ProviderCardTransaction(
                        "ptx-1",
                        CardTransactionType.CAPTURE,
                        CardTransactionStatus.SETTLED,
                        new BigDecimal("10.00"),
                        "USD",
                        "Store",
                        Instant.parse("2026-01-01T12:00:00Z"))));
        when(cardTransactionRepository.findByCardIdAndProviderTransactionId(card.getId(), "ptx-1"))
                .thenReturn(Optional.empty());
        when(cardTransactionRepository.save(any(CardTransaction.class))).thenAnswer(inv -> {
            CardTransaction tx = inv.getArgument(0);
            tx.setId(UUID.randomUUID());
            return tx;
        });
        Pageable pageable = PageRequest.of(0, 20);
        when(cardTransactionRepository.findByCardIdAndUserIdOrderByOccurredAtDesc(card.getId(), userId, pageable))
                .thenReturn(new PageImpl<>(List.of()));

        var page = cardService.syncAndListTransactions(userId, card.getId(), pageable);

        assertThat(page).isNotNull();
        ArgumentCaptor<CardTransaction> captor = ArgumentCaptor.forClass(CardTransaction.class);
        verify(cardTransactionRepository).save(captor.capture());
        assertThat(captor.getValue().getLedgerEntryId()).isNull();
        assertThat(captor.getValue().getProviderTransactionId()).isEqualTo("ptx-1");
    }

    private Card ownedCard(UUID userId, CardStatus status) {
        Card card = new Card();
        card.setId(UUID.randomUUID());
        card.setUserId(userId);
        card.setProviderName("STUB");
        card.setProviderCardId("pc-1");
        card.setLastFour("4242");
        card.setBrand("VISA");
        card.setCurrencyCode("USD");
        card.setStatus(status);
        return card;
    }
}
