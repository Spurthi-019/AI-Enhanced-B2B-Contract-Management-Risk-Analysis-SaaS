package com.contractiq.service;

import com.contractiq.dto.ContractAnalysisResponse;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.ai.converter.BeanOutputConverter;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ContractAnalysisService {

    private static final Logger log = LoggerFactory.getLogger(ContractAnalysisService.class);

    private final ChatModel chatModel;
    private final VectorStore vectorStore;

    public ContractAnalysisService(ChatModel chatModel, VectorStore vectorStore) {
        this.chatModel = chatModel;
        this.vectorStore = vectorStore;
    }

    public ContractAnalysisResponse analyzeContract(String contractId, String tenantId) {
        log.info("Starting risk analysis for contract: {} under tenant: {}", contractId, tenantId);

        // 1. Query vector database for relevant contract chunks (RAG context)
        // We filter by tenantId and contractId metadata for strict multi-tenant isolation.
        String filterExpression = String.format("tenantId == '%s' && contractId == '%s'", tenantId, contractId);
        
        SearchRequest searchRequest = SearchRequest.query("liabilities indemnities termination warranty risk")
                .withTopK(8)
                .withFilterExpression(filterExpression);

        List<Document> relevantDocs = vectorStore.similaritySearch(searchRequest);
        log.info("Retrieved {} relevant text chunks from PGVector", relevantDocs.size());

        String contextText = relevantDocs.stream()
                .map(Document::getContent)
                .collect(Collectors.joining("\n---\n"));

        // 2. Setup BeanOutputConverter for structured JSON response
        BeanOutputConverter<ContractAnalysisResponse> converter = 
                new BeanOutputConverter<>(ContractAnalysisResponse.class);

        // 3. Define the legal prompting template
        String promptInstruction = """
                You are an expert corporate legal counsel analyzing a business contract.
                Evaluate the contract text provided in the Context below specifically checking for liabilities, indemnities, warranties, and termination clauses.
                Identify any risk items and provide mitigations.
                
                Context:
                {context}
                
                {format}
                """;

        PromptTemplate promptTemplate = new PromptTemplate(promptInstruction);
        promptTemplate.add("context", contextText);
        promptTemplate.add("format", converter.getFormat());

        Prompt prompt = promptTemplate.create();

        // 4. Invoke LLM via ChatModel
        log.info("Sending prompt to Ollama LLM...");
        ChatResponse chatResponse = chatModel.call(prompt);
        String rawOutput = chatResponse.getResult().getOutput().getContent();
        log.debug("LLM Raw Output: {}", rawOutput);

        // 5. Parse and return structured JSON model
        try {
            ContractAnalysisResponse analysis = converter.convert(rawOutput);
            log.info("Successfully converted LLM response to structured Risk Analysis object");
            return analysis;
        } catch (Exception e) {
            log.error("Failed to parse LLM structured output to ContractAnalysisResponse. Raw output: {}", rawOutput, e);
            throw new RuntimeException("AI output could not be parsed into legal analysis format. Please try again.", e);
        }
    }
}
