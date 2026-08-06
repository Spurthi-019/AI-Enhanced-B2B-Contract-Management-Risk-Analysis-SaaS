package com.contractiq.repository;

import com.contractiq.document.ContractDocument;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ContractDocumentRepository extends MongoRepository<ContractDocument, String> {
    List<ContractDocument> findByTenantId(String tenantId);
    long countByTenantId(String tenantId);
}
