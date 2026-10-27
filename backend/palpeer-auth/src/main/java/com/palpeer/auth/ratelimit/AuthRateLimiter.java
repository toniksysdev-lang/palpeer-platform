package com.palpeer.auth.ratelimit;

import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Sliding-window rate limiter. Prefers Redis when available (multi-instance safe); falls back to
 * in-memory for local/dev when Redis auto-config is off or Redis is unreachable.
 */
@Slf4j
@Component
public class AuthRateLimiter {

    private static final String KEY_PREFIX = "palpeer:auth-rl:";

    private final ObjectProvider<StringRedisTemplate> redisTemplate;
    private final Map<String, Deque<Long>> windows = new ConcurrentHashMap<>();

    public AuthRateLimiter(ObjectProvider<StringRedisTemplate> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    /**
     * @return true if the call is allowed; false if the limit is exceeded
     */
    public boolean tryAcquire(String key, int limit, Duration window) {
        if (limit <= 0) {
            return true;
        }
        StringRedisTemplate redis = redisTemplate.getIfAvailable();
        if (redis != null) {
            try {
                return tryAcquireRedis(redis, key, limit, window);
            } catch (Exception ex) {
                log.warn("Redis rate-limit failed; falling back to in-memory: {}", ex.toString());
            }
        }
        return tryAcquireMemory(key, limit, window);
    }

    private boolean tryAcquireRedis(StringRedisTemplate redis, String key, int limit, Duration window) {
        String redisKey = KEY_PREFIX + key;
        Long count = redis.opsForValue().increment(redisKey);
        if (count != null && count == 1L) {
            redis.expire(redisKey, window);
        }
        return count == null || count <= limit;
    }

    private boolean tryAcquireMemory(String key, int limit, Duration window) {
        long now = System.currentTimeMillis();
        long cutoff = now - window.toMillis();
        Deque<Long> timestamps = windows.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (timestamps) {
            while (!timestamps.isEmpty() && timestamps.peekFirst() < cutoff) {
                timestamps.pollFirst();
            }
            if (timestamps.size() >= limit) {
                return false;
            }
            timestamps.addLast(now);
            return true;
        }
    }

    /** Best-effort cleanup for the in-memory fallback. */
    public void evictIdle(Duration idleOlderThan) {
        long cutoff = System.currentTimeMillis() - idleOlderThan.toMillis();
        Iterator<Map.Entry<String, Deque<Long>>> it = windows.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<String, Deque<Long>> entry = it.next();
            Deque<Long> timestamps = entry.getValue();
            synchronized (timestamps) {
                while (!timestamps.isEmpty() && timestamps.peekFirst() < cutoff) {
                    timestamps.pollFirst();
                }
                if (timestamps.isEmpty()) {
                    it.remove();
                }
            }
        }
    }
}
