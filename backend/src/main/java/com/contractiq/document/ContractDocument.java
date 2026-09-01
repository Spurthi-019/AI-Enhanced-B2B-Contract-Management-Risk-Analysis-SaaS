package com.contractiq.document;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import org.springframework.data.annotation.CreatedDate;
import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "contracts")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ContractDocument {

    @Id
    private String id;

    @Indexed
    private String tenantId;

    private String title;

    private int currentVersion;

    private List<ContractVersion> versionHistory;

    private String originalFilename;

    private String storedFilePath;

    private String expirationDate;

    private String approvalStatus;

    private Integer reminderThresholdDays;

    @CreatedDate
    private LocalDateTime createdAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public int getCurrentVersion() { return currentVersion; }
    public void setCurrentVersion(int currentVersion) { this.currentVersion = currentVersion; }

    public List<ContractVersion> getVersionHistory() { return versionHistory; }
    public void setVersionHistory(List<ContractVersion> versionHistory) { this.versionHistory = versionHistory; }

    public String getOriginalFilename() { return originalFilename; }
    public void setOriginalFilename(String originalFilename) { this.originalFilename = originalFilename; }

    public String getStoredFilePath() { return storedFilePath; }
    public void setStoredFilePath(String storedFilePath) { this.storedFilePath = storedFilePath; }

    public String getExpirationDate() { return expirationDate; }
    public void setExpirationDate(String expirationDate) { this.expirationDate = expirationDate; }

    public String getApprovalStatus() { return approvalStatus; }
    public void setApprovalStatus(String approvalStatus) { this.approvalStatus = approvalStatus; }

    public Integer getReminderThresholdDays() { return reminderThresholdDays; }
    public void setReminderThresholdDays(Integer reminderThresholdDays) { this.reminderThresholdDays = reminderThresholdDays; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
