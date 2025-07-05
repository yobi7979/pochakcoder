using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;

namespace SportsCoderWinForm.Models
{
    [Table("Matches")]
    public class Match
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string SportType { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string HomeTeam { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string AwayTeam { get; set; } = string.Empty;

        public int HomeScore { get; set; } = 0;

        public int AwayScore { get; set; } = 0;

        [MaxLength(20)]
        public string Status { get; set; } = "pending";

        [Column(TypeName = "TEXT")]
        public string MatchDataJson { get; set; } = "{}";

        [NotMapped]
        public Dictionary<string, object> MatchData
        {
            get
            {
                try
                {
                    return JsonConvert.DeserializeObject<Dictionary<string, object>>(MatchDataJson) ?? new Dictionary<string, object>();
                }
                catch
                {
                    return new Dictionary<string, object>();
                }
            }
            set
            {
                MatchDataJson = JsonConvert.SerializeObject(value);
            }
        }

        public DateTime CreatedAt { get; set; } = DateTime.Now;

        public DateTime UpdatedAt { get; set; } = DateTime.Now;
    }
} 