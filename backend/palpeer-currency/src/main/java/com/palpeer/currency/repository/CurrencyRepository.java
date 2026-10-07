package com.palpeer.currency.repository;

import com.palpeer.currency.domain.Currency;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CurrencyRepository extends JpaRepository<Currency, UUID> {

    Optional<Currency> findByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCase(String code);
}
