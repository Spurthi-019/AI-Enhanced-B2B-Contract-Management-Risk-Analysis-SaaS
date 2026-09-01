package com.contractiq.config;

import com.contractiq.document.ContractDocument;
import com.contractiq.document.ContractVersion;
import com.contractiq.domain.Role;
import com.contractiq.domain.Tenant;
import com.contractiq.domain.User;
import com.contractiq.dto.ContractAnalysisResponse;
import com.contractiq.dto.ContractSummary;
import com.contractiq.repository.ContractDocumentRepository;
import com.contractiq.repository.RoleRepository;
import com.contractiq.repository.TenantRepository;
import com.contractiq.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Component
public class DbInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DbInitializer.class);

    private final TenantRepository tenantRepository;
    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final ContractDocumentRepository contractDocumentRepository;

    public DbInitializer(
            TenantRepository tenantRepository,
            RoleRepository roleRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            ContractDocumentRepository contractDocumentRepository
    ) {
        this.tenantRepository = tenantRepository;
        this.roleRepository = roleRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.contractDocumentRepository = contractDocumentRepository;
    }

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        log.info("Initializing database with default tenant, roles, and test user...");

        // 1. Create default Tenant if none exist
        Tenant tenant;
        if (tenantRepository.count() == 0) {
            tenant = new Tenant();
            tenant.setName("Default SaaS Tenant");
            tenant.setCompanyName("Default SaaS Tenant");
            tenant.setSubscriptionPlan("PRO");
            tenant.setCreatedAt(LocalDateTime.now());
            tenant = tenantRepository.save(tenant);
            log.info("Created Default Tenant with PRO plan: {}", tenant.getId());
        } else {
            tenant = tenantRepository.findAll().getFirst();
            if (tenant.getSubscriptionPlan() == null || tenant.getSubscriptionPlan().equals("FREE")) {
                tenant.setSubscriptionPlan("PRO");
                tenant = tenantRepository.save(tenant);
                log.info("Upgraded existing Default Tenant to PRO plan");
            }
        }

        // 2. Create default Roles if they do not exist
        Role adminRole = roleRepository.findByName("ROLE_ADMIN")
                .orElseGet(() -> {
                    Role r = new Role();
                    r.setName("ROLE_ADMIN");
                    r.setUsers(new HashSet<>());
                    r = roleRepository.save(r);
                    log.info("Created role ROLE_ADMIN: {}", r.getId());
                    return r;
                });

        Role reviewerRole = roleRepository.findByName("ROLE_LEGAL_REVIEWER")
                .orElseGet(() -> {
                    Role r = new Role();
                    r.setName("ROLE_LEGAL_REVIEWER");
                    r.setUsers(new HashSet<>());
                    r = roleRepository.save(r);
                    log.info("Created role ROLE_LEGAL_REVIEWER: {}", r.getId());
                    return r;
                });

        Role employeeRole = roleRepository.findByName("ROLE_EMPLOYEE")
                .orElseGet(() -> {
                    Role r = new Role();
                    r.setName("ROLE_EMPLOYEE");
                    r.setUsers(new HashSet<>());
                    r = roleRepository.save(r);
                    log.info("Created role ROLE_EMPLOYEE: {}", r.getId());
                    return r;
                });

        // 3. Create test admin user if none exist
        if (userRepository.findByEmail("test@contractiq.com").isEmpty()) {
            User testUser = new User();
            testUser.setEmail("test@contractiq.com");
            testUser.setPasswordHash(passwordEncoder.encode("devpassword"));
            testUser.setTenant(tenant);
            testUser.setRoles(new HashSet<>(Set.of(adminRole)));
            testUser = userRepository.save(testUser);
            
            if (adminRole.getUsers() == null) {
                adminRole.setUsers(new HashSet<>());
            }
            adminRole.getUsers().add(testUser);
            log.info("Created test admin user test@contractiq.com under tenant: {}", tenant.getName());
        } else {
            log.info("Test user test@contractiq.com already exists.");
        }

        // 4. Create test reviewer user if none exist
        if (userRepository.findByEmail("reviewer@contractiq.com").isEmpty()) {
            User reviewerUser = new User();
            reviewerUser.setEmail("reviewer@contractiq.com");
            reviewerUser.setPasswordHash(passwordEncoder.encode("devpassword"));
            reviewerUser.setTenant(tenant);
            reviewerUser.setRoles(new HashSet<>(Set.of(reviewerRole)));
            reviewerUser = userRepository.save(reviewerUser);
            
            if (reviewerRole.getUsers() == null) {
                reviewerRole.setUsers(new HashSet<>());
            }
            reviewerRole.getUsers().add(reviewerUser);
            log.info("Created test reviewer user reviewer@contractiq.com");
        }

        // 5. Create test employee user if none exist
        if (userRepository.findByEmail("employee@contractiq.com").isEmpty()) {
            User employeeUser = new User();
            employeeUser.setEmail("employee@contractiq.com");
            employeeUser.setPasswordHash(passwordEncoder.encode("devpassword"));
            employeeUser.setTenant(tenant);
            employeeUser.setRoles(new HashSet<>(Set.of(employeeRole)));
            employeeUser = userRepository.save(employeeUser);
            
            if (employeeRole.getUsers() == null) {
                employeeRole.setUsers(new HashSet<>());
            }
            employeeRole.getUsers().add(employeeUser);
            log.info("Created test employee user employee@contractiq.com");
        }

        // 6. Seed specimen contract if none exist
        String tenantIdStr = tenant.getId().toString();
        if (contractDocumentRepository.findByTenantId(tenantIdStr).isEmpty()) {
            ContractDocument specimen = new ContractDocument();
            specimen.setTenantId(tenantIdStr);
            specimen.setTitle("Apex CloudTech Master SaaS Agreement");
            specimen.setOriginalFilename("Apex_CloudTech_Master_SaaS_Agreement_Specimen.pdf");
            specimen.setCurrentVersion(1);
            specimen.setApprovalStatus("APPROVED");
            specimen.setReminderThresholdDays(30);
            specimen.setExpirationDate("Expires in 1 year on 2027-07-28");

            String specimenText = """
                MASTER SOFTWARE AS A SERVICE (SAAS) AGREEMENT
                
                This Master SaaS Agreement ("Agreement") is entered into by and between Apex CloudTech Solutions Inc. ("Vendor"), and Client Enterprise ("Customer").
                
                1. SERVICES & LICENSE GRANT
                Vendor grants Customer a non-exclusive, non-transferable right to access and use the SaaS platform for its internal business operations during the Term.
                
                2. FEES & PAYMENT TERMS
                All invoices issued under this Agreement are due and payable Net 30 days from the date of invoice receipt. Unpaid balances beyond 30 days shall accrue late interest at 1.5% per month or the maximum rate permitted by law. All fees are quoted in USD and are non-refundable except as explicitly provided herein.
                
                3. TERM & TERMINATION
                3.1 Initial Term: This Agreement commences on the Effective Date and continues for an initial term of one (1) year.
                3.2 Renewal: This Agreement will automatically renew for successive one (1) year terms unless either party gives written notice of non-renewal at least thirty (30) days prior to the expiration of the then-current term.
                3.3 Termination for Convenience: Customer may terminate this Agreement at any time for convenience upon sixty (60) days written notice to Vendor.
                3.4 Termination for Cause: Either party may terminate immediately if the other party commits a material breach and fails to cure such breach within thirty (30) calendar days of receiving written notice of default.
                
                4. CONFIDENTIALITY & DATA PROTECTION
                Each party agrees to safeguard the other's Proprietary and Confidential Information with the same degree of care it uses for its own confidential assets, but not less than reasonable care. Personal data shall be processed in compliance with GDPR and applicable Data Protection Addendums (DPA).
                
                5. INTELLECTUAL PROPERTY RIGHTS
                Vendor retains all right, title, and interest in and to the SaaS software, platform architecture, and documentation. All custom deliverables and Customer data remain the exclusive property of Customer upon full payment of fees.
                
                6. LIMITATION OF LIABILITY & INDEMNIFICATION
                6.1 Liability Cap: To the maximum extent permitted by law, each party's total aggregate liability arising out of or related to this Agreement shall be limited to the total fees paid or payable by Customer under this Agreement in the twelve (12) months preceding the incident giving rise to liability.
                6.2 Uncapped Liability Carve-outs: The limitation of liability in Section 6.1 shall not apply to: (a) breach of confidentiality obligations under Section 4, (b) gross negligence or willful misconduct, or (c) indemnification obligations under Section 6.3.
                6.3 Indemnification: Vendor shall defend and indemnify Customer against any third-party claims alleging that the SaaS services infringe any valid patent, copyright, or trademark. Customer shall indemnify Vendor against third-party claims arising from unauthorized use of Customer content.
                
                7. WARRANTIES & SERVICE LEVEL AGREEMENT (SLA)
                Vendor warrants 99.9% uptime availability of the SaaS platform. In the event of a warranty breach, Vendor's sole obligation is to restore the services or issue service credits.
                
                8. GOVERNING LAW & DISPUTE RESOLUTION
                This Agreement shall be governed by and construed in accordance with the laws of the State of New York, without regard to conflicts of law principles. Any dispute arising out of this Agreement shall be submitted to binding arbitration in New York, NY.
                """;

            ContractVersion v1 = new ContractVersion();
            v1.setVersionNumber(1);
            v1.setFullText(specimenText);
            v1.setComments(new ArrayList<>());
            v1.setUpdatedAt(LocalDateTime.now());
            
            ContractAnalysisResponse analysis = new ContractAnalysisResponse();
            ContractSummary sum = new ContractSummary();
            sum.setOverallRiskLevel("MEDIUM");
            sum.setSummaryText("Master SaaS Agreement with Apex CloudTech Solutions. Key points include Net 30 payment terms, 30-day notice for renewal/cause termination, 60-day notice for convenience, and 12-month fee liability cap with uncapped carve-outs for data breaches and IP indemnity.");
            analysis.setSummary(sum);
            analysis.setExpirationDate("Expires in 1 year on 2027-07-28");
            analysis.setKeyTerms(List.of("Net 30 Payment Terms", "30-day Notice for Cause Termination", "60-day Termination for Convenience", "12-month Fee Liability Cap"));
            
            v1.setAnalysis(analysis);
            specimen.setVersionHistory(List.of(v1));
            contractDocumentRepository.save(specimen);
            log.info("Seeded default specimen contract for tenant: {}", tenantIdStr);
        }
        
        log.info("Database initialization complete!");
    }
}
