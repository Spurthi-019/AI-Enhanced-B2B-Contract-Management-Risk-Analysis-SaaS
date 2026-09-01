package com.contractiq.dto;

import lombok.Data;

@Data
public class CompanyRegistrationRequest {
    private String companyName;
    private String email;
    private String password;

    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
}
