package com.palpeer.p2p.repository;

import com.palpeer.p2p.domain.P2POrder;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

@Repository
public interface P2POrderRepository extends JpaRepository<P2POrder, UUID>, JpaSpecificationExecutor<P2POrder> {

    Optional<P2POrder> findById(UUID id);

    List<P2POrder> findByRequestId(UUID requestId);

    List<P2POrder> findByRequesterIdOrAcceptorIdOrderByCreatedAtDesc(UUID requesterId, UUID acceptorId);
}
