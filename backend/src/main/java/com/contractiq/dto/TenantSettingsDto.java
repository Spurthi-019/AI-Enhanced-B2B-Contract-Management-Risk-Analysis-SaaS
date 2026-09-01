package com.contractiq.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TenantSettingsDto {
    private String companyName;
    private String domain;
    private String aiModel;
    private String riskSensitivity;
    private Integer magicLinkExpiryDays;
    private String webhookUrl;
    private String subscriptionPlan;

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
}
