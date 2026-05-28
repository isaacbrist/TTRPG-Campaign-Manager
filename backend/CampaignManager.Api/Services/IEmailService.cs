namespace CampaignManager.Api.Services;

public interface IEmailService
{
    Task SendPasswordResetEmailAsync(string toEmail, string resetUrl);
}
