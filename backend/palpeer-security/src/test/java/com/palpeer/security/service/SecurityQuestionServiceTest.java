package com.palpeer.security.service;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.palpeer.common.audit.AuditRecorder;
import com.palpeer.common.exception.BusinessException;
import com.palpeer.security.domain.SecurityQuestion;
import com.palpeer.security.repository.SecurityQuestionRepository;
import com.palpeer.security.web.dto.SecurityAnswerRequest;
import com.palpeer.security.web.dto.SecurityQuestionInput;
import com.palpeer.security.web.dto.SetSecurityQuestionsRequest;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class SecurityQuestionServiceTest {

    @Mock private SecurityQuestionRepository repository;
    @Mock private AuditRecorder auditRecorder;

    private PasswordEncoder passwordEncoder;
    private SecurityQuestionService service;
    private UUID userId;

    @BeforeEach
    void setUp() {
        passwordEncoder = new BCryptPasswordEncoder();
        service = new SecurityQuestionService(repository, passwordEncoder, auditRecorder);
        userId = UUID.randomUUID();
    }

    @Test
    void setQuestionsHashesNormalizedAnswers() {
        when(repository.save(any(SecurityQuestion.class))).thenAnswer(invocation -> {
            SecurityQuestion question = invocation.getArgument(0);
            if (question.getId() == null) {
                question.setId(UUID.randomUUID());
            }
            return question;
        });

        service.setQuestions(
                userId,
                new SetSecurityQuestionsRequest(List.of(
                        new SecurityQuestionInput("FIRST_PET", "First pet?", "  Rex "),
                        new SecurityQuestionInput("BIRTH_TOWN", "Birth town?", "Lagos"))));

        ArgumentCaptor<SecurityQuestion> captor = ArgumentCaptor.forClass(SecurityQuestion.class);
        verify(repository, org.mockito.Mockito.times(2)).save(captor.capture());
        SecurityQuestion pet = captor.getAllValues().stream()
                .filter(q -> q.getQuestionKey().equals("FIRST_PET"))
                .findFirst()
                .orElseThrow();
        assertThatCode(() -> {
            if (!passwordEncoder.matches("rex", pet.getAnswerHash())) {
                throw new AssertionError("expected normalized answer to match");
            }
            if (passwordEncoder.matches("wrong", pet.getAnswerHash())) {
                throw new AssertionError("wrong answer must not match");
            }
        }).doesNotThrowAnyException();
    }

    @Test
    void verifyAnswersRejectsWrongAnswer() {
        SecurityQuestion pet = stored("FIRST_PET", "First pet?", "rex");
        SecurityQuestion town = stored("BIRTH_TOWN", "Birth town?", "lagos");
        when(repository.findByUserId(userId)).thenReturn(List.of(pet, town));

        assertThatThrownBy(() -> service.verifyAnswers(
                        userId,
                        List.of(
                                new SecurityAnswerRequest("FIRST_PET", "rex"),
                                new SecurityAnswerRequest("BIRTH_TOWN", "abuja"))))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> {
                    BusinessException business = (BusinessException) ex;
                    org.assertj.core.api.Assertions.assertThat(business.getCode())
                            .isEqualTo("SECURITY_ANSWER_INVALID");
                    org.assertj.core.api.Assertions.assertThat(business.getStatus())
                            .isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
                });
    }

    @Test
    void verifyAnswersAcceptsOnlySavedNormalizedAnswers() {
        SecurityQuestion pet = stored("FIRST_PET", "First pet?", "rex");
        SecurityQuestion town = stored("BIRTH_TOWN", "Birth town?", "lagos");
        when(repository.findByUserId(userId)).thenReturn(List.of(pet, town));

        assertThatCode(() -> service.verifyAnswers(
                        userId,
                        List.of(
                                new SecurityAnswerRequest("FIRST_PET", "  REX "),
                                new SecurityAnswerRequest("BIRTH_TOWN", "Lagos"))))
                .doesNotThrowAnyException();
        verify(repository, never()).save(any());
    }

    private SecurityQuestion stored(String key, String text, String rawAnswer) {
        SecurityQuestion question = new SecurityQuestion();
        question.setId(UUID.randomUUID());
        question.setUserId(userId);
        question.setQuestionKey(key);
        question.setQuestionText(text);
        question.setAnswerHash(passwordEncoder.encode(rawAnswer));
        return question;
    }
}
