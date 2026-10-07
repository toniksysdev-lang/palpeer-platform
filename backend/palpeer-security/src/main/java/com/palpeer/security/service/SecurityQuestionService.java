package com.palpeer.security.service;

import com.palpeer.common.audit.AuditRecord;
import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.security.domain.SecurityQuestion;
import com.palpeer.security.repository.SecurityQuestionRepository;
import com.palpeer.security.web.dto.SecurityAnswerRequest;
import com.palpeer.security.web.dto.SecurityQuestionInput;
import com.palpeer.security.web.dto.SecurityQuestionResponse;
import com.palpeer.security.web.dto.SetSecurityQuestionsRequest;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SecurityQuestionService {

    private final SecurityQuestionRepository securityQuestionRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditRecorder auditRecorder;

    @Transactional
    public List<SecurityQuestionResponse> setQuestions(UUID userId, SetSecurityQuestionsRequest request) {
        // CONTRACT_PENDING (P3-02): required question count — provisional minimum 2
        if (request.questions().size() < 2) {
            throw new BusinessException(
                    "SECURITY_QUESTIONS_MIN",
                    "At least 2 security questions are required (provisional P3-02)",
                    HttpStatus.BAD_REQUEST);
        }

        long distinctKeys = request.questions().stream()
                .map(q -> q.questionKey().trim().toUpperCase(Locale.ROOT))
                .distinct()
                .count();
        if (distinctKeys != request.questions().size()) {
            throw new BusinessException("SECURITY_QUESTIONS_DUPLICATE", "Duplicate questionKey", HttpStatus.BAD_REQUEST);
        }

        securityQuestionRepository.deleteByUserId(userId);
        securityQuestionRepository.flush();

        List<SecurityQuestion> saved = request.questions().stream()
                .map(input -> toEntity(userId, input))
                .map(securityQuestionRepository::save)
                .toList();

        auditRecorder.record(AuditRecord.builder("SECURITY_QUESTIONS_SET")
                .entity("SecurityQuestion:user:" + userId)
                .userRef(userId)
                .newValue("count=" + saved.size())
                .build());
        return saved.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<SecurityQuestionResponse> listQuestions(UUID userId) {
        return securityQuestionRepository.findByUserId(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public void verifyAnswers(UUID userId, List<SecurityAnswerRequest> answers) {
        List<SecurityQuestion> stored = securityQuestionRepository.findByUserId(userId);
        if (stored.isEmpty()) {
            throw new BusinessException("SECURITY_QUESTIONS_NOT_SET", "Security questions not configured", HttpStatus.CONFLICT);
        }

        Map<String, SecurityQuestion> byKey = stored.stream()
                .collect(Collectors.toMap(
                        q -> q.getQuestionKey().toUpperCase(Locale.ROOT),
                        Function.identity()));

        // CONTRACT_PENDING (P3-05): must match all vs subset
        for (SecurityQuestion question : stored) {
            SecurityAnswerRequest match = answers.stream()
                    .filter(a -> question.getQuestionKey().equalsIgnoreCase(a.questionKey()))
                    .findFirst()
                    .orElseThrow(() -> new BusinessException(
                            "SECURITY_ANSWER_MISSING",
                            "Missing answer for question " + question.getQuestionKey(),
                            HttpStatus.BAD_REQUEST));

            if (!passwordEncoder.matches(normalizeAnswer(match.answer()), question.getAnswerHash())) {
                throw new BusinessException("SECURITY_ANSWER_INVALID", "Invalid security answer", HttpStatus.UNAUTHORIZED);
            }
        }

        // Ensure no unknown keys were supplied (optional strictness)
        for (SecurityAnswerRequest answer : answers) {
            if (!byKey.containsKey(answer.questionKey().trim().toUpperCase(Locale.ROOT))) {
                throw new BusinessException(
                        "SECURITY_ANSWER_UNKNOWN",
                        "Unknown questionKey " + answer.questionKey(),
                        HttpStatus.BAD_REQUEST);
            }
        }
    }

    private SecurityQuestion toEntity(UUID userId, SecurityQuestionInput input) {
        SecurityQuestion question = new SecurityQuestion();
        question.setUserId(userId);
        question.setQuestionKey(input.questionKey().trim().toUpperCase(Locale.ROOT));
        question.setQuestionText(input.questionText().trim());
        question.setAnswerHash(passwordEncoder.encode(normalizeAnswer(input.answer())));
        return question;
    }

    private SecurityQuestionResponse toResponse(SecurityQuestion question) {
        return new SecurityQuestionResponse(question.getId(), question.getQuestionKey(), question.getQuestionText());
    }

    private static String normalizeAnswer(String answer) {
        return answer.trim().toLowerCase(Locale.ROOT);
    }
}
