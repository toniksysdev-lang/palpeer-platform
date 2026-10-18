package com.palpeer.profile.repository;

import com.palpeer.profile.domain.Profile;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProfileRepository extends JpaRepository<Profile, UUID> {

    Optional<Profile> findByUserId(UUID userId);

    List<Profile> findByUserIdIn(Collection<UUID> userIds);

    boolean existsByUserId(UUID userId);
}
