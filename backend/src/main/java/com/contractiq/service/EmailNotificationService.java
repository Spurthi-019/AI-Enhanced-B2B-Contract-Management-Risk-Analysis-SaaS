package com.contractiq.service;

import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class EmailNotificationService {

    private static final Logger log = LoggerFactory.getLogger(EmailNotificationService.class);

    private final JavaMailSender mailSender;

    public EmailNotificationService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendVendorPortalLink(String toEmail, String title, String magicLink) {
        log.info("Preparing vendor portal invite for: {} link: {}", toEmail, magicLink);
        
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            
            helper.setTo(toEmail);
            helper.setSubject("Contract Review Invite: " + title);
            
            String htmlContent = String.format("""
                <html>
                <body style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #2c3e50;">Contract Review Invitation</h2>
                    <p>You have been invited to review the contract: <strong>%s</strong>.</p>
                    <p>Please click the button below to securely access the review portal (active for 7 days):</p>
                    <div style="margin: 25px 0;">
                        <a href="%s" style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Access Review Portal</a>
                    </div>
                    <p style="color: #7f8c8d; font-size: 12px;">This is an automated security transmission from ContractIQ.</p>
                </body>
                </html>
                """, title, magicLink);
            
            helper.setText(htmlContent, true);
            
            // Send the email
            mailSender.send(message);
            log.info("Successfully dispatched email invitation to: {}", toEmail);
        } catch (Exception e) {
            // Graceful handling to prevent breaking runtime operations if SMTP is offline/unreachable
            log.error("Failed to send HTML portal invitation to: {} via SMTP. (Reason: {})", toEmail, e.getMessage());
            log.warn("DISPATCH MOCK LOG: [Vendor Email Invitation: {} -> Magic Link: {}]", toEmail, magicLink);
        }
    }
}
