using System;
using System.Windows.Forms;
using SportsCoderWinForm.Models;

namespace SportsCoderWinForm.Forms
{
    public partial class MatchOverlayForm : Form
    {
        private readonly Match _match;
        private System.Windows.Forms.Timer _updateTimer;

        public MatchOverlayForm(Match match)
        {
            InitializeComponent();
            _match = match;

            InitializeTimer();
            LoadMatchData();
        }

        private void InitializeTimer()
        {
            _updateTimer = new System.Windows.Forms.Timer();
            _updateTimer.Interval = 1000;
            _updateTimer.Tick += UpdateTimer_Tick;
            _updateTimer.Start();
        }

        private void LoadMatchData()
        {
            // 팀 정보 로드
            lblHomeTeam.Text = _match.HomeTeam;
            lblAwayTeam.Text = _match.AwayTeam;

            // 점수 로드
            lblHomeScore.Text = _match.HomeScore.ToString();
            lblAwayScore.Text = _match.AwayScore.ToString();

            // 통계 로드
            UpdateStats();
        }

        private void UpdateTimer_Tick(object sender, EventArgs e)
        {
            UpdateStats();
        }

        private void UpdateStats()
        {
            // 홈팀 통계
            lblHomeFouls.Text = _match.HomeFouls.ToString();
            lblHomeShots.Text = _match.HomeShots.ToString();
            lblHomeShotsOnTarget.Text = _match.HomeShotsOnTarget.ToString();
            lblHomeYellowCards.Text = _match.HomeYellowCards.ToString();
            lblHomeRedCards.Text = _match.HomeRedCards.ToString();
            lblHomeCorners.Text = _match.HomeCorners.ToString();
            lblHomeOffsides.Text = _match.HomeOffsides.ToString();
            lblHomePossession.Text = _match.HomePossession.ToString() + "%";

            // 원정팀 통계
            lblAwayFouls.Text = _match.AwayFouls.ToString();
            lblAwayShots.Text = _match.AwayShots.ToString();
            lblAwayShotsOnTarget.Text = _match.AwayShotsOnTarget.ToString();
            lblAwayYellowCards.Text = _match.AwayYellowCards.ToString();
            lblAwayRedCards.Text = _match.AwayRedCards.ToString();
            lblAwayCorners.Text = _match.AwayCorners.ToString();
            lblAwayOffsides.Text = _match.AwayOffsides.ToString();
            lblAwayPossession.Text = _match.AwayPossession.ToString() + "%";
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            base.OnFormClosing(e);
            _updateTimer.Stop();
            _updateTimer.Dispose();
        }
    }
} 