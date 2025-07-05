using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;
using SportsCoderWinForm.Data;
using SportsCoderWinForm.Models;

namespace SportsCoderWinForm.Forms
{
    public partial class CreateMatchForm : Form
    {
        private readonly ApplicationDbContext _context;

        public CreateMatchForm(ApplicationDbContext context)
        {
            InitializeComponent();
            _context = context;
        }

        private void btnSave_Click(object sender, EventArgs e)
        {
            if (string.IsNullOrWhiteSpace(txtHomeTeam.Text) || string.IsNullOrWhiteSpace(txtAwayTeam.Text))
            {
                MessageBox.Show("홈팀과 원정팀 이름을 모두 입력해주세요.", "입력 오류", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            var match = new Match
            {
                SportType = "soccer",
                HomeTeam = txtHomeTeam.Text,
                AwayTeam = txtAwayTeam.Text,
                Status = "pending",
                MatchData = new Dictionary<string, object>
                {
                    { "match_time", "00:00" },
                    { "half_time", false },
                    { "home_stats", new Dictionary<string, object>
                        {
                            { "fouls", 0 },
                            { "shots", 0 },
                            { "shots_on_target", 0 },
                            { "corners", 0 },
                            { "offsides", 0 },
                            { "yellow_cards", 0 },
                            { "red_cards", 0 }
                        }
                    },
                    { "away_stats", new Dictionary<string, object>
                        {
                            { "fouls", 0 },
                            { "shots", 0 },
                            { "shots_on_target", 0 },
                            { "corners", 0 },
                            { "offsides", 0 },
                            { "yellow_cards", 0 },
                            { "red_cards", 0 }
                        }
                    }
                }
            };

            _context.Matches.Add(match);
            _context.SaveChanges();

            DialogResult = DialogResult.OK;
            Close();
        }

        private void btnCancel_Click(object sender, EventArgs e)
        {
            DialogResult = DialogResult.Cancel;
            Close();
        }
    }
} 