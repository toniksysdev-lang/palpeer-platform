package com.palpeer.user.repository;

import com.palpeer.user.domain.User;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface UserRepository extends JpaRepository<User, UUID>, JpaSpecificationExecutor<User> {

    Optional<User> findByEmailIgnoreCase(String email);

    Optional<User> findByPhone(String phone);

    Optional<User> findByGoogleSub(String googleSub);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByPhone(String phone);
}
