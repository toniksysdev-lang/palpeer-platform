package com.palpeer.admin.web.dto;

import com.palpeer.p2p.domain.P2PStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateP2PStatusRequest(
        @NotNull P2PStatus status
) {
}
