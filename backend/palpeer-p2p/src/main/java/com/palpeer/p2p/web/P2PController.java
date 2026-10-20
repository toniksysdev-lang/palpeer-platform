package com.palpeer.p2p.web;

import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.common.api.ApiResponse;
import com.palpeer.p2p.service.P2PRateBoundsService;
import com.palpeer.p2p.service.P2PService;
import com.palpeer.p2p.web.dto.CreateP2PRequestDto;
import com.palpeer.p2p.web.dto.P2POrderResponse;
import com.palpeer.p2p.web.dto.P2POrderSummaryResponse;
import com.palpeer.p2p.web.dto.P2PRateBoundsResponse;
import com.palpeer.p2p.web.dto.P2PRequestResponse;
import com.palpeer.p2p.web.dto.PublicP2PRateResponse;
import com.palpeer.p2p.web.dto.UpdateP2PRequestDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
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
@RequestMapping("/api/v1/p2p")
@RequiredArgsConstructor
@Tag(name = "P2P")
@SecurityRequirement(name = "bearerAuth")
public class P2PController {

    private final P2PService p2PService;
    private final P2PRateBoundsService p2PRateBoundsService;

    @PostMapping("/requests")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create P2P request")
    public ApiResponse<P2PRequestResponse> create(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody CreateP2PRequestDto request) {
        return ApiResponse.ok("P2P request created", p2PService.create(principal.getId(), request));
    }

    @PutMapping("/requests/{requestId}")
    @Operation(summary = "Update OPEN P2P request")
    public ApiResponse<P2PRequestResponse> update(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID requestId,
            @Valid @RequestBody UpdateP2PRequestDto request) {
        return ApiResponse.ok(p2PService.update(principal.getId(), requestId, request));
    }

    @DeleteMapping("/requests/{requestId}")
    @Operation(summary = "Cancel an OPEN request, or remove a cancelled/expired request from history")
    public ApiResponse<Void> delete(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID requestId) {
        p2PService.delete(principal.getId(), requestId);
        return ApiResponse.ok("P2P request removed", null);
    }

    @DeleteMapping("/orders/{orderId}")
    @Operation(summary = "Remove a cancelled P2P order from the caller's history")
    public ApiResponse<Void> deleteOrder(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID orderId) {
        p2PService.deleteOrder(principal.getId(), orderId);
        return ApiResponse.ok("P2P order removed", null);
    }

    @PostMapping("/requests/{requestId}/accept")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Accept P2P request and create order")
    public ApiResponse<P2POrderResponse> accept(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID requestId) {
        return ApiResponse.ok("P2P request accepted", p2PService.accept(principal.getId(), requestId));
    }

    @GetMapping("/me/requests")
    @Operation(summary = "List my P2P requests")
    public ApiResponse<List<P2PRequestResponse>> listMine(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(p2PService.listMine(principal.getId()));
    }

    @GetMapping("/me/orders")
    @Operation(summary = "List my P2P orders (as requester or acceptor)")
    public ApiResponse<List<P2POrderSummaryResponse>> listMyOrders(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(p2PService.listMyOrders(principal.getId()));
    }

    @GetMapping("/requests/{requestId}")
    @Operation(summary = "Get P2P request")
    public ApiResponse<P2PRequestResponse> getRequest(@PathVariable UUID requestId) {
        return ApiResponse.ok(p2PService.getRequest(requestId));
    }

    @GetMapping("/requests")
    @Operation(summary = "List OPEN P2P requests")
    public ApiResponse<List<P2PRequestResponse>> listOpen() {
        return ApiResponse.ok(p2PService.listOpen());
    }

    @GetMapping("/rate-bounds")
    @Operation(summary = "Get configured min/max rate for a currency pair, if any")
    public ApiResponse<P2PRateBoundsResponse> getRateBounds(
            @RequestParam String baseCurrencyCode, @RequestParam String quoteCurrencyCode) {
        return ApiResponse.ok(p2PRateBoundsService.findByPair(baseCurrencyCode, quoteCurrencyCode));
    }

    @GetMapping("/orders/{orderId}")
    @Operation(summary = "Get P2P order (participant only)")
    public ApiResponse<P2POrderResponse> getOrder(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID orderId) {
        return ApiResponse.ok(p2PService.getOrder(principal.getId(), orderId));
    }
}
