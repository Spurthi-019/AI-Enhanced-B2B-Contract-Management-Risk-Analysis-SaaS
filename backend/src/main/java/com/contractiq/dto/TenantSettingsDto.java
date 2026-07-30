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
}
