package com.palpeer.app.web;

import com.palpeer.common.api.ApiResponse;
import com.palpeer.currency.domain.RateChannel;
import com.palpeer.currency.service.ExchangeRateService;
import com.palpeer.currency.web.dto.ExchangeRateResponse;
import com.palpeer.p2p.service.P2PService;
import com.palpeer.p2p.web.dto.PublicP2PRateResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Unauthenticated rate board for the mobile welcome / View Rates flow.
 * Lives in the app module so component-scan always picks it up.
 */
@RestController
@RequestMapping("/api/v1/public")
@RequiredArgsConstructor
@Tag(name = "Public rates")
public class PublicRatesController {

    private final ExchangeRateService exchangeRateService;
    private final P2PService p2PService;

    @GetMapping("/instant-rates")
    @Operation(summary = "Latest InstantEX rates for every published pair (public)")
    public ApiResponse<List<ExchangeRateResponse>> instantRates() {
        return ApiResponse.ok(exchangeRateService.latestForAllPairs(RateChannel.SWAP));
    }

    @GetMapping("/p2p-rates")
    @Operation(summary = "Open P2P request rates (public, no owner details)")
    public ApiResponse<List<PublicP2PRateResponse>> p2pRates() {
        return ApiResponse.ok(p2PService.listOpenPublicRates());
    }
}
