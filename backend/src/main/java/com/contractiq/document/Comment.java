package com.contractiq.document;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;

import org.springframework.data.annotation.CreatedDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Comment {

    @Id
    private String id;
    
    private String authorId;
    
    private String text;
    
    private boolean isVendorFacing; // strict internal/vendor separation flag
    
    @CreatedDate
    private LocalDateTime createdAt;
}
