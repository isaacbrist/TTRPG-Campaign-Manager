using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace CampaignManager.Api.Services;

public class EmailService(IConfiguration config, ILogger<EmailService> logger) : IEmailService
{
    public async Task SendPasswordResetEmailAsync(string toEmail, string resetUrl)
    {
        var from = config["Email:From"]
            ?? throw new InvalidOperationException("Email:From is not configured.");

        var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(from));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = "Reset your Campaign Manager password";

        message.Body = new TextPart("html")
        {
            Text = $"""
                <!DOCTYPE html>
                <html>
                <body style="font-family:sans-serif;color:#374151;max-width:480px;margin:0 auto;padding:24px">
                  <h2 style="color:#d97706">⚔ Campaign Manager</h2>
                  <p>Someone requested a password reset for your account.</p>
                  <p style="margin:24px 0">
                    <a href="{resetUrl}"
                       style="background:#d97706;color:#1c1917;text-decoration:none;
                              padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block">
                      Reset Password
                    </a>
                  </p>
                  <p style="color:#6b7280;font-size:14px">
                    This link expires in <strong>1 hour</strong>. If you didn't request a reset,
                    you can safely ignore this email — your password won't change.
                  </p>
                  <p style="color:#9ca3af;font-size:12px;margin-top:32px">
                    Or copy this URL into your browser:<br/>
                    <span style="word-break:break-all">{resetUrl}</span>
                  </p>
                </body>
                </html>
                """,
        };

        using var client = new SmtpClient();

        var host = config["Email:Host"] ?? "localhost";
        var port = config.GetValue<int>("Email:Port", 587);
        var useSsl = config.GetValue<bool>("Email:UseSsl", false);
        var username = config["Email:Username"];
        var password = config["Email:Password"];

        logger.LogInformation("Sending password reset email to {Email} via {Host}:{Port}", toEmail, host, port);

        var socketOptions = useSsl
            ? SecureSocketOptions.SslOnConnect
            : SecureSocketOptions.StartTlsWhenAvailable;

        await client.ConnectAsync(host, port, socketOptions);

        if (!string.IsNullOrEmpty(username))
            await client.AuthenticateAsync(username, password);

        await client.SendAsync(message);
        await client.DisconnectAsync(quit: true);

        logger.LogInformation("Password reset email sent to {Email}", toEmail);
    }
}
