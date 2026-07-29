package com.contractiq.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TenantUsersResponse {
    private String id;
    private String email;
    private List<String> roles;
}
