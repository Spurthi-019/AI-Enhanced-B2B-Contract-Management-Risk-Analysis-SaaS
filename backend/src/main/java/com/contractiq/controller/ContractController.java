package com.contractiq.controller;

import com.contractiq.document.ContractDocument;
import com.contractiq.document.ContractVersion;
import com.contractiq.dto.ContractAnalysisResponse;
import com.contractiq.repository.ContractDocumentRepository;
import com.contractiq.security.TenantContext;
import com.contractiq.service.ContractAnalysisService;
import com.contractiq.service.VectorIndexingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/contracts")
public class ContractController {

    private static final Logger log = LoggerFactory.getLogger(ContractController.class);
    private static final long MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

    private final ContractDocumentRepository contractDocumentRepository;
    private final VectorIndexingService vectorIndexingService;
    private final ContractAnalysisService contractAnalysisService;

    public ContractController(
            ContractDocumentRepository contractDocumentRepository,
            VectorIndexingService vectorIndexingService,
            ContractAnalysisService contractAnalysisService
    ) {
        this.contractDocumentRepository = contractDocumentRepository;
        this.vectorIndexingService = vectorIndexingService;
        this.contractAnalysisService = contractAnalysisService;
    }

    @PostMapping("/upload")
    public ResponseEntity<ContractDocument> uploadContract(
            @RequestParam("file") MultipartFile file,
            @RequestParam("title") String title
    ) {
        log.info("Received contract upload request for title: {}", title);

        // 1. Get and validate tenant ID from TenantContext
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.trim().isEmpty()) {
            log.warn("Unauthorized upload attempt: Missing tenant context");
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing tenant context");
        }

        // 2. Validate file existence
        if (file == null || file.isEmpty()) {
            log.warn("Upload rejected: File is empty or missing");
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File is empty or missing");
        }

        // 3. Validate file size (must be under 20MB)
        if (file.getSize() > MAX_FILE_SIZE) {
            log.warn("Upload rejected: File size {} exceeds 20MB limit", file.getSize());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File size exceeds 20MB limit");
        }

        // 4. Validate file type (must be PDF)
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null) {
            log.warn("Upload rejected: Missing original filename");
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing original filename");
        }

        String contentType = file.getContentType();
        boolean hasPdfExtension = originalFilename.toLowerCase().endsWith(".pdf");
        boolean hasPdfContentType = "application/pdf".equalsIgnoreCase(contentType);

        if (!hasPdfExtension || !hasPdfContentType) {
            log.warn("Upload rejected: Content-Type '{}' and extension '{}' is not a PDF", contentType, originalFilename);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only PDF files are allowed");
        }

        // 5. Sanitize filename to prevent path traversal attacks
        String sanitizedFilename = Paths.get(originalFilename).getFileName().toString();
        String uniqueFilename = UUID.randomUUID().toString() + "-" + sanitizedFilename;

        // 6. Save the file to tenant-scoped folder
        Path tenantUploadDir = Paths.get("uploads", tenantId).normalize();
        Path targetFilePath = tenantUploadDir.resolve(uniqueFilename).normalize();

        // Safety check: ensure targetFilePath is still inside tenantUploadDir (prevents path traversal via file name)
        if (!targetFilePath.startsWith(tenantUploadDir)) {
            log.error("Path traversal attempt detected! Filename: {}", originalFilename);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid file name");
        }

        try {
            Files.createDirectories(tenantUploadDir);
            Files.copy(file.getInputStream(), targetFilePath, StandardCopyOption.REPLACE_EXISTING);
            log.info("Contract file successfully saved to disk: {}", targetFilePath);
        } catch (IOException e) {
            log.error("Failed to save file to disk", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to save file to disk");
        }

        // 7. Persist contract metadata in MongoDB
        ContractDocument contractDoc = new ContractDocument();
        contractDoc.setTenantId(tenantId);
        contractDoc.setTitle(title);
        contractDoc.setOriginalFilename(sanitizedFilename);
        contractDoc.setStoredFilePath(targetFilePath.toString());
        contractDoc.setCurrentVersion(1);
        contractDoc.setVersionHistory(new ArrayList<>());

        ContractDocument savedDoc = contractDocumentRepository.save(contractDoc);
        log.info("Contract document metadata successfully saved to MongoDB. ID: {}", savedDoc.getId());

        // 8. Trigger vector indexing asynchronously/inline
        try {
            vectorIndexingService.indexContract(savedDoc.getId(), tenantId, targetFilePath.toString());
        } catch (Exception e) {
            log.error("Vector indexing failed for contract: {}", savedDoc.getId(), e);
            // Non-blocking: We don't fail the upload if vector database indexing fails,
            // but we log it as an error.
        }

        return ResponseEntity.ok(savedDoc);
    }

    @PostMapping("/{id}/analyze")
    public ResponseEntity<ContractAnalysisResponse> analyzeContract(@PathVariable("id") String id) {
        log.info("Received contract analysis request for ID: {}", id);

        // 1. Validate tenant session
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing tenant context");
        }

        // 2. Load contract document from MongoDB
        ContractDocument contractDoc = contractDocumentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contract not found"));

        // 3. Security check: Ensure contract belongs to requesting tenant
        if (!tenantId.equals(contractDoc.getTenantId())) {
            log.warn("Security warning: Tenant {} attempted to analyze contract {} belonging to tenant {}", 
                    tenantId, id, contractDoc.getTenantId());
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied to this contract");
        }

        // 4. Perform structured AI legal analysis using PGVector RAG context
        ContractAnalysisResponse analysis = contractAnalysisService.analyzeContract(id, tenantId);

        // 5. Update Contract Document's versionHistory with the analysis result
        ContractVersion currentVersion = new ContractVersion();
        currentVersion.setVersionNumber(contractDoc.getCurrentVersion());
        currentVersion.setFullText("Indexed risk profile analysis stored.");
        currentVersion.setComments(new ArrayList<>());
        currentVersion.setAnalysis(analysis);
        currentVersion.setUpdatedAt(LocalDateTime.now());

        if (contractDoc.getVersionHistory() == null) {
            contractDoc.setVersionHistory(new ArrayList<>());
        }
        
        // Remove existing version entry if overwriting or add to history
        contractDoc.getVersionHistory().removeIf(v -> v.getVersionNumber() == contractDoc.getCurrentVersion());
        contractDoc.getVersionHistory().add(currentVersion);

        contractDocumentRepository.save(contractDoc);
        log.info("Successfully updated contract document {} in MongoDB with analysis data", id);

        return ResponseEntity.ok(analysis);
    }
}
