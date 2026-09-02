package com.contractiq.controller;

import com.contractiq.document.ContractDocument;
import com.contractiq.document.ContractVersion;
import com.contractiq.document.Comment;
import com.contractiq.dto.ContractAnalysisResponse;
import com.contractiq.repository.ContractDocumentRepository;
import com.contractiq.security.TenantContext;
import com.contractiq.service.ContractAnalysisService;
import com.contractiq.service.VectorIndexingService;
import com.contractiq.service.VendorTokenService;
import com.contractiq.service.EmailNotificationService;
import com.contractiq.service.PdfParsingService;
import com.contractiq.service.ContractAiService;
import com.contractiq.dto.ChatRequest;
import com.contractiq.dto.ChatResponse;
import io.jsonwebtoken.Claims;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.document.Document;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/contracts")
public class ContractController {

    private static final Logger log = LoggerFactory.getLogger(ContractController.class);
    private static final long MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

    private final ContractDocumentRepository contractDocumentRepository;
    private final VectorIndexingService vectorIndexingService;
    private final ContractAnalysisService contractAnalysisService;
    private final VendorTokenService vendorTokenService;
    private final EmailNotificationService emailNotificationService;
    private final ChatModel chatModel;
    private final VectorStore vectorStore;
    private final com.contractiq.repository.TenantRepository tenantRepository;
    private final PdfParsingService pdfParsingService;
    private final ContractAiService contractAiService;

    public ContractController(
            ContractDocumentRepository contractDocumentRepository,
            VectorIndexingService vectorIndexingService,
            ContractAnalysisService contractAnalysisService,
            VendorTokenService vendorTokenService,
            EmailNotificationService emailNotificationService,
            ChatModel chatModel,
            VectorStore vectorStore,
            com.contractiq.repository.TenantRepository tenantRepository,
            PdfParsingService pdfParsingService,
            ContractAiService contractAiService
    ) {
        this.contractDocumentRepository = contractDocumentRepository;
        this.vectorIndexingService = vectorIndexingService;
        this.contractAnalysisService = contractAnalysisService;
        this.vendorTokenService = vendorTokenService;
        this.emailNotificationService = emailNotificationService;
        this.chatModel = chatModel;
        this.vectorStore = vectorStore;
        this.tenantRepository = tenantRepository;
        this.pdfParsingService = pdfParsingService;
        this.contractAiService = contractAiService;
    }

    @GetMapping
    public ResponseEntity<List<ContractDocument>> getContracts() {
        log.info("Received request to list all contracts");
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing tenant context");
        }
        List<ContractDocument> list = contractDocumentRepository.findByTenantId(tenantId);
        return ResponseEntity.ok(list);
    }

    @PostMapping("/upload")
    public ResponseEntity<ContractDocument> uploadContract(
            @RequestParam("file") MultipartFile file,
            @RequestParam("title") String title
    ) {
        log.info("Received contract upload request for title: {}", title);

        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing tenant context");
        }

        // 1.5 Verify subscription plan limits
        java.util.UUID tenantUuid = java.util.UUID.fromString(tenantId);
        com.contractiq.domain.Tenant tenant = tenantRepository.findById(tenantUuid)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Tenant workspace not found"));
        
        long existingContractsCount = contractDocumentRepository.countByTenantId(tenantId);
        String plan = tenant.getSubscriptionPlan() != null ? tenant.getSubscriptionPlan() : "FREE";
        if (plan.equals("FREE") && existingContractsCount >= 2) {
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, "Upload failed: Free tier is limited to 2 contracts. Please upgrade to Pro or Enterprise.");
        }
        if (plan.equals("PRO") && existingContractsCount >= 100) {
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, "Upload failed: Pro tier is limited to 100 contracts. Please upgrade to Enterprise.");
        }

        // 2. Validate file presence & criteria
        validateMultipartFile(file);

        // 3. Sanitize filename to prevent path traversal
        String originalFilename = file.getOriginalFilename();
        String sanitizedFilename = Paths.get(originalFilename).getFileName().toString();
        String uniqueFilename = UUID.randomUUID().toString() + "-" + sanitizedFilename;

        // 4. Save the file to tenant-scoped folder
        Path tenantUploadDir = Paths.get("uploads", tenantId).normalize();
        Path targetFilePath = tenantUploadDir.resolve(uniqueFilename).normalize();

        if (!targetFilePath.startsWith(tenantUploadDir)) {
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

        // 5. Persist contract metadata in MongoDB
        ContractDocument contractDoc = new ContractDocument();
        contractDoc.setTenantId(tenantId);
        contractDoc.setTitle(title);
        contractDoc.setOriginalFilename(sanitizedFilename);
        contractDoc.setStoredFilePath(targetFilePath.toString());
        contractDoc.setCurrentVersion(1);
        contractDoc.setApprovalStatus("PENDING_APPROVAL");
        contractDoc.setReminderThresholdDays(30);
        
        ContractVersion version1 = new ContractVersion();
        version1.setVersionNumber(1);
        String fullText = "";
        try {
            fullText = pdfParsingService.parsePdf(targetFilePath);
        } catch (Exception e) {
            log.error("Failed to parse PDF content during upload", e);
            fullText = "Failed to parse PDF content.";
        }
        version1.setFullText(fullText);
        version1.setComments(new ArrayList<>());
        version1.setUpdatedAt(LocalDateTime.now());
        
        List<ContractVersion> history = new ArrayList<>();
        history.add(version1);
        contractDoc.setVersionHistory(history);

        ContractDocument savedDoc = contractDocumentRepository.save(contractDoc);
        log.info("Contract document metadata successfully saved to MongoDB. ID: {}", savedDoc.getId());

        // 6. Trigger vector indexing for version 1
        try {
            vectorIndexingService.indexContract(savedDoc.getId(), tenantId, targetFilePath.toString(), 1);
        } catch (Exception e) {
            log.error("Vector indexing failed for contract version 1", e);
        }

        return ResponseEntity.ok(savedDoc);
    }

    @PostMapping("/{id}/analyze")
    public ResponseEntity<ContractAnalysisResponse> analyzeContract(@PathVariable("id") String id) {
        log.info("Received contract analysis request for ID: {}", id);

        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing tenant context");
        }

        ContractDocument contractDoc = contractDocumentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contract not found"));

        if (!tenantId.equals(contractDoc.getTenantId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }

        int currentVersion = contractDoc.getCurrentVersion();
        ContractAnalysisResponse analysis = contractAnalysisService.analyzeContract(id, tenantId, currentVersion);

        java.util.UUID tenantUuid = java.util.UUID.fromString(tenantId);
        com.contractiq.domain.Tenant tenant = tenantRepository.findById(tenantUuid)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Tenant workspace not found"));
        
        String plan = tenant.getSubscriptionPlan() != null ? tenant.getSubscriptionPlan() : "FREE";
        if (plan.equals("FREE")) {
            if (analysis != null) {
                if (analysis.getRiskClauses() != null) {
                    analysis.getRiskClauses().clear();
                }
                com.contractiq.dto.ComplianceChecklist checklist = analysis.getComplianceChecklist();
                if (checklist != null) {
                    checklist.setGdprDetails("Upgrade to Pro/Enterprise plan to unlock detailed GDPR compliance reports.");
                    checklist.setIndemnityDetails("Upgrade to Pro/Enterprise plan to unlock detailed Indemnification boundaries analysis.");
                    checklist.setLiabilityDetails("Upgrade to Pro/Enterprise plan to unlock detailed Liability Limit assessment.");
                    checklist.setGovLawDetails("Upgrade to Pro/Enterprise plan to unlock detailed Jurisdiction review.");
                }
            }
        }

        // Update active version inside versionHistory
        ContractVersion activeVersion = null;
        if (contractDoc.getVersionHistory() != null) {
            for (ContractVersion version : contractDoc.getVersionHistory()) {
                if (version.getVersionNumber() == currentVersion) {
                    activeVersion = version;
                    break;
                }
            }
        }

        if (activeVersion == null) {
            activeVersion = new ContractVersion();
            activeVersion.setVersionNumber(currentVersion);
            activeVersion.setComments(new ArrayList<>());
            activeVersion.setUpdatedAt(LocalDateTime.now());
            if (contractDoc.getVersionHistory() == null) {
                contractDoc.setVersionHistory(new ArrayList<>());
            }
            contractDoc.getVersionHistory().add(activeVersion);
        }

        activeVersion.setAnalysis(analysis);
        activeVersion.setUpdatedAt(LocalDateTime.now());
        if (analysis != null && analysis.getExpirationDate() != null) {
            contractDoc.setExpirationDate(analysis.getExpirationDate());
        }
        contractDocumentRepository.save(contractDoc);

        log.info("Successfully updated contract document {} inside MongoDB with analysis data", id);
        return ResponseEntity.ok(analysis);
    }

    @PostMapping("/{id}/share")
    public ResponseEntity<Map<String, String>> shareContract(
            @PathVariable("id") String id,
            @RequestParam("email") String email
    ) {
        log.info("Request to share contract: {} with vendor email: {}", id, email);

        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing tenant context");
        }

        ContractDocument contractDoc = contractDocumentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contract not found"));

        if (!tenantId.equals(contractDoc.getTenantId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }

        // Generate magic token and send HTML email
        String secureToken = vendorTokenService.generateVendorToken(id, tenantId, email);
        String magicLink = "http://localhost:5173/vendor/review?token=" + secureToken;
        
        emailNotificationService.sendVendorPortalLink(email, contractDoc.getTitle(), magicLink);

        Map<String, String> response = new HashMap<>();
        response.put("token", secureToken);
        response.put("magicLink", magicLink);

        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/comments")
    public ResponseEntity<Comment> addComment(
            @PathVariable("id") String id,
            @RequestBody CommentRequest request
    ) {
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing tenant context");
        }

        ContractDocument contractDoc = contractDocumentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contract not found"));

        if (!tenantId.equals(contractDoc.getTenantId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }

        String authorEmail = SecurityContextHolder.getContext().getAuthentication().getName();

        Comment comment = new Comment();
        comment.setId(UUID.randomUUID().toString());
        comment.setAuthorEmail(authorEmail);
        comment.setContent(request.getContent());
        comment.setVendorFacing(request.isVendorFacing());
        comment.setCreatedAt(LocalDateTime.now());

        // Append to the specific or active version
        int targetVersion = (request.getVersion() != null) ? request.getVersion() : contractDoc.getCurrentVersion();
        ContractVersion activeVersion = null;
        if (contractDoc.getVersionHistory() != null) {
            for (ContractVersion version : contractDoc.getVersionHistory()) {
                if (version.getVersionNumber() == targetVersion) {
                    activeVersion = version;
                    break;
                }
            }
        }

        if (activeVersion == null) {
            activeVersion = new ContractVersion();
            activeVersion.setVersionNumber(targetVersion);
            activeVersion.setComments(new ArrayList<>());
            activeVersion.setUpdatedAt(LocalDateTime.now());
            if (contractDoc.getVersionHistory() == null) {
                contractDoc.setVersionHistory(new ArrayList<>());
            }
            contractDoc.getVersionHistory().add(activeVersion);
        }

        if (activeVersion.getComments() == null) {
            activeVersion.setComments(new ArrayList<>());
        }
        activeVersion.getComments().add(comment);
        contractDocumentRepository.save(contractDoc);

        log.info("Successfully added comment to contract {} version {}", id, targetVersion);
        return ResponseEntity.ok(comment);
    }

    @GetMapping("/{id}/comments")
    public ResponseEntity<List<Comment>> getComments(
            @PathVariable("id") String id,
            @RequestParam(value = "token", required = false) String token
    ) {
        String tenantId = TenantContext.getTenantId();
        boolean isVendor = false;

        // If vendor token parameter is provided, resolve and validate context
        if (token != null && !token.trim().isEmpty()) {
            Claims claims = vendorTokenService.parseVendorToken(token);
            tenantId = claims.get("tenantId", String.class);
            isVendor = true;
            if (!id.equals(claims.get("contractId", String.class))) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
            }
        }

        if (tenantId == null || tenantId.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing tenant or vendor context");
        }

        ContractDocument contractDoc = contractDocumentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contract not found"));

        if (!tenantId.equals(contractDoc.getTenantId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }

        int currentVersion = contractDoc.getCurrentVersion();
        ContractVersion activeVersion = null;
        if (contractDoc.getVersionHistory() != null) {
            for (ContractVersion version : contractDoc.getVersionHistory()) {
                if (version.getVersionNumber() == currentVersion) {
                    activeVersion = version;
                    break;
                }
            }
        }

        List<Comment> comments = new ArrayList<>();
        if (activeVersion != null && activeVersion.getComments() != null) {
            if (isVendor) {
                // Automatically filter out internal comments when accessed by a vendor
                comments = activeVersion.getComments().stream()
                        .filter(Comment::isVendorFacing)
                        .collect(Collectors.toList());
            } else {
                comments = activeVersion.getComments();
            }
        }

        return ResponseEntity.ok(comments);
    }

    @PostMapping("/{id}/versions")
    public ResponseEntity<ContractDocument> uploadNewVersion(
            @PathVariable("id") String id,
            @RequestParam("file") MultipartFile file
    ) {
        log.info("Received new contract version upload request for ID: {}", id);

        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing tenant context");
        }

        ContractDocument contractDoc = contractDocumentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contract not found"));

        if (!tenantId.equals(contractDoc.getTenantId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }

        // Validate revised PDF file
        validateMultipartFile(file);

        String originalFilename = file.getOriginalFilename();
        String sanitizedFilename = Paths.get(originalFilename).getFileName().toString();
        String uniqueFilename = UUID.randomUUID().toString() + "-" + sanitizedFilename;

        Path tenantUploadDir = Paths.get("uploads", tenantId).normalize();
        Path targetFilePath = tenantUploadDir.resolve(uniqueFilename).normalize();

        if (!targetFilePath.startsWith(tenantUploadDir)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid file name");
        }

        try {
            Files.createDirectories(tenantUploadDir);
            Files.copy(file.getInputStream(), targetFilePath, StandardCopyOption.REPLACE_EXISTING);
            log.info("Revised contract file successfully saved to disk: {}", targetFilePath);
        } catch (IOException e) {
            log.error("Failed to save file to disk", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to save file to disk");
        }

        // Increment version number
        int nextVersion = contractDoc.getCurrentVersion() + 1;
        contractDoc.setCurrentVersion(nextVersion);
        contractDoc.setOriginalFilename(sanitizedFilename);
        contractDoc.setStoredFilePath(targetFilePath.toString());

        // Parse and index new version in PGVector
        try {
            vectorIndexingService.indexContract(contractDoc.getId(), tenantId, targetFilePath.toString(), nextVersion);
        } catch (Exception e) {
            log.error("Vector indexing failed for contract version {}", nextVersion, e);
        }

        // Re-analyze risk engine for the new version
        ContractAnalysisResponse analysis = null;
        try {
            analysis = contractAnalysisService.analyzeContract(contractDoc.getId(), tenantId, nextVersion);
        } catch (Exception e) {
            log.error("AI risk analysis failed for contract version {}", nextVersion, e);
        }

        // Build new version history entry
        ContractVersion versionEntry = new ContractVersion();
        versionEntry.setVersionNumber(nextVersion);
        String fullText = "";
        try {
            fullText = pdfParsingService.parsePdf(targetFilePath);
        } catch (Exception e) {
            log.error("Failed to parse PDF content during revised upload", e);
            fullText = "Failed to parse PDF content.";
        }
        versionEntry.setFullText(fullText);
        versionEntry.setComments(new ArrayList<>());
        versionEntry.setAnalysis(analysis);
        versionEntry.setUpdatedAt(LocalDateTime.now());

        if (contractDoc.getVersionHistory() == null) {
            contractDoc.setVersionHistory(new ArrayList<>());
        }
        contractDoc.getVersionHistory().add(versionEntry);

        if (analysis != null && analysis.getExpirationDate() != null) {
            contractDoc.setExpirationDate(analysis.getExpirationDate());
        }

        ContractDocument savedDoc = contractDocumentRepository.save(contractDoc);
        log.info("Successfully uploaded, indexed, and analyzed new version {} for contract {}", nextVersion, id);

        return ResponseEntity.ok(savedDoc);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteContract(@PathVariable("id") String id) {
        log.info("Received request to delete contract ID: {}", id);

        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing tenant context");
        }

        ContractDocument contractDoc = contractDocumentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contract not found"));

        if (!tenantId.equals(contractDoc.getTenantId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }

        // 1. Delete file on disk
        if (contractDoc.getStoredFilePath() != null) {
            try {
                Path filePath = Paths.get(contractDoc.getStoredFilePath());
                Files.deleteIfExists(filePath);
                log.info("Successfully deleted contract file from disk: {}", filePath);
            } catch (Exception e) {
                log.error("Failed to delete contract file from disk", e);
            }
        }

        // 2. Delete vector embeddings
        try {
            vectorIndexingService.deleteContractVectors(id);
        } catch (Exception e) {
            log.error("Failed to delete vector embeddings for contract: {}", id, e);
        }

        // 3. Delete metadata from MongoDB
        contractDocumentRepository.delete(contractDoc);
        log.info("Successfully deleted contract document from MongoDB: {}", id);

        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<org.springframework.core.io.Resource> downloadContractFile(@PathVariable("id") String id) {
        log.info("Request to download contract file for ID: {}", id);
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing tenant context");
        }

        ContractDocument contractDoc = contractDocumentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contract not found"));

        if (!tenantId.equals(contractDoc.getTenantId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }

        try {
            Path filePath = Paths.get(contractDoc.getStoredFilePath());
            org.springframework.core.io.Resource resource = new org.springframework.core.io.UrlResource(filePath.toUri());
            if (resource.exists() || resource.isReadable()) {
                return ResponseEntity.ok()
                        .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + contractDoc.getOriginalFilename() + "\"")
                        .contentType(org.springframework.http.MediaType.APPLICATION_PDF)
                        .body(resource);
            } else {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found or not readable");
            }
        } catch (Exception e) {
            log.error("Error reading contract file", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Error downloading file");
        }
    }

    private void validateMultipartFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File is empty or missing");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File size exceeds 20MB limit");
        }

        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing original filename");
        }

        String contentType = file.getContentType();
        boolean hasPdfExtension = originalFilename.toLowerCase().endsWith(".pdf");
        boolean hasPdfContentType = "application/pdf".equalsIgnoreCase(contentType);

        if (!hasPdfExtension || !hasPdfContentType) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only PDF files are allowed");
        }
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CommentRequest {
        private String content;
        private boolean isVendorFacing;
        private Integer version;

        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }

        public boolean isVendorFacing() { return isVendorFacing; }
        public void setVendorFacing(boolean isVendorFacing) { this.isVendorFacing = isVendorFacing; }

        public Integer getVersion() { return version; }
        public void setVersion(Integer version) { this.version = version; }
    }

    @PostMapping("/{id}/chat")
    public ResponseEntity<ChatResponse> chatAboutContract(
            @PathVariable("id") String id,
            @RequestBody ChatRequest request
    ) {
        log.info("Received chat query for contract ID: {} query: {}", id, request.getQuestion());

        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing tenant context");
        }



        ContractDocument contractDoc = contractDocumentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contract not found"));

        if (!tenantId.equals(contractDoc.getTenantId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }

        // 1. Extract active version and full contract text from document
        com.contractiq.document.ContractVersion activeVersion = null;
        if (contractDoc.getVersionHistory() != null && !contractDoc.getVersionHistory().isEmpty()) {
            activeVersion = contractDoc.getVersionHistory().stream()
                    .filter(v -> v.getVersionNumber() == contractDoc.getCurrentVersion())
                    .findFirst()
                    .orElse(contractDoc.getVersionHistory().get(contractDoc.getVersionHistory().size() - 1));
        }

        String fullText = activeVersion != null ? activeVersion.getFullText() : null;

        // Fallback: If full text is missing in DB, parse directly from stored PDF on disk
        if ((fullText == null || fullText.trim().isEmpty()) && contractDoc.getStoredFilePath() != null) {
            try {
                java.nio.file.Path path = java.nio.file.Paths.get(contractDoc.getStoredFilePath());
                if (java.nio.file.Files.exists(path)) {
                    fullText = pdfParsingService.parsePdf(path);
                    if (activeVersion != null && fullText != null) {
                        activeVersion.setFullText(fullText);
                        contractDocumentRepository.save(contractDoc);
                    }
                }
            } catch (Exception e) {
                log.warn("Could not parse contract PDF from disk: {}", e.getMessage());
            }
        }

        if (fullText == null || fullText.trim().isEmpty()) {
            fullText = "Contract Title: " + contractDoc.getTitle();
        }

        StringBuilder metadata = new StringBuilder();
        metadata.append("Version: ").append(contractDoc.getCurrentVersion()).append("\n");
        if (contractDoc.getOriginalFilename() != null) {
            metadata.append("Filename: ").append(contractDoc.getOriginalFilename()).append("\n");
        }
        if (activeVersion != null && activeVersion.getAnalysis() != null) {
            var analysis = activeVersion.getAnalysis();
            if (analysis.getSummary() != null) {
                metadata.append("Risk Level: ").append(analysis.getSummary().getOverallRiskLevel()).append("\n");
                metadata.append("Analysis Summary: ").append(analysis.getSummary().getSummaryText()).append("\n");
            }
            if (analysis.getKeyTerms() != null && !analysis.getKeyTerms().isEmpty()) {
                metadata.append("Key Terms: ").append(String.join(", ", analysis.getKeyTerms())).append("\n");
            }
            if (analysis.getExpirationDate() != null) {
                metadata.append("Expiration: ").append(analysis.getExpirationDate()).append("\n");
            }
        }

        String answer = contractAiService.generateGroundedResponse(request.getQuestion(), contractDoc.getTitle(), metadata.toString(), fullText);
        return ResponseEntity.ok(new ChatResponse(answer));
    }

    @RequestMapping(value = "/{id}/status", method = {RequestMethod.PUT, RequestMethod.PATCH})
    public ResponseEntity<ContractDocument> updateContractStatus(
            @PathVariable("id") String id,
            @RequestParam(value = "status", required = false) String paramStatus,
            @RequestBody(required = false) java.util.Map<String, String> body
    ) {
        String targetStatus = (paramStatus != null && !paramStatus.trim().isEmpty()) 
                ? paramStatus 
                : (body != null ? body.get("status") : null);

        log.info("Received request to update contract status to {} for contract ID: {}", targetStatus, id);
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing tenant context");
        }

        if (targetStatus == null || targetStatus.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing status parameter or request body");
        }

        String upperStatus = targetStatus.trim().toUpperCase();
        boolean isValid = false;
        for (com.contractiq.domain.ContractStatus s : com.contractiq.domain.ContractStatus.values()) {
            if (s.name().equals(upperStatus)) {
                isValid = true;
                break;
            }
        }
        if (!isValid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid contract status value: " + targetStatus);
        }

        ContractDocument doc = contractDocumentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contract not found"));

        if (!tenantId.equals(doc.getTenantId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied to this contract workspace");
        }

        doc.setApprovalStatus(upperStatus);
        ContractDocument saved = contractDocumentRepository.save(doc);
        log.info("Successfully updated contract status to {} for ID: {}", upperStatus, id);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}/reminders")
    public ResponseEntity<ContractDocument> updateReminderThreshold(
            @PathVariable("id") String id,
            @RequestParam("days") Integer days
    ) {
        log.info("Received request to update reminder threshold to {} days for contract ID: {}", days, id);
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing tenant context");
        }

        if (days == null || days <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid alert threshold days");
        }

        ContractDocument doc = contractDocumentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contract not found"));

        if (!tenantId.equals(doc.getTenantId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied to this contract workspace");
        }

        doc.setReminderThresholdDays(days);
        ContractDocument saved = contractDocumentRepository.save(doc);
        return ResponseEntity.ok(saved);
    }
}
