# ContractIQ

**AI-Powered Multi-Tenant SaaS Platform for Contract Negotiation**

ContractIQ helps legal, procurement, and vendor-management teams negotiate contracts faster and more safely by combining AI-assisted contract analysis with a structured internal/external collaboration workflow. Each customer organization (tenant) operates in a fully isolated workspace — their contracts, comments, and negotiation strategy are never visible to any other tenant.

> **Status:** Pre-development. This document defines product scope only. No implementation has begun.

---

## 1. Problem Statement

Contract negotiation today is slow and risky because:
- Legal teams manually re-read long contracts to spot risky clauses.
- Internal strategy discussions ("what are we willing to concede?") happen in email/Slack, disconnected from the contract itself, and often accidentally get forwarded to the vendor.
- There's no single source of truth for contract version history and negotiation state.

ContractIQ solves this with AI-assisted clause analysis plus a workflow that structurally separates **internal-only** discussion from **vendor-facing** discussion, so confidential strategy can never leak into a vendor-visible comment by accident.

---

## 2. User Roles (Personas)

Defining roles now avoids painful rework later — every requirement below should be checked against "which role can do this?"

| Role | Description |
|---|---|
| **Tenant Admin** | Manages users, billing, tenant settings for their organization. |
| **Internal Legal/Negotiator** | Uploads contracts, runs AI analysis, writes internal and vendor-facing comments, sends contracts out for negotiation. |
| **Internal Viewer** | Read-only access to contracts and internal comments (e.g., a stakeholder who needs visibility but doesn't negotiate). |
| **Vendor/External Counterparty** | The other party in the negotiation. Has a restricted, invite-only view: sees only the contract and comments explicitly marked vendor-facing. Never sees internal discussion, AI risk scores, or other tenants' data. |
| **Platform Super Admin** (you, the operator) | Anthropic-style internal role for platform operations — tenant provisioning, support, monitoring. Not a customer-facing role. |

**Open question to resolve before backend design:** Is a "Vendor" its own tenant with a restricted relationship to the negotiating tenant, or a special non-tenant guest-access role scoped to one contract? *(Flagging this now — it materially changes your data model and is worth a dedicated design session before coding.)*

---

## 3. Functional Requirements

### 3.1 Core AI Features
- **FR-1: AI Contract Ingestion** — Users can upload a contract (PDF/DOCX) and the system extracts and stores its text and structure.
- **FR-2: Clause Extraction** — AI identifies and labels standard clause types (e.g., Indemnification, Limitation of Liability, Termination, Governing Law, Auto-Renewal).
- **FR-3: Risk Scoring** — AI flags clauses as Low/Medium/High risk relative to configurable playbook rules, with a plain-language explanation of *why*.
- **FR-4: Redline Suggestions** — AI proposes alternative clause language aligned to the tenant's negotiation playbook/preferred terms.
- **FR-5: AI Negotiation Chat** — Users can ask natural-language questions about a specific contract ("What's our exposure under clause 8.2?") and get answers grounded only in that contract's text.
- **FR-6: Contract Summary Generation** — AI produces an executive summary of a contract's key terms and risk areas.

### 3.2 Internal / Vendor Comment Workflow
- **FR-7: Dual-Channel Commenting** — Every clause supports two independent comment threads: **Internal** (never leaves the tenant) and **Vendor-Facing** (visible to the invited counterparty).
- **FR-8: Visual Distinction** — The UI must make it visually unmistakable which channel a comment is in before a user posts (preventing accidental strategy leaks — this directly serves the data-isolation principle discussed above, just at the comment level instead of the tenant level).
- **FR-9: Promote Comment** — An internal user can explicitly "promote" an internal comment to vendor-facing (an intentional, auditable action — never automatic).
- **FR-10: Comment Audit Trail** — Every comment, edit, and promotion is timestamped and attributed to a user, permanently.
- **FR-11: Vendor Restricted View** — Vendor users see only: the current contract version, vendor-facing comments, and their own submitted redlines. They never see AI risk scores, internal comments, or playbook data.

### 3.3 Contract Lifecycle
- **FR-12: Version History** — Every edit/redline creates a new tracked version; users can diff any two versions.
- **FR-13: Status Workflow** — Contracts move through defined states (e.g., Draft → Internal Review → Sent to Vendor → In Negotiation → Signed → Archived).
- **FR-14: Notifications** — Users are notified when a vendor responds, a comment is promoted, or a contract status changes.

---

## 4. Non-Functional Requirements

### 4.1 Multi-Tenancy
- **NFR-1: Tenant Data Isolation** — No user, query, or AI prompt may ever access another tenant's data, under any circumstance, including bugs, admin tooling, and AI context windows. *(This is the single most important requirement in this document — see Part 1 discussion on why.)*
- **NFR-2: Tenant Identification Strategy** — [Decision pending] Choose one of: separate schema per tenant, or shared schema with enforced `tenant_id` + PostgreSQL Row-Level Security. Decision must be documented with rationale before database design begins.
- **NFR-3: AI Context Isolation** — When calling the AI model (Spring AI), the prompt/context sent must be scoped to a single tenant's data only — never batch multiple tenants' contracts into one AI call.
- **NFR-4: Tenant Onboarding/Offboarding** — New tenants can be provisioned without code changes; a tenant's data can be fully exported and deleted on request (supports compliance/right-to-erasure).

### 4.2 Security
- **NFR-5: Authentication** — Secure login (password + MFA at minimum) for internal users; separate, more restricted auth flow for vendor guest access (e.g., invite-link + email verification, scoped to one contract).
- **NFR-6: Authorization (RBAC)** — Every API endpoint enforces role-based access control matching Section 2's role table — checked server-side, never trusted from the client.
- **NFR-7: Encryption** — Data encrypted in transit (TLS) and at rest (database-level encryption).
- **NFR-8: Audit Logging** — Security-relevant events (login, role change, comment promotion, contract export) are logged immutably.
- **NFR-9: Least Privilege** — Platform Super Admin access to tenant contract content is logged and restricted to support-ticket-justified access, not standing access.

### 4.3 Scalability & Performance
- **NFR-10: Horizontal Scalability** — Application tier must scale out statelessly (multiple Spring Boot instances behind a load balancer).
- **NFR-11: Async AI Processing** — Long-running AI operations (full contract analysis) run asynchronously with status polling/webhooks, not as blocking HTTP requests.
- **NFR-12: Response Time Targets** — [Placeholder — define with real numbers once you have usage estimates, e.g., "AI chat response starts streaming within 2s."]
- **NFR-13: Multi-Tenant Fair Usage** — One tenant's heavy AI usage must not degrade performance for other tenants (rate limiting / quota per tenant).

### 4.4 Reliability & Compliance
- **NFR-14: Availability Target** — [Placeholder — e.g., 99.9% uptime, once you have an SLA in mind.]
- **NFR-15: Backup & Recovery** — Automated, tested backups with a defined Recovery Point Objective (RPO) and Recovery Time Objective (RTO).
- **NFR-16: Compliance Readiness** — Design with SOC 2 and GDPR principles in mind from day one (audit trails, data isolation, right to erasure) even if formal certification is a later milestone.

---

## 5. Out of Scope (v1)

Explicitly *not* building in the first version — revisit later:
- E-signature integration (assume signing happens outside ContractIQ for now)
- Billing/payments system
- Mobile native apps (web-responsive only)
- Multi-language contract support (English only for v1)

---

## 6. Open Decisions (must resolve before backend design)

1. Vendor access model: separate tenant vs. scoped guest role (see Section 2).
2. Tenant isolation strategy: shared-schema-with-RLS vs. schema-per-tenant (see NFR-2).
3. AI model context boundaries: how much of a contract's history is sent per AI call, and how is that scoped and logged.

---

## 7. Tech Stack (confirmed)
- **Backend:** Spring Boot
- **Frontend:** React
- **Database:** PostgreSQL
- **AI Integration:** Spring AI
