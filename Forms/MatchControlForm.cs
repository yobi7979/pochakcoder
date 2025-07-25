using System;
using System.Windows.Forms;
using SportsCoderWinForm.Models;
using SportsCoderWinForm.Data;
using System.Linq;

namespace SportsCoderWinForm.Forms
{
    public partial class MatchControlForm : Form
    {
        private readonly ApplicationDbContext _context;
        private readonly Match _match;
        private System.Windows.Forms.Timer _timer;
        private DateTime _matchTime;
        private bool _isHalfTime;

        public MatchControlForm(ApplicationDbContext context, Match match)
        {
            InitializeComponent();
            _context = context;
            _match = match;
            _matchTime = DateTime.Today.AddMinutes(45);
            _isHalfTime = false;

            InitializeTimer();
            LoadMatchData();
        }

        private void InitializeTimer()
        {
            _timer = new System.Windows.Forms.Timer();
            _timer.Interval = 1000;
            _timer.Tick += Timer_Tick;
        }

        private void LoadMatchData()
        {
            // 팀 정보 로드
            txtHomeTeam.Text = _match.HomeTeam;
            txtAwayTeam.Text = _match.AwayTeam;

            // 점수 로드
            numHomeScore.Value = _match.HomeScore;
            numAwayScore.Value = _match.AwayScore;

            // 경기 시간 로드
            UpdateTimeDisplay();
        }

        private void Timer_Tick(object sender, EventArgs e)
        {
            if (!_isHalfTime)
            {
                _matchTime = _matchTime.AddSeconds(1);
                UpdateTimeDisplay();
            }
        }

        private void UpdateTimeDisplay()
        {
            lblTime.Text = _matchTime.ToString("mm:ss");
        }

        private void btnStart_Click(object sender, EventArgs e)
        {
            _timer.Start();
        }

        private void btnStop_Click(object sender, EventArgs e)
        {
            _timer.Stop();
        }

        private void btnReset_Click(object sender, EventArgs e)
        {
            _matchTime = DateTime.Today.AddMinutes(45);
            _isHalfTime = false;
            UpdateTimeDisplay();
        }

        private void btnHalfTime_Click(object sender, EventArgs e)
        {
            _isHalfTime = true;
            _matchTime = DateTime.Today.AddMinutes(45);
            UpdateTimeDisplay();
        }

        private void btnEndMatch_Click(object sender, EventArgs e)
        {
            _timer.Stop();
            _match.Status = "종료";
            _context.SaveChanges();
            Close();
        }

        private void numHomeScore_ValueChanged(object sender, EventArgs e)
        {
            _match.HomeScore = (int)numHomeScore.Value;
            _context.SaveChanges();
        }

        private void numAwayScore_ValueChanged(object sender, EventArgs e)
        {
            _match.AwayScore = (int)numAwayScore.Value;
            _context.SaveChanges();
        }

        private void numHomeFouls_ValueChanged(object sender, EventArgs e)
        {
            _match.HomeFouls = (int)numHomeFouls.Value;
            _context.SaveChanges();
        }

        private void numAwayFouls_ValueChanged(object sender, EventArgs e)
        {
            _match.AwayFouls = (int)numAwayFouls.Value;
            _context.SaveChanges();
        }

        private void numHomeShots_ValueChanged(object sender, EventArgs e)
        {
            _match.HomeShots = (int)numHomeShots.Value;
            _context.SaveChanges();
        }

        private void numAwayShots_ValueChanged(object sender, EventArgs e)
        {
            _match.AwayShots = (int)numAwayShots.Value;
            _context.SaveChanges();
        }

        private void numHomeShotsOnTarget_ValueChanged(object sender, EventArgs e)
        {
            _match.HomeShotsOnTarget = (int)numHomeShotsOnTarget.Value;
            _context.SaveChanges();
        }

        private void numAwayShotsOnTarget_ValueChanged(object sender, EventArgs e)
        {
            _match.AwayShotsOnTarget = (int)numAwayShotsOnTarget.Value;
            _context.SaveChanges();
        }

        private void numHomeYellowCards_ValueChanged(object sender, EventArgs e)
        {
            _match.HomeYellowCards = (int)numHomeYellowCards.Value;
            _context.SaveChanges();
        }

        private void numAwayYellowCards_ValueChanged(object sender, EventArgs e)
        {
            _match.AwayYellowCards = (int)numAwayYellowCards.Value;
            _context.SaveChanges();
        }

        private void numHomeRedCards_ValueChanged(object sender, EventArgs e)
        {
            _match.HomeRedCards = (int)numHomeRedCards.Value;
            _context.SaveChanges();
        }

        private void numAwayRedCards_ValueChanged(object sender, EventArgs e)
        {
            _match.AwayRedCards = (int)numAwayRedCards.Value;
            _context.SaveChanges();
        }

        private void numHomeCorners_ValueChanged(object sender, EventArgs e)
        {
            _match.HomeCorners = (int)numHomeCorners.Value;
            _context.SaveChanges();
        }

        private void numAwayCorners_ValueChanged(object sender, EventArgs e)
        {
            _match.AwayCorners = (int)numAwayCorners.Value;
            _context.SaveChanges();
        }

        private void numHomeOffsides_ValueChanged(object sender, EventArgs e)
        {
            _match.HomeOffsides = (int)numHomeOffsides.Value;
            _context.SaveChanges();
        }

        private void numAwayOffsides_ValueChanged(object sender, EventArgs e)
        {
            _match.AwayOffsides = (int)numAwayOffsides.Value;
            _context.SaveChanges();
        }

        private void numHomePossession_ValueChanged(object sender, EventArgs e)
        {
            _match.HomePossession = (int)numHomePossession.Value;
            _context.SaveChanges();
        }

        private void numAwayPossession_ValueChanged(object sender, EventArgs e)
        {
            _match.AwayPossession = (int)numAwayPossession.Value;
            _context.SaveChanges();
        }

        private void btnShowOverlay_Click(object sender, EventArgs e)
        {
            var overlayForm = new MatchOverlayForm(_match);
            overlayForm.Show();
        }
    }
} 