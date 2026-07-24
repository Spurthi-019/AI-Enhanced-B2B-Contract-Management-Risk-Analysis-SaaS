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
}
