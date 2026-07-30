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
}
