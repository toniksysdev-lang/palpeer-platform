package com.palpeer.app.admin.search;

import static com.palpeer.app.admin.AdminAuthorities.has;

import com.palpeer.admin.service.AdminUserService;
import com.palpeer.admin.web.dto.AdminUserSummaryResponse;
import com.palpeer.app.admin.search.AdminSearchResponse.Match;
import com.palpeer.app.admin.search.AdminSearchResponse.MatchType;
import com.palpeer.card.repository.CardRepository;
import com.palpeer.chat.repository.ChatRoomRepository;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.exchange.repository.ExchangeTransactionRepository;
import com.palpeer.kyc.repository.KycCaseRepository;
import com.palpeer.negotiation.repository.NegotiationRepository;
import com.palpeer.p2p.repository.P2POrderRepository;
import com.palpeer.p2p.repository.P2PRequestRepository;
import com.palpeer.promotion.repository.ReferralRepository;
import com.palpeer.transaction.domain.TransactionActivityType;
import com.palpeer.user.domain.User;
import com.palpeer.user.repository.UserRepository;
import com.palpeer.wallet.funding.FundingTransactionRepository;
import com.palpeer.wallet.repository.WalletRepository;
import com.palpeer.wallet.withdrawal.WithdrawalTransactionRepository;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read-only admin global search. Result groups are included only when the caller holds
 * the corresponding read permission.
 */
@Service
@RequiredArgsConstructor
public class AdminSearchService {

    public static final int MIN_QUERY_LENGTH = 2;
    public static final int MAX_USERS = 10;

    private final UserRepository userRepository;
    private final AdminUserService adminUserService;
    private final WalletRepository walletRepository;
    private final CardRepository cardRepository;
    private final KycCaseRepository kycCaseRepository;
    private final P2PRequestRepository p2PRequestRepository;
    private final P2POrderRepository p2POrderRepository;
    private final NegotiationRepository negotiationRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final ReferralRepository referralRepository;
    private final FundingTransactionRepository fundingTransactionRepository;
    private final WithdrawalTransactionRepository withdrawalTransactionRepository;
    private final ExchangeTransactionRepository exchangeTransactionRepository;

    @Transactional(readOnly = true)
    public AdminSearchResponse search(String rawQuery) {
        String q = rawQuery == null ? "" : rawQuery.trim();
        if (q.length() < MIN_QUERY_LENGTH) {
            throw new BusinessException(
                    "SEARCH_QUERY_TOO_SHORT",
                    "Search query must be at least " + MIN_QUERY_LENGTH + " characters",
                    HttpStatus.BAD_REQUEST);
        }

        List<AdminUserSummaryResponse> users = has("users:read") ? searchUsers(q) : List.of();
        UUID id = parseUuid(q);
        List<Match> matches = id == null ? List.of() : matchById(id);
        return new AdminSearchResponse(q, users, matches);
    }

    private List<AdminUserSummaryResponse> searchUsers(String q) {
        String pattern = "%" + escapeLike(q.toLowerCase(Locale.ROOT)) + "%";
        String phonePattern = "%" + escapeLike(q) + "%";
        Specification<User> spec = AdminUserService.appUsersOnly().and((root, query, cb) -> cb.or(
                cb.like(cb.lower(root.get("email")), pattern, '\\'),
                cb.like(root.get("phone"), phonePattern, '\\')));
        return userRepository
                .findAll(spec, PageRequest.of(0, MAX_USERS, Sort.by(Sort.Direction.DESC, "createdAt")))
                .map(adminUserService::summarize)
                .getContent();
    }

    private List<Match> matchById(UUID id) {
        List<Match> matches = new ArrayList<>();
        if (has("users:read") && adminUserService.isAppUser(id)) {
            userRepository.findById(id).ifPresent(u ->
                    matches.add(new Match(MatchType.USER, id, u.getEmail(), "/admin/users/" + id)));
        }
        if (has("wallets:read")) {
            walletRepository.findById(id).ifPresent(w ->
                    matches.add(new Match(MatchType.WALLET, id,
                            w.getCurrencyCode() + " wallet", "/admin/wallets/" + id)));
        }
        if (has("cards:read")) {
            cardRepository.findById(id).ifPresent(c ->
                    matches.add(new Match(MatchType.CARD, id,
                            "Card ending " + c.getLastFour() + " (" + c.getStatus() + ")", "/admin/cards/" + id)));
        }
        if (has("kyc:read")) {
            kycCaseRepository.findById(id).ifPresent(k ->
                    matches.add(new Match(MatchType.KYC_CASE, id,
                            "KYC case (" + k.getStatus() + ")", "/admin/kyc/" + id)));
        }
        if (has("p2p:read")) {
            p2PRequestRepository.findById(id).ifPresent(r ->
                    matches.add(new Match(MatchType.P2P_REQUEST, id,
                            "P2P request " + r.getBaseCurrencyCode() + "/" + r.getQuoteCurrencyCode()
                                    + " (" + r.getStatus() + ")",
                            "/admin/p2p/" + id + "?kind=request")));
            p2POrderRepository.findById(id).ifPresent(o ->
                    matches.add(new Match(MatchType.P2P_ORDER, id,
                            "P2P order (" + o.getStatus() + ")", "/admin/p2p/" + id + "?kind=order")));
        }
        if (has("negotiations:read")) {
            negotiationRepository.findById(id).ifPresent(n ->
                    matches.add(new Match(MatchType.NEGOTIATION, id,
                            "Negotiation (" + n.getStatus() + ")", "/admin/negotiations/" + id)));
        }
        if (has("chat:read")) {
            chatRoomRepository.findById(id).ifPresent(r ->
                    matches.add(new Match(MatchType.CHAT_ROOM, id, "Chat room", "/admin/chat?room=" + id)));
        }
        if (has("promotions:write")) {
            referralRepository.findById(id).ifPresent(r ->
                    matches.add(new Match(MatchType.REFERRAL, id,
                            "Referral " + r.getReferralCode() + " (" + r.getStatus() + ")",
                            "/admin/referrals/" + id)));
        }
        if (has("transactions:read")) {
            fundingTransactionRepository.findById(id).ifPresent(f -> matches.add(transactionMatch(
                    id, f.getUserId(), TransactionActivityType.FUNDING, f.getAmount(), f.getCurrencyCode(),
                    f.getStatus().name())));
            withdrawalTransactionRepository.findById(id).ifPresent(w -> matches.add(transactionMatch(
                    id, w.getUserId(), TransactionActivityType.WITHDRAWAL, w.getAmount(), w.getCurrencyCode(),
                    w.getStatus().name())));
            exchangeTransactionRepository.findById(id).ifPresent(e -> matches.add(transactionMatch(
                    id, e.getUserId(), TransactionActivityType.EXCHANGE, e.getSourceAmount(), null,
                    e.getStatus().name())));
        }
        return matches;
    }

    private static Match transactionMatch(
            UUID id, UUID userId, TransactionActivityType type, BigDecimal amount, String currency, String status) {
        String label = type.name().charAt(0) + type.name().substring(1).toLowerCase(Locale.ROOT)
                + " " + amount.stripTrailingZeros().toPlainString()
                + (currency == null ? "" : " " + currency)
                + " (" + status + ")";
        return new Match(MatchType.TRANSACTION, id, label,
                "/admin/transactions/" + id + "?userId=" + userId + "&type=" + type.name());
    }

    private static UUID parseUuid(String q) {
        try {
            return q.length() == 36 ? UUID.fromString(q) : null;
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
