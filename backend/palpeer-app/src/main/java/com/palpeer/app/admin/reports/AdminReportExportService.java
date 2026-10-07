package com.palpeer.app.admin.reports;

import com.palpeer.admin.service.AdminUserService;
import com.palpeer.app.admin.AdminAuthorities;
import com.palpeer.common.csv.CsvWriter;
import com.palpeer.common.domain.AuditEntityRepository;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.kyc.repository.KycCaseRepository;
import com.palpeer.p2p.repository.P2POrderRepository;
import com.palpeer.p2p.repository.P2PRequestRepository;
import com.palpeer.transaction.service.AdminTransactionFilter;
import com.palpeer.transaction.service.TransactionCsv;
import com.palpeer.transaction.service.TransactionQueryService;
import com.palpeer.user.repository.UserRepository;
import com.palpeer.wallet.repository.WalletRepository;
import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * CSV exports for admin reports. Newest first, capped at {@link #MAX_ROWS}; from/to filter createdAt.
 */
@Service
@RequiredArgsConstructor
public class AdminReportExportService {

    public static final int MAX_ROWS = 5_000;

    private final UserRepository userRepository;
    private final KycCaseRepository kycCaseRepository;
    private final WalletRepository walletRepository;
    private final P2PRequestRepository p2PRequestRepository;
    private final P2POrderRepository p2POrderRepository;
    private final AuditEntityRepository auditEntityRepository;
    private final TransactionQueryService transactionQueryService;

    @Transactional(readOnly = true)
    public CsvWriter export(String dataset, Instant from, Instant to) {
        Pageable window = PageRequest.of(0, MAX_ROWS, Sort.by(Sort.Direction.DESC, "createdAt"));
        return switch (dataset) {
            case "users" -> {
                CsvWriter csv = new CsvWriter(List.of(
                        "id", "email", "phone", "status", "enabled", "emailVerified", "phoneVerified", "createdAt"));
                userRepository.findAll(
                                AdminUserService.appUsersOnly().and(createdBetween(from, to)), window).forEach(u -> csv.row(
                        u.getId(), u.getEmail(), u.getPhone(), u.getStatus(), u.isEnabled(),
                        u.isEmailVerified(), u.isPhoneVerified(), u.getCreatedAt()));
                yield csv;
            }
            case "kyc-cases" -> {
                CsvWriter csv = new CsvWriter(List.of(
                        "caseId", "userId", "status", "rejectionReason", "createdAt", "updatedAt"));
                kycCaseRepository.findAll(createdBetween(from, to), window).forEach(k -> csv.row(
                        k.getId(), k.getUserId(), k.getStatus(), k.getRejectionReason(),
                        k.getCreatedAt(), k.getUpdatedAt()));
                yield csv;
            }
            case "wallets" -> {
                CsvWriter csv = new CsvWriter(List.of(
                        "id", "userId", "currencyCode", "availableBalance", "pendingBalance", "createdAt"));
                walletRepository.findAll(createdBetween(from, to), window).forEach(w -> csv.row(
                        w.getId(), w.getUserId(), w.getCurrencyCode(), w.getAvailableBalance(),
                        w.getPendingBalance(), w.getCreatedAt()));
                yield csv;
            }
            case "transactions" -> TransactionCsv.write(transactionQueryService.adminExport(
                    new AdminTransactionFilter(null, null, null, null, from, to)));
            case "p2p-requests" -> {
                CsvWriter csv = new CsvWriter(List.of(
                        "id", "userId", "side", "baseCurrencyCode", "quoteCurrencyCode", "amount", "rate",
                        "status", "expiresAt", "notes", "createdAt"));
                p2PRequestRepository.findAll(createdBetween(from, to), window).forEach(r -> csv.row(
                        r.getId(), r.getUserId(), r.getSide(), r.getBaseCurrencyCode(), r.getQuoteCurrencyCode(),
                        r.getAmount(), r.getRate(), r.getStatus(), r.getExpiresAt(), r.getNotes(), r.getCreatedAt()));
                yield csv;
            }
            case "p2p-orders" -> {
                CsvWriter csv = new CsvWriter(List.of(
                        "id", "requestId", "requesterId", "acceptorId", "amount", "rate", "status", "createdAt"));
                p2POrderRepository.findAll(createdBetween(from, to), window).forEach(o -> csv.row(
                        o.getId(), o.getRequestId(), o.getRequesterId(), o.getAcceptorId(), o.getAmount(),
                        o.getRate(), o.getStatus(), o.getCreatedAt()));
                yield csv;
            }
            case "audit-logs" -> {
                if (!AdminAuthorities.has("audit:read")) {
                    throw new AccessDeniedException("audit:read required");
                }
                CsvWriter csv = new CsvWriter(List.of(
                        "id", "createdAt", "userRef", "action", "entity", "oldValue", "newValue",
                        "ipAddress", "device"));
                auditEntityRepository.findAll(createdBetween(from, to), window).forEach(a -> csv.row(
                        a.getId(), a.getCreatedAt(), a.getUserRef(), a.getAction(), a.getEntity(),
                        a.getOldValue(), a.getNewValue(), a.getIpAddress(), a.getDevice()));
                yield csv;
            }
            default -> throw new ResourceNotFoundException("Unknown report dataset: " + dataset);
        };
    }

    private static <T> Specification<T> createdBetween(Instant from, Instant to) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (from != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.<Instant>get("createdAt"), from));
            }
            if (to != null) {
                predicates.add(cb.lessThanOrEqualTo(root.<Instant>get("createdAt"), to));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
