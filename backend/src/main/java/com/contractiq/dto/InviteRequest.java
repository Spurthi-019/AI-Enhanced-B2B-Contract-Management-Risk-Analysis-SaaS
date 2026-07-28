package com.contractiq.dto;

import lombok.Data;

@Data
public class InviteRequest {
    private String email;
    private String role; // Accepts 'ADMIN', 'LEGAL_REVIEWER', or 'EMPLOYEE'
}
