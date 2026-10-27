package com.palpeer.wallet.interac;

import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.wallet.interac.dto.InteracAddressResponse;
import com.palpeer.wallet.interac.dto.UpsertInteracAddressRequest;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class InteracAddressService {

    private final UserInteracAddressRepository repository;

    @Transactional(readOnly = true)
    public List<InteracAddressResponse> list(UUID userId) {
        return repository.findByUserIdOrderByCreatedAtDesc(userId).stream().map(this::toResponse).toList();
    }

    @Transactional
    public InteracAddressResponse upsert(UUID userId, UpsertInteracAddressRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        String first = request.firstName().trim();
        String last = request.lastName().trim();
        if (first.isEmpty() || last.isEmpty()) {
            throw new BusinessException("INVALID_NAME", "First and last name are required", HttpStatus.BAD_REQUEST);
        }
        UserInteracAddress row =
                repository.findByUserIdAndEmailIgnoreCase(userId, email).orElseGet(UserInteracAddress::new);
        row.setUserId(userId);
        row.setEmail(email);
        row.setFirstName(first);
        row.setLastName(last);
        return toResponse(repository.save(row));
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        UserInteracAddress row = repository
                .findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Interac address not found"));
        repository.delete(row);
    }

    private InteracAddressResponse toResponse(UserInteracAddress row) {
        return new InteracAddressResponse(
                row.getId(), row.getEmail(), row.getFirstName(), row.getLastName(), row.getCreatedAt());
    }
}
