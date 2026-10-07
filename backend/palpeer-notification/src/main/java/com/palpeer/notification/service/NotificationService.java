package com.palpeer.notification.service;

import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.common.mail.EmailSender;
import com.palpeer.common.mail.PalpeerEmailTemplates;
import com.palpeer.notification.domain.DeviceToken;
import com.palpeer.notification.domain.Notification;
import com.palpeer.notification.domain.NotificationChannel;
import com.palpeer.notification.domain.NotificationStatus;
import com.palpeer.notification.push.PushNotifier;
import com.palpeer.notification.repository.DeviceTokenRepository;
import com.palpeer.notification.repository.NotificationRepository;
import com.palpeer.notification.web.dto.CreateNotificationRequest;
import com.palpeer.notification.web.dto.NotificationResponse;
import com.palpeer.user.domain.User;
import com.palpeer.user.repository.UserRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final DeviceTokenRepository deviceTokenRepository;
    private final PushNotifier pushNotifier;
    private final EmailSender emailSender;
    private final UserRepository userRepository;

    /**
     * Create and optionally push/email a notification for a user.
     * Intended for internal module callers until admin RBAC (P12-06 / Phase 15).
     */
    @Transactional
    public NotificationResponse create(UUID userId, CreateNotificationRequest request) {
        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setTitle(request.title().trim());
        notification.setBody(request.body().trim());
        notification.setCategory(trimToNull(request.category()));
        notification.setChannel(request.channel());
        notification.setReferenceType(trimToNull(request.referenceType()));
        notification.setReferenceId(request.referenceId());
        notification.setStatus(NotificationStatus.PENDING);
        notificationRepository.save(notification);

        deliverIfNeeded(notification);
        return toResponse(notification);
    }

    @Transactional(readOnly = true)
    public Page<NotificationResponse> list(UUID userId, NotificationStatus status, Pageable pageable) {
        Page<Notification> page = status == null
                ? notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
                : notificationRepository.findByUserIdAndStatusOrderByCreatedAtDesc(userId, status, pageable);
        return page.map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public NotificationResponse get(UUID userId, UUID notificationId) {
        return toResponse(requireOwned(userId, notificationId));
    }

    @Transactional
    public NotificationResponse markRead(UUID userId, UUID notificationId) {
        Notification notification = requireOwned(userId, notificationId);
        if (notification.getStatus() != NotificationStatus.READ) {
            notification.setStatus(NotificationStatus.READ);
            notification.setReadAt(Instant.now());
            notificationRepository.save(notification);
        }
        return toResponse(notification);
    }

    @Transactional(readOnly = true)
    public long unreadCount(UUID userId) {
        return notificationRepository.countByUserIdAndStatus(userId, NotificationStatus.SENT)
                + notificationRepository.countByUserIdAndStatus(userId, NotificationStatus.PENDING);
    }

    /**
     * Admin inventory — recent notifications across users (JpaRepository findAll pageable).
     * No broadcast/create endpoint (P12-06).
     */
    @Transactional(readOnly = true)
    public Page<NotificationResponse> adminList(Pageable pageable) {
        return notificationRepository.findAll(pageable).map(this::toResponse);
    }

    private void deliverIfNeeded(Notification notification) {
        NotificationChannel channel = notification.getChannel();
        if (channel == NotificationChannel.IN_APP) {
            markSent(notification, null);
            return;
        }

        if (channel == NotificationChannel.EMAIL) {
            deliverEmail(notification);
            return;
        }

        // PUSH or BOTH (in-app + push)
        List<DeviceToken> tokens = deviceTokenRepository.findByUserIdAndEnabledTrue(notification.getUserId());
        if (tokens.isEmpty()) {
            if (channel == NotificationChannel.PUSH) {
                notification.setStatus(NotificationStatus.FAILED);
                notification.setFailureReason("No enabled device tokens");
                notificationRepository.save(notification);
            } else {
                markSent(notification, "No enabled device tokens for push");
            }
            return;
        }

        try {
            for (DeviceToken token : tokens) {
                pushNotifier.send(token, notification);
            }
            markSent(notification, null);
        } catch (RuntimeException ex) {
            log.warn("Push delivery failed for notification {}: {}", notification.getId(), ex.getMessage());
            notification.setStatus(NotificationStatus.FAILED);
            notification.setFailureReason(truncate(ex.getMessage(), 500));
            notificationRepository.save(notification);
        }
    }

    private void deliverEmail(Notification notification) {
        User user = userRepository.findById(notification.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found for notification"));
        try {
            var rendered =
                    PalpeerEmailTemplates.notification(notification.getTitle(), notification.getBody());
            emailSender.send(user.getEmail(), rendered.subject(), rendered.text(), rendered.html());
            markSent(notification, null);
        } catch (RuntimeException ex) {
            log.warn("Email delivery failed for notification {}: {}", notification.getId(), ex.getMessage());
            notification.setStatus(NotificationStatus.FAILED);
            notification.setFailureReason(truncate(ex.getMessage(), 500));
            notificationRepository.save(notification);
        }
    }

    private void markSent(Notification notification, String failureReason) {
        notification.setStatus(NotificationStatus.SENT);
        notification.setSentAt(Instant.now());
        notification.setFailureReason(failureReason);
        notificationRepository.save(notification);
    }

    private Notification requireOwned(UUID userId, UUID notificationId) {
        return notificationRepository.findByIdAndUserId(notificationId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));
    }

    private NotificationResponse toResponse(Notification notification) {
        return new NotificationResponse(
                notification.getId(),
                notification.getTitle(),
                notification.getBody(),
                notification.getCategory(),
                notification.getChannel(),
                notification.getStatus(),
                notification.getReferenceType(),
                notification.getReferenceId(),
                notification.getReadAt(),
                notification.getSentAt(),
                notification.getFailureReason(),
                notification.getCreatedAt());
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}
