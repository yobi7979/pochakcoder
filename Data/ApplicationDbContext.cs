using Microsoft.EntityFrameworkCore;
using SportsCoderWinForm.Models;

namespace SportsCoderWinForm.Data
{
    public class ApplicationDbContext : DbContext
    {
        public DbSet<Match> Matches { get; set; }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            optionsBuilder.UseSqlite("Data Source=sports.db");
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Match>()
                .Property(m => m.CreatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");

            modelBuilder.Entity<Match>()
                .Property(m => m.UpdatedAt)
                .HasDefaultValueSql("CURRENT_TIMESTAMP");
        }
    }
} 