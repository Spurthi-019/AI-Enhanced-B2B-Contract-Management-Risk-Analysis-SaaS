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

    public VendorPortalController(
            ContractDocumentRepository contractDocumentRepository,
            VendorTokenService vendorTokenService
    ) {
        this.contractDocumentRepository = contractDocumentRepository;
        this.vendorTokenService = vendorTokenService;
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
}
