package com.contractiq.dto;

import lombok.Data;

@Data
public class CompanyRegistrationRequest {
    private String companyName;
    private String email;
    private String password;
}
