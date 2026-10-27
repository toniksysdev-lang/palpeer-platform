package com.palpeer.auth.ratelimit;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;

class AuthRateLimiterTest {

    private AuthRateLimiter limiter;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        ObjectProvider<StringRedisTemplate> redis = mock(ObjectProvider.class);
        when(redis.getIfAvailable()).thenReturn(null);
        limiter = new AuthRateLimiter(redis);
    }

    @Test
    void allowsUpToLimitThenBlocks() {
        String key = "login:127.0.0.1";
        Duration window = Duration.ofMinutes(1);

        assertTrue(limiter.tryAcquire(key, 3, window));
        assertTrue(limiter.tryAcquire(key, 3, window));
        assertTrue(limiter.tryAcquire(key, 3, window));
        assertFalse(limiter.tryAcquire(key, 3, window));
    }

    @Test
    void separateKeysAreIndependent() {
        Duration window = Duration.ofMinutes(1);

        assertTrue(limiter.tryAcquire("a", 1, window));
        assertFalse(limiter.tryAcquire("a", 1, window));
        assertTrue(limiter.tryAcquire("b", 1, window));
    }
}
