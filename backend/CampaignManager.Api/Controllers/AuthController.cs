using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using CampaignManager.Api.Data;
using CampaignManager.Api.Dtos;
using CampaignManager.Api.Models;
using CampaignManager.Api.Services;

namespace CampaignManager.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[AllowAnonymous]
public class AuthController(
    AppDbContext db,
    IConfiguration config,
    IEmailService emailService,
    ILogger<AuthController> logger) : ControllerBase
{
    // ── POST /api/auth/register ──────────────────────────────────────────────

    [HttpPost("register")]
    public async Task<IActionResult> Register(AuthRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { message = "Email and password are required." });

        var email = request.Email.Trim().ToLowerInvariant();

        if (await db.Users.AnyAsync(u => u.Email == email))
            return Conflict(new { message = "An account with that email already exists." });

        var user = new User
        {
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        return Ok(BuildAuthResponse(user));
    }

    // ── POST /api/auth/login ─────────────────────────────────────────────────

    [HttpPost("login")]
    public async Task<IActionResult> Login(AuthRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { message = "Email and password are required." });

        var email = request.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);

        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized(new { message = "Invalid email or password." });

        return Ok(BuildAuthResponse(user));
    }

    // ── GET /api/auth/me ─────────────────────────────────────────────────────

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var user = await db.Users.FindAsync(userId);
        if (user is null) return NotFound();

        return Ok(new { user.Id, user.Email, user.CreatedAt });
    }

    // ── POST /api/auth/forgot-password ───────────────────────────────────────

    /// <summary>
    /// Sends a password reset email if the given address matches an account.
    /// Always returns 200 so callers cannot enumerate registered email addresses.
    /// </summary>
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);

        // Return 200 regardless so callers can't tell whether the email exists.
        if (user is null) return Ok();

        // Invalidate any unexpired, unused tokens already issued for this user.
        var stale = await db.PasswordResetTokens
            .Where(t => t.UserId == user.Id && t.UsedAt == null && t.ExpiresAt > DateTime.UtcNow)
            .ToListAsync();
        db.PasswordResetTokens.RemoveRange(stale);

        // Generate a cryptographically secure URL-safe token.
        var rawToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');

        var tokenHash = HashToken(rawToken);

        db.PasswordResetTokens.Add(new PasswordResetToken
        {
            UserId   = user.Id,
            TokenHash = tokenHash,
            ExpiresAt = DateTime.UtcNow.AddHours(1),
        });
        await db.SaveChangesAsync();

        var frontendBase = (config["App:FrontendBaseUrl"] ?? "http://localhost:3000").TrimEnd('/');
        var resetUrl = $"{frontendBase}/reset-password?token={rawToken}";

        try
        {
            await emailService.SendPasswordResetEmailAsync(user.Email, resetUrl);
        }
        catch (Exception ex)
        {
            // Log but swallow — we don't expose email send failures to the client.
            logger.LogError(ex, "Failed to send password reset email to {Email}", user.Email);
        }

        return Ok();
    }

    // ── POST /api/auth/reset-password ────────────────────────────────────────

    /// <summary>
    /// Validates the reset token and updates the user's password.
    /// Marks the token as used so it cannot be redeemed a second time.
    /// </summary>
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest request)
    {
        // [MinLength(8)] on the DTO handles the length check, but guard here too.
        if (request.NewPassword.Length < 8)
            return BadRequest(new { message = "Password must be at least 8 characters." });

        var tokenHash = HashToken(request.Token);

        var token = await db.PasswordResetTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash && t.UsedAt == null);

        if (token is null || token.ExpiresAt < DateTime.UtcNow)
            return BadRequest(new { message = "This reset link is invalid or has expired." });

        token.User!.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        token.UsedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Ok(new { message = "Password updated successfully. You can now log in." });
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static string HashToken(string rawToken) =>
        Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));

    private object BuildAuthResponse(User user) => new
    {
        token = GenerateJwt(user),
        user = new { user.Id, user.Email, user.CreatedAt },
    };

    private string GenerateJwt(User user)
    {
        var secretKey = config["Jwt:SecretKey"]
            ?? throw new InvalidOperationException("Jwt:SecretKey is not configured.");

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };

        var token = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"],
            audience: config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddDays(30),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
