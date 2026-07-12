# ContractIQ — Architecture

**Status:** Design phase. Describes the intended system shape before implementation begins. Companion to `README.md` (product scope).

---

## 1. Components

| Component | Role | Analogy |
|---|---|---|
| **React** | Frontend UI, runs in the user's browser. Never talks to a database directly. | The dining room — what the customer sees |
| **Spring Boot** | Backend application server. The only component allowed to talk to any database or AI model. Enforces auth, RBAC, and tenant isolation on every request. | The kitchen — where all decisions happen |
| **PostgreSQL** | Relational database. Stores tenants, users, roles, billing, audit logs. Also hosts the **pgvector** extension for semantic search. | The reservation book & register — strict, rule-bound records |
| **MongoDB** | Document database. Stores contract full text, version history, and internal/vendor comment threads. | The recipe box — flexible, nested, evolving content |
| **PGVector** | PostgreSQL extension. Stores vector embeddings of contract text chunks and supports similarity search, scoped per tenant. | The card catalog, indexed by meaning instead of title |
| **Ollama** | Runs AI models locally (embedding generation + local LLM inference) instead of always calling a cloud API. Accessed through Spring AI. | A local kitchen appliance instead of ordering out |
| **Spring AI** | Abstraction layer inside Spring Boot for calling any AI model (Ollama or cloud) through one consistent interface. | The universal recipe format any appliance can read |

---

## 2. Why a Hybrid Database Approach (Polyglot Persistence)

We deliberately use two databases instead of one, because tenant/user data and contract data have fundamentally different shapes and correctness requirements:

- **PostgreSQL** enforces strict rules and relationships (a user belongs to exactly one tenant, an email is unique, a billing transaction either fully completes or doesn't happen — ACID guarantees). This is non-negotiable for authentication, authorization, and billing, where a subtle bug is a security incident.
- **MongoDB** stores naturally nested, variably-structured content — a contract's clauses, its version history, and arbitrarily nested internal/vendor comment threads — without forcing constant schema migrations or expensive multi-table joins just to reconstruct one contract view.
- **Splitting responsibility limits blast radius.** A performance spike in contract/comment activity (MongoDB) never risks the stability of authentication or billing (PostgreSQL).

This pattern is called **polyglot persistence**: choosing the storage engine that matches the shape and guarantees each type of data actually needs, rather than forcing every kind of data into one engine.

**Important nuance:** PGVector runs as an extension *inside* PostgreSQL, not as a third separate database. So PostgreSQL ends up serving two purposes — strict relational data, and vector similarity search for AI retrieval — while MongoDB is reserved purely for flexible document content.

---

## 3. RAG and Vector Embeddings (Core AI Mechanism)

- **Vector embedding**: a numeric representation of a piece of text such that text with similar *meaning* ends up as nearby points in that numeric space — enabling search by meaning instead of exact keyword match.
- **RAG (Retrieval-Augmented Generation)**: before asking an AI model to answer a question, first retrieve the actual relevant source text (via vector similarity search) and include it in the prompt. This grounds the AI's answer in real contract content instead of relying on the model's general training memory — an "open-book exam" instead of a "closed-book" one.

This is essential for ContractIQ because an ungrounded AI answering "what does clause 8.2 say about liability" would be guessing. A RAG-grounded answer is quoting the tenant's actual contract.

---

## 4. Data Flow

### 4.1 General request flow (any feature)

1. User interacts with the React UI (e.g., opens a contract).
2. React sends an authenticated API request to Spring Boot.
3. Spring Boot validates the session/token and resolves the user's **tenant ID** and role.
4. Spring Boot routes the request to the appropriate service:
   - Tenant/user/billing/audit concerns → **PostgreSQL**
   - Contract text/version/comment concerns → **MongoDB**
   - AI concerns → **Spring AI**, which may call **Ollama** and/or query **PGVector**
5. Every query to MongoDB and PGVector is filtered by the resolved tenant ID — no exceptions, no admin bypass without logging (see NFR-9 in `README.md`).
6. Spring Boot assembles the response and returns it to React for display.

### 4.2 Contract ingestion flow (AI Contract Ingestion, FR-1–FR-3)

1. User uploads a contract file via React.
2. Spring Boot stores the extracted contract text and metadata as a document in **MongoDB**, tagged with `tenantId`.
3. Spring Boot splits the contract into chunks (e.g., per clause) and sends each chunk to **Ollama** to generate a vector embedding.
4. Each embedding is stored in **PGVector**, tagged with `tenantId` and a reference back to the MongoDB document/clause.
5. Spring AI runs clause extraction and risk-scoring prompts (via Ollama or a configured cloud model) and stores the results back onto the MongoDB contract document.

### 4.3 AI negotiation chat flow — RAG in action (FR-5)

1. User asks a question about a specific contract in React (e.g., "What's our exposure under clause 8.2?").
2. Spring Boot resolves the tenant ID and the contract ID.
3. Spring Boot converts the question into a vector embedding (via Ollama).
4. Spring Boot queries **PGVector**, filtered to `tenantId` + `contractId`, for the most semantically relevant stored chunks.
5. Spring Boot fetches the full text of those matching chunks from **MongoDB**.
6. Spring AI sends the user's question **plus** the retrieved chunks as context to the LLM (Ollama locally, or a cloud model in production).
7. The grounded answer is returned to React and displayed in the chat.

### 4.4 Comment workflow flow (FR-7–FR-11)

1. User posts a comment (internal or vendor-facing) on a clause in React.
2. Spring Boot validates the user's role permits posting to that channel (vendor users can never post to the internal channel).
3. Comment is stored as part of the contract's document in **MongoDB**, tagged with channel type (`internal` / `vendor`), `tenantId`, author, and timestamp.
4. If a user "promotes" an internal comment to vendor-facing, Spring Boot records this as an explicit, audited action (never automatic) and updates the comment's channel tag.
5. Vendor users querying comments only ever receive documents where `channel = vendor` — enforced server-side, not just hidden in the UI.

---

## 5. Open Design Decisions (carried over from README.md, Section 6)

1. **Tenant isolation strategy** — shared-schema-with-Row-Level-Security vs. schema-per-tenant in PostgreSQL. Affects both PostgreSQL and, by extension, how `tenantId` filtering is enforced in PGVector queries.
2. **Vendor access model** — separate tenant vs. scoped guest role. Affects how vendor-facing MongoDB queries are scoped.
3. **AI context boundaries** — exactly how much contract history is included per RAG query, and how that's logged for auditability.

These should be resolved before database schema and API design begin.
