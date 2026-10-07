package com.palpeer.negotiation.repository;

import com.palpeer.negotiation.domain.NegotiationOffer;
import com.palpeer.negotiation.domain.NegotiationOfferStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface NegotiationOfferRepository extends JpaRepository<NegotiationOffer, UUID> {

    List<NegotiationOffer> findByNegotiationIdOrderByCreatedAtAsc(UUID negotiationId);

    Optional<NegotiationOffer> findByIdAndNegotiationId(UUID id, UUID negotiationId);

    List<NegotiationOffer> findByNegotiationIdAndStatus(UUID negotiationId, NegotiationOfferStatus status);
}
