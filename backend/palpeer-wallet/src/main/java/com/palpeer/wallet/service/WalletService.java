package com.palpeer.wallet.service;

import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.currency.service.CurrencyService;
import com.palpeer.ledger.domain.LedgerEntry;
import com.palpeer.ledger.repository.LedgerEntryRepository;
import com.palpeer.profile.domain.Profile;
import com.palpeer.profile.repository.ProfileRepository;
import com.palpeer.user.domain.User;
import com.palpeer.user.repository.UserRepository;
import com.palpeer.wallet.domain.Wallet;
import com.palpeer.wallet.repository.WalletRepository;
import com.palpeer.wallet.web.dto.CreateWalletRequest;
import com.palpeer.wallet.web.dto.LedgerTransactionResponse;
import com.palpeer.wallet.web.dto.WalletResponse;
import jakarta.persistence.criteria.Predicate;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WalletService {

    private final WalletRepository walletRepository;
    private final LedgerEntryRepository ledgerEntryRepository;
    private final CurrencyService currencyService;
    private final UserRepository userRepository;
    private final ProfileRepository profileRepository;

    @Transactional
    public WalletResponse create(UUID userId, CreateWalletRequest request) {
        String currencyCode = request.currencyCode().trim().toUpperCase(Locale.ROOT);
        currencyService.requireExists(currencyCode);

        if (walletRepository.existsByUserIdAndCurrencyCodeIgnoreCase(userId, currencyCode)) {
            throw new BusinessException(
                    "WALLET_EXISTS",
                    "Wallet already exists for currency " + currencyCode,
                    HttpStatus.CONFLICT);
        }

        Wallet wallet = new Wallet();
        wallet.setUserId(userId);
        wallet.setCurrencyCode(currencyCode);
        // Balances start at zero; subsequent changes MUST go through LedgerService
        wallet.setAvailableBalance(BigDecimal.ZERO);
        wallet.setPendingBalance(BigDecimal.ZERO);
        walletRepository.save(wallet);
        return toWalletResponse(wallet);
    }

    @Transactional(readOnly = true)
    public List<WalletResponse> list(UUID userId) {
        return walletRepository.findByUserIdOrderByCurrencyCodeAsc(userId).stream()
                .map(this::toWalletResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public WalletResponse get(UUID userId, UUID walletId) {
        return toWalletResponse(requireOwnedWallet(userId, walletId));
    }

    @Transactional(readOnly = true)
    public Page<LedgerTransactionResponse> transactions(UUID userId, UUID walletId, Pageable pageable) {
        requireOwnedWallet(userId, walletId);
        return ledgerEntryRepository.findByWalletIdOrderByCreatedAtDesc(walletId, pageable)
                .map(this::toTransactionResponse);
    }

    /** Admin inventory — no ownership check; includes owner email/name. */
    @Transactional(readOnly = true)
    public Page<WalletResponse> adminList(UUID userId, String currencyCode, Pageable pageable) {
        Specification<Wallet> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (userId != null) {
                predicates.add(cb.equal(root.get("userId"), userId));
            }
            if (currencyCode != null && !currencyCode.isBlank()) {
                predicates.add(cb.equal(root.get("currencyCode"), currencyCode.trim().toUpperCase(Locale.ROOT)));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
        Page<Wallet> page = walletRepository.findAll(spec, pageable);
        OwnerLookup owners = loadOwners(page.getContent());
        return page.map(wallet -> toAdminWalletResponse(wallet, owners));
    }

    /** Admin inventory — no ownership check; includes owner email/name. */
    @Transactional(readOnly = true)
    public WalletResponse adminGet(UUID walletId) {
        Wallet wallet = walletRepository.findById(walletId)
                .orElseThrow(() -> new ResourceNotFoundException("Wallet not found"));
        return toAdminWalletResponse(wallet, loadOwners(List.of(wallet)));
    }

    /** Admin inventory — ledger txs for any wallet. */
    @Transactional(readOnly = true)
    public Page<LedgerTransactionResponse> adminTransactions(UUID walletId, Pageable pageable) {
        if (!walletRepository.existsById(walletId)) {
            throw new ResourceNotFoundException("Wallet not found");
        }
        return ledgerEntryRepository.findByWalletIdOrderByCreatedAtDesc(walletId, pageable)
                .map(this::toTransactionResponse);
    }

    private Wallet requireOwnedWallet(UUID userId, UUID walletId) {
        return walletRepository.findByIdAndUserId(walletId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Wallet not found"));
    }

    private WalletResponse toWalletResponse(Wallet wallet) {
        return new WalletResponse(
                wallet.getId(),
                wallet.getUserId(),
                wallet.getCurrencyCode(),
                wallet.getAvailableBalance(),
                wallet.getPendingBalance()
        );
    }

    private WalletResponse toAdminWalletResponse(Wallet wallet, OwnerLookup owners) {
        User user = owners.users().get(wallet.getUserId());
        Profile profile = owners.profiles().get(wallet.getUserId());
        return new WalletResponse(
                wallet.getId(),
                wallet.getUserId(),
                wallet.getCurrencyCode(),
                wallet.getAvailableBalance(),
                wallet.getPendingBalance(),
                user == null ? null : user.getEmail(),
                profile == null ? null : profile.getFirstName(),
                profile == null ? null : profile.getLastName()
        );
    }

    private OwnerLookup loadOwners(List<Wallet> wallets) {
        Set<UUID> userIds = wallets.stream()
                .map(Wallet::getUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (userIds.isEmpty()) {
            return new OwnerLookup(Map.of(), Map.of());
        }
        Map<UUID, User> users = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        Map<UUID, Profile> profiles = profileRepository.findByUserIdIn(userIds).stream()
                .collect(Collectors.toMap(Profile::getUserId, Function.identity(), (a, b) -> a));
        return new OwnerLookup(users, profiles);
    }

    private LedgerTransactionResponse toTransactionResponse(LedgerEntry entry) {
        return new LedgerTransactionResponse(
                entry.getId(),
                entry.getWalletId(),
                entry.getEntryType(),
                entry.getAmount(),
                entry.getCurrencyCode(),
                entry.getAvailableBalanceAfter(),
                entry.getPendingBalanceAfter(),
                entry.getReferenceType(),
                entry.getReferenceId(),
                entry.getDescription(),
                entry.getCreatedAt()
        );
    }

    private record OwnerLookup(Map<UUID, User> users, Map<UUID, Profile> profiles) {
    }
}
