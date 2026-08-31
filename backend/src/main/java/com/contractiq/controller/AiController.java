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

    public AiController(
            ContractAiService contractAiService,
            ContractDocumentRepository contractDocumentRepository,
            VectorStore vectorStore,
            com.contractiq.repository.TenantRepository tenantRepository
    ) {
        this.contractAiService = contractAiService;
        this.contractDocumentRepository = contractDocumentRepository;
        this.vectorStore = vectorStore;
        this.tenantRepository = tenantRepository;
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



            // 1. RAG context query setup: Search top 3 relevant chunks
            List<Document> relevantDocs;
            if (vectorStore instanceof org.springframework.ai.vectorstore.SimpleVectorStore) {
                SearchRequest searchRequest = SearchRequest.query(question).withTopK(100);
                List<Document> allDocs = vectorStore.similaritySearch(searchRequest);
                relevantDocs = allDocs.stream()
                        .filter(doc -> {
                            Object tId = doc.getMetadata().get("tenantId");
                            Object cId = doc.getMetadata().get("contractId");
                            Object ver = doc.getMetadata().get("version");
                            return tenantId.equals(tId) && 
                                   contractId.equals(cId) && 
                                   (ver == null || Integer.valueOf(contractDoc.getCurrentVersion()).equals(Integer.valueOf(ver.toString())));
                        })
                        .limit(3)
                        .collect(Collectors.toList());
            } else {
                String filterExpression = String.format("tenantId == '%s' && contractId == '%s' && version == %d", 
                        tenantId, contractId, contractDoc.getCurrentVersion());
                SearchRequest searchRequest = SearchRequest.query(question)
                        .withTopK(3)
                        .withFilterExpression(filterExpression);
                relevantDocs = vectorStore.similaritySearch(searchRequest);
            }

            String contextText = relevantDocs.stream()
                    .map(Document::getContent)
                    .collect(Collectors.joining("\n---\n"));

            // Format Prompt
            String promptText = String.format("""
                    You are a helpful corporate legal assistant for ContractIQ.
                    Answer the user's Question using ONLY the contract Context provided below.
                    Make the response professional, clear, and direct.
                    If the answer cannot be found or inferred from the context, state: "I'm sorry, but that information is not available in the active contract version."
                    
                    Context:
                    %s
                    
                    Question:
                    %s
                    
                    Answer:
                    """, contextText, question);

            answer = contractAiService.generateResponse(promptText);
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
    }
}
