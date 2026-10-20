package com.palpeer.app.publicapi;

import com.palpeer.common.api.ApiResponse;
import com.palpeer.common.settings.RegistrationCountryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public/registration-countries")
@RequiredArgsConstructor
@Tag(name = "Public Registration Countries")
public class PublicRegistrationCountriesController {

    private final RegistrationCountryService registrationCountryService;

    @GetMapping
    @Operation(summary = "Countries currently allowed for mobile registration")
    public ApiResponse<List<String>> list() {
        return ApiResponse.ok(registrationCountryService.listAllowedIso2());
    }
}
