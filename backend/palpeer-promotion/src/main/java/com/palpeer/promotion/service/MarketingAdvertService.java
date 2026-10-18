package com.palpeer.promotion.service;

import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.promotion.domain.MarketingAdvert;
import com.palpeer.promotion.repository.MarketingAdvertRepository;
import com.palpeer.promotion.web.dto.CreateMarketingAdvertRequest;
import com.palpeer.promotion.web.dto.MarketingAdvertResponse;
import com.palpeer.promotion.web.dto.UpdateMarketingAdvertRequest;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MarketingAdvertService {

    private final MarketingAdvertRepository marketingAdvertRepository;

    @Transactional(readOnly = true)
    public List<MarketingAdvertResponse> listActive() {
        return marketingAdvertRepository.findByActiveTrueOrderBySortOrderAscCreatedAtDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MarketingAdvertResponse> listAll() {
        return marketingAdvertRepository.findAllByOrderBySortOrderAscCreatedAtDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public MarketingAdvertResponse get(UUID id) {
        return toResponse(require(id));
    }

    @Transactional
    public MarketingAdvertResponse create(CreateMarketingAdvertRequest request) {
        MarketingAdvert advert = new MarketingAdvert();
        advert.setTitle(request.title().trim());
        advert.setBody(request.body().trim());
        advert.setImageUrl(normalizeUrl(request.imageUrl()));
        advert.setCtaLabel(request.ctaLabel().trim());
        advert.setCtaPath(normalizePath(request.ctaPath()));
        advert.setSortOrder(request.sortOrder() == null ? 0 : request.sortOrder());
        advert.setActive(request.active() == null || request.active());
        marketingAdvertRepository.save(advert);
        return toResponse(advert);
    }

    @Transactional
    public MarketingAdvertResponse update(UUID id, UpdateMarketingAdvertRequest request) {
        MarketingAdvert advert = require(id);
        if (request.title() != null && !request.title().isBlank()) {
            advert.setTitle(request.title().trim());
        }
        if (request.body() != null && !request.body().isBlank()) {
            advert.setBody(request.body().trim());
        }
        if (request.imageUrl() != null && !request.imageUrl().isBlank()) {
            advert.setImageUrl(normalizeUrl(request.imageUrl()));
        }
        if (request.ctaLabel() != null && !request.ctaLabel().isBlank()) {
            advert.setCtaLabel(request.ctaLabel().trim());
        }
        if (request.ctaPath() != null && !request.ctaPath().isBlank()) {
            advert.setCtaPath(normalizePath(request.ctaPath()));
        }
        if (request.sortOrder() != null) {
            advert.setSortOrder(request.sortOrder());
        }
        if (request.active() != null) {
            advert.setActive(request.active());
        }
        marketingAdvertRepository.save(advert);
        return toResponse(advert);
    }

    @Transactional
    public void delete(UUID id) {
        MarketingAdvert advert = require(id);
        marketingAdvertRepository.delete(advert);
    }

    private MarketingAdvert require(UUID id) {
        return marketingAdvertRepository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Marketing advert not found"));
    }

    private MarketingAdvertResponse toResponse(MarketingAdvert advert) {
        return new MarketingAdvertResponse(
                advert.getId(),
                advert.getTitle(),
                advert.getBody(),
                advert.getImageUrl(),
                advert.getCtaLabel(),
                advert.getCtaPath(),
                advert.getSortOrder(),
                advert.isActive(),
                advert.getCreatedAt(),
                advert.getUpdatedAt());
    }

    private static String normalizeUrl(String raw) {
        String url = raw.trim();
        String lower = url.toLowerCase(Locale.ROOT);
        if (!(lower.startsWith("https://") || lower.startsWith("http://"))) {
            throw new BusinessException(
                    "INVALID_IMAGE_URL",
                    "Image URL must start with http:// or https://",
                    HttpStatus.BAD_REQUEST);
        }
        return url;
    }

    private static String normalizePath(String raw) {
        String path = raw.trim();
        if (!path.startsWith("/")) {
            path = "/" + path;
        }
        return path;
    }
}
