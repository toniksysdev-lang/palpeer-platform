package com.palpeer.admin.web;

import com.palpeer.admin.service.AdminKycQueryService;
import com.palpeer.admin.service.AdminRbacService;
import com.palpeer.admin.service.AdminUserService;
import com.palpeer.admin.service.UserNoteService;
import com.palpeer.admin.web.dto.CreateUserNoteRequest;
import com.palpeer.admin.web.dto.UserNoteResponse;
import com.palpeer.admin.web.dto.AdminMeResponse;
import com.palpeer.admin.web.dto.AdminUserResponse;
import com.palpeer.admin.web.dto.AdminUserSummaryResponse;
import com.palpeer.admin.web.dto.AssignAdminRequest;
import com.palpeer.admin.web.dto.CreatePermissionRequest;
import com.palpeer.admin.web.dto.CreateRoleRequest;
import com.palpeer.admin.web.dto.PermissionResponse;
import com.palpeer.admin.web.dto.ReviewKycRequest;
import com.palpeer.admin.web.dto.RoleResponse;
import com.palpeer.admin.web.dto.UpdateP2PStatusRequest;
import com.palpeer.admin.web.dto.UpdateRoleRequest;
import com.palpeer.admin.web.dto.UpdateUserAdminRequest;
import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.common.api.ApiResponse;
import com.palpeer.common.csv.CsvWriter;
import com.palpeer.currency.domain.RateApprovalStatus;
import com.palpeer.currency.domain.RateChannel;
import com.palpeer.currency.service.CurrencyService;
import com.palpeer.currency.service.ExchangeRateService;
import com.palpeer.currency.web.dto.CreateCurrencyRequest;
import com.palpeer.currency.web.dto.CreateExchangeRateRequest;
import com.palpeer.currency.web.dto.CurrencyResponse;
import com.palpeer.currency.web.dto.ExchangeRateResponse;
import com.palpeer.kyc.domain.KycStatus;
import com.palpeer.kyc.service.KycService;
import com.palpeer.kyc.web.dto.AdminKycCaseDetailResponse;
import com.palpeer.kyc.web.dto.AdminKycCaseSummaryResponse;
import com.palpeer.kyc.web.dto.KycFileContent;
import com.palpeer.kyc.web.dto.KycStatusResponse;
import com.palpeer.p2p.domain.P2PStatus;
import com.palpeer.p2p.service.P2PFeeTierService;
import com.palpeer.p2p.service.P2PRateBoundsService;
import com.palpeer.p2p.service.P2PService;
import com.palpeer.p2p.web.dto.P2PFeeTierResponse;
import com.palpeer.p2p.web.dto.P2PRateBoundsResponse;
import com.palpeer.p2p.web.dto.UpsertP2PFeeTierRequest;
import com.palpeer.p2p.web.dto.UpsertP2PRateBoundsRequest;
import com.palpeer.p2p.web.dto.P2POrderResponse;
import com.palpeer.p2p.web.dto.P2PRequestResponse;
import com.palpeer.transaction.domain.TransactionActivityType;
import com.palpeer.transaction.service.AdminTransactionFilter;
import com.palpeer.transaction.service.TransactionCsv;
import com.palpeer.transaction.service.TransactionQueryService;
import com.palpeer.transaction.web.dto.TransactionItemResponse;
import com.palpeer.transaction.web.dto.TransactionPageResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import com.palpeer.user.domain.UserStatus;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@Tag(name = "Admin")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminController {

    private final AdminUserService adminUserService;
    private final UserNoteService userNoteService;
    private final AdminRbacService adminRbacService;
    private final AdminKycQueryService adminKycQueryService;
    private final KycService kycService;
    private final CurrencyService currencyService;
    private final ExchangeRateService exchangeRateService;
    private final TransactionQueryService transactionQueryService;
    private final P2PService p2PService;
    private final P2PRateBoundsService p2PRateBoundsService;
    private final P2PFeeTierService p2PFeeTierService;

    // --- Users ---

    @GetMapping("/users")
    @PreAuthorize("hasAuthority('users:read')")
    @Operation(summary = "List platform users")
    public ApiResponse<Page<AdminUserSummaryResponse>> listUsers(
            @RequestParam(required = false) String email,
            @RequestParam(required = false) UserStatus status,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.ok(adminUserService.listUsers(email, status, from, to, pageable));
    }

    @GetMapping("/users/{userId}")
    @PreAuthorize("hasAuthority('users:read')")
    @Operation(summary = "Get user")
    public ApiResponse<AdminUserSummaryResponse> getUser(@PathVariable UUID userId) {
        return ApiResponse.ok(adminUserService.getUser(userId));
    }

    @PutMapping("/users/{userId}")
    @PreAuthorize("hasAuthority('users:write')")
    @Operation(summary = "Update user status/enabled")
    public ApiResponse<AdminUserSummaryResponse> updateUser(
            @PathVariable UUID userId,
            @Valid @RequestBody UpdateUserAdminRequest request) {
        return ApiResponse.ok(adminUserService.updateUser(userId, request));
    }

    @DeleteMapping("/users/{userId}")
    @PreAuthorize("hasAuthority('users:write')")
    @Operation(summary = "Permanently delete an app user and all related records")
    public ApiResponse<Void> deleteUser(@PathVariable UUID userId) {
        adminUserService.deleteUser(userId);
        return ApiResponse.ok("User deleted", null);
    }

    @GetMapping("/users/{userId}/notes")
    @PreAuthorize("hasAuthority('users:notes:read')")
    @Operation(summary = "List internal notes / incident records for an app user (newest first)")
    public ApiResponse<Page<UserNoteResponse>> listUserNotes(
            @PathVariable UUID userId,
            @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.ok(userNoteService.list(userId, pageable));
    }

    @PostMapping("/users/{userId}/notes")
    @PreAuthorize("hasAuthority('users:notes:write')")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Add an append-only internal note / incident record to an app user (audited)")
    public ApiResponse<UserNoteResponse> createUserNote(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID userId,
            @Valid @RequestBody CreateUserNoteRequest request) {
        return ApiResponse.ok(userNoteService.create(userId, principal.getId(), principal.getEmail(), request));
    }

    // --- KYC ---

    @GetMapping("/kyc/cases")
    @PreAuthorize("hasAuthority('kyc:read')")
    @Operation(summary = "List KYC cases")
    public ApiResponse<Page<AdminKycCaseSummaryResponse>> listKyc(
            @RequestParam(required = false) KycStatus status,
            @RequestParam(required = false) UUID userId,
            @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.ok(adminKycQueryService.listCases(status, userId, pageable));
    }

    @GetMapping("/kyc/cases/{caseId}")
    @PreAuthorize("hasAuthority('kyc:read')")
    @Operation(summary = "KYC case detail with document/selfie metadata")
    public ApiResponse<AdminKycCaseDetailResponse> getKycCase(@PathVariable UUID caseId) {
        return ApiResponse.ok(kycService.adminGetCase(caseId));
    }

    @GetMapping("/kyc/cases/{caseId}/documents/{documentId}/content")
    @PreAuthorize("hasAuthority('kyc:read')")
    @Operation(summary = "View KYC document bytes (audited)")
    public ResponseEntity<byte[]> kycDocumentContent(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID caseId,
            @PathVariable UUID documentId) {
        return inline(kycService.adminDocumentContent(caseId, documentId, principal.getId()));
    }

    @GetMapping("/kyc/cases/{caseId}/selfie/content")
    @PreAuthorize("hasAuthority('kyc:read')")
    @Operation(summary = "View latest KYC selfie bytes (audited)")
    public ResponseEntity<byte[]> kycSelfieContent(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID caseId) {
        return inline(kycService.adminSelfieContent(caseId, principal.getId()));
    }

    private static ResponseEntity<byte[]> inline(KycFileContent content) {
        MediaType type;
        try {
            type = MediaType.parseMediaType(content.contentType());
        } catch (RuntimeException ex) {
            type = MediaType.APPLICATION_OCTET_STREAM;
        }
        return ResponseEntity.ok()
                .contentType(type)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                        .filename(content.filename(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .header("X-Content-Type-Options", "nosniff")
                .body(content.bytes());
    }

    @PostMapping("/kyc/cases/{caseId}/review")
    @PreAuthorize("hasAuthority('kyc:review')")
    @Operation(summary = "Review KYC case")
    public ApiResponse<KycStatusResponse> reviewKyc(
            @PathVariable UUID caseId,
            @Valid @RequestBody ReviewKycRequest request) {
        return ApiResponse.ok(kycService.review(caseId, request.status(), request.rejectionReason()));
    }

    // --- Rates / currencies ---

    @PostMapping("/currencies")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('currencies:write')")
    @Operation(summary = "Create currency")
    public ApiResponse<CurrencyResponse> createCurrency(@Valid @RequestBody CreateCurrencyRequest request) {
        return ApiResponse.ok("Currency created", currencyService.create(request));
    }

    @PostMapping("/rates")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('rates:write')")
    @Operation(summary = "Publish exchange rate")
    public ApiResponse<ExchangeRateResponse> createRate(@Valid @RequestBody CreateExchangeRateRequest request) {
        return ApiResponse.ok("Rate published", exchangeRateService.create(request));
    }

    @GetMapping("/rates/latest")
    @Operation(summary = "Latest effective rate for every base/quote pair (admin, optional channel filter)")
    public ApiResponse<List<ExchangeRateResponse>> latestRates(
            @RequestParam(required = false) RateChannel channel) {
        return ApiResponse.ok(exchangeRateService.listAdminLatest(channel));
    }

    @PostMapping("/rates/{id}/activate")
    @PreAuthorize("hasAuthority('rates:write')")
    @Operation(summary = "Activate an exchange rate")
    public ApiResponse<ExchangeRateResponse> activateRate(@PathVariable UUID id) {
        return ApiResponse.ok(exchangeRateService.setActive(id, true));
    }

    @PostMapping("/rates/{id}/deactivate")
    @PreAuthorize("hasAuthority('rates:write')")
    @Operation(summary = "Deactivate an exchange rate")
    public ApiResponse<ExchangeRateResponse> deactivateRate(@PathVariable UUID id) {
        return ApiResponse.ok(exchangeRateService.setActive(id, false));
    }

    @PostMapping("/rates/{id}/approve")
    @PreAuthorize("hasAuthority('rates:write')")
    @Operation(summary = "Approve a pending exchange rate")
    public ApiResponse<ExchangeRateResponse> approveRate(@PathVariable UUID id) {
        return ApiResponse.ok(exchangeRateService.setApprovalStatus(id, RateApprovalStatus.APPROVED));
    }

    @PostMapping("/rates/{id}/reject")
    @PreAuthorize("hasAuthority('rates:write')")
    @Operation(summary = "Reject a pending exchange rate")
    public ApiResponse<ExchangeRateResponse> rejectRate(@PathVariable UUID id) {
        return ApiResponse.ok(exchangeRateService.setApprovalStatus(id, RateApprovalStatus.REJECTED));
    }

    @DeleteMapping("/rates/{id}")
    @PreAuthorize("hasAuthority('rates:write')")
    @Operation(summary = "Delete a swap/P2P pair (all rate rows for that base/quote/channel)")
    public ApiResponse<Void> deleteRatePair(@PathVariable UUID id) {
        exchangeRateService.deletePair(id);
        return ApiResponse.ok("Rate pair deleted", null);
    }

    // --- Transactions ---

    @GetMapping("/users/{userId}/transactions/recent")
    @PreAuthorize("hasAuthority('transactions:read')")
    @Operation(summary = "Recent transactions for a user")
    public ApiResponse<List<TransactionItemResponse>> userRecent(
            @PathVariable UUID userId,
            @RequestParam(defaultValue = "20") int limit) {
        return ApiResponse.ok(transactionQueryService.adminRecent(userId, limit));
    }

    @GetMapping("/users/{userId}/transactions/history")
    @PreAuthorize("hasAuthority('transactions:read')")
    @Operation(summary = "Transaction history for a user")
    public ApiResponse<TransactionPageResponse> userHistory(
            @PathVariable UUID userId,
            @RequestParam(required = false) TransactionActivityType type,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(transactionQueryService.adminHistory(userId, type, from, to, page, size));
    }

    @GetMapping("/transactions")
    @PreAuthorize("hasAuthority('transactions:read')")
    @Operation(summary = "Global transaction feed across all users")
    public ApiResponse<TransactionPageResponse> listTransactions(
            @RequestParam(required = false) TransactionActivityType type,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String currencyCode,
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        AdminTransactionFilter filter = new AdminTransactionFilter(type, status, currencyCode, userId, from, to);
        return ApiResponse.ok(transactionQueryService.adminSearch(filter, page, size));
    }

    @GetMapping("/transactions/export")
    @PreAuthorize("hasAuthority('transactions:read')")
    @Operation(summary = "Export global transactions as CSV (max 5,000 rows)")
    public ResponseEntity<byte[]> exportTransactions(
            @RequestParam(required = false) TransactionActivityType type,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String currencyCode,
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {
        AdminTransactionFilter filter = new AdminTransactionFilter(type, status, currencyCode, userId, from, to);
        return TransactionCsv.write(transactionQueryService.adminExport(filter))
                .toResponse(CsvWriter.filename("transactions"));
    }

    @GetMapping("/transactions/{type}/{id}")
    @PreAuthorize("hasAuthority('transactions:read')")
    @Operation(summary = "Transaction detail by type and id (any user)")
    public ApiResponse<TransactionItemResponse> getTransaction(
            @PathVariable TransactionActivityType type,
            @PathVariable UUID id) {
        return ApiResponse.ok(transactionQueryService.adminDetails(type, id));
    }

    // --- P2P ---

    @GetMapping("/p2p/requests")
    @PreAuthorize("hasAuthority('p2p:read')")
    @Operation(summary = "List all P2P requests")
    public ApiResponse<List<P2PRequestResponse>> listP2PRequests(
            @RequestParam(required = false) P2PStatus status,
            @RequestParam(required = false) UUID userId) {
        return ApiResponse.ok(p2PService.adminListRequests(status, userId));
    }

    @GetMapping("/p2p/orders")
    @PreAuthorize("hasAuthority('p2p:read')")
    @Operation(summary = "List all P2P orders")
    public ApiResponse<List<P2POrderResponse>> listP2POrders(
            @RequestParam(required = false) P2PStatus status,
            @RequestParam(required = false) UUID userId) {
        return ApiResponse.ok(p2PService.adminListOrders(status, userId));
    }

    @PutMapping("/p2p/requests/{requestId}/status")
    @PreAuthorize("hasAuthority('p2p:write')")
    @Operation(summary = "Admin update P2P request status")
    public ApiResponse<P2PRequestResponse> updateRequestStatus(
            @PathVariable UUID requestId,
            @Valid @RequestBody UpdateP2PStatusRequest request) {
        return ApiResponse.ok(p2PService.adminUpdateRequestStatus(requestId, request.status()));
    }

    @PutMapping("/p2p/orders/{orderId}/status")
    @PreAuthorize("hasAuthority('p2p:write')")
    @Operation(summary = "Admin update P2P order status")
    public ApiResponse<P2POrderResponse> updateOrderStatus(
            @PathVariable UUID orderId,
            @Valid @RequestBody UpdateP2PStatusRequest request) {
        return ApiResponse.ok(p2PService.adminUpdateOrderStatus(orderId, request.status()));
    }

    @GetMapping("/p2p/rate-bounds")
    @PreAuthorize("hasAuthority('p2p:read')")
    @Operation(summary = "List P2P min/max rate bounds per currency pair")
    public ApiResponse<List<P2PRateBoundsResponse>> listP2PRateBounds() {
        return ApiResponse.ok(p2PRateBoundsService.listAll());
    }

    @PutMapping("/p2p/rate-bounds")
    @PreAuthorize("hasAuthority('p2p:write')")
    @Operation(summary = "Create or update P2P rate bounds for a pair")
    public ApiResponse<P2PRateBoundsResponse> upsertP2PRateBounds(
            @Valid @RequestBody UpsertP2PRateBoundsRequest request) {
        return ApiResponse.ok("Rate bounds saved", p2PRateBoundsService.upsert(request));
    }

    @DeleteMapping("/p2p/rate-bounds/{id}")
    @PreAuthorize("hasAuthority('p2p:write')")
    @Operation(summary = "Delete P2P rate bounds")
    public ApiResponse<Void> deleteP2PRateBounds(@PathVariable UUID id) {
        p2PRateBoundsService.delete(id);
        return ApiResponse.ok("Rate bounds deleted", null);
    }

    // --- Fee management (P2P) ---

    @GetMapping("/fees/p2p")
    @PreAuthorize("hasAuthority('fees:read')")
    @Operation(summary = "List P2P fee tiers (fixed / percentage with amount ranges)")
    public ApiResponse<List<P2PFeeTierResponse>> listP2PFeeTiers() {
        return ApiResponse.ok(p2PFeeTierService.listAll());
    }

    @PostMapping("/fees/p2p")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('fees:write')")
    @Operation(summary = "Create a P2P fee tier")
    public ApiResponse<P2PFeeTierResponse> createP2PFeeTier(
            @Valid @RequestBody UpsertP2PFeeTierRequest request) {
        return ApiResponse.ok("Fee tier created", p2PFeeTierService.create(request));
    }

    @PutMapping("/fees/p2p/{id}")
    @PreAuthorize("hasAuthority('fees:write')")
    @Operation(summary = "Update a P2P fee tier")
    public ApiResponse<P2PFeeTierResponse> updateP2PFeeTier(
            @PathVariable UUID id, @Valid @RequestBody UpsertP2PFeeTierRequest request) {
        return ApiResponse.ok("Fee tier updated", p2PFeeTierService.update(id, request));
    }

    @DeleteMapping("/fees/p2p/{id}")
    @PreAuthorize("hasAuthority('fees:write')")
    @Operation(summary = "Delete a P2P fee tier")
    public ApiResponse<Void> deleteP2PFeeTier(@PathVariable UUID id) {
        p2PFeeTierService.delete(id);
        return ApiResponse.ok("Fee tier deleted", null);
    }

    // --- Admin RBAC ---

    @GetMapping("/me")
    @Operation(summary = "Current admin profile, roles, and permissions")
    public ApiResponse<AdminMeResponse> me() {
        return ApiResponse.ok(adminRbacService.me());
    }

    @GetMapping("/admins")
    @PreAuthorize("hasAuthority('admin:manage')")
    @Operation(summary = "List admin users")
    public ApiResponse<List<AdminUserResponse>> listAdmins() {
        return ApiResponse.ok(adminRbacService.listAdmins());
    }

    @PostMapping("/admins")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('admin:manage')")
    @Operation(summary = "Assign admin roles to a user")
    public ApiResponse<AdminUserResponse> assignAdmin(@Valid @RequestBody AssignAdminRequest request) {
        return ApiResponse.ok("Admin assigned", adminRbacService.assign(request));
    }

    @PostMapping("/admins/{userId}/disable")
    @PreAuthorize("hasAuthority('admin:manage')")
    @Operation(summary = "Disable admin access for a user")
    public ApiResponse<AdminUserResponse> disableAdmin(@PathVariable UUID userId) {
        return ApiResponse.ok(adminRbacService.disable(userId));
    }

    @GetMapping("/roles")
    @PreAuthorize("hasAuthority('admin:manage')")
    @Operation(summary = "List admin roles")
    public ApiResponse<List<RoleResponse>> listRoles() {
        return ApiResponse.ok(adminRbacService.listRoles());
    }

    @GetMapping("/roles/{code}")
    @PreAuthorize("hasAuthority('admin:manage')")
    @Operation(summary = "Get admin role by code")
    public ApiResponse<RoleResponse> getRole(@PathVariable String code) {
        return ApiResponse.ok(adminRbacService.getRole(code));
    }

    @PostMapping("/roles")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('admin:manage')")
    @Operation(summary = "Create admin role")
    public ApiResponse<RoleResponse> createRole(@Valid @RequestBody CreateRoleRequest request) {
        return ApiResponse.ok("Role created", adminRbacService.createRole(request));
    }

    @PutMapping("/roles/{code}")
    @PreAuthorize("hasAuthority('admin:manage')")
    @Operation(summary = "Update admin role name/description/permissions")
    public ApiResponse<RoleResponse> updateRole(
            @PathVariable String code,
            @Valid @RequestBody UpdateRoleRequest request) {
        return ApiResponse.ok(adminRbacService.updateRole(code, request));
    }

    @GetMapping("/permissions")
    @PreAuthorize("hasAuthority('admin:manage')")
    @Operation(summary = "List admin permissions")
    public ApiResponse<List<PermissionResponse>> listPermissions() {
        return ApiResponse.ok(adminRbacService.listPermissions());
    }

    @PostMapping("/permissions")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('admin:manage')")
    @Operation(summary = "Create admin permission")
    public ApiResponse<PermissionResponse> createPermission(@Valid @RequestBody CreatePermissionRequest request) {
        return ApiResponse.ok("Permission created", adminRbacService.createPermission(request));
    }
}
