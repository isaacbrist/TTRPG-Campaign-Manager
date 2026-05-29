using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using CampaignManager.Api;
using CampaignManager.Api.Data;
using CampaignManager.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// ── Services ─────────────────────────────────────────────────────────────────

builder.Services.AddControllers().AddJsonOptions(o =>
    o.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles);

builder.Services.AddEndpointsApiExplorer();

// Swagger with JWT bearer support
builder.Services.AddSwaggerGen(c =>
{
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter your JWT token (without the 'Bearer ' prefix).",
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

// Database — SQLite
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("Default")
        ?? "Data Source=campaign_manager.db"));

// Anthropic client
builder.Services.AddSingleton<IAnthropicMessageClient, AnthropicMessageClientWrapper>();
builder.Services.AddScoped<ClaudeService>();

// Email
builder.Services.AddScoped<IEmailService, EmailService>();

// JWT authentication
var jwtSecretKey = builder.Configuration["Jwt:SecretKey"]
    ?? throw new InvalidOperationException("Jwt:SecretKey is not configured. Add it to appsettings or user secrets.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecretKey)),
        };
    });

builder.Services.AddAuthorization();

// Rate limiting — protect AI endpoints from excessive calls
builder.Services.AddRateLimiter(options =>
{
    // Per-user fixed-window: 10 requests per 60-second window.
    // Partition key is the JWT "sub" claim so each user gets their own bucket.
    // Falls back to remote IP for any unauthenticated callers (belt-and-suspenders;
    // all three protected endpoints already require [Authorize]).
    options.AddPolicy(RateLimitPolicies.AiEndpoints, httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
                          ?? httpContext.Connection.RemoteIpAddress?.ToString()
                          ?? "anonymous",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,   // reject immediately rather than queuing
            }));

    // Return 429 with a Retry-After header when the limit is exceeded.
    options.OnRejected = async (context, cancellationToken) =>
    {
        // Ask the limiter how long to wait; fall back to the full window (60 s).
        var retryAfterSeconds = 60;
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
            retryAfterSeconds = (int)Math.Ceiling(retryAfter.TotalSeconds);

        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.HttpContext.Response.Headers["Retry-After"] = retryAfterSeconds.ToString();
        context.HttpContext.Response.ContentType = "application/problem+json";

        await context.HttpContext.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = StatusCodes.Status429TooManyRequests,
            Title = "Too Many Requests",
            Detail = "You have exceeded the AI endpoint rate limit (10 requests per minute). "
                   + $"Please wait {retryAfterSeconds} second(s) before trying again.",
        }, cancellationToken);
    };
});

// CORS — allow the Next.js dev server
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins("http://localhost:3000")
              .AllowAnyMethod()
              .AllowAnyHeader());
});

builder.Services.AddProblemDetails();

// ── Build ─────────────────────────────────────────────────────────────────────

var app = builder.Build();

// Apply any pending EF Core migrations on startup.
// New migrations are created with: dotnet ef migrations add <Name> --project CampaignManager.Api
// and applied automatically the next time the app starts (or manually with: dotnet ef database update).
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    // Migrate() only works with relational providers (SQLite, SQL Server, etc.).
    // Integration tests substitute an in-memory provider, so we fall back to
    // EnsureCreated() in that case to avoid an InvalidOperationException.
    if (db.Database.IsRelational())
        db.Database.Migrate();
    else
        db.Database.EnsureCreated();
}

// Global exception handler
app.UseExceptionHandler(errApp =>
{
    errApp.Run(async context =>
    {
        var logger = context.RequestServices
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger("GlobalExceptionHandler");

        var exceptionFeature = context.Features.Get<IExceptionHandlerFeature>();
        var exception = exceptionFeature?.Error;

        logger.LogError(exception, "Unhandled exception for {Method} {Path}",
            context.Request.Method, context.Request.Path);

        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/problem+json";

        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Title = "An unexpected error occurred.",
            Detail = app.Environment.IsDevelopment()
                ? exception?.Message
                : "Please try again later or contact support.",
        };

        await context.Response.WriteAsJsonAsync(problem);
    });
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();   // must come after UseAuthentication so HttpContext.User is populated
app.MapControllers();

app.Run();

// Expose Program to the test project via WebApplicationFactory<Program>
public partial class Program { }
