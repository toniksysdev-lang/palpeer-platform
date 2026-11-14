package com.palpeer.wallet.ngnbank;

import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.wallet.ngnbank.dto.NgnBankAccountResponse;
import com.palpeer.wallet.ngnbank.dto.UpsertNgnBankAccountRequest;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class NgnBankAccountService {

    private final UserNgnBankAccountRepository repository;

    @Transactional(readOnly = true)
    public List<NgnBankAccountResponse> list(UUID userId) {
        return repository.findByUserIdOrderByCreatedAtDesc(userId).stream().map(this::toResponse).toList();
    }

    @Transactional
    public NgnBankAccountResponse upsert(UUID userId, UpsertNgnBankAccountRequest request) {
        String bankCode = request.bankCode().trim();
        String bankName = request.bankName().trim();
        String accountNumber = request.accountNumber().trim();
        String accountName = request.accountName().trim();
        if (bankCode.isEmpty() || bankName.isEmpty() || accountName.isEmpty()) {
            throw new BusinessException(
                    "INVALID_BANK_ACCOUNT", "Bank, account number and name are required", HttpStatus.BAD_REQUEST);
        }
        if (!accountNumber.matches("\\d{10}")) {
            throw new BusinessException(
                    "INVALID_ACCOUNT_NUMBER", "Account number must be 10 digits", HttpStatus.BAD_REQUEST);
        }
        UserNgnBankAccount row = repository
                .findByUserIdAndBankCodeAndAccountNumber(userId, bankCode, accountNumber)
                .orElseGet(UserNgnBankAccount::new);
        row.setUserId(userId);
        row.setBankCode(bankCode);
        row.setBankName(bankName);
        row.setAccountNumber(accountNumber);
        row.setAccountName(accountName);
        return toResponse(repository.save(row));
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        UserNgnBankAccount row = repository
                .findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Bank account not found"));
        repository.delete(row);
    }

    private NgnBankAccountResponse toResponse(UserNgnBankAccount row) {
        return new NgnBankAccountResponse(
                row.getId(),
                row.getBankCode(),
                row.getBankName(),
                row.getAccountNumber(),
                row.getAccountName(),
                row.getCreatedAt());
    }
}
