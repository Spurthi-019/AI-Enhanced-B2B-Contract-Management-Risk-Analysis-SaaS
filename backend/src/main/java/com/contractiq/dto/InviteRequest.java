package com.contractiq.dto;

import lombok.Data;

@Data
public class InviteRequest {
    private String email;
    private String role; // Accepts 'ADMIN', 'LEGAL_REVIEWER', or 'EMPLOYEE'

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
}
