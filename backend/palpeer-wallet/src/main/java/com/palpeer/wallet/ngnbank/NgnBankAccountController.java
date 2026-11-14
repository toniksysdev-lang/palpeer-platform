package com.palpeer.wallet.ngnbank;

import com.palpeer.auth.security.UserPrincipal;
import com.palpeer.common.api.ApiResponse;
import com.palpeer.wallet.ngnbank.dto.NgnBankAccountResponse;
import com.palpeer.wallet.ngnbank.dto.UpsertNgnBankAccountRequest;
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
@RequestMapping("/api/v1/me/ngn-bank-accounts")
@RequiredArgsConstructor
@Tag(name = "NGN bank accounts")
@SecurityRequirement(name = "bearerAuth")
public class NgnBankAccountController {

    private final NgnBankAccountService ngnBankAccountService;

    @GetMapping
    @Operation(summary = "List saved NGN withdrawal bank accounts")
    public ApiResponse<List<NgnBankAccountResponse>> list(@AuthenticationPrincipal UserPrincipal principal) {
        return ApiResponse.ok(ngnBankAccountService.list(principal.getId()));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create or update a saved NGN bank account by bank code + account number")
    public ApiResponse<NgnBankAccountResponse> upsert(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody UpsertNgnBankAccountRequest request) {
        return ApiResponse.ok("Saved", ngnBankAccountService.upsert(principal.getId(), request));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete a saved NGN bank account")
    public void delete(@AuthenticationPrincipal UserPrincipal principal, @PathVariable UUID id) {
        ngnBankAccountService.delete(principal.getId(), id);
    }
}
