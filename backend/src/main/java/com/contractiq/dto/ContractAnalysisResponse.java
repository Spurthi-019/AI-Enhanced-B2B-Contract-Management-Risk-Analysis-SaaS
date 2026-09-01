package com.contractiq.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ContractAnalysisResponse {
    private ContractSummary summary;
    private List<RiskClause> riskClauses;
    private String expirationDate;
    private List<String> keyTerms;
    private ComplianceChecklist complianceChecklist;

    public ContractSummary getSummary() { return summary; }
    public void setSummary(ContractSummary summary) { this.summary = summary; }

    public List<RiskClause> getRiskClauses() { return riskClauses; }
    public void setRiskClauses(List<RiskClause> riskClauses) { this.riskClauses = riskClauses; }

    public String getExpirationDate() { return expirationDate; }
    public void setExpirationDate(String expirationDate) { this.expirationDate = expirationDate; }

    public List<String> getKeyTerms() { return keyTerms; }
    public void setKeyTerms(List<String> keyTerms) { this.keyTerms = keyTerms; }

    public ComplianceChecklist getComplianceChecklist() { return complianceChecklist; }
    public void setComplianceChecklist(ComplianceChecklist complianceChecklist) { this.complianceChecklist = complianceChecklist; }
}
