package com.contractiq.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Service
public class VendorTokenService {

    private static final String DEFAULT_SECRET = "your_secure_base64_jwt_signing_key_here_must_be_at_least_256_bits";
    private static final long EXPIRATION_7_DAYS_MS = 7L * 24 * 60 * 60 * 1000; // 7 days in milliseconds

    @Value("${security.jwt.secret:}")
    private String configuredSecret;

    private SecretKey getSigningKey() {
        String secret = (configuredSecret != null && !configuredSecret.trim().isEmpty()) 
                ? configuredSecret 
                : DEFAULT_SECRET;
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateVendorToken(String contractId, String tenantId, String vendorEmail) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("contractId", contractId);
        claims.put("tenantId", tenantId);
        claims.put("vendorEmail", vendorEmail);
        claims.put("isVendor", true);

        return Jwts.builder()
                .claims(claims)
                .subject(vendorEmail)
                .issuedAt(new Date(System.currentTimeMillis()))
                .expiration(new Date(System.currentTimeMillis() + EXPIRATION_7_DAYS_MS))
                .signWith(getSigningKey(), Jwts.SIG.HS256)
                .compact();
    }

    public Claims parseVendorToken(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid or expired vendor token", e);
        }
    }
}
