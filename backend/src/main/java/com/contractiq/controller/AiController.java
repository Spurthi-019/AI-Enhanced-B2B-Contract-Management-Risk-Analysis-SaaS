package com.contractiq.controller;

import com.contractiq.document.ContractDocument;
import com.contractiq.dto.ChatResponse;
import com.contractiq.repository.ContractDocumentRepository;
import com.contractiq.security.TenantContext;
import com.contractiq.service.ContractAiService;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    private static final Logger log = LoggerFactory.getLogger(AiController.class);

    private final ContractAiService contractAiService;
    private final ContractDocumentRepository contractDocumentRepository;
    private final VectorStore vectorStore;
    private final com.contractiq.repository.TenantRepository tenantRepository;
    private final com.contractiq.service.PdfParsingService pdfParsingService;

    public AiController(
            ContractAiService contractAiService,
            ContractDocumentRepository contractDocumentRepository,
            VectorStore vectorStore,
            com.contractiq.repository.TenantRepository tenantRepository,
            com.contractiq.service.PdfParsingService pdfParsingService
    ) {
        this.contractAiService = contractAiService;
        this.contractDocumentRepository = contractDocumentRepository;
        this.vectorStore = vectorStore;
        this.tenantRepository = tenantRepository;
        this.pdfParsingService = pdfParsingService;
    }

    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(@RequestBody AiChatRequest request) {
        log.info("Received AI chat request: question={}, prompt={}, contractId={}", 
                request.getQuestion(), request.getPrompt(), request.getContractId());

        String tenantId = TenantContext.getTenantId();
        if (tenantId == null || tenantId.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing tenant context");
        }

        String question = request.getQuestion();
        if (question == null || question.trim().isEmpty()) {
            question = request.getPrompt();
        }

        if (question == null || question.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Prompt/Question cannot be empty");
        }

        String answer;
        String contractId = request.getContractId();

        if (contractId != null && !contractId.trim().isEmpty()) {
            // Retrieve contract document
            ContractDocument contractDoc = contractDocumentRepository.findById(contractId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contract not found"));

            if (!tenantId.equals(contractDoc.getTenantId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied to this contract workspace");
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

            // 2. Build metadata string
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

            answer = contractAiService.generateGroundedResponse(question, contractDoc.getTitle(), metadata.toString(), fullText);
        } else {
            // General prompt fallback
            answer = contractAiService.generateResponse(question);
        }

        return ResponseEntity.ok(new ChatResponse(answer));
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AiChatRequest {
        private String question;
        private String prompt;
        private String contractId;

        public String getQuestion() { return question; }
        public void setQuestion(String question) { this.question = question; }

        public String getPrompt() { return prompt; }
        public void setPrompt(String prompt) { this.prompt = prompt; }

        public String getContractId() { return contractId; }
        public void setContractId(String contractId) { this.contractId = contractId; }
    }
}
