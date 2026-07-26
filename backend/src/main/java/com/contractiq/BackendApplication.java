package com.contractiq;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(excludeName = {
    "org.springframework.cloud.function.context.config.ContextFunctionCatalogAutoConfiguration",
    "org.springframework.ai.autoconfigure.vectorstore.pgvector.PgVectorStoreAutoConfiguration"
})
public class BackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(BackendApplication.class, args);
    }
}
