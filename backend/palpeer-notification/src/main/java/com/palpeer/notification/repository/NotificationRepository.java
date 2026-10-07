package com.palpeer.notification.repository;

import com.palpeer.notification.domain.Notification;
import com.palpeer.notification.domain.NotificationStatus;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    Optional<Notification> findByIdAndUserId(UUID id, UUID userId);

    Page<Notification> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    Page<Notification> findByUserIdAndStatusOrderByCreatedAtDesc(
            UUID userId, NotificationStatus status, Pageable pageable);

    long countByUserIdAndStatus(UUID userId, NotificationStatus status);
}
