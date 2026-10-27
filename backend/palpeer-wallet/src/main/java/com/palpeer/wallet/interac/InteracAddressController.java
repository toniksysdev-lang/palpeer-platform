package com.palpeer.wallet.interac;

import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.common.api.ApiResponse;
import com.palpeer.wallet.interac.dto.InteracAddressResponse;
import com.palpeer.wallet.interac.dto.UpsertInteracAddressRequest;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/me/interac-addresses")
@RequiredArgsConstructor
@Tag(name = "Interac addresses")
@SecurityRequirement(name = "bearerAuth")
public class InteracAddressController {

    private final InteracAddressService interacAddressService;

    @GetMapping
    @Operation(summary = "List saved CAD Interac payer addresses")
    public ApiResponse<List<InteracAddressResponse>> list(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(interacAddressService.list(principal.getId()));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create or update a saved Interac address by email")
    public ApiResponse<InteracAddressResponse> upsert(
            @AuthenticationPrincipal UserPrincipal principal, @Valid @RequestBody UpsertInteracAddressRequest request) {
        return ApiResponse.ok("Saved", interacAddressService.upsert(principal.getId(), request));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete a saved Interac address")
    public void delete(@AuthenticationPrincipal UserPrincipal principal, @PathVariable UUID id) {
        interacAddressService.delete(principal.getId(), id);
    }
}
