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

    public String getGdprStatus() { return gdprStatus; }
    public void setGdprStatus(String gdprStatus) { this.gdprStatus = gdprStatus; }

    public String getGdprDetails() { return gdprDetails; }
    public void setGdprDetails(String gdprDetails) { this.gdprDetails = gdprDetails; }

    public String getIndemnityStatus() { return indemnityStatus; }
    public void setIndemnityStatus(String indemnityStatus) { this.indemnityStatus = indemnityStatus; }

    public String getIndemnityDetails() { return indemnityDetails; }
    public void setIndemnityDetails(String indemnityDetails) { this.indemnityDetails = indemnityDetails; }

    public String getLiabilityStatus() { return liabilityStatus; }
    public void setLiabilityStatus(String liabilityStatus) { this.liabilityStatus = liabilityStatus; }

    public String getLiabilityDetails() { return liabilityDetails; }
    public void setLiabilityDetails(String liabilityDetails) { this.liabilityDetails = liabilityDetails; }

    public String getGovLawStatus() { return govLawStatus; }
    public void setGovLawStatus(String govLawStatus) { this.govLawStatus = govLawStatus; }

    public String getGovLawDetails() { return govLawDetails; }
    public void setGovLawDetails(String govLawDetails) { this.govLawDetails = govLawDetails; }
}
