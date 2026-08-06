package com.contractiq.domain;

public enum SubscriptionPlan {
    FREE(
            2, // max contracts
            2, // max users
            "BASIC", // ai analysis level
            false, // contract chat
            "BASIC", // risk reports
            7, // audit log retention days
            false // priority support
    ),
    PRO(
            100,
            20,
            "ADVANCED",
            true,
            "DETAILED",
            365,
            false
    ),
    ENTERPRISE(
            Integer.MAX_VALUE,
            Integer.MAX_VALUE,
            "FULL",
            true,
            "ADVANCED",
            Integer.MAX_VALUE,
            true
    );

    private final int maxContracts;
    private final int maxUsers;
    private final String aiAnalysisLevel;
    private final boolean contractChatEnabled;
    private final String riskReportLevel;
    private final int auditLogRetentionDays;
    private final boolean prioritySupport;

    SubscriptionPlan(int maxContracts, int maxUsers, String aiAnalysisLevel, boolean contractChatEnabled,
                     String riskReportLevel, int auditLogRetentionDays, boolean prioritySupport) {
        this.maxContracts = maxContracts;
        this.maxUsers = maxUsers;
        this.aiAnalysisLevel = aiAnalysisLevel;
        this.contractChatEnabled = contractChatEnabled;
        this.riskReportLevel = riskReportLevel;
        this.auditLogRetentionDays = auditLogRetentionDays;
        this.prioritySupport = prioritySupport;
    }

    public int getMaxContracts() { return maxContracts; }
    public int getMaxUsers() { return maxUsers; }
    public String getAiAnalysisLevel() { return aiAnalysisLevel; }
    public boolean isContractChatEnabled() { return contractChatEnabled; }
    public String getRiskReportLevel() { return riskReportLevel; }
    public int getAuditLogRetentionDays() { return auditLogRetentionDays; }
    public boolean hasPrioritySupport() { return prioritySupport; }
}
