package com.contractiq.controller;

import com.contractiq.domain.Role;
import com.contractiq.domain.User;
import com.contractiq.dto.LoginRequest;
import com.contractiq.dto.LoginResponse;
import com.contractiq.repository.UserRepository;
import com.contractiq.security.JwtService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final com.contractiq.repository.TenantRepository tenantRepository;
    private final com.contractiq.repository.RoleRepository roleRepository;

    public AuthController(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            com.contractiq.repository.TenantRepository tenantRepository,
            com.contractiq.repository.RoleRepository roleRepository
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.tenantRepository = tenantRepository;
        this.roleRepository = roleRepository;
    }

    @PostMapping("/login")
    @Transactional(readOnly = true)
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request) {
        log.info("Login request received for user: {}", request.getEmail());
        
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> {
                    log.warn("User not found: {}", request.getEmail());
                    return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
                });

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            log.warn("Invalid password for user: {}", request.getEmail());
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }

        List<String> roles = user.getRoles().stream()
                .map(Role::getName)
                .collect(Collectors.toList());

        String token = jwtService.generateToken(
                user.getId().toString(),
                user.getEmail(),
                user.getTenant().getId().toString(),
                roles
        );

        log.info("User {} successfully logged in. Token generated.", request.getEmail());
        return ResponseEntity.ok(new LoginResponse(token));
    }

    @PostMapping("/register-company")
    @Transactional
    public ResponseEntity<?> registerCompany(@RequestBody com.contractiq.dto.CompanyRegistrationRequest request) {
        log.info("Company registration request received for company: {} admin: {}", request.getCompanyName(), request.getEmail());
        
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            log.warn("User email already exists: {}", request.getEmail());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email address is already registered");
        }

        // 1. Create Tenant
        com.contractiq.domain.Tenant tenant = new com.contractiq.domain.Tenant();
        tenant.setName(request.getCompanyName());
        tenant.setCreatedAt(java.time.LocalDateTime.now());
        tenant = tenantRepository.save(tenant);

        // 2. Fetch or create ROLE_ADMIN
        Role adminRole = roleRepository.findByName("ROLE_ADMIN")
                .orElseGet(() -> {
                    Role r = new Role();
                    r.setName("ROLE_ADMIN");
                    r.setUsers(new java.util.HashSet<>());
                    return roleRepository.save(r);
                });

        // 3. Create Admin User
        User adminUser = new User();
        adminUser.setEmail(request.getEmail());
        adminUser.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        adminUser.setTenant(tenant);
        adminUser.setRoles(new java.util.HashSet<>(java.util.Set.of(adminRole)));
        adminUser = userRepository.save(adminUser);

        if (adminRole.getUsers() == null) {
            adminRole.setUsers(new java.util.HashSet<>());
        }
        adminRole.getUsers().add(adminUser);
        roleRepository.save(adminRole);

        log.info("Successfully registered company {} and created admin user {}", tenant.getName(), adminUser.getEmail());
        return ResponseEntity.ok(java.util.Map.of("message", "Company and administrator user registered successfully"));
    }
}
