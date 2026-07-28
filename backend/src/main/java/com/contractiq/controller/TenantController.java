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

    public TenantController(
            UserRepository userRepository,
            RoleRepository roleRepository,
            PasswordEncoder passwordEncoder,
            EmailNotificationService emailNotificationService
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailNotificationService = emailNotificationService;
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
}
