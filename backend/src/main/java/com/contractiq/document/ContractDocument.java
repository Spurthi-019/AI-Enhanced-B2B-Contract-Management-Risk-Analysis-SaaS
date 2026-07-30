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

    @CreatedDate
    private LocalDateTime createdAt;
}
