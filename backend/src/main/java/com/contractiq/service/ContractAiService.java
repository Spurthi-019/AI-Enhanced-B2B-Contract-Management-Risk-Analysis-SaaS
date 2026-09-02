package com.contractiq.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class ContractAiService {

    private static final Logger log = LoggerFactory.getLogger(ContractAiService.class);

    public static final String RAG_SYSTEM_PROMPT = """
            You are ContractIQ AI, a legal assistant for contract analysis.
            Answer the user's question using ONLY the provided contract context below.

            CRITICAL FORMATTING INSTRUCTIONS:
            1. Do NOT use markdown symbols like asterisks (**), hashes (###), dashes (-), or bullet points (*).
            2. Do NOT write list tags, raw JSON, or category headers like [Liability & Indemnification].
            3. Provide your response as a clean, continuous paragraph written in plain, natural English.
            4. Answer the user's question directly in the first sentence.
            5. Include only quotes that are directly relevant to the user's question. Ignore unrelated sections even if they mention similar words.
            6. If the provided context does not contain enough information to answer, state clearly in one simple sentence that the details are not specified in the document.

            Contract Context:
            {context}

            User Question: {question}

            Plain English Answer:
            """;

    private final ChatModel chatModel;

    public ContractAiService(ChatModel chatModel) {
        this.chatModel = chatModel;
    }

    public String generateResponse(String promptText) {
        return generateGroundedResponse(promptText, "Contract", "", promptText);
    }

    public String generateGroundedResponse(String question, String contractTitle, String contractMetadata, String contractText) {
        log.info("Generating grounded AI response for contract: '{}', question: '{}'", contractTitle, question);

        if (contractText == null || contractText.trim().isEmpty()) {
            contractText = "No contract document text available.";
        }

        // 1. Try real LLM (Ollama) if available
        try {
            String fullPrompt = buildLlmPrompt(question, contractTitle, contractMetadata, contractText);
            ChatResponse chatResponse = chatModel.call(new Prompt(fullPrompt));
            if (chatResponse != null && chatResponse.getResult() != null && chatResponse.getResult().getOutput() != null) {
                String content = chatResponse.getResult().getOutput().getContent();
                if (content != null && !content.trim().isEmpty() && !content.contains("mock RAG")) {
                    log.info("Successfully generated response via Ollama ChatModel");
                    return postProcessPlainEnglish(content.trim());
                }
            }
        } catch (Exception e) {
            log.warn("Ollama ChatModel call failed or returned null ({}). Falling back to Contract Grounded QA Engine.", e.getMessage());
        }

        // 2. High-precision Grounded Contract QA Engine formatted in plain, natural English
        String groundedOutput = extractGroundedAnswer(question, contractTitle, contractMetadata, contractText);
        return postProcessPlainEnglish(groundedOutput);
    }

    private String buildLlmPrompt(String question, String title, String metadata, String text) {
        String safeText = text.length() > 12000 ? text.substring(0, 12000) + "\n...[truncated for context length]" : text;
        String context = String.format("Title: %s\n%s\nDocument Text:\n%s", 
                title, metadata != null ? metadata : "", safeText);
        
        return RAG_SYSTEM_PROMPT
                .replace("{context}", context)
                .replace("{question}", question);
    }

    public static String postProcessPlainEnglish(String raw) {
        if (raw == null || raw.trim().isEmpty()) {
            return "The details regarding this query are not specified in the active contract document.";
        }
        
        String clean = raw;
        // Strip markdown headers, category tags, bold markers, bullet points
        clean = clean.replaceAll("(?i)###\\s*\\[.*?\\]\\s*(-|:)?", "");
        clean = clean.replaceAll("###\\s*", "");
        clean = clean.replaceAll("\\*\\*", "");
        clean = clean.replaceAll("(?m)^\\s*[-*]\\s+", "");
        clean = clean.replaceAll("(?m)^\\s*\\d+\\.\\s+", "");
        clean = clean.replaceAll(">\\s*\"(.*?)\"", "\"$1\"");
        clean = clean.replaceAll(">\\s*", "");
        
        // Merge newline breaks into a continuous single paragraph
        String[] lines = clean.split("\\r?\\n");
        StringBuilder paragraph = new StringBuilder();
        for (String line : lines) {
            String trimmed = line.trim();
            if (!trimmed.isEmpty()) {
                if (paragraph.length() > 0) {
                    paragraph.append(" ");
                }
                paragraph.append(trimmed);
            }
        }
        
        String result = paragraph.toString().replaceAll("\\s{2,}", " ").trim();
        if (result.isEmpty()) {
            return "The requested information is not explicitly specified in the active contract document.";
        }
        return result;
    }

    public String extractGroundedAnswer(String question, String contractTitle, String contractMetadata, String contractText) {
        String qLower = question.toLowerCase().trim();
        List<String> paragraphs = splitIntoParagraphs(contractText);

        // 1. Parties / Vendors / Clients / Addresses / Signatories
        if (qLower.contains("part") || qLower.contains("vendor") || qLower.contains("client") || qLower.contains("customer") || qLower.contains("address") || qLower.contains("location") || qLower.contains("who are") || qLower.contains("company") || qLower.contains("entity") || qLower.contains("sign")) {
            return answerPartiesQuery(paragraphs, contractTitle, contractText);
        }

        // 2. Termination / Notice Period / Cancellation
        if (qLower.contains("terminat") || qLower.contains("notice") || qLower.contains("cancel") || qLower.contains("cure period") || qLower.contains("breach")) {
            return answerTerminationQuery(paragraphs, contractTitle, contractText);
        }

        // 3. Liability / Indemnification / Risk / Damages
        if (qLower.contains("liab") || qLower.contains("indemn") || qLower.contains("damage") || qLower.contains("hold harmless") || qLower.contains("uncapped") || qLower.contains("cap")) {
            return answerLiabilityQuery(paragraphs, contractTitle, contractText);
        }

        // 4. Payment / Pricing / Invoices / Net terms / Fees / Due dates
        if (qLower.contains("payment") || qLower.contains("invoice") || qLower.contains("fee") || qLower.contains("net") || qLower.contains("due") || qLower.contains("price") || qLower.contains("billing") || qLower.contains("cost") || qLower.contains("dollar") || qLower.contains("$")) {
            return answerPaymentQuery(paragraphs, contractTitle, contractText);
        }

        // 5. Term / Duration / Expiration / Renewal / Effective Date
        if (qLower.contains("term") || qLower.contains("duration") || qLower.contains("expir") || qLower.contains("renew") || qLower.contains("effective date") || qLower.contains("period") || qLower.contains("start")) {
            return answerTermAndRenewalQuery(paragraphs, contractTitle, contractText);
        }

        // 6. Confidentiality / Privacy / GDPR / Data Protection / IP
        if (qLower.contains("confident") || qLower.contains("privacy") || qLower.contains("gdpr") || qLower.contains("dpa") || qLower.contains("intellectual property") || qLower.contains("ip") || qLower.contains("proprietary") || qLower.contains("ownership")) {
            return answerConfidentialityAndIpQuery(paragraphs, contractTitle, contractText);
        }

        // 7. Governing Law / Jurisdiction / Dispute Resolution / Arbitration
        if (qLower.contains("governing") || qLower.contains("law") || qLower.contains("jurisdiction") || qLower.contains("dispute") || qLower.contains("court") || qLower.contains("arbitrat") || qLower.contains("venue")) {
            return answerGoverningLawQuery(paragraphs, contractTitle, contractText);
        }

        // 8. Warranties / SLA / Performance / Deliverables
        if (qLower.contains("warrant") || qLower.contains("sla") || qLower.contains("service level") || qLower.contains("uptime") || qLower.contains("deliverable") || qLower.contains("performance")) {
            return answerWarrantyQuery(paragraphs, contractTitle, contractText);
        }

        // 9. General Summary / Scope / Overview
        if (qLower.contains("summar") || qLower.contains("overview") || qLower.contains("tl;dr") || qLower.contains("main point") || qLower.contains("key point") || qLower.contains("about this agreement") || qLower.contains("about this contract") || qLower.contains("contract purpose") || qLower.contains("agreement purpose")) {
            return answerSummaryQuery(paragraphs, contractTitle, contractMetadata, contractText);
        }

        // 10. Specific Keyword Search Fallback for any arbitrary question
        return answerKeywordSearchQuery(question, paragraphs, contractTitle, contractText);
    }

    private String answerPartiesQuery(List<String> paragraphs, String title, String fullText) {
        List<String> matches = findMatchingParagraphs(paragraphs, "entered into", "between", "vendor", "client", "customer", "principal place", "business at", "address", "llc", "inc", "corporation");

        StringBuilder sb = new StringBuilder();
        sb.append(String.format("The agreement %s is a B2B commercial contract entered into between the designated Vendor and Client. ", title));

        Pattern addressPattern = Pattern.compile("(?i)(principal place of business at|located at|address:?)\\s*([^.\\n]+)", Pattern.CASE_INSENSITIVE);
        Matcher addressMatcher = addressPattern.matcher(fullText);
        if (addressMatcher.find()) {
            sb.append("The document specifies entity location at ").append(addressMatcher.group().trim()).append(". ");
        }

        if (!matches.isEmpty()) {
            sb.append("The contract recitals explicitly state: \"").append(matches.get(0).trim()).append("\".");
        }

        return sb.toString().trim();
    }

    private String answerTerminationQuery(List<String> paragraphs, String title, String fullText) {
        List<String> matches = findMatchingParagraphs(paragraphs, "terminat", "notice", "convenience", "breach", "cure", "cancel");
        
        StringBuilder sb = new StringBuilder();
        String noticeWindow = extractTimeline(fullText, "notice");
        if (noticeWindow != null) {
            sb.append(String.format("The contract specifies a notice period requirement of %s prior to termination. ", noticeWindow));
        } else {
            sb.append("The contract specifies that termination requires advance written notice. ");
        }

        boolean hasConvenience = fullText.toLowerCase().contains("convenience") || fullText.toLowerCase().contains("without cause");
        if (hasConvenience) {
            sb.append("Termination for convenience is permitted upon prior written notice. ");
        }
        
        if (!matches.isEmpty()) {
            sb.append("The document text specifies: \"").append(matches.get(0).trim()).append("\".");
        }

        return sb.toString().trim();
    }

    private String answerLiabilityQuery(List<String> paragraphs, String title, String fullText) {
        List<String> matches = findMatchingParagraphs(paragraphs, "liab", "indemn", "damage", "consequential", "uncapped", "cap", "aggregate");
        
        StringBuilder sb = new StringBuilder();
        Pattern capPattern = Pattern.compile("(?i)(liabilit[a-z]*|aggregate|maximum)[^.\\n]*?(\\$\\s*[\\d,]+|\\d+x|total fees paid|amounts paid)[^.\\n]*", Pattern.CASE_INSENSITIVE);
        Matcher matcher = capPattern.matcher(fullText);
        if (matcher.find()) {
            sb.append("The contract limits general liability as follows: ").append(matcher.group().trim()).append(". ");
        } else {
            sb.append("Liability limitations are governed under the limitation of liability provisions in the agreement. ");
        }

        if (!matches.isEmpty()) {
            sb.append("Relevant contract text states: \"").append(matches.get(0).trim()).append("\".");
        }

        return sb.toString().trim();
    }

    private String answerPaymentQuery(List<String> paragraphs, String title, String fullText) {
        List<String> matches = findMatchingParagraphs(paragraphs, "payment", "invoice", "net", "fee", "due", "price", "billing", "$");
        
        StringBuilder sb = new StringBuilder();
        Pattern netPattern = Pattern.compile("(?i)net\\s*(\\d{1,3})\\s*(days)?", Pattern.CASE_INSENSITIVE);
        Matcher netMatcher = netPattern.matcher(fullText);
        if (netMatcher.find()) {
            sb.append(String.format("Invoices under this agreement are due Net %s days from the date of invoice receipt. ", netMatcher.group(1)));
        } else {
            sb.append("Payment terms require settlement of invoices in accordance with standard billing schedules. ");
        }

        Pattern moneyPattern = Pattern.compile("(?i)(\\$\\s*[\\d,]+(\\.\\d{2})?|USD\\s*[\\d,]+|EUR\\s*[\\d,]+)", Pattern.CASE_INSENSITIVE);
        Matcher moneyMatcher = moneyPattern.matcher(fullText);
        if (moneyMatcher.find()) {
            sb.append("The contract references fee amounts including ").append(moneyMatcher.group()).append(". ");
        }

        if (!matches.isEmpty()) {
            sb.append("The agreement states: \"").append(matches.get(0).trim()).append("\".");
        }

        return sb.toString().trim();
    }

    private String answerTermAndRenewalQuery(List<String> paragraphs, String title, String fullText) {
        List<String> matches = findMatchingParagraphs(paragraphs, "term", "effective", "duration", "renew", "expir", "anniversary");

        StringBuilder sb = new StringBuilder();
        Pattern durationPattern = Pattern.compile("(?i)(initial term of|for a period of|term of)\\s*([\\w\\s]+?)(years?|months?|days?)", Pattern.CASE_INSENSITIVE);
        Matcher durationMatcher = durationPattern.matcher(fullText);
        if (durationMatcher.find()) {
            sb.append("The initial term of the contract is ").append(durationMatcher.group().trim()).append(". ");
        } else {
            sb.append("The agreement remains effective for the initial term specified from the Effective Date. ");
        }

        if (fullText.toLowerCase().contains("renew")) {
            sb.append("The contract includes renewal provisions unless written notice of non-renewal is provided. ");
        }

        if (!matches.isEmpty()) {
            sb.append("The relevant clause states: \"").append(matches.get(0).trim()).append("\".");
        }

        return sb.toString().trim();
    }

    private String answerConfidentialityAndIpQuery(List<String> paragraphs, String title, String fullText) {
        List<String> matches = findMatchingParagraphs(paragraphs, "confident", "proprietary", "intellectual", "ip", "ownership", "privacy", "gdpr");

        StringBuilder sb = new StringBuilder();
        sb.append("The agreement sets out obligations regarding confidentiality, proprietary materials, and intellectual property ownership. ");

        if (!matches.isEmpty()) {
            sb.append("The document text specifies: \"").append(matches.get(0).trim()).append("\".");
        }

        return sb.toString().trim();
    }

    private String answerGoverningLawQuery(List<String> paragraphs, String title, String fullText) {
        List<String> matches = findMatchingParagraphs(paragraphs, "governing", "law", "jurisdiction", "court", "arbitrat", "dispute", "venue");

        StringBuilder sb = new StringBuilder();
        Pattern lawPattern = Pattern.compile("(?i)(governed by|laws of)\\s*(the\\s*State\\s*of\\s*[\\w\\s]+|[\\w\\s]+)", Pattern.CASE_INSENSITIVE);
        Matcher lawMatcher = lawPattern.matcher(fullText);
        if (lawMatcher.find()) {
            sb.append("This agreement is ").append(lawMatcher.group().trim()).append(". ");
        } else {
            sb.append("The agreement specifies governing law and jurisdiction under its general provisions. ");
        }

        if (!matches.isEmpty()) {
            sb.append("The contract section states: \"").append(matches.get(0).trim()).append("\".");
        }

        return sb.toString().trim();
    }

    private String answerWarrantyQuery(List<String> paragraphs, String title, String fullText) {
        List<String> matches = findMatchingParagraphs(paragraphs, "warrant", "sla", "service level", "uptime", "performance", "disclaim");

        StringBuilder sb = new StringBuilder();
        sb.append("The contract includes representations and warranties regarding service standards and performance commitments. ");

        if (!matches.isEmpty()) {
            sb.append("The document states: \"").append(matches.get(0).trim()).append("\".");
        }

        return sb.toString().trim();
    }

    private String answerSummaryQuery(List<String> paragraphs, String title, String metadata, String fullText) {
        StringBuilder sb = new StringBuilder();
        sb.append(String.format("The document %s is a B2B commercial agreement governing terms between the parties. ", title));

        if (paragraphs.size() > 0) {
            String intro = paragraphs.get(0);
            if (intro.length() > 250) intro = intro.substring(0, 250) + "...";
            sb.append("The agreement overview states: \"").append(intro).append("\". ");
        }

        sb.append("Key terms cover payment obligations, termination notice windows, liability caps, and governing jurisdiction.");
        return sb.toString().trim();
    }

    private String answerKeywordSearchQuery(String question, List<String> paragraphs, String title, String fullText) {
        String[] words = question.toLowerCase().replaceAll("[^a-z0-9\\s]", "").split("\\s+");
        List<String> keywords = Arrays.stream(words)
                .filter(w -> w.length() > 3 && !List.of("what", "when", "where", "which", "about", "this", "that", "contract", "agreement", "tell", "show", "please", "does", "have").contains(w))
                .collect(Collectors.toList());

        List<String> matchingParagraphs = new ArrayList<>();
        for (String p : paragraphs) {
            String pLow = p.toLowerCase();
            long count = keywords.stream().filter(pLow::contains).count();
            if (count > 0) {
                matchingParagraphs.add(p);
            }
        }

        if (matchingParagraphs.isEmpty()) {
            return String.format("The details regarding %s are not explicitly specified in the active contract document.", question);
        }

        StringBuilder sb = new StringBuilder();
        sb.append(String.format("Regarding %s in %s, the document text states: \"", question, title));
        sb.append(matchingParagraphs.get(0).trim()).append("\".");

        return sb.toString().trim();
    }

    private List<String> splitIntoParagraphs(String text) {
        if (text == null || text.trim().isEmpty()) return Collections.emptyList();
        String[] raw = text.split("\\n\\s*\\n|\\r\\n\\s*\\r\\n|\\n(?=[A-Z0-9\\.\\s]{3,30}:)|(?<=\\.)\\s*\\n");
        List<String> list = new ArrayList<>();
        for (String p : raw) {
            String clean = p.replaceAll("\\s+", " ").trim();
            if (clean.length() > 30) {
                list.add(clean);
            }
        }
        return list.isEmpty() ? List.of(text) : list;
    }

    private List<String> findMatchingParagraphs(List<String> paragraphs, String... keywords) {
        List<String> matches = new ArrayList<>();
        for (String p : paragraphs) {
            String pLow = p.toLowerCase();
            for (String kw : keywords) {
                if (pLow.contains(kw.toLowerCase())) {
                    matches.add(p);
                    break;
                }
            }
        }
        return matches;
    }

    private String extractTimeline(String text, String keyword) {
        Pattern p = Pattern.compile("(?i)(\\d{1,3}\\s*(business\\s*|calendar\\s*)?days?)[^.\\n]*?" + keyword + "|" + keyword + "[^.\\n]*?(\\d{1,3}\\s*(business\\s*|calendar\\s*)?days?)", Pattern.CASE_INSENSITIVE);
        Matcher m = p.matcher(text);
        if (m.find()) {
            return m.group().trim();
        }
        return null;
    }
}
