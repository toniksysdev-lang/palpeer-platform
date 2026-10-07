package com.palpeer.admin.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.palpeer.admin.web.dto.UpdateUserAdminRequest;
import com.palpeer.common.exception.ResourceNotFoundException;
import com.palpeer.user.domain.User;
import com.palpeer.user.domain.UserStatus;
import com.palpeer.user.repository.UserRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AdminUserServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private com.palpeer.admin.repository.AdminUserRepository adminUserRepository;
    @Mock private com.palpeer.common.audit.AuditRecorder auditRecorder;
    @InjectMocks private AdminUserService adminUserService;

    @Test
    void updateUser_suspendsAndDisables() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setEmail("a@b.com");
        user.setPhone("+1");
        user.setStatus(UserStatus.ACTIVE);
        user.setEnabled(true);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        var response = adminUserService.updateUser(userId, new UpdateUserAdminRequest(UserStatus.SUSPENDED, null));

        assertThat(response.status()).isEqualTo(UserStatus.SUSPENDED);
        assertThat(response.enabled()).isFalse();
        verify(userRepository).save(user);
    }

    @Test
    void getUser_requiresExisting() {
        UUID userId = UUID.randomUUID();
        when(userRepository.findById(userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminUserService.getUser(userId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void getUser_hidesAdminAccounts() {
        UUID userId = UUID.randomUUID();
        when(adminUserRepository.existsByUserId(userId)).thenReturn(true);

        assertThatThrownBy(() -> adminUserService.getUser(userId))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
