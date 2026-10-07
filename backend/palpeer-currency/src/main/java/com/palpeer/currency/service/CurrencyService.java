package com.palpeer.currency.service;

import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.currency.domain.Currency;
import com.palpeer.currency.repository.CurrencyRepository;
import com.palpeer.currency.web.dto.CreateCurrencyRequest;
import com.palpeer.currency.web.dto.CurrencyResponse;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CurrencyService {

    private final CurrencyRepository currencyRepository;
    private final AuditRecorder auditRecorder;

    @Transactional(readOnly = true)
    public List<CurrencyResponse> list() {
        return currencyRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public CurrencyResponse getByCode(String code) {
        return currencyRepository.findByCodeIgnoreCase(code)
                .map(this::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Currency not found: " + code));
    }

    /**
     * Create currency (admin: currencies:write).
     */
    @Transactional
    public CurrencyResponse create(CreateCurrencyRequest request) {
        String code = request.code().trim().toUpperCase(Locale.ROOT);
        if (currencyRepository.existsByCodeIgnoreCase(code)) {
            throw new BusinessException("CURRENCY_EXISTS", "Currency already exists: " + code, HttpStatus.CONFLICT);
        }

        Currency currency = new Currency();
        currency.setCode(code);
        currency.setSymbol(request.symbol().trim());
        currency.setPrecision(request.precision());
        currencyRepository.save(currency);
        auditRecorder.record(AuditRecord.builder("ADMIN_CURRENCY_CREATE")
                .entity("Currency:" + currency.getId())
                .newValue("code=" + currency.getCode()
                        + ";symbol=" + currency.getSymbol()
                        + ";precision=" + currency.getPrecision())
                .build());
        return toResponse(currency);
    }

    public void requireExists(String code) {
        if (!currencyRepository.existsByCodeIgnoreCase(code)) {
            throw new ResourceNotFoundException("Currency not found: " + code);
        }
    }

    private CurrencyResponse toResponse(Currency currency) {
        return new CurrencyResponse(
                currency.getId(),
                currency.getCode(),
                currency.getSymbol(),
                currency.getPrecision()
        );
    }
}
