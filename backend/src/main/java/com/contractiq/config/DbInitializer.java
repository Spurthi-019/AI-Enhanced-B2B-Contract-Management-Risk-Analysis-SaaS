package com.contractiq.config;

import com.contractiq.domain.Role;
import com.contractiq.domain.Tenant;
import com.contractiq.domain.User;
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
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Component
public class DbInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DbInitializer.class);

    private final TenantRepository tenantRepository;
    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public DbInitializer(
            TenantRepository tenantRepository,
            RoleRepository roleRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.tenantRepository = tenantRepository;
        this.roleRepository = roleRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
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
            tenant.setCreatedAt(LocalDateTime.now());
            tenant = tenantRepository.save(tenant);
            log.info("Created Default Tenant: {}", tenant.getId());
        } else {
            tenant = tenantRepository.findAll().getFirst();
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
        
        log.info("Database initialization complete!");
    }
}
