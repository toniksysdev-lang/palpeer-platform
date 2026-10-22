package com.palpeer.notification.service;

import com.palpeer.common.notify.BroadcastPushEvent;
import com.palpeer.common.notify.UserNotifyEvent;
import com.palpeer.notification.domain.NotificationChannel;
import com.palpeer.notification.web.dto.CreateNotificationRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Delivers {@link UserNotifyEvent} / {@link BroadcastPushEvent} after the source transaction commits
 * so failed money movements never notify. Delivery is {@link Async} so HTTP callers are not blocked
 * by push/email fan-out.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NotifyEventListener {

    private final NotificationService notificationService;

    @Async
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

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onBroadcastPush(BroadcastPushEvent event) {
        if (event == null) {
            return;
        }
        try {
            BroadcastPushStats stats = notificationService.broadcastPush(
                    event.excludeUserId(),
                    event.title(),
                    event.body(),
                    event.category(),
                    event.referenceType(),
                    event.referenceId());
            log.info(
                    "Broadcast push delivered recipients={} devicePush={} failed={} category={} ref={}",
                    stats.recipientCount(),
                    stats.devicePushCount(),
                    stats.failedCount(),
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
