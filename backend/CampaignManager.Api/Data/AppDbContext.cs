using Microsoft.EntityFrameworkCore;
using CampaignManager.Api.Models;

namespace CampaignManager.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Campaign> Campaigns => Set<Campaign>();
    public DbSet<Npc> Npcs => Set<Npc>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<RecapDraft> RecapDrafts => Set<RecapDraft>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Users — unique email index
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        // User → Campaigns (one-to-many, nullable FK so old campaigns aren't orphaned)
        modelBuilder.Entity<User>()
            .HasMany(u => u.Campaigns)
            .WithOne(c => c.User)
            .HasForeignKey(c => c.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        // Campaign → Npcs
        modelBuilder.Entity<Campaign>()
            .HasMany(c => c.Npcs)
            .WithOne(n => n.Campaign)
            .HasForeignKey(n => n.CampaignId)
            .OnDelete(DeleteBehavior.Cascade);

        // Campaign → Sessions
        modelBuilder.Entity<Campaign>()
            .HasMany(c => c.Sessions)
            .WithOne(s => s.Campaign)
            .HasForeignKey(s => s.CampaignId)
            .OnDelete(DeleteBehavior.Cascade);

        // Campaign → RecapDrafts
        modelBuilder.Entity<Campaign>()
            .HasMany(c => c.RecapDrafts)
            .WithOne(r => r.Campaign)
            .HasForeignKey(r => r.CampaignId)
            .OnDelete(DeleteBehavior.Cascade);

        // User → PasswordResetTokens
        modelBuilder.Entity<PasswordResetToken>()
            .HasOne(t => t.User)
            .WithMany()
            .HasForeignKey(t => t.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Index on TokenHash for fast lookup during reset
        modelBuilder.Entity<PasswordResetToken>()
            .HasIndex(t => t.TokenHash)
            .IsUnique();
    }
}
