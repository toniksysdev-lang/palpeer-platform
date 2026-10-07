package com.palpeer.card.web;

import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.card.service.CardService;
import com.palpeer.card.web.dto.CardResponse;
import com.palpeer.card.web.dto.CardTransactionResponse;
import com.palpeer.card.web.dto.IssueCardRequest;
import com.palpeer.common.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/cards")
@RequiredArgsConstructor
@Tag(name = "Cards")
@SecurityRequirement(name = "bearerAuth")
public class CardController {

    private final CardService cardService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Issue a card via CardProvider")
    public ApiResponse<CardResponse> issue(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody IssueCardRequest request) {
        return ApiResponse.ok("Card issued", cardService.issue(principal.getId(), request));
    }

    @GetMapping
    @Operation(summary = "List my cards")
    public ApiResponse<List<CardResponse>> list(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(cardService.list(principal.getId()));
    }

    @GetMapping("/{cardId}")
    @Operation(summary = "Get card details")
    public ApiResponse<CardResponse> get(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID cardId) {
        return ApiResponse.ok(cardService.get(principal.getId(), cardId));
    }

    @PostMapping("/{cardId}/block")
    @Operation(summary = "Block card")
    public ApiResponse<CardResponse> block(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID cardId) {
        return ApiResponse.ok(cardService.block(principal.getId(), cardId));
    }

    @PostMapping("/{cardId}/unblock")
    @Operation(summary = "Unblock card")
    public ApiResponse<CardResponse> unblock(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID cardId) {
        return ApiResponse.ok(cardService.unblock(principal.getId(), cardId));
    }

    @GetMapping("/{cardId}/transactions")
    @Operation(summary = "List card transactions (syncs from provider first)")
    public ApiResponse<Page<CardTransactionResponse>> transactions(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID cardId,
            @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.ok(cardService.syncAndListTransactions(principal.getId(), cardId, pageable));
    }
}
