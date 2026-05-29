using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace CampaignManager.Tests;

/// <summary>
/// A minimal authentication handler used in integration tests.
/// Every incoming request is automatically authenticated as a fixed test user,
/// so [Authorize]-decorated controllers can be exercised without a real JWT.
/// Registered via TestAuthHandler.SchemeName in WebApplicationFactory setup.
/// </summary>
public class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string SchemeName = "Test";

    /// <summary>
    /// Fixed user ID injected into every test request's ClaimsPrincipal.
    /// Controllers that filter by user (e.g. c.UserId == CurrentUserId) will
    /// see this value and all test-created records will be owned by it.
    /// </summary>
    public const string TestUserId = "test-user-00000000";

    public TestAuthHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder) { }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var claims = new[] { new Claim(ClaimTypes.NameIdentifier, TestUserId) };
        var identity = new ClaimsIdentity(claims, SchemeName);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, SchemeName);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
