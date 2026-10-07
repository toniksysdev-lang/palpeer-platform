package com.palpeer.card.web;

import com.palpeer.card.domain.CardStatus;
import com.palpeer.card.service.CardService;
import com.palpeer.card.web.dto.AdminCardResponse;
import com.palpeer.card.web.dto.CardTransactionResponse;
import com.palpeer.common.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin inventory for cards — list/get/txs read-only; block/unblock without owner check.
 * Never exposes PAN/CVV (CardResponse uses lastFour only).
 */
@RestController
@RequestMapping("/api/v1/admin/cards")
@RequiredArgsConstructor
@Tag(name = "Admin Cards")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminCardController {

    private final CardService cardService;

    @GetMapping
    @PreAuthorize("hasAuthority('cards:read')")
    @Operation(summary = "List all cards (admin inventory)")
    public ApiResponse<Page<AdminCardResponse>> list(
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false) CardStatus status,
            @PageableDefault(size = 20, sort = "createdAt", direction = org.springframework.data.domain.Sort.Direction.DESC)
            Pageable pageable) {
        return ApiResponse.ok(cardService.adminList(userId, status, pageable));
    }

    @GetMapping("/{cardId}")
    @PreAuthorize("hasAuthority('cards:read')")
    @Operation(summary = "Get card by id")
    public ApiResponse<AdminCardResponse> get(@PathVariable UUID cardId) {
        return ApiResponse.ok(cardService.adminGet(cardId));
    }

    @GetMapping("/{cardId}/transactions")
    @PreAuthorize("hasAuthority('cards:read')")
    @Operation(summary = "List card transactions (local inventory)")
    public ApiResponse<Page<CardTransactionResponse>> transactions(
            @PathVariable UUID cardId,
            @PageableDefault(size = 20, sort = "occurredAt", direction = org.springframework.data.domain.Sort.Direction.DESC)
            Pageable pageable) {
        return ApiResponse.ok(cardService.adminTransactions(cardId, pageable));
    }

    @PostMapping("/{cardId}/block")
    @PreAuthorize("hasAuthority('cards:write')")
    @Operation(summary = "Block a card (admin)")
    public ApiResponse<AdminCardResponse> block(@PathVariable UUID cardId) {
        return ApiResponse.ok(cardService.adminBlock(cardId));
    }

    @PostMapping("/{cardId}/unblock")
    @PreAuthorize("hasAuthority('cards:write')")
    @Operation(summary = "Unblock a card (admin)")
    public ApiResponse<AdminCardResponse> unblock(@PathVariable UUID cardId) {
        return ApiResponse.ok(cardService.adminUnblock(cardId));
    }
}
