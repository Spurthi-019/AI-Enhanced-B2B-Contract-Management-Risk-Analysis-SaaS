package com.contractiq.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ContractSummary {
    private String summaryText;
    private String overallRiskLevel;
}
