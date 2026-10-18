package com.palpeer.promotion.web;

import com.palpeer.common.api.ApiResponse;
import com.palpeer.promotion.service.MarketingAdvertService;
import com.palpeer.promotion.web.dto.MarketingAdvertResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public/marketing-adverts")
@RequiredArgsConstructor
@Tag(name = "Public Marketing")
public class PublicMarketingAdvertController {

    private final MarketingAdvertService marketingAdvertService;

    @GetMapping
    @Operation(summary = "List active marketing adverts for the home carousel")
    public ApiResponse<List<MarketingAdvertResponse>> listActive() {
        return ApiResponse.ok(marketingAdvertService.listActive());
    }
}
