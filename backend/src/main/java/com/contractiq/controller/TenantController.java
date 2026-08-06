package com.contractiq.controller;

import com.contractiq.domain.Role;
import com.contractiq.domain.Tenant;
import com.contractiq.domain.User;
import com.contractiq.dto.InviteRequest;
import com.contractiq.repository.RoleRepository;
import com.contractiq.repository.UserRepository;
import com.contractiq.service.EmailNotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.HashSet;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/tenants")
public class TenantController {

    private static final Logger log = LoggerFactory.getLogger(TenantController.class);

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailNotificationService emailNotificationService;
    private final com.contractiq.repository.TenantRepository tenantRepository;

    public TenantController(
            UserRepository userRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder,
            EmailNotificationService emailNotificationService,
            com.contractiq.repository.TenantRepository tenantRepository
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailNotificationService = emailNotificationService;
        this.tenantRepository = tenantRepository;
    }

    @PostMapping("/invite")
    @Transactional
    public ResponseEntity<?> inviteUser(@RequestBody InviteRequest request, Principal principal) {
        log.info("Invite user request received from Admin: {} to invite: {} as: {}", 
                principal.getName(), request.getEmail(), request.getRole());

        // 1. Fetch current logged-in admin user to verify their tenant
        UUID adminId = UUID.fromString(principal.getName());
        User admin = userRepository.findById(adminId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Admin user not found"));

        Tenant tenant = admin.getTenant();
        if (tenant == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Current user is not mapped to any tenant workspace");
        }

        // 2. Validate role selection and map to spring authority prefixed name
        String rawRole = request.getRole();
        if (rawRole == null || (!rawRole.equals("ADMIN") && !rawRole.equals("LEGAL_REVIEWER") && !rawRole.equals("EMPLOYEE"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid role parameter. Must be ADMIN, LEGAL_REVIEWER, or EMPLOYEE");
        }

        String roleName = "ROLE_" + rawRole;

        // 3. Find or create the target Role
        Role targetRole = roleRepository.findByName(roleName)
                .orElseGet(() -> {
                    Role r = new Role();
                    r.setName(roleName);
                    r.setUsers(new HashSet<>());
                    return roleRepository.save(r);
                });

        // 3.5 Check plan user seat limits
        java.util.List<User> workspaceUsers = userRepository.findByTenantId(tenant.getId());
        long currentUsersCount = workspaceUsers.size();
        String currentPlan = tenant.getSubscriptionPlan() != null ? tenant.getSubscriptionPlan() : "FREE";
        if (currentPlan.equals("FREE") && currentUsersCount >= 2) {
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, "Invitation failed: Free tier is limited to 2 users. Please upgrade to Pro.");
        }
        if (currentPlan.equals("PRO") && currentUsersCount >= 20) {
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, "Invitation failed: Pro tier is limited to 20 users. Please upgrade to Enterprise.");
        }

        // 4. Check if the invited email already exists in system database
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "User email address is already registered in the system");
        }

        // 5. Create new User with default password
        String tempPassword = "welcome123";
        User newUser = new User();
        newUser.setEmail(request.getEmail());
        newUser.setPasswordHash(passwordEncoder.encode(tempPassword));
        newUser.setTenant(tenant);
        newUser.setRoles(new HashSet<>());
        newUser.getRoles().add(targetRole);
        newUser = userRepository.save(newUser);

        if (targetRole.getUsers() == null) {
            targetRole.setUsers(new HashSet<>());
        }
        targetRole.getUsers().add(newUser);
        roleRepository.save(targetRole);

        // 6. Send invitation email
        emailNotificationService.sendTeamInvitation(
                newUser.getEmail(),
                tenant.getName(),
                rawRole,
                tempPassword
        );

        log.info("Successfully invited user {} to company {} as {}", newUser.getEmail(), tenant.getName(), rawRole);
        return ResponseEntity.ok(java.util.Map.of("message", "Invitation sent successfully to " + request.getEmail()));
    }

    @GetMapping("/users")
    public ResponseEntity<java.util.List<com.contractiq.dto.TenantUsersResponse>> getTenantUsers(Principal principal) {
        log.info("Request to list workspace roster received from user: {}", principal.getName());
        
        UUID userId = UUID.fromString(principal.getName());
        User currentUser = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
                
        Tenant tenant = currentUser.getTenant();
        if (tenant == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Current user is not mapped to any tenant workspace");
        }
        
        java.util.List<User> workspaceUsers = userRepository.findByTenantId(tenant.getId());
        java.util.List<com.contractiq.dto.TenantUsersResponse> response = workspaceUsers.stream()
                .map(u -> new com.contractiq.dto.TenantUsersResponse(
                        u.getId().toString(),
                        u.getEmail(),
                        u.getRoles().stream().map(Role::getName).collect(java.util.stream.Collectors.toList())
                ))
                .collect(java.util.stream.Collectors.toList());
                
        return ResponseEntity.ok(response);
    }

    @GetMapping("/settings")
    public ResponseEntity<com.contractiq.dto.TenantSettingsDto> getTenantSettings(Principal principal) {
        log.info("Request to get tenant settings received from user: {}", principal.getName());
        
        UUID userId = UUID.fromString(principal.getName());
        User currentUser = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
                
        Tenant tenant = currentUser.getTenant();
        if (tenant == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Current user is not mapped to any tenant workspace");
        }
        
        String companyName = tenant.getCompanyName();
        if (companyName == null || companyName.trim().isEmpty()) {
            companyName = tenant.getName();
        }
        
        com.contractiq.dto.TenantSettingsDto dto = new com.contractiq.dto.TenantSettingsDto(
                companyName,
                tenant.getDomain(),
                tenant.getAiModel(),
                tenant.getRiskSensitivity(),
                tenant.getMagicLinkExpiryDays(),
                tenant.getWebhookUrl(),
                tenant.getSubscriptionPlan()
        );
        return ResponseEntity.ok(dto);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/settings")
    @Transactional
    public ResponseEntity<com.contractiq.dto.TenantSettingsDto> updateTenantSettings(
            Principal principal,
            @RequestBody com.contractiq.dto.TenantSettingsDto request
    ) {
        log.info("Request to update tenant settings received from user: {}", principal.getName());
        
        UUID userId = UUID.fromString(principal.getName());
        User currentUser = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
                
        // Admin role enforced by @PreAuthorize annotation 
        Tenant tenant = currentUser.getTenant();
        if (tenant == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Current user is not mapped to any tenant workspace");
        }
        
        tenant.setCompanyName(request.getCompanyName());
        tenant.setDomain(request.getDomain());
        if (request.getAiModel() != null) {
            tenant.setAiModel(request.getAiModel());
        }
        if (request.getRiskSensitivity() != null) {
            tenant.setRiskSensitivity(request.getRiskSensitivity());
        }
        if (request.getMagicLinkExpiryDays() != null) {
            tenant.setMagicLinkExpiryDays(request.getMagicLinkExpiryDays());
        }
        tenant.setWebhookUrl(request.getWebhookUrl());
        
        Tenant savedTenant = tenantRepository.save(tenant);
        
        com.contractiq.dto.TenantSettingsDto responseDto = new com.contractiq.dto.TenantSettingsDto(
                savedTenant.getCompanyName() != null ? savedTenant.getCompanyName() : savedTenant.getName(),
                savedTenant.getDomain(),
                savedTenant.getAiModel(),
                savedTenant.getRiskSensitivity(),
                savedTenant.getMagicLinkExpiryDays(),
                savedTenant.getWebhookUrl(),
                savedTenant.getSubscriptionPlan()
        );
        return ResponseEntity.ok(responseDto);
    }

    @PutMapping("/subscription")
    @Transactional
    public ResponseEntity<com.contractiq.dto.TenantSettingsDto> updateSubscriptionPlan(
            Principal principal,
            @RequestParam("plan") String plan
    ) {
        log.info("Request to update subscription plan to {} received from user: {}", plan, principal.getName());
        
        UUID userId = UUID.fromString(principal.getName());
        User currentUser = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
                
        Tenant tenant = currentUser.getTenant();
        if (tenant == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Current user is not mapped to any tenant workspace");
        }
        
        String upperPlan = plan.toUpperCase();
        if (!upperPlan.equals("FREE") && !upperPlan.equals("PRO") && !upperPlan.equals("ENTERPRISE")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid subscription plan. Must be FREE, PRO, or ENTERPRISE");
        }
        
        tenant.setSubscriptionPlan(upperPlan);
        Tenant savedTenant = tenantRepository.save(tenant);
        
        com.contractiq.dto.TenantSettingsDto responseDto = new com.contractiq.dto.TenantSettingsDto(
                savedTenant.getCompanyName() != null ? savedTenant.getCompanyName() : savedTenant.getName(),
                savedTenant.getDomain(),
                savedTenant.getAiModel(),
                savedTenant.getRiskSensitivity(),
                savedTenant.getMagicLinkExpiryDays(),
                savedTenant.getWebhookUrl(),
                savedTenant.getSubscriptionPlan()
        );
        return ResponseEntity.ok(responseDto);
    }
}
