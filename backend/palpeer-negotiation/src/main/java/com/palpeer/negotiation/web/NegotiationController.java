package com.palpeer.negotiation.web;

import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.common.api.ApiResponse;
import com.palpeer.negotiation.service.NegotiationService;
import com.palpeer.negotiation.web.dto.CounterOfferRequest;
import com.palpeer.negotiation.web.dto.CreateOfferRequest;
import com.palpeer.negotiation.web.dto.NegotiationResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/negotiations")
@RequiredArgsConstructor
@Tag(name = "Negotiation")
@SecurityRequirement(name = "bearerAuth")
public class NegotiationController {

    private final NegotiationService negotiationService;

    @PostMapping("/offers")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create initial offer on a P2P request")
    public ApiResponse<NegotiationResponse> offer(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody CreateOfferRequest request) {
        return ApiResponse.ok("Offer created", negotiationService.offer(principal.getId(), request));
    }

    @PostMapping("/{negotiationId}/counter")
    @Operation(summary = "Counter the current pending offer")
    public ApiResponse<NegotiationResponse> counter(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID negotiationId,
            @Valid @RequestBody CounterOfferRequest request) {
        return ApiResponse.ok(negotiationService.counter(principal.getId(), negotiationId, request));
    }

    @PostMapping("/{negotiationId}/accept")
    @Operation(summary = "Accept the current pending offer and create P2P order")
    public ApiResponse<NegotiationResponse> accept(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID negotiationId) {
        return ApiResponse.ok("Negotiation accepted", negotiationService.accept(principal.getId(), negotiationId));
    }

    @PostMapping("/{negotiationId}/reject")
    @Operation(summary = "Decline the other participant's pending offer; ends the negotiation")
    public ApiResponse<NegotiationResponse> reject(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID negotiationId) {
        return ApiResponse.ok("Offer declined", negotiationService.reject(principal.getId(), negotiationId));
    }

    @PostMapping("/{negotiationId}/cancel")
    @Operation(summary = "Withdraw from an open negotiation (either participant)")
    public ApiResponse<NegotiationResponse> cancel(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID negotiationId) {
        return ApiResponse.ok("Negotiation cancelled", negotiationService.cancel(principal.getId(), negotiationId));
    }

    @GetMapping("/me")
    @Operation(summary = "List my negotiations (as request owner or counterparty)")
    public ApiResponse<List<NegotiationResponse>> listMine(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) UUID p2pRequestId) {
        return ApiResponse.ok(negotiationService.listMine(principal.getId(), p2pRequestId));
    }

    @GetMapping("/{negotiationId}")
    @Operation(summary = "Get negotiation (participant only)")
    public ApiResponse<NegotiationResponse> get(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID negotiationId) {
        return ApiResponse.ok(negotiationService.get(principal.getId(), negotiationId));
    }
}
