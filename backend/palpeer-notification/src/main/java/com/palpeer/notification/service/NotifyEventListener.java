package com.palpeer.notification.service;

import com.palpeer.common.notify.BroadcastPushEvent;
import com.palpeer.common.notify.UserNotifyEvent;
import com.palpeer.notification.domain.NotificationChannel;
import com.palpeer.notification.web.dto.CreateNotificationRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Delivers {@link UserNotifyEvent} / {@link BroadcastPushEvent} after the source transaction commits
 * so failed money movements never notify.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NotifyEventListener {

    private final NotificationService notificationService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onUserNotify(UserNotifyEvent event) {
        if (event == null || event.userId() == null) {
            return;
        }
        try {
            notificationService.create(
                    event.userId(),
                    new CreateNotificationRequest(
                            event.title(),
                            event.body(),
                            event.category(),
                            resolveChannel(event.sendEmail(), event.sendPush()),
                            event.referenceType(),
                            event.referenceId()));
        } catch (RuntimeException ex) {
            log.warn(
                    "User notify failed user={} ref={}: {}",
                    event.userId(),
                    event.referenceType(),
                    ex.getMessage());
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onBroadcastPush(BroadcastPushEvent event) {
        if (event == null) {
            return;
        }
        try {
            int count = notificationService.broadcastPush(
                    event.excludeUserId(),
                    event.title(),
                    event.body(),
                    event.category(),
                    event.referenceType(),
                    event.referenceId());
            log.info(
                    "Broadcast push delivered count={} category={} ref={}",
                    count,
                    event.category(),
                    event.referenceId());
        } catch (RuntimeException ex) {
            log.warn("Broadcast push failed ref={}: {}", event.referenceId(), ex.getMessage());
        }
    }

    private static NotificationChannel resolveChannel(boolean email, boolean push) {
        if (email && push) {
            return NotificationChannel.BOTH;
        }
        if (email) {
            return NotificationChannel.EMAIL;
        }
        if (push) {
            return NotificationChannel.PUSH;
        }
        return NotificationChannel.IN_APP;
    }
}
