package com.palpeer.admin.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.palpeer.common.api.ApiError;
import com.palpeer.common.api.ApiResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Optional network gate for {@code /api/v1/admin/**}.
 *
 * <p>When {@code ADMIN_IP_ALLOWLIST} is empty, this filter is a no-op. When set to a
 * comma-separated list of IPv4 addresses or CIDRs (e.g. {@code 203.0.113.10,198.51.100.0/24}),
 * requests whose client IP (first {@code X-Forwarded-For} hop, else remote addr) is not on the
 * list receive {@code 403}. Does not protect the admin static SPA — pair with Cloudflare Access
 * or DNS/WAF on {@code admin.palpeer.com}.
 */
public class AdminIpAllowlistFilter extends OncePerRequestFilter {

    private static final String ADMIN_PREFIX = "/api/v1/admin";

    private final ObjectMapper objectMapper;
    private final List<Cidr> allowlist;

    public AdminIpAllowlistFilter(ObjectMapper objectMapper, String allowlistCsv) {
        this.objectMapper = objectMapper;
        this.allowlist = parseAllowlist(allowlistCsv);
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        if (allowlist.isEmpty()) {
            return true;
        }
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String path = request.getRequestURI();
        return path == null || !path.startsWith(ADMIN_PREFIX);
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain)
            throws ServletException, IOException {
        String clientIp = clientIp(request);
        if (isAllowed(clientIp)) {
            filterChain.doFilter(request, response);
            return;
        }
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        ApiError error = ApiError.builder()
                .code("ADMIN_IP_DENIED")
                .detail("Admin API is not available from this network.")
                .build();
        objectMapper.writeValue(
                response.getOutputStream(),
                ApiResponse.fail("Admin API is not available from this network.", error));
    }

    private boolean isAllowed(String clientIp) {
        if (clientIp == null || clientIp.isBlank() || "unknown".equalsIgnoreCase(clientIp)) {
            return false;
        }
        InetAddress addr;
        try {
            addr = InetAddress.getByName(clientIp.trim());
        } catch (UnknownHostException e) {
            return false;
        }
        for (Cidr cidr : allowlist) {
            if (cidr.contains(addr)) {
                return true;
            }
        }
        return false;
    }

    static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            int comma = forwarded.indexOf(',');
            return (comma > 0 ? forwarded.substring(0, comma) : forwarded).trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr() == null ? "unknown" : request.getRemoteAddr();
    }

    static List<Cidr> parseAllowlist(String csv) {
        if (csv == null || csv.isBlank()) {
            return List.of();
        }
        List<Cidr> out = new ArrayList<>();
        for (String raw : csv.split(",")) {
            String entry = raw.trim();
            if (entry.isEmpty()) {
                continue;
            }
            try {
                out.add(Cidr.parse(entry));
            } catch (IllegalArgumentException | UnknownHostException ignored) {
                // Skip malformed entries rather than locking everyone out on boot.
            }
        }
        return List.copyOf(out);
    }

    record Cidr(byte[] network, int prefixLength) {
        static Cidr parse(String entry) throws UnknownHostException {
            String value = entry.trim().toLowerCase(Locale.ROOT);
            int slash = value.indexOf('/');
            String hostPart = slash >= 0 ? value.substring(0, slash) : value;
            InetAddress addr = InetAddress.getByName(hostPart);
            byte[] bytes = addr.getAddress();
            int maxPrefix = bytes.length * 8;
            int prefix = slash >= 0 ? Integer.parseInt(value.substring(slash + 1)) : maxPrefix;
            if (prefix < 0 || prefix > maxPrefix) {
                throw new IllegalArgumentException("Invalid prefix: " + entry);
            }
            return new Cidr(mask(bytes, prefix), prefix);
        }

        boolean contains(InetAddress candidate) {
            byte[] bytes = candidate.getAddress();
            if (bytes.length != network.length) {
                return false;
            }
            return Arrays.equals(mask(bytes, prefixLength), network);
        }

        private static byte[] mask(byte[] address, int prefixLength) {
            byte[] out = Arrays.copyOf(address, address.length);
            int fullBytes = prefixLength / 8;
            int remBits = prefixLength % 8;
            for (int i = fullBytes + (remBits > 0 ? 1 : 0); i < out.length; i++) {
                out[i] = 0;
            }
            if (remBits > 0 && fullBytes < out.length) {
                int keep = 0xFF << (8 - remBits);
                out[fullBytes] = (byte) (out[fullBytes] & keep);
            }
            return out;
        }
    }
}
