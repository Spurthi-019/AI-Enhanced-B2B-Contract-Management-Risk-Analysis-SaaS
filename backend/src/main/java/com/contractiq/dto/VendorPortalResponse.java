package com.contractiq.dto;

import com.contractiq.document.Comment;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class VendorPortalResponse {
    private String id;
    private String title;
    private String originalFilename;
    private int currentVersion;
    private ContractAnalysisResponse analysis;
    private List<Comment> comments;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getOriginalFilename() { return originalFilename; }
    public void setOriginalFilename(String originalFilename) { this.originalFilename = originalFilename; }

    public int getCurrentVersion() { return currentVersion; }
    public void setCurrentVersion(int currentVersion) { this.currentVersion = currentVersion; }

    public ContractAnalysisResponse getAnalysis() { return analysis; }
    public void setAnalysis(ContractAnalysisResponse analysis) { this.analysis = analysis; }

    public List<Comment> getComments() { return comments; }
    public void setComments(List<Comment> comments) { this.comments = comments; }
}
