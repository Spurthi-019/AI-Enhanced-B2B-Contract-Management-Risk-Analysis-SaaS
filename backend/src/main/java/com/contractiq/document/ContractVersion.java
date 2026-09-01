package com.contractiq.document;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import org.springframework.data.annotation.LastModifiedDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ContractVersion {

    private int versionNumber;
    
    private String fullText;
    
    private List<Comment> comments;

    private com.contractiq.dto.ContractAnalysisResponse analysis;
    
    @LastModifiedDate
    private LocalDateTime updatedAt;

    public int getVersionNumber() { return versionNumber; }
    public void setVersionNumber(int versionNumber) { this.versionNumber = versionNumber; }

    public String getFullText() { return fullText; }
    public void setFullText(String fullText) { this.fullText = fullText; }

    public List<Comment> getComments() { return comments; }
    public void setComments(List<Comment> comments) { this.comments = comments; }

    public com.contractiq.dto.ContractAnalysisResponse getAnalysis() { return analysis; }
    public void setAnalysis(com.contractiq.dto.ContractAnalysisResponse analysis) { this.analysis = analysis; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
