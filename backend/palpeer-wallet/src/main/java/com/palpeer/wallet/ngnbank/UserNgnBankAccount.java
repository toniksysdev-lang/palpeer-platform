package com.palpeer.wallet.ngnbank;

import com.palpeer.common.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(
        name = "user_ngn_bank_accounts",
        uniqueConstraints =
                @UniqueConstraint(
                        name = "uk_user_ngn_bank_accounts_user_bank_acct",
                        columnNames = {"user_id", "bank_code", "account_number"}))
public class UserNgnBankAccount extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "bank_code", nullable = false, length = 20)
    private String bankCode;

    @Column(name = "bank_name", nullable = false, length = 120)
    private String bankName;

    @Column(name = "account_number", nullable = false, length = 20)
    private String accountNumber;

    @Column(name = "account_name", nullable = false, length = 160)
    private String accountName;
}
