package com.contractiq.domain;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "tenants")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Tenant {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(columnDefinition = "UUID")
    private UUID id;

    @Column(nullable = false)
    private String name;

    private String companyName;
    private String domain;

    @Column(name = "ai_model")
    private String aiModel = "llama3";

    @Column(name = "risk_sensitivity")
    private String riskSensitivity = "MEDIUM";

    @Column(name = "magic_link_expiry_days")
    private Integer magicLinkExpiryDays = 7;

    private String webhookUrl;

    @Column(name = "subscription_plan")
    private String subscriptionPlan = "FREE";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }

    public String getDomain() { return domain; }
    public void setDomain(String domain) { this.domain = domain; }

    public String getAiModel() { return aiModel; }
    public void setAiModel(String aiModel) { this.aiModel = aiModel; }

    public String getRiskSensitivity() { return riskSensitivity; }
    public void setRiskSensitivity(String riskSensitivity) { this.riskSensitivity = riskSensitivity; }

    public Integer getMagicLinkExpiryDays() { return magicLinkExpiryDays; }
    public void setMagicLinkExpiryDays(Integer magicLinkExpiryDays) { this.magicLinkExpiryDays = magicLinkExpiryDays; }

    public String getWebhookUrl() { return webhookUrl; }
    public void setWebhookUrl(String webhookUrl) { this.webhookUrl = webhookUrl; }

    public String getSubscriptionPlan() { return subscriptionPlan; }
    public void setSubscriptionPlan(String subscriptionPlan) { this.subscriptionPlan = subscriptionPlan; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
