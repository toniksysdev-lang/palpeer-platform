package com.palpeer.promotion.service;

import com.palpeer.common.exception.BusinessException;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.common.mail.EmailSender;
import com.palpeer.common.mail.PalpeerEmailTemplates;
import com.palpeer.promotion.domain.BusinessAccountInterest;
import com.palpeer.promotion.repository.BusinessAccountInterestRepository;
import com.palpeer.promotion.web.dto.BusinessInterestResponse;
import com.palpeer.promotion.web.dto.CreateBusinessInterestRequest;
import com.palpeer.promotion.web.dto.SendBusinessInterestEmailRequest;
import com.palpeer.promotion.web.dto.SendBusinessInterestEmailResponse;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class BusinessAccountInterestService {

    private final BusinessAccountInterestRepository repository;
    private final EmailSender emailSender;

    @Transactional
    public BusinessInterestResponse submit(CreateBusinessInterestRequest request) {
        String email = request.email().trim();
        String normalized = email.toLowerCase(Locale.ROOT);
        return repository
                .findByEmailNormalized(normalized)
                .map(this::toResponse)
                .orElseGet(() -> {
                    BusinessAccountInterest interest = new BusinessAccountInterest();
                    interest.setEmail(email);
                    interest.setEmailNormalized(normalized);
                    interest.setSource("mobile");
                    repository.save(interest);
                    return toResponse(interest);
                });
    }

    @Transactional(readOnly = true)
    public List<BusinessInterestResponse> listAll() {
        return repository.findAllByOrderByCreatedAtDesc().stream().map(this::toResponse).toList();
    }

    @Transactional
    public void delete(UUID id) {
        BusinessAccountInterest interest = repository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Waitlist email not found"));
        repository.delete(interest);
    }

    @Transactional
    public int deleteMany(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) {
            throw new BusinessException(
                    "RECIPIENTS_REQUIRED",
                    "Select at least one waitlist email to delete.",
                    HttpStatus.BAD_REQUEST);
        }
        LinkedHashSet<UUID> unique = new LinkedHashSet<>(ids);
        List<BusinessAccountInterest> found = repository.findByIdIn(unique);
        if (found.isEmpty()) {
            throw new BusinessException(
                    "RECIPIENTS_NOT_FOUND",
                    "No waitlist emails matched the selection.",
                    HttpStatus.BAD_REQUEST);
        }
        repository.deleteAll(found);
        return found.size();
    }

    public SendBusinessInterestEmailResponse sendEmail(SendBusinessInterestEmailRequest request) {
        boolean sendAll = Boolean.TRUE.equals(request.all());
        List<BusinessAccountInterest> recipients;
        if (sendAll) {
            recipients = repository.findAllByOrderByCreatedAtDesc();
        } else {
            List<UUID> ids = request.ids() == null ? List.of() : request.ids();
            if (ids.isEmpty()) {
                throw new BusinessException(
                        "RECIPIENTS_REQUIRED",
                        "Select at least one email, or choose Send all.",
                        HttpStatus.BAD_REQUEST);
            }
            // Preserve request order / uniqueness
            LinkedHashSet<UUID> unique = new LinkedHashSet<>(ids);
            recipients = repository.findByIdIn(unique);
            if (recipients.isEmpty()) {
                throw new BusinessException(
                        "RECIPIENTS_NOT_FOUND",
                        "No waitlist emails matched the selection.",
                        HttpStatus.BAD_REQUEST);
            }
        }
        if (recipients.isEmpty()) {
            throw new BusinessException(
                    "WAITLIST_EMPTY",
                    "There are no waitlist emails to send to.",
                    HttpStatus.BAD_REQUEST);
        }

        String subject = request.subject().trim();
        String body = request.body().trim();
        var rendered = PalpeerEmailTemplates.notification(subject, body);

        int sent = 0;
        int failed = 0;
        List<String> failures = new ArrayList<>();
        for (BusinessAccountInterest interest : recipients) {
            try {
                emailSender.send(
                        interest.getEmail(), rendered.subject(), rendered.text(), rendered.html());
                sent++;
            } catch (Exception ex) {
                failed++;
                failures.add(interest.getEmail());
                log.warn(
                        "Failed to send business waitlist email to {}: {}",
                        interest.getEmail(),
                        ex.toString());
            }
        }
        if (failed > 0 && sent == 0) {
            throw new BusinessException(
                    "EMAIL_SEND_FAILED",
                    "Could not send email to: " + String.join(", ", failures),
                    HttpStatus.BAD_GATEWAY);
        }
        return new SendBusinessInterestEmailResponse(sent, failed);
    }

    private BusinessInterestResponse toResponse(BusinessAccountInterest interest) {
        return new BusinessInterestResponse(
                interest.getId(), interest.getEmail(), interest.getSource(), interest.getCreatedAt());
    }
}
