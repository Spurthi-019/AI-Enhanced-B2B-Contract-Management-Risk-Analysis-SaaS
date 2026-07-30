package com.contractiq.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ComplianceChecklist {
    private String gdprStatus; // "VERIFIED", "RISK_FLAGGED", "MISSING"
    private String gdprDetails;
    private String indemnityStatus; // "VERIFIED", "RISK_FLAGGED", "MISSING"
    private String indemnityDetails;
    private String liabilityStatus; // "VERIFIED", "RISK_FLAGGED", "MISSING"
    private String liabilityDetails;
    private String govLawStatus; // "VERIFIED", "RISK_FLAGGED", "MISSING"
    private String govLawDetails;
}
