namespace SportsCoderWinForm.Forms
{
    partial class MatchControlForm
    {
        /// <summary>
        /// Required designer variable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        /// <summary>
        /// Required method for Designer support - do not modify
        /// the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            this.components = new System.ComponentModel.Container();
            this.panelTop = new System.Windows.Forms.Panel();
            this.lblTime = new System.Windows.Forms.Label();
            this.btnStart = new System.Windows.Forms.Button();
            this.btnStop = new System.Windows.Forms.Button();
            this.btnReset = new System.Windows.Forms.Button();
            this.btnHalfTime = new System.Windows.Forms.Button();
            this.btnEndMatch = new System.Windows.Forms.Button();
            this.panelScore = new System.Windows.Forms.Panel();
            this.txtHomeTeam = new System.Windows.Forms.TextBox();
            this.txtAwayTeam = new System.Windows.Forms.TextBox();
            this.numHomeScore = new System.Windows.Forms.NumericUpDown();
            this.numAwayScore = new System.Windows.Forms.NumericUpDown();
            this.label1 = new System.Windows.Forms.Label();
            this.panelStats = new System.Windows.Forms.Panel();
            this.groupHomeStats = new System.Windows.Forms.GroupBox();
            this.numHomeFouls = new System.Windows.Forms.NumericUpDown();
            this.numHomeShots = new System.Windows.Forms.NumericUpDown();
            this.numHomeShotsOnTarget = new System.Windows.Forms.NumericUpDown();
            this.numHomeYellowCards = new System.Windows.Forms.NumericUpDown();
            this.numHomeRedCards = new System.Windows.Forms.NumericUpDown();
            this.numHomeCorners = new System.Windows.Forms.NumericUpDown();
            this.numHomeOffsides = new System.Windows.Forms.NumericUpDown();
            this.numHomePossession = new System.Windows.Forms.NumericUpDown();
            this.label2 = new System.Windows.Forms.Label();
            this.label3 = new System.Windows.Forms.Label();
            this.label4 = new System.Windows.Forms.Label();
            this.label5 = new System.Windows.Forms.Label();
            this.label6 = new System.Windows.Forms.Label();
            this.label7 = new System.Windows.Forms.Label();
            this.label8 = new System.Windows.Forms.Label();
            this.label9 = new System.Windows.Forms.Label();
            this.groupAwayStats = new System.Windows.Forms.GroupBox();
            this.numAwayFouls = new System.Windows.Forms.NumericUpDown();
            this.numAwayShots = new System.Windows.Forms.NumericUpDown();
            this.numAwayShotsOnTarget = new System.Windows.Forms.NumericUpDown();
            this.numAwayYellowCards = new System.Windows.Forms.NumericUpDown();
            this.numAwayRedCards = new System.Windows.Forms.NumericUpDown();
            this.numAwayCorners = new System.Windows.Forms.NumericUpDown();
            this.numAwayOffsides = new System.Windows.Forms.NumericUpDown();
            this.numAwayPossession = new System.Windows.Forms.NumericUpDown();
            this.label10 = new System.Windows.Forms.Label();
            this.label11 = new System.Windows.Forms.Label();
            this.label12 = new System.Windows.Forms.Label();
            this.label13 = new System.Windows.Forms.Label();
            this.label14 = new System.Windows.Forms.Label();
            this.label15 = new System.Windows.Forms.Label();
            this.label16 = new System.Windows.Forms.Label();
            this.label17 = new System.Windows.Forms.Label();
            this.btnShowOverlay = new System.Windows.Forms.Button();
            this.panelTop.SuspendLayout();
            this.panelScore.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.numHomeScore)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.numAwayScore)).BeginInit();
            this.panelStats.SuspendLayout();
            this.groupHomeStats.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.numHomeFouls)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.numHomeShots)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.numHomeShotsOnTarget)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.numHomeYellowCards)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.numHomeRedCards)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.numHomeCorners)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.numHomeOffsides)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.numHomePossession)).BeginInit();
            this.groupAwayStats.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.numAwayFouls)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.numAwayShots)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.numAwayShotsOnTarget)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.numAwayYellowCards)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.numAwayRedCards)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.numAwayCorners)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.numAwayOffsides)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.numAwayPossession)).BeginInit();
            this.SuspendLayout();
            // 
            // panelTop
            // 
            this.panelTop.Controls.Add(this.lblTime);
            this.panelTop.Controls.Add(this.btnStart);
            this.panelTop.Controls.Add(this.btnStop);
            this.panelTop.Controls.Add(this.btnReset);
            this.panelTop.Controls.Add(this.btnHalfTime);
            this.panelTop.Controls.Add(this.btnEndMatch);
            this.panelTop.Dock = System.Windows.Forms.DockStyle.Top;
            this.panelTop.Location = new System.Drawing.Point(0, 0);
            this.panelTop.Name = "panelTop";
            this.panelTop.Size = new System.Drawing.Size(800, 50);
            this.panelTop.TabIndex = 0;
            // 
            // lblTime
            // 
            this.lblTime.AutoSize = true;
            this.lblTime.Font = new System.Drawing.Font("Segoe UI", 16F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point);
            this.lblTime.Location = new System.Drawing.Point(12, 12);
            this.lblTime.Name = "lblTime";
            this.lblTime.Size = new System.Drawing.Size(65, 30);
            this.lblTime.TabIndex = 0;
            this.lblTime.Text = "45:00";
            // 
            // btnStart
            // 
            this.btnStart.Location = new System.Drawing.Point(200, 12);
            this.btnStart.Name = "btnStart";
            this.btnStart.Size = new System.Drawing.Size(75, 30);
            this.btnStart.TabIndex = 1;
            this.btnStart.Text = "시작";
            this.btnStart.UseVisualStyleBackColor = true;
            this.btnStart.Click += new System.EventHandler(this.btnStart_Click);
            // 
            // btnStop
            // 
            this.btnStop.Location = new System.Drawing.Point(281, 12);
            this.btnStop.Name = "btnStop";
            this.btnStop.Size = new System.Drawing.Size(75, 30);
            this.btnStop.TabIndex = 2;
            this.btnStop.Text = "정지";
            this.btnStop.UseVisualStyleBackColor = true;
            this.btnStop.Click += new System.EventHandler(this.btnStop_Click);
            // 
            // btnReset
            // 
            this.btnReset.Location = new System.Drawing.Point(362, 12);
            this.btnReset.Name = "btnReset";
            this.btnReset.Size = new System.Drawing.Size(75, 30);
            this.btnReset.TabIndex = 3;
            this.btnReset.Text = "리셋";
            this.btnReset.UseVisualStyleBackColor = true;
            this.btnReset.Click += new System.EventHandler(this.btnReset_Click);
            // 
            // btnHalfTime
            // 
            this.btnHalfTime.Location = new System.Drawing.Point(443, 12);
            this.btnHalfTime.Name = "btnHalfTime";
            this.btnHalfTime.Size = new System.Drawing.Size(75, 30);
            this.btnHalfTime.TabIndex = 4;
            this.btnHalfTime.Text = "하프타임";
            this.btnHalfTime.UseVisualStyleBackColor = true;
            this.btnHalfTime.Click += new System.EventHandler(this.btnHalfTime_Click);
            // 
            // btnEndMatch
            // 
            this.btnEndMatch.Location = new System.Drawing.Point(524, 12);
            this.btnEndMatch.Name = "btnEndMatch";
            this.btnEndMatch.Size = new System.Drawing.Size(75, 30);
            this.btnEndMatch.TabIndex = 5;
            this.btnEndMatch.Text = "경기종료";
            this.btnEndMatch.UseVisualStyleBackColor = true;
            this.btnEndMatch.Click += new System.EventHandler(this.btnEndMatch_Click);
            // 
            // panelScore
            // 
            this.panelScore.Controls.Add(this.txtHomeTeam);
            this.panelScore.Controls.Add(this.txtAwayTeam);
            this.panelScore.Controls.Add(this.numHomeScore);
            this.panelScore.Controls.Add(this.numAwayScore);
            this.panelScore.Controls.Add(this.label1);
            this.panelScore.Dock = System.Windows.Forms.DockStyle.Top;
            this.panelScore.Location = new System.Drawing.Point(0, 50);
            this.panelScore.Name = "panelScore";
            this.panelScore.Size = new System.Drawing.Size(800, 100);
            this.panelScore.TabIndex = 1;
            // 
            // txtHomeTeam
            // 
            this.txtHomeTeam.Location = new System.Drawing.Point(12, 12);
            this.txtHomeTeam.Name = "txtHomeTeam";
            this.txtHomeTeam.ReadOnly = true;
            this.txtHomeTeam.Size = new System.Drawing.Size(200, 23);
            this.txtHomeTeam.TabIndex = 0;
            // 
            // txtAwayTeam
            // 
            this.txtAwayTeam.Location = new System.Drawing.Point(588, 12);
            this.txtAwayTeam.Name = "txtAwayTeam";
            this.txtAwayTeam.ReadOnly = true;
            this.txtAwayTeam.Size = new System.Drawing.Size(200, 23);
            this.txtAwayTeam.TabIndex = 1;
            // 
            // numHomeScore
            // 
            this.numHomeScore.Font = new System.Drawing.Font("Segoe UI", 16F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point);
            this.numHomeScore.Location = new System.Drawing.Point(12, 41);
            this.numHomeScore.Name = "numHomeScore";
            this.numHomeScore.Size = new System.Drawing.Size(80, 36);
            this.numHomeScore.TabIndex = 2;
            this.numHomeScore.ValueChanged += new System.EventHandler(this.numHomeScore_ValueChanged);
            // 
            // numAwayScore
            // 
            this.numAwayScore.Font = new System.Drawing.Font("Segoe UI", 16F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point);
            this.numAwayScore.Location = new System.Drawing.Point(708, 41);
            this.numAwayScore.Name = "numAwayScore";
            this.numAwayScore.Size = new System.Drawing.Size(80, 36);
            this.numAwayScore.TabIndex = 3;
            this.numAwayScore.ValueChanged += new System.EventHandler(this.numAwayScore_ValueChanged);
            // 
            // label1
            // 
            this.label1.AutoSize = true;
            this.label1.Font = new System.Drawing.Font("Segoe UI", 16F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point);
            this.label1.Location = new System.Drawing.Point(380, 43);
            this.label1.Name = "label1";
            this.label1.Size = new System.Drawing.Size(24, 30);
            this.label1.TabIndex = 4;
            this.label1.Text = "-";
            // 
            // panelStats
            // 
            this.panelStats.Controls.Add(this.groupHomeStats);
            this.panelStats.Controls.Add(this.groupAwayStats);
            this.panelStats.Dock = System.Windows.Forms.DockStyle.Fill;
            this.panelStats.Location = new System.Drawing.Point(0, 150);
            this.panelStats.Name = "panelStats";
            this.panelStats.Size = new System.Drawing.Size(800, 300);
            this.panelStats.TabIndex = 2;
            // 
            // groupHomeStats
            // 
            this.groupHomeStats.Controls.Add(this.numHomeFouls);
            this.groupHomeStats.Controls.Add(this.numHomeShots);
            this.groupHomeStats.Controls.Add(this.numHomeShotsOnTarget);
            this.groupHomeStats.Controls.Add(this.numHomeYellowCards);
            this.groupHomeStats.Controls.Add(this.numHomeRedCards);
            this.groupHomeStats.Controls.Add(this.numHomeCorners);
            this.groupHomeStats.Controls.Add(this.numHomeOffsides);
            this.groupHomeStats.Controls.Add(this.numHomePossession);
            this.groupHomeStats.Controls.Add(this.label2);
            this.groupHomeStats.Controls.Add(this.label3);
            this.groupHomeStats.Controls.Add(this.label4);
            this.groupHomeStats.Controls.Add(this.label5);
            this.groupHomeStats.Controls.Add(this.label6);
            this.groupHomeStats.Controls.Add(this.label7);
            this.groupHomeStats.Controls.Add(this.label8);
            this.groupHomeStats.Controls.Add(this.label9);
            this.groupHomeStats.Location = new System.Drawing.Point(12, 12);
            this.groupHomeStats.Name = "groupHomeStats";
            this.groupHomeStats.Size = new System.Drawing.Size(380, 276);
            this.groupHomeStats.TabIndex = 0;
            this.groupHomeStats.TabStop = false;
            this.groupHomeStats.Text = "홈팀 통계";
            // 
            // numHomeFouls
            // 
            this.numHomeFouls.Location = new System.Drawing.Point(120, 30);
            this.numHomeFouls.Name = "numHomeFouls";
            this.numHomeFouls.Size = new System.Drawing.Size(60, 23);
            this.numHomeFouls.TabIndex = 0;
            this.numHomeFouls.ValueChanged += new System.EventHandler(this.numHomeFouls_ValueChanged);
            // 
            // numHomeShots
            // 
            this.numHomeShots.Location = new System.Drawing.Point(120, 60);
            this.numHomeShots.Name = "numHomeShots";
            this.numHomeShots.Size = new System.Drawing.Size(60, 23);
            this.numHomeShots.TabIndex = 1;
            this.numHomeShots.ValueChanged += new System.EventHandler(this.numHomeShots_ValueChanged);
            // 
            // numHomeShotsOnTarget
            // 
            this.numHomeShotsOnTarget.Location = new System.Drawing.Point(120, 90);
            this.numHomeShotsOnTarget.Name = "numHomeShotsOnTarget";
            this.numHomeShotsOnTarget.Size = new System.Drawing.Size(60, 23);
            this.numHomeShotsOnTarget.TabIndex = 2;
            this.numHomeShotsOnTarget.ValueChanged += new System.EventHandler(this.numHomeShotsOnTarget_ValueChanged);
            // 
            // numHomeYellowCards
            // 
            this.numHomeYellowCards.Location = new System.Drawing.Point(120, 120);
            this.numHomeYellowCards.Name = "numHomeYellowCards";
            this.numHomeYellowCards.Size = new System.Drawing.Size(60, 23);
            this.numHomeYellowCards.TabIndex = 3;
            this.numHomeYellowCards.ValueChanged += new System.EventHandler(this.numHomeYellowCards_ValueChanged);
            // 
            // numHomeRedCards
            // 
            this.numHomeRedCards.Location = new System.Drawing.Point(120, 150);
            this.numHomeRedCards.Name = "numHomeRedCards";
            this.numHomeRedCards.Size = new System.Drawing.Size(60, 23);
            this.numHomeRedCards.TabIndex = 4;
            this.numHomeRedCards.ValueChanged += new System.EventHandler(this.numHomeRedCards_ValueChanged);
            // 
            // numHomeCorners
            // 
            this.numHomeCorners.Location = new System.Drawing.Point(120, 180);
            this.numHomeCorners.Name = "numHomeCorners";
            this.numHomeCorners.Size = new System.Drawing.Size(60, 23);
            this.numHomeCorners.TabIndex = 5;
            this.numHomeCorners.ValueChanged += new System.EventHandler(this.numHomeCorners_ValueChanged);
            // 
            // numHomeOffsides
            // 
            this.numHomeOffsides.Location = new System.Drawing.Point(120, 210);
            this.numHomeOffsides.Name = "numHomeOffsides";
            this.numHomeOffsides.Size = new System.Drawing.Size(60, 23);
            this.numHomeOffsides.TabIndex = 6;
            this.numHomeOffsides.ValueChanged += new System.EventHandler(this.numHomeOffsides_ValueChanged);
            // 
            // numHomePossession
            // 
            this.numHomePossession.Location = new System.Drawing.Point(120, 240);
            this.numHomePossession.Name = "numHomePossession";
            this.numHomePossession.Size = new System.Drawing.Size(60, 23);
            this.numHomePossession.TabIndex = 7;
            this.numHomePossession.ValueChanged += new System.EventHandler(this.numHomePossession_ValueChanged);
            // 
            // label2
            // 
            this.label2.AutoSize = true;
            this.label2.Location = new System.Drawing.Point(6, 32);
            this.label2.Name = "label2";
            this.label2.Size = new System.Drawing.Size(35, 15);
            this.label2.TabIndex = 0;
            this.label2.Text = "파울:";
            // 
            // label3
            // 
            this.label3.AutoSize = true;
            this.label3.Location = new System.Drawing.Point(6, 62);
            this.label3.Name = "label3";
            this.label3.Size = new System.Drawing.Size(47, 15);
            this.label3.TabIndex = 1;
            this.label3.Text = "슈팅:";
            // 
            // label4
            // 
            this.label4.AutoSize = true;
            this.label4.Location = new System.Drawing.Point(6, 92);
            this.label4.Name = "label4";
            this.label4.Size = new System.Drawing.Size(71, 15);
            this.label4.TabIndex = 2;
            this.label4.Text = "유효슈팅:";
            // 
            // label5
            // 
            this.label5.AutoSize = true;
            this.label5.Location = new System.Drawing.Point(6, 122);
            this.label5.Name = "label5";
            this.label5.Size = new System.Drawing.Size(59, 15);
            this.label5.TabIndex = 3;
            this.label5.Text = "옐로카드:";
            // 
            // label6
            // 
            this.label6.AutoSize = true;
            this.label6.Location = new System.Drawing.Point(6, 152);
            this.label6.Name = "label6";
            this.label6.Size = new System.Drawing.Size(47, 15);
            this.label6.TabIndex = 4;
            this.label6.Text = "레드카드:";
            // 
            // label7
            // 
            this.label7.AutoSize = true;
            this.label7.Location = new System.Drawing.Point(6, 182);
            this.label7.Name = "label7";
            this.label7.Size = new System.Drawing.Size(47, 15);
            this.label7.TabIndex = 5;
            this.label7.Text = "코너킥:";
            // 
            // label8
            // 
            this.label8.AutoSize = true;
            this.label8.Location = new System.Drawing.Point(6, 212);
            this.label8.Name = "label8";
            this.label8.Size = new System.Drawing.Size(47, 15);
            this.label8.TabIndex = 6;
            this.label8.Text = "오프사이드:";
            // 
            // label9
            // 
            this.label9.AutoSize = true;
            this.label9.Location = new System.Drawing.Point(6, 242);
            this.label9.Name = "label9";
            this.label9.Size = new System.Drawing.Size(47, 15);
            this.label9.TabIndex = 7;
            this.label9.Text = "점유율:";
            // 
            // groupAwayStats
            // 
            this.groupAwayStats.Controls.Add(this.numAwayFouls);
            this.groupAwayStats.Controls.Add(this.numAwayShots);
            this.groupAwayStats.Controls.Add(this.numAwayShotsOnTarget);
            this.groupAwayStats.Controls.Add(this.numAwayYellowCards);
            this.groupAwayStats.Controls.Add(this.numAwayRedCards);
            this.groupAwayStats.Controls.Add(this.numAwayCorners);
            this.groupAwayStats.Controls.Add(this.numAwayOffsides);
            this.groupAwayStats.Controls.Add(this.numAwayPossession);
            this.groupAwayStats.Controls.Add(this.label10);
            this.groupAwayStats.Controls.Add(this.label11);
            this.groupAwayStats.Controls.Add(this.label12);
            this.groupAwayStats.Controls.Add(this.label13);
            this.groupAwayStats.Controls.Add(this.label14);
            this.groupAwayStats.Controls.Add(this.label15);
            this.groupAwayStats.Controls.Add(this.label16);
            this.groupAwayStats.Controls.Add(this.label17);
            this.groupAwayStats.Location = new System.Drawing.Point(408, 12);
            this.groupAwayStats.Name = "groupAwayStats";
            this.groupAwayStats.Size = new System.Drawing.Size(380, 276);
            this.groupAwayStats.TabIndex = 1;
            this.groupAwayStats.TabStop = false;
            this.groupAwayStats.Text = "원정팀 통계";
            // 
            // numAwayFouls
            // 
            this.numAwayFouls.Location = new System.Drawing.Point(120, 30);
            this.numAwayFouls.Name = "numAwayFouls";
            this.numAwayFouls.Size = new System.Drawing.Size(60, 23);
            this.numAwayFouls.TabIndex = 0;
            this.numAwayFouls.ValueChanged += new System.EventHandler(this.numAwayFouls_ValueChanged);
            // 
            // numAwayShots
            // 
            this.numAwayShots.Location = new System.Drawing.Point(120, 60);
            this.numAwayShots.Name = "numAwayShots";
            this.numAwayShots.Size = new System.Drawing.Size(60, 23);
            this.numAwayShots.TabIndex = 1;
            this.numAwayShots.ValueChanged += new System.EventHandler(this.numAwayShots_ValueChanged);
            // 
            // numAwayShotsOnTarget
            // 
            this.numAwayShotsOnTarget.Location = new System.Drawing.Point(120, 90);
            this.numAwayShotsOnTarget.Name = "numAwayShotsOnTarget";
            this.numAwayShotsOnTarget.Size = new System.Drawing.Size(60, 23);
            this.numAwayShotsOnTarget.TabIndex = 2;
            this.numAwayShotsOnTarget.ValueChanged += new System.EventHandler(this.numAwayShotsOnTarget_ValueChanged);
            // 
            // numAwayYellowCards
            // 
            this.numAwayYellowCards.Location = new System.Drawing.Point(120, 120);
            this.numAwayYellowCards.Name = "numAwayYellowCards";
            this.numAwayYellowCards.Size = new System.Drawing.Size(60, 23);
            this.numAwayYellowCards.TabIndex = 3;
            this.numAwayYellowCards.ValueChanged += new System.EventHandler(this.numAwayYellowCards_ValueChanged);
            // 
            // numAwayRedCards
            // 
            this.numAwayRedCards.Location = new System.Drawing.Point(120, 150);
            this.numAwayRedCards.Name = "numAwayRedCards";
            this.numAwayRedCards.Size = new System.Drawing.Size(60, 23);
            this.numAwayRedCards.TabIndex = 4;
            this.numAwayRedCards.ValueChanged += new System.EventHandler(this.numAwayRedCards_ValueChanged);
            // 
            // numAwayCorners
            // 
            this.numAwayCorners.Location = new System.Drawing.Point(120, 180);
            this.numAwayCorners.Name = "numAwayCorners";
            this.numAwayCorners.Size = new System.Drawing.Size(60, 23);
            this.numAwayCorners.TabIndex = 5;
            this.numAwayCorners.ValueChanged += new System.EventHandler(this.numAwayCorners_ValueChanged);
            // 
            // numAwayOffsides
            // 
            this.numAwayOffsides.Location = new System.Drawing.Point(120, 210);
            this.numAwayOffsides.Name = "numAwayOffsides";
            this.numAwayOffsides.Size = new System.Drawing.Size(60, 23);
            this.numAwayOffsides.TabIndex = 6;
            this.numAwayOffsides.ValueChanged += new System.EventHandler(this.numAwayOffsides_ValueChanged);
            // 
            // numAwayPossession
            // 
            this.numAwayPossession.Location = new System.Drawing.Point(120, 240);
            this.numAwayPossession.Name = "numAwayPossession";
            this.numAwayPossession.Size = new System.Drawing.Size(60, 23);
            this.numAwayPossession.TabIndex = 7;
            this.numAwayPossession.ValueChanged += new System.EventHandler(this.numAwayPossession_ValueChanged);
            // 
            // label10
            // 
            this.label10.AutoSize = true;
            this.label10.Location = new System.Drawing.Point(6, 32);
            this.label10.Name = "label10";
            this.label10.Size = new System.Drawing.Size(35, 15);
            this.label10.TabIndex = 0;
            this.label10.Text = "파울:";
            // 
            // label11
            // 
            this.label11.AutoSize = true;
            this.label11.Location = new System.Drawing.Point(6, 62);
            this.label11.Name = "label11";
            this.label11.Size = new System.Drawing.Size(47, 15);
            this.label11.TabIndex = 1;
            this.label11.Text = "슈팅:";
            // 
            // label12
            // 
            this.label12.AutoSize = true;
            this.label12.Location = new System.Drawing.Point(6, 92);
            this.label12.Name = "label12";
            this.label12.Size = new System.Drawing.Size(71, 15);
            this.label12.TabIndex = 2;
            this.label12.Text = "유효슈팅:";
            // 
            // label13
            // 
            this.label13.AutoSize = true;
            this.label13.Location = new System.Drawing.Point(6, 122);
            this.label13.Name = "label13";
            this.label13.Size = new System.Drawing.Size(59, 15);
            this.label13.TabIndex = 3;
            this.label13.Text = "옐로카드:";
            // 
            // label14
            // 
            this.label14.AutoSize = true;
            this.label14.Location = new System.Drawing.Point(6, 152);
            this.label14.Name = "label14";
            this.label14.Size = new System.Drawing.Size(47, 15);
            this.label14.TabIndex = 4;
            this.label14.Text = "레드카드:";
            // 
            // label15
            // 
            this.label15.AutoSize = true;
            this.label15.Location = new System.Drawing.Point(6, 182);
            this.label15.Name = "label15";
            this.label15.Size = new System.Drawing.Size(47, 15);
            this.label15.TabIndex = 5;
            this.label15.Text = "코너킥:";
            // 
            // label16
            // 
            this.label16.AutoSize = true;
            this.label16.Location = new System.Drawing.Point(6, 212);
            this.label16.Name = "label16";
            this.label16.Size = new System.Drawing.Size(47, 15);
            this.label16.TabIndex = 6;
            this.label16.Text = "오프사이드:";
            // 
            // label17
            // 
            this.label17.AutoSize = true;
            this.label17.Location = new System.Drawing.Point(6, 242);
            this.label17.Name = "label17";
            this.label17.Size = new System.Drawing.Size(47, 15);
            this.label17.TabIndex = 7;
            this.label17.Text = "점유율:";
            // 
            // btnShowOverlay
            // 
            this.btnShowOverlay.Location = new System.Drawing.Point(605, 12);
            this.btnShowOverlay.Name = "btnShowOverlay";
            this.btnShowOverlay.Size = new System.Drawing.Size(75, 30);
            this.btnShowOverlay.TabIndex = 6;
            this.btnShowOverlay.Text = "오버레이";
            this.btnShowOverlay.UseVisualStyleBackColor = true;
            this.btnShowOverlay.Click += new System.EventHandler(this.btnShowOverlay_Click);
            // 
            // MatchControlForm
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(7F, 15F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(800, 450);
            this.Controls.Add(this.btnShowOverlay);
            this.Controls.Add(this.panelStats);
            this.Controls.Add(this.panelScore);
            this.Controls.Add(this.panelTop);
            this.Name = "MatchControlForm";
            this.Text = "경기 제어";
            this.panelTop.ResumeLayout(false);
            this.panelTop.PerformLayout();
            this.panelScore.ResumeLayout(false);
            this.panelScore.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.numHomeScore)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.numAwayScore)).EndInit();
            this.panelStats.ResumeLayout(false);
            this.groupHomeStats.ResumeLayout(false);
            this.groupHomeStats.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.numHomeFouls)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.numHomeShots)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.numHomeShotsOnTarget)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.numHomeYellowCards)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.numHomeRedCards)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.numHomeCorners)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.numHomeOffsides)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.numHomePossession)).EndInit();
            this.groupAwayStats.ResumeLayout(false);
            this.groupAwayStats.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.numAwayFouls)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.numAwayShots)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.numAwayShotsOnTarget)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.numAwayYellowCards)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.numAwayRedCards)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.numAwayCorners)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.numAwayOffsides)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.numAwayPossession)).EndInit();
            this.ResumeLayout(false);
        }

        #endregion

        private System.Windows.Forms.Panel panelTop;
        private System.Windows.Forms.Label lblTime;
        private System.Windows.Forms.Button btnStart;
        private System.Windows.Forms.Button btnStop;
        private System.Windows.Forms.Button btnReset;
        private System.Windows.Forms.Button btnHalfTime;
        private System.Windows.Forms.Button btnEndMatch;
        private System.Windows.Forms.Panel panelScore;
        private System.Windows.Forms.TextBox txtHomeTeam;
        private System.Windows.Forms.TextBox txtAwayTeam;
        private System.Windows.Forms.NumericUpDown numHomeScore;
        private System.Windows.Forms.NumericUpDown numAwayScore;
        private System.Windows.Forms.Label label1;
        private System.Windows.Forms.Panel panelStats;
        private System.Windows.Forms.GroupBox groupHomeStats;
        private System.Windows.Forms.NumericUpDown numHomeFouls;
        private System.Windows.Forms.NumericUpDown numHomeShots;
        private System.Windows.Forms.NumericUpDown numHomeShotsOnTarget;
        private System.Windows.Forms.NumericUpDown numHomeYellowCards;
        private System.Windows.Forms.NumericUpDown numHomeRedCards;
        private System.Windows.Forms.NumericUpDown numHomeCorners;
        private System.Windows.Forms.NumericUpDown numHomeOffsides;
        private System.Windows.Forms.NumericUpDown numHomePossession;
        private System.Windows.Forms.Label label2;
        private System.Windows.Forms.Label label3;
        private System.Windows.Forms.Label label4;
        private System.Windows.Forms.Label label5;
        private System.Windows.Forms.Label label6;
        private System.Windows.Forms.Label label7;
        private System.Windows.Forms.Label label8;
        private System.Windows.Forms.Label label9;
        private System.Windows.Forms.GroupBox groupAwayStats;
        private System.Windows.Forms.NumericUpDown numAwayFouls;
        private System.Windows.Forms.NumericUpDown numAwayShots;
        private System.Windows.Forms.NumericUpDown numAwayShotsOnTarget;
        private System.Windows.Forms.NumericUpDown numAwayYellowCards;
        private System.Windows.Forms.NumericUpDown numAwayRedCards;
        private System.Windows.Forms.NumericUpDown numAwayCorners;
        private System.Windows.Forms.NumericUpDown numAwayOffsides;
        private System.Windows.Forms.NumericUpDown numAwayPossession;
        private System.Windows.Forms.Label label10;
        private System.Windows.Forms.Label label11;
        private System.Windows.Forms.Label label12;
        private System.Windows.Forms.Label label13;
        private System.Windows.Forms.Label label14;
        private System.Windows.Forms.Label label15;
        private System.Windows.Forms.Label label16;
        private System.Windows.Forms.Label label17;
        private System.Windows.Forms.Button btnShowOverlay;
    }
} 