package com.palpeer.promotion.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.palpeer.promotion.domain.Promotion;
import jakarta.persistence.EntityManager;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class PromotionEligibilityEvaluator {

    private final EntityManager entityManager;
    private final ObjectMapper objectMapper;

    public boolean evaluateEligibility(UUID userId, Promotion promotion) {
        String json = promotion.getEligibilityJson();
        if (json == null || json.isBlank()) {
            return true;
        }
        try {
            JsonNode node = objectMapper.readTree(json);
            Integer minKyc = intOrNull(node, "minKycLevel");
            if (minKyc != null && kycLevel(userId) < minKyc) {
                return false;
            }
            Integer minOrders = intOrNull(node, "minCompletedOrders");
            if (minOrders != null && completedP2POrders(userId) < minOrders) {
                return false;
            }
            String countries = textOrNull(node, "countries");
            if (countries != null && !countries.isBlank()) {
                Set<String> allowed = Arrays.stream(countries.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .map(s -> s.toUpperCase(Locale.ROOT))
                        .collect(Collectors.toSet());
                String residence = userCountry(userId);
                if (residence == null || !allowed.contains(residence)) {
                    return false;
                }
            }
            return true;
        } catch (Exception ex) {
            log.warn("Eligibility JSON invalid for promotion {}: {}", promotion.getId(), ex.getMessage());
            return false;
        }
    }

    /**
     * When true, the referrer's bonus stays PENDING until the invitee completes InstantEX or P2P.
     * Field: {@code referrerBonusRequiresInviteeTrade} in eligibility JSON.
     */
    public boolean referrerBonusRequiresInviteeTrade(Promotion promotion) {
        String json = promotion.getEligibilityJson();
        if (json == null || json.isBlank()) {
            return false;
        }
        try {
            JsonNode node = objectMapper.readTree(json);
            JsonNode flag = node.get("referrerBonusRequiresInviteeTrade");
            if (flag == null || flag.isNull()) {
                return false;
            }
            if (flag.isBoolean()) {
                return flag.booleanValue();
            }
            return Boolean.parseBoolean(flag.asText().trim());
        } catch (Exception ex) {
            log.warn(
                    "Could not read referrerBonusRequiresInviteeTrade for {}: {}",
                    promotion.getId(),
                    ex.getMessage());
            return false;
        }
    }

    /** Invitee has completed at least one InstantEX (SUCCESS) or settled P2P order. */
    public boolean hasQualifyingTrade(UUID userId) {
        return successfulInstantExCount(userId) > 0 || completedP2POrders(userId) > 0;
    }

    private long successfulInstantExCount(UUID userId) {
        Number count = (Number) entityManager
                .createNativeQuery(
                        """
                        SELECT COUNT(*) FROM exchange_transactions
                        WHERE user_id = :userId AND status = 'SUCCESS'
                        """)
                .setParameter("userId", userId)
                .getSingleResult();
        return count == null ? 0L : count.longValue();
    }

    private static Integer intOrNull(JsonNode node, String field) {
        JsonNode child = node.get(field);
        if (child == null || child.isNull()) {
            return null;
        }
        return child.isNumber() ? child.intValue() : Integer.parseInt(child.asText().trim());
    }

    private static String textOrNull(JsonNode node, String field) {
        JsonNode child = node.get(field);
        if (child == null || child.isNull()) {
            return null;
        }
        return child.asText();
    }

    private int kycLevel(UUID userId) {
        Object status = entityManager
                .createNativeQuery(
                        """
                        SELECT status FROM kyc_cases
                        WHERE user_id = :userId
                        ORDER BY updated_at DESC
                        LIMIT 1
                        """)
                .setParameter("userId", userId)
                .getResultStream()
                .findFirst()
                .orElse(null);
        if (status == null) {
            return 0;
        }
        return switch (status.toString()) {
            case "APPROVED" -> 3;
            case "UNDER_REVIEW" -> 2;
            case "IN_PROGRESS" -> 1;
            case "REJECTED" -> 0;
            default -> 0;
        };
    }

    private long completedP2POrders(UUID userId) {
        Number count = (Number) entityManager
                .createNativeQuery(
                        """
                        SELECT COUNT(*) FROM p2p_orders
                        WHERE status = 'COMPLETED'
                          AND (requester_id = :userId OR acceptor_id = :userId)
                        """)
                .setParameter("userId", userId)
                .getSingleResult();
        return count == null ? 0L : count.longValue();
    }

    private String userCountry(UUID userId) {
        Object country = entityManager
                .createNativeQuery("SELECT country_of_residence FROM profiles WHERE user_id = :userId")
                .setParameter("userId", userId)
                .getResultStream()
                .findFirst()
                .orElse(null);
        if (country == null || country.toString().isBlank()) {
            return null;
        }
        return country.toString().trim().toUpperCase(Locale.ROOT);
    }
}
