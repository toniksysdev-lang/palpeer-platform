package com.palpeer.auth.repository;

import com.palpeer.auth.domain.OtpChallenge;
import com.palpeer.auth.domain.OtpChannel;
import com.palpeer.auth.domain.OtpPurpose;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OtpChallengeRepository extends JpaRepository<OtpChallenge, UUID> {

    Optional<OtpChallenge> findFirstByUserIdAndPurposeAndConsumedFalseOrderByCreatedAtDesc(
            UUID userId, OtpPurpose purpose);

    Optional<OtpChallenge>
            findFirstByDestinationAndPurposeAndChannelAndConsumedFalseAndUserIdIsNullOrderByCreatedAtDesc(
                    String destination, OtpPurpose purpose, OtpChannel channel);
}
