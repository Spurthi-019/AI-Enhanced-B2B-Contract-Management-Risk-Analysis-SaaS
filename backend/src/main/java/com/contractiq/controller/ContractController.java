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

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
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

    public ContractController(
            ContractDocumentRepository contractDocumentRepository,
            VectorIndexingService vectorIndexingService,
            ContractAnalysisService contractAnalysisService,
            VendorTokenService vendorTokenService,
            EmailNotificationService emailNotificationService
    ) {
        this.contractDocumentRepository = contractDocumentRepository;
        this.vectorIndexingService = vectorIndexingService;
        this.contractAnalysisService = contractAnalysisService;
        this.vendorTokenService = vendorTokenService;
        this.emailNotificationService = emailNotificationService;
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

        // 1. Get and validate tenant ID from TenantContext
        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing tenant context");
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
        
        ContractVersion version1 = new ContractVersion();
        version1.setVersionNumber(1);
        version1.setFullText("Version 1 uploaded.");
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
        contractDocumentRepository.save(contractDoc);

        log.info("Successfully updated contract document {} inside MongoDB with analysis data", id);
        return ResponseEntity.ok(analysis);
    }

    @PostMapping("/{id}/share")
    public ResponseEntity<Void> shareContract(
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

        return ResponseEntity.ok().build();
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

        // Append to the active version
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

        if (activeVersion.getComments() == null) {
            activeVersion.setComments(new ArrayList<>());
        }
        activeVersion.getComments().add(comment);
        contractDocumentRepository.save(contractDoc);

        log.info("Successfully added comment to contract {} version {}", id, currentVersion);
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
        versionEntry.setFullText("Version " + nextVersion + " uploaded.");
        versionEntry.setComments(new ArrayList<>());
        versionEntry.setAnalysis(analysis);
        versionEntry.setUpdatedAt(LocalDateTime.now());

        if (contractDoc.getVersionHistory() == null) {
            contractDoc.setVersionHistory(new ArrayList<>());
        }
        contractDoc.getVersionHistory().add(versionEntry);

        ContractDocument savedDoc = contractDocumentRepository.save(contractDoc);
        log.info("Successfully uploaded, indexed, and analyzed new version {} for contract {}", nextVersion, id);

        return ResponseEntity.ok(savedDoc);
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
    }
}
