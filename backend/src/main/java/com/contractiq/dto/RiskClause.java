package com.contractiq.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RiskClause {
    private String title;
    private String riskLevel; // LOW, MEDIUM, HIGH
    private String clauseText;
    private String mitigation;
}
