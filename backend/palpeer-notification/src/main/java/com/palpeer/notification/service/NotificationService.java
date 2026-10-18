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
import java.util.ArrayList;
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

    /**
     * Push + in-app notification for every user (optionally excluding one actor).
     * Failures for individual recipients are logged and do not abort the broadcast.
     */
    @Transactional
    public int broadcastPush(
            UUID excludeUserId,
            String title,
            String body,
            String category,
            String referenceType,
            UUID referenceId) {
        List<UUID> userIds = userRepository.findAllIds();
        int sent = 0;
        for (UUID userId : userIds) {
            if (excludeUserId != null && excludeUserId.equals(userId)) {
                continue;
            }
            try {
                create(
                        userId,
                        new CreateNotificationRequest(
                                title, body, category, NotificationChannel.PUSH, referenceType, referenceId));
                sent++;
            } catch (RuntimeException ex) {
                log.warn("Broadcast push failed for user {}: {}", userId, ex.getMessage());
            }
        }
        return sent;
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

        List<String> failures = new ArrayList<>();
        boolean emailOk = true;
        boolean pushOk = true;

        if (channel == NotificationChannel.EMAIL || channel == NotificationChannel.BOTH) {
            emailOk = deliverEmail(notification, failures);
        }

        if (channel == NotificationChannel.PUSH || channel == NotificationChannel.BOTH) {
            pushOk = deliverPush(notification, failures);
        }

        if (channel == NotificationChannel.EMAIL) {
            if (emailOk) {
                markSent(notification, null);
            } else {
                markFailed(notification, joinFailures(failures));
            }
            return;
        }

        if (channel == NotificationChannel.PUSH) {
            if (pushOk) {
                markSent(notification, null);
            } else {
                markFailed(notification, joinFailures(failures));
            }
            return;
        }

        // BOTH: keep in-app as SENT when either channel works; record partial failures
        if (emailOk || pushOk) {
            markSent(notification, failures.isEmpty() ? null : joinFailures(failures));
        } else {
            markFailed(notification, joinFailures(failures));
        }
    }

    /** @return true when email was accepted by the sender */
    private boolean deliverEmail(Notification notification, List<String> failures) {
        User user = userRepository.findById(notification.getUserId()).orElse(null);
        if (user == null || user.getEmail() == null || user.getEmail().isBlank()) {
            failures.add("User email not found");
            return false;
        }
        try {
            var rendered =
                    PalpeerEmailTemplates.notification(notification.getTitle(), notification.getBody());
            emailSender.send(user.getEmail(), rendered.subject(), rendered.text(), rendered.html());
            return true;
        } catch (RuntimeException ex) {
            log.warn("Email delivery failed for notification {}: {}", notification.getId(), ex.getMessage());
            failures.add(truncate(ex.getMessage(), 200));
            return false;
        }
    }

    /** @return true when at least one device token was notified */
    private boolean deliverPush(Notification notification, List<String> failures) {
        List<DeviceToken> tokens = deviceTokenRepository.findByUserIdAndEnabledTrue(notification.getUserId());
        if (tokens.isEmpty()) {
            failures.add("No enabled device tokens");
            return false;
        }
        try {
            for (DeviceToken token : tokens) {
                pushNotifier.send(token, notification);
            }
            return true;
        } catch (RuntimeException ex) {
            log.warn("Push delivery failed for notification {}: {}", notification.getId(), ex.getMessage());
            failures.add(truncate(ex.getMessage(), 200));
            return false;
        }
    }

    private void markSent(Notification notification, String failureReason) {
        notification.setStatus(NotificationStatus.SENT);
        notification.setSentAt(Instant.now());
        notification.setFailureReason(failureReason);
        notificationRepository.save(notification);
    }

    private void markFailed(Notification notification, String failureReason) {
        notification.setStatus(NotificationStatus.FAILED);
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

    private static String joinFailures(List<String> failures) {
        if (failures == null || failures.isEmpty()) {
            return null;
        }
        return truncate(String.join("; ", failures), 500);
    }
}
