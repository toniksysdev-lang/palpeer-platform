package com.palpeer.wallet.service;

import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.wallet.funding.FundingService;
import com.palpeer.wallet.funding.FundingTransaction;
import com.palpeer.wallet.funding.FundingTransactionRepository;
import com.palpeer.wallet.funding.dto.FundingTransactionResponse;
import com.palpeer.wallet.repository.WalletRepository;
import com.palpeer.wallet.web.dto.AdminCreateFundingRequest;
import com.palpeer.wallet.web.dto.AdminCreateWithdrawalRequest;
import com.palpeer.wallet.web.dto.AdminMoneyMovementResponse;
import com.palpeer.wallet.withdrawal.WithdrawalService;
import com.palpeer.wallet.withdrawal.WithdrawalTransaction;
import com.palpeer.wallet.withdrawal.WithdrawalTransactionRepository;
import com.palpeer.wallet.withdrawal.dto.WithdrawalTransactionResponse;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminWalletMovementService {

    private static final int MOVEMENT_FETCH = 40;

    private final WalletRepository walletRepository;
    private final FundingTransactionRepository fundingTransactionRepository;
    private final WithdrawalTransactionRepository withdrawalTransactionRepository;
    private final FundingService fundingService;
    private final WithdrawalService withdrawalService;

    @Transactional(readOnly = true)
    public List<AdminMoneyMovementResponse> listMovements(UUID walletId) {
        requireWallet(walletId);
        List<AdminMoneyMovementResponse> rows = new ArrayList<>();
        var pageable = PageRequest.of(0, MOVEMENT_FETCH);
        for (FundingTransaction tx : fundingTransactionRepository.findByWalletIdOrderByCreatedAtDesc(walletId, pageable)) {
            rows.add(new AdminMoneyMovementResponse(
                    tx.getId(),
                    "FUNDING",
                    tx.getWalletId(),
                    tx.getUserId(),
                    tx.getAmount(),
                    tx.getCurrencyCode(),
                    tx.getStatus(),
                    tx.getFailureReason(),
                    tx.getProviderReference(),
                    tx.getProviderName(),
                    tx.getCreatedAt()));
        }
        for (WithdrawalTransaction tx :
                withdrawalTransactionRepository.findByWalletIdOrderByCreatedAtDesc(walletId, pageable)) {
            rows.add(new AdminMoneyMovementResponse(
                    tx.getId(),
                    "WITHDRAWAL",
                    tx.getWalletId(),
                    tx.getUserId(),
                    tx.getAmount(),
                    tx.getCurrencyCode(),
                    tx.getStatus(),
                    tx.getFailureReason(),
                    tx.getDestinationReference(),
                    tx.getProviderName(),
                    tx.getCreatedAt()));
        }
        rows.sort(Comparator.comparing(AdminMoneyMovementResponse::createdAt).reversed());
        return rows.size() > MOVEMENT_FETCH ? rows.subList(0, MOVEMENT_FETCH) : rows;
    }

    @Transactional
    public FundingTransactionResponse createFunding(
            UUID operatorId, UUID walletId, String idempotencyKey, AdminCreateFundingRequest request) {
        return fundingService.operatorInitiate(
                operatorId, walletId, idempotencyKey, request.amount(), request.providerReference());
    }

    @Transactional
    public WithdrawalTransactionResponse createWithdrawal(
            UUID operatorId, UUID walletId, String idempotencyKey, AdminCreateWithdrawalRequest request) {
        return withdrawalService.operatorInitiate(
                operatorId, walletId, idempotencyKey, request.amount(), request.destinationReference());
    }

    @Transactional
    public FundingTransactionResponse processFunding(UUID operatorId, UUID walletId, UUID fundingId) {
        requireFundingForWallet(walletId, fundingId);
        return fundingService.operatorProcess(operatorId, fundingId);
    }

    @Transactional
    public FundingTransactionResponse failFunding(UUID operatorId, UUID walletId, UUID fundingId, String reason) {
        requireFundingForWallet(walletId, fundingId);
        return fundingService.operatorFail(operatorId, fundingId, reason);
    }

    @Transactional
    public FundingTransactionResponse reverseFunding(UUID operatorId, UUID walletId, UUID fundingId) {
        requireFundingForWallet(walletId, fundingId);
        return fundingService.operatorReverse(operatorId, fundingId);
    }

    @Transactional
    public WithdrawalTransactionResponse processWithdrawal(UUID operatorId, UUID walletId, UUID withdrawalId) {
        requireWithdrawalForWallet(walletId, withdrawalId);
        return withdrawalService.operatorProcess(operatorId, withdrawalId);
    }

    @Transactional
    public WithdrawalTransactionResponse failWithdrawal(
            UUID operatorId, UUID walletId, UUID withdrawalId, String reason) {
        requireWithdrawalForWallet(walletId, withdrawalId);
        return withdrawalService.operatorFail(operatorId, withdrawalId, reason);
    }

    @Transactional
    public WithdrawalTransactionResponse reverseWithdrawal(UUID operatorId, UUID walletId, UUID withdrawalId) {
        requireWithdrawalForWallet(walletId, withdrawalId);
        return withdrawalService.operatorReverse(operatorId, withdrawalId);
    }

    private void requireWallet(UUID walletId) {
        if (!walletRepository.existsById(walletId)) {
            throw new ResourceNotFoundException("Wallet not found");
        }
    }

    private void requireFundingForWallet(UUID walletId, UUID fundingId) {
        FundingTransaction tx = fundingTransactionRepository
                .findById(fundingId)
                .orElseThrow(() -> new ResourceNotFoundException("Funding transaction not found"));
        if (!tx.getWalletId().equals(walletId)) {
            throw new ResourceNotFoundException("Funding transaction not found");
        }
    }

    private void requireWithdrawalForWallet(UUID walletId, UUID withdrawalId) {
        WithdrawalTransaction tx = withdrawalTransactionRepository
                .findById(withdrawalId)
                .orElseThrow(() -> new ResourceNotFoundException("Withdrawal transaction not found"));
        if (!tx.getWalletId().equals(walletId)) {
            throw new ResourceNotFoundException("Withdrawal transaction not found");
        }
    }
}
