package com.contractiq.config;

import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.embedding.Embedding;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.embedding.EmbeddingRequest;
import org.springframework.ai.embedding.EmbeddingResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import com.contractiq.service.ContractAiService;
import java.util.ArrayList;
import java.util.List;

@Configuration
@ConditionalOnProperty(name = "spring.ai.ollama.mock", havingValue = "true", matchIfMissing = true)
public class MockAiConfig {

    @Bean
    @Primary
    public ChatModel mockChatModel() {
        return new ChatModel() {
            @Override
            public ChatResponse call(Prompt prompt) {
                String promptText = prompt.getContents();
                if (promptText.contains("USER QUESTION") || promptText.contains("legal assistant") || promptText.contains("Question:")) {
                    // Extract question and context from promptText
                    String question = "What are the terms of this contract?";
                    String context = promptText;
                    
                    if (promptText.contains("--- USER QUESTION ---")) {
                        String[] parts = promptText.split("--- USER QUESTION ---");
                        if (parts.length > 1) {
                            String qPart = parts[1].split("--- ANSWER ---")[0].trim();
                            if (!qPart.isEmpty()) question = qPart;
                        }
                    } else if (promptText.contains("Question:")) {
                        String[] parts = promptText.split("Question:");
                        if (parts.length > 1) {
                            String qPart = parts[1].split("Answer:")[0].trim();
                            if (!qPart.isEmpty()) question = qPart;
                        }
                    }
                    
                    ContractAiService semanticEngine = new ContractAiService(null);
                    String answer = semanticEngine.extractGroundedAnswer(question, "Contract Document", "", context);
                    return new ChatResponse(List.of(new Generation(answer)));
                }

                // Mock a valid legal risk analysis JSON response matching our DTOs
                String mockResponseJson = """
                {
                  "summary": {
                    "summaryText": "The contract is a standard corporate services agreement. Key risks relate to uncapped liability in clause 8.2 and broad indemnification requirements in clause 9.1.",
                    "overallRiskLevel": "HIGH"
                  },
                  "riskClauses": [
                    {
                      "title": "Limitation of Liability",
                      "riskLevel": "HIGH",
                      "clauseText": "Section 8.2: Neither party shall be liable to the other, except that Vendor's liability for data breaches under Section 5 shall be unlimited.",
                      "mitigation": "Negotiate a reasonable liability cap for data breaches, e.g., 2x the annual contract value."
                    },
                    {
                      "title": "Indemnification",
                      "riskLevel": "MEDIUM",
                      "clauseText": "Section 9.1: Vendor shall indemnify and hold Customer harmless from any and all claims, losses, or liabilities arising from the services.",
                      "mitigation": "Limit indemnification to third-party claims arising from gross negligence or willful misconduct."
                    }
                  ],
                  "expirationDate": "Expires in 1 year on 2027-07-28",
                  "keyTerms": [
                    "Net 30 Payment Terms",
                    "Uncapped Liability for Data Breaches under Section 5",
                    "Customer intellectual property transfers upon payment"
                  ]
                }
                """;
                Generation generation = new Generation(mockResponseJson);
                return new ChatResponse(List.of(generation));
            }

            @Override
            public ChatOptions getDefaultOptions() {
                return null;
            }
        };
    }

    @Bean
    @Primary
    public EmbeddingModel mockEmbeddingModel() {
        return new EmbeddingModel() {
            @Override
            public EmbeddingResponse call(EmbeddingRequest request) {
                List<Embedding> embeddings = new ArrayList<>();
                for (int i = 0; i < request.getInstructions().size(); i++) {
                    List<Double> vector = new ArrayList<>();
                    for (int d = 0; d < 768; d++) {
                        vector.add(d == 0 ? 1.0 : 0.0);
                    }
                    embeddings.add(new Embedding(vector, i));
                }
                return new EmbeddingResponse(embeddings);
            }

            @Override
            public List<Double> embed(org.springframework.ai.document.Document document) {
                List<Double> vector = new ArrayList<>();
                for (int d = 0; d < 768; d++) {
                    vector.add(d == 0 ? 1.0 : 0.0);
                }
                return vector;
            }
        };
    }
}
