package com.palpeer.currency.repository;

import com.palpeer.currency.domain.ExchangeRate;
import com.palpeer.currency.domain.RateApprovalStatus;
import com.palpeer.currency.domain.RateChannel;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ExchangeRateRepository extends JpaRepository<ExchangeRate, UUID> {

    @Query("""
            select r from ExchangeRate r
            where upper(r.baseCurrencyCode) = upper(:base)
              and upper(r.quoteCurrencyCode) = upper(:quote)
              and r.channel = :channel
              and r.active = true
              and r.approvalStatus = :approved
              and r.effectiveDate <= :asOf
            order by r.effectiveDate desc
            """)
    List<ExchangeRate> findPublishedEffectiveRates(
            @Param("base") String base,
            @Param("quote") String quote,
            @Param("channel") RateChannel channel,
            @Param("approved") RateApprovalStatus approved,
            @Param("asOf") Instant asOf);

    default Optional<ExchangeRate> findLatestPublishedEffective(
            String base, String quote, RateChannel channel, Instant asOf) {
        List<ExchangeRate> rates = findPublishedEffectiveRates(
                base, quote, channel, RateApprovalStatus.APPROVED, asOf);
        return rates.isEmpty() ? Optional.empty() : Optional.of(rates.getFirst());
    }

    @Query("""
            select r from ExchangeRate r
            where upper(r.baseCurrencyCode) = upper(:base)
              and upper(r.quoteCurrencyCode) = upper(:quote)
              and r.channel = :channel
              and r.active = true
              and r.approvalStatus = :approved
            order by r.effectiveDate desc
            """)
    List<ExchangeRate> findPublishedHistory(
            @Param("base") String base,
            @Param("quote") String quote,
            @Param("channel") RateChannel channel,
            @Param("approved") RateApprovalStatus approved);

    @Query("""
            select r from ExchangeRate r
            where r.channel = :channel
              and r.active = true
              and r.approvalStatus = :approved
              and r.effectiveDate <= :asOf
            order by r.effectiveDate desc
            """)
    List<ExchangeRate> findPublishedEffectiveByChannel(
            @Param("channel") RateChannel channel,
            @Param("approved") RateApprovalStatus approved,
            @Param("asOf") Instant asOf);

    @Query("""
            select r from ExchangeRate r
            where r.effectiveDate <= :asOf
              and (:channel is null or r.channel = :channel)
            order by r.effectiveDate desc
            """)
    List<ExchangeRate> findAdminEffectiveRates(
            @Param("asOf") Instant asOf,
            @Param("channel") RateChannel channel);

    @Query("""
            select r from ExchangeRate r
            where upper(r.baseCurrencyCode) = upper(:base)
              and upper(r.quoteCurrencyCode) = upper(:quote)
              and (:channel is null or r.channel = :channel)
            order by r.effectiveDate desc
            """)
    List<ExchangeRate> findAdminHistory(
            @Param("base") String base,
            @Param("quote") String quote,
            @Param("channel") RateChannel channel);

    boolean existsByBaseCurrencyCodeIgnoreCaseAndQuoteCurrencyCodeIgnoreCaseAndChannelAndEffectiveDate(
            String baseCurrencyCode, String quoteCurrencyCode, RateChannel channel, Instant effectiveDate);

    long deleteByBaseCurrencyCodeIgnoreCaseAndQuoteCurrencyCodeIgnoreCaseAndChannel(
            String baseCurrencyCode, String quoteCurrencyCode, RateChannel channel);
}
