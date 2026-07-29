package com.contractiq.controller;

import com.contractiq.document.ContractDocument;
import com.contractiq.document.ContractVersion;
import com.contractiq.document.Comment;
import com.contractiq.dto.VendorPortalResponse;
import com.contractiq.repository.ContractDocumentRepository;
import com.contractiq.service.VendorTokenService;
import io.jsonwebtoken.Claims;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/vendor/portal")
public class VendorPortalController {

    private static final Logger log = LoggerFactory.getLogger(VendorPortalController.class);

    private final ContractDocumentRepository contractDocumentRepository;
    private final VendorTokenService vendorTokenService;
    private final com.contractiq.service.VectorIndexingService vectorIndexingService;
    private final com.contractiq.service.ContractAnalysisService contractAnalysisService;

    public VendorPortalController(
            ContractDocumentRepository contractDocumentRepository,
            VendorTokenService vendorTokenService,
            com.contractiq.service.VectorIndexingService vectorIndexingService,
            com.contractiq.service.ContractAnalysisService contractAnalysisService
    ) {
        this.contractDocumentRepository = contractDocumentRepository;
        this.vendorTokenService = vendorTokenService;
        this.vectorIndexingService = vectorIndexingService;
        this.contractAnalysisService = contractAnalysisService;
    }

    @GetMapping("/access")
    public VendorPortalResponse getVendorPortalAccess(@RequestParam("token") String token) {
        log.info("Vendor portal access requested with token");

        // 1. Parse and validate vendor token
        Claims claims;
        try {
            claims = vendorTokenService.parseVendorToken(token);
        } catch (Exception e) {
            log.warn("Invalid vendor token verification failure: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired review token");
        }

        String contractId = claims.get("contractId", String.class);
        String tenantId = claims.get("tenantId", String.class);

        // 2. Load contract document from MongoDB
        ContractDocument contractDoc = contractDocumentRepository.findById(contractId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contract not found"));

        // 3. Multi-tenant verification match
        if (!tenantId.equals(contractDoc.getTenantId())) {
            log.error("Tenant mismatch in vendor portal token: {} vs contract: {}", tenantId, contractDoc.getTenantId());
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied to this contract resource");
        }

        // 4. Extract current active version
        int currentVersionNumber = contractDoc.getCurrentVersion();
        ContractVersion activeVersion = null;
        if (contractDoc.getVersionHistory() != null) {
            for (ContractVersion version : contractDoc.getVersionHistory()) {
                if (version.getVersionNumber() == currentVersionNumber) {
                    activeVersion = version;
                    break;
                }
            }
        }

        // 5. Filter out comments that are not marked isVendorFacing
        List<Comment> vendorFacingComments = new ArrayList<>();
        if (activeVersion != null && activeVersion.getComments() != null) {
            vendorFacingComments = activeVersion.getComments().stream()
                    .filter(Comment::isVendorFacing)
                    .collect(Collectors.toList());
        }

        // 6. Build structured response
        VendorPortalResponse response = new VendorPortalResponse();
        response.setId(contractDoc.getId());
        response.setTitle(contractDoc.getTitle());
        response.setOriginalFilename(contractDoc.getOriginalFilename());
        response.setCurrentVersion(currentVersionNumber);
        if (activeVersion != null) {
            response.setAnalysis(activeVersion.getAnalysis());
        }
        response.setComments(vendorFacingComments);

        log.info("Granted vendor review access for contract: {} version: {}", contractId, currentVersionNumber);
        return response;
    }

    @GetMapping("/access/download")
    public org.springframework.http.ResponseEntity<org.springframework.core.io.Resource> downloadVendorContractFile(@RequestParam("token") String token) {
        log.info("Vendor portal request to download contract file with token");
        Claims claims;
        try {
            claims = vendorTokenService.parseVendorToken(token);
        } catch (Exception e) {
            log.warn("Invalid vendor token verification failure: {}", e.getMessage());
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired review token");
        }

        String contractId = claims.get("contractId", String.class);
        String tenantId = claims.get("tenantId", String.class);

        ContractDocument contractDoc = contractDocumentRepository.findById(contractId)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(HttpStatus.NOT_FOUND, "Contract not found"));

        if (!tenantId.equals(contractDoc.getTenantId())) {
            log.error("Tenant mismatch in vendor portal token: {} vs contract: {}", tenantId, contractDoc.getTenantId());
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied to this contract resource");
        }

        try {
            java.nio.file.Path filePath = java.nio.file.Paths.get(contractDoc.getStoredFilePath());
            org.springframework.core.io.Resource resource = new org.springframework.core.io.UrlResource(filePath.toUri());
            if (resource.exists() || resource.isReadable()) {
                return org.springframework.http.ResponseEntity.ok()
                        .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + contractDoc.getOriginalFilename() + "\"")
                        .contentType(org.springframework.http.MediaType.APPLICATION_PDF)
                        .body(resource);
            } else {
                throw new org.springframework.web.server.ResponseStatusException(HttpStatus.NOT_FOUND, "File not found or not readable");
            }
        } catch (Exception e) {
            log.error("Error reading contract file for vendor", e);
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Error downloading file");
        }
    }

    public static class VendorCommentRequest {
        private String content;
        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }
    }

    @org.springframework.web.bind.annotation.PostMapping("/comment")
    @org.springframework.transaction.annotation.Transactional
    public List<Comment> addVendorComment(
            @RequestParam("token") String token,
            @RequestBody VendorCommentRequest request
    ) {
        log.info("Vendor portal request to add comment with token");
        Claims claims = vendorTokenService.parseVendorToken(token);
        String contractId = claims.get("contractId", String.class);
        String tenantId = claims.get("tenantId", String.class);
        String vendorEmail = claims.getSubject();

        ContractDocument contractDoc = contractDocumentRepository.findById(contractId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contract not found"));

        if (!tenantId.equals(contractDoc.getTenantId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }

        Comment comment = new Comment();
        comment.setId(java.util.UUID.randomUUID().toString());
        comment.setAuthorEmail("Vendor (" + vendorEmail + ")");
        comment.setContent(request.getContent());
        comment.setVendorFacing(true);
        comment.setCreatedAt(java.time.LocalDateTime.now());

        int currentVersionNumber = contractDoc.getCurrentVersion();
        ContractVersion activeVersion = null;
        if (contractDoc.getVersionHistory() != null) {
            for (ContractVersion version : contractDoc.getVersionHistory()) {
                if (version.getVersionNumber() == currentVersionNumber) {
                    activeVersion = version;
                    break;
                }
            }
        }

        if (activeVersion == null) {
            activeVersion = new ContractVersion();
            activeVersion.setVersionNumber(currentVersionNumber);
            activeVersion.setComments(new ArrayList<>());
            activeVersion.setUpdatedAt(java.time.LocalDateTime.now());
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

        log.info("Successfully saved vendor comment on contract ID: {}", contractId);
        
        return activeVersion.getComments().stream()
                .filter(Comment::isVendorFacing)
                .collect(Collectors.toList());
    }

    @org.springframework.web.bind.annotation.PostMapping("/upload")
    @org.springframework.transaction.annotation.Transactional
    public VendorPortalResponse uploadVendorRevision(
            @RequestParam("token") String token,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file
    ) {
        log.info("Vendor portal request to upload revised contract file with token");
        Claims claims = vendorTokenService.parseVendorToken(token);
        String contractId = claims.get("contractId", String.class);
        String tenantId = claims.get("tenantId", String.class);
        String vendorEmail = claims.getSubject();

        ContractDocument contractDoc = contractDocumentRepository.findById(contractId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contract not found"));

        if (!tenantId.equals(contractDoc.getTenantId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }

        if (file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File is empty");
        }
        if (file.getSize() > 10 * 1024 * 1024) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File exceeds size limits");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.equals("application/pdf")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only PDF documents are supported");
        }

        String originalFilename = file.getOriginalFilename();
        String sanitizedFilename = java.nio.file.Paths.get(originalFilename).getFileName().toString();
        String uniqueFilename = java.util.UUID.randomUUID().toString() + "-" + sanitizedFilename;

        java.nio.file.Path tenantUploadDir = java.nio.file.Paths.get("uploads", tenantId).normalize();
        java.nio.file.Path targetFilePath = tenantUploadDir.resolve(uniqueFilename).normalize();

        if (!targetFilePath.startsWith(tenantUploadDir)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid file name");
        }

        try {
            java.nio.file.Files.createDirectories(tenantUploadDir);
            java.nio.file.Files.copy(file.getInputStream(), targetFilePath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            log.info("Revised contract file successfully saved to disk: {}", targetFilePath);
        } catch (Exception e) {
            log.error("Failed to save file to disk", e);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to save file to disk");
        }

        int nextVersion = contractDoc.getCurrentVersion() + 1;
        contractDoc.setCurrentVersion(nextVersion);
        contractDoc.setOriginalFilename(sanitizedFilename);
        contractDoc.setStoredFilePath(targetFilePath.toString());

        try {
            vectorIndexingService.indexContract(contractDoc.getId(), tenantId, targetFilePath.toString(), nextVersion);
        } catch (Exception e) {
            log.error("Vector indexing failed for contract version {}", nextVersion, e);
        }

        com.contractiq.dto.ContractAnalysisResponse analysis = null;
        try {
            analysis = contractAnalysisService.analyzeContract(contractDoc.getId(), tenantId, nextVersion);
        } catch (Exception e) {
            log.error("AI risk analysis failed for contract version {}", nextVersion, e);
        }

        ContractVersion versionEntry = new ContractVersion();
        versionEntry.setVersionNumber(nextVersion);
        versionEntry.setFullText("Version " + nextVersion + " uploaded by vendor: " + vendorEmail);
        versionEntry.setComments(new ArrayList<>());
        versionEntry.setAnalysis(analysis);
        versionEntry.setUpdatedAt(java.time.LocalDateTime.now());

        if (contractDoc.getVersionHistory() == null) {
            contractDoc.setVersionHistory(new ArrayList<>());
        }
        contractDoc.getVersionHistory().add(versionEntry);

        if (analysis != null && analysis.getExpirationDate() != null) {
            contractDoc.setExpirationDate(analysis.getExpirationDate());
        }

        ContractDocument savedDoc = contractDocumentRepository.save(contractDoc);
        log.info("Successfully uploaded revised version {} for contract {}", nextVersion, contractId);

        VendorPortalResponse response = new VendorPortalResponse();
        response.setId(savedDoc.getId());
        response.setTitle(savedDoc.getTitle());
        response.setOriginalFilename(savedDoc.getOriginalFilename());
        response.setCurrentVersion(nextVersion);
        response.setAnalysis(analysis);
        response.setComments(new ArrayList<>());

        return response;
    }
}
