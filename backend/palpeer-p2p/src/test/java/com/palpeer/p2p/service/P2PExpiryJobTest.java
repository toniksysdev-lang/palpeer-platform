package com.palpeer.p2p.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class P2PExpiryJobTest {

    @Mock private P2PService p2PService;

    @InjectMocks private P2PExpiryJob job;

    @Test
    void expiresEachDueRequestAndKeepsGoingAfterAFailure() {
        UUID failing = UUID.randomUUID();
        UUID due = UUID.randomUUID();
        when(p2PService.findExpiredOpenIds(any())).thenReturn(List.of(failing, due));
        when(p2PService.expireIfDue(failing)).thenThrow(new IllegalStateException("lock timeout"));
        when(p2PService.expireIfDue(due)).thenReturn(true);

        job.sweep();

        verify(p2PService).expireIfDue(failing);
        verify(p2PService).expireIfDue(due);
    }
}
