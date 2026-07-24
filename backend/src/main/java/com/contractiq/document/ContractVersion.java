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
}
