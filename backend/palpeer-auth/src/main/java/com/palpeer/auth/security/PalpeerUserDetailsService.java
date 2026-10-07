package com.palpeer.auth.security;

import com.palpeer.user.domain.User;
import com.palpeer.user.repository.UserRepository;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PalpeerUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;
    private final List<AuthorityEnricher> authorityEnrichers;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findByEmailIgnoreCase(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        return toPrincipal(user);
    }

    public UserDetails loadUserById(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        return toPrincipal(user);
    }

    private UserPrincipal toPrincipal(User user) {
        return new UserPrincipal(user, UserPrincipal.mergeBaseAndEnrichers(user, authorityEnrichers));
    }
}
