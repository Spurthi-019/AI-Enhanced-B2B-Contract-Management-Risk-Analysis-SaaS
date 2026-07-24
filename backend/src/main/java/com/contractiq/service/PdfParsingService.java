package com.contractiq.service;

import org.springframework.ai.document.Document;
import org.springframework.ai.reader.tika.TikaDocumentReader;
import org.springframework.core.io.FileSystemResource;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class PdfParsingService {

    public String parsePdf(Path pdfPath) {
        FileSystemResource resource = new FileSystemResource(pdfPath.toFile());
        TikaDocumentReader reader = new TikaDocumentReader(resource);
        List<Document> documents = reader.read();
        return documents.stream()
                .map(Document::getContent)
                .collect(Collectors.joining("\n"));
    }
}
