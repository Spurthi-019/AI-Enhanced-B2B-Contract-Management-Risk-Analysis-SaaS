package com.contractiq.service;

import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.VectorStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class VectorIndexingService {

    private static final Logger log = LoggerFactory.getLogger(VectorIndexingService.class);
    private static final int CHUNK_SIZE = 500;
    private static final int OVERLAP = 50;

    private final PdfParsingService pdfParsingService;
    private final VectorStore vectorStore;

    public VectorIndexingService(PdfParsingService pdfParsingService, VectorStore vectorStore) {
        this.pdfParsingService = pdfParsingService;
        this.vectorStore = vectorStore;
    }

    public void indexContract(String contractId, String tenantId, String filePath) {
        log.info("Indexing contract: {} for tenant: {} at: {}", contractId, tenantId, filePath);
        
        // 1. Parse text from PDF
        String fullText;
        try {
            fullText = pdfParsingService.parsePdf(Paths.get(filePath));
        } catch (Exception e) {
            log.error("Failed to parse PDF file for vector indexing", e);
            throw new RuntimeException("Failed to parse PDF file for vector indexing", e);
        }

        if (fullText == null || fullText.trim().isEmpty()) {
            log.warn("Parsed text is empty for contract: {}. Skipping vector indexing.", contractId);
            return;
        }

        // 2. Chunk text (500 chars, 50 overlap)
        List<String> chunks = splitText(fullText, CHUNK_SIZE, OVERLAP);
        log.info("Split text into {} chunks for contract: {}", chunks.size(), contractId);

        // 3. Persist embedding vectors to PGVector
        List<Document> documents = new ArrayList<>();
        for (int i = 0; i < chunks.size(); i++) {
            Map<String, Object> metadata = new HashMap<>();
            metadata.put("tenantId", tenantId);
            metadata.put("contractId", contractId);
            metadata.put("chunkIndex", i);
            
            Document doc = new Document(chunks.get(i), metadata);
            documents.add(doc);
        }

        try {
            vectorStore.accept(documents);
            log.info("Successfully persisted {} vector chunks in PGVector store", documents.size());
        } catch (Exception e) {
            log.error("Failed to persist vectors in PGVector store", e);
            throw new RuntimeException("Failed to persist vectors in PGVector store", e);
        }
    }

    private List<String> splitText(String text, int chunkSize, int overlap) {
        List<String> chunks = new ArrayList<>();
        if (text == null || text.trim().isEmpty()) {
            return chunks;
        }
        int textLength = text.length();
        int start = 0;
        while (start < textLength) {
            int end = Math.min(start + chunkSize, textLength);
            chunks.add(text.substring(start, end));
            if (end == textLength) {
                break;
            }
            start += (chunkSize - overlap);
        }
        return chunks;
    }
}
