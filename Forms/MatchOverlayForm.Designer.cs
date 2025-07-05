namespace SportsCoderWinForm.Forms
{
    partial class MatchOverlayForm
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
            this.panelTop = new System.Windows.Forms.Panel();
            this.lblHomeTeam = new System.Windows.Forms.Label();
            this.lblAwayTeam = new System.Windows.Forms.Label();
            this.lblHomeScore = new System.Windows.Forms.Label();
            this.lblAwayScore = new System.Windows.Forms.Label();
            this.label1 = new System.Windows.Forms.Label();
            this.panelStats = new System.Windows.Forms.Panel();
            this.groupHomeStats = new System.Windows.Forms.GroupBox();
            this.lblHomeFouls = new System.Windows.Forms.Label();
            this.lblHomeShots = new System.Windows.Forms.Label();
            this.lblHomeShotsOnTarget = new System.Windows.Forms.Label();
            this.lblHomeYellowCards = new System.Windows.Forms.Label();
            this.lblHomeRedCards = new System.Windows.Forms.Label();
            this.lblHomeCorners = new System.Windows.Forms.Label();
            this.lblHomeOffsides = new System.Windows.Forms.Label();
            this.lblHomePossession = new System.Windows.Forms.Label();
            this.label2 = new System.Windows.Forms.Label();
            this.label3 = new System.Windows.Forms.Label();
            this.label4 = new System.Windows.Forms.Label();
            this.label5 = new System.Windows.Forms.Label();
            this.label6 = new System.Windows.Forms.Label();
            this.label7 = new System.Windows.Forms.Label();
            this.label8 = new System.Windows.Forms.Label();
            this.label9 = new System.Windows.Forms.Label();
            this.groupAwayStats = new System.Windows.Forms.GroupBox();
            this.lblAwayFouls = new System.Windows.Forms.Label();
            this.lblAwayShots = new System.Windows.Forms.Label();
            this.lblAwayShotsOnTarget = new System.Windows.Forms.Label();
            this.lblAwayYellowCards = new System.Windows.Forms.Label();
            this.lblAwayRedCards = new System.Windows.Forms.Label();
            this.lblAwayCorners = new System.Windows.Forms.Label();
            this.lblAwayOffsides = new System.Windows.Forms.Label();
            this.lblAwayPossession = new System.Windows.Forms.Label();
            this.label10 = new System.Windows.Forms.Label();
            this.label11 = new System.Windows.Forms.Label();
            this.label12 = new System.Windows.Forms.Label();
            this.label13 = new System.Windows.Forms.Label();
            this.label14 = new System.Windows.Forms.Label();
            this.label15 = new System.Windows.Forms.Label();
            this.label16 = new System.Windows.Forms.Label();
            this.label17 = new System.Windows.Forms.Label();
            this.panelTop.SuspendLayout();
            this.panelStats.SuspendLayout();
            this.groupHomeStats.SuspendLayout();
            this.groupAwayStats.SuspendLayout();
            this.SuspendLayout();
            // 
            // panelTop
            // 
            this.panelTop.Controls.Add(this.lblHomeTeam);
            this.panelTop.Controls.Add(this.lblAwayTeam);
            this.panelTop.Controls.Add(this.lblHomeScore);
            this.panelTop.Controls.Add(this.lblAwayScore);
            this.panelTop.Controls.Add(this.label1);
            this.panelTop.Dock = System.Windows.Forms.DockStyle.Top;
            this.panelTop.Location = new System.Drawing.Point(0, 0);
            this.panelTop.Name = "panelTop";
            this.panelTop.Size = new System.Drawing.Size(800, 100);
            this.panelTop.TabIndex = 0;
            // 
            // lblHomeTeam
            // 
            this.lblHomeTeam.AutoSize = true;
            this.lblHomeTeam.Font = new System.Drawing.Font("Segoe UI", 16F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point);
            this.lblHomeTeam.Location = new System.Drawing.Point(12, 12);
            this.lblHomeTeam.Name = "lblHomeTeam";
            this.lblHomeTeam.Size = new System.Drawing.Size(100, 30);
            this.lblHomeTeam.TabIndex = 0;
            this.lblHomeTeam.Text = "홈팀";
            // 
            // lblAwayTeam
            // 
            this.lblAwayTeam.AutoSize = true;
            this.lblAwayTeam.Font = new System.Drawing.Font("Segoe UI", 16F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point);
            this.lblAwayTeam.Location = new System.Drawing.Point(688, 12);
            this.lblAwayTeam.Name = "lblAwayTeam";
            this.lblAwayTeam.Size = new System.Drawing.Size(100, 30);
            this.lblAwayTeam.TabIndex = 1;
            this.lblAwayTeam.Text = "원정팀";
            // 
            // lblHomeScore
            // 
            this.lblHomeScore.AutoSize = true;
            this.lblHomeScore.Font = new System.Drawing.Font("Segoe UI", 24F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point);
            this.lblHomeScore.Location = new System.Drawing.Point(12, 42);
            this.lblHomeScore.Name = "lblHomeScore";
            this.lblHomeScore.Size = new System.Drawing.Size(37, 45);
            this.lblHomeScore.TabIndex = 2;
            this.lblHomeScore.Text = "0";
            // 
            // lblAwayScore
            // 
            this.lblAwayScore.AutoSize = true;
            this.lblAwayScore.Font = new System.Drawing.Font("Segoe UI", 24F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point);
            this.lblAwayScore.Location = new System.Drawing.Point(751, 42);
            this.lblAwayScore.Name = "lblAwayScore";
            this.lblAwayScore.Size = new System.Drawing.Size(37, 45);
            this.lblAwayScore.TabIndex = 3;
            this.lblAwayScore.Text = "0";
            // 
            // label1
            // 
            this.label1.AutoSize = true;
            this.label1.Font = new System.Drawing.Font("Segoe UI", 24F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point);
            this.label1.Location = new System.Drawing.Point(380, 42);
            this.label1.Name = "label1";
            this.label1.Size = new System.Drawing.Size(36, 45);
            this.label1.TabIndex = 4;
            this.label1.Text = "-";
            // 
            // panelStats
            // 
            this.panelStats.Controls.Add(this.groupHomeStats);
            this.panelStats.Controls.Add(this.groupAwayStats);
            this.panelStats.Dock = System.Windows.Forms.DockStyle.Fill;
            this.panelStats.Location = new System.Drawing.Point(0, 100);
            this.panelStats.Name = "panelStats";
            this.panelStats.Size = new System.Drawing.Size(800, 350);
            this.panelStats.TabIndex = 1;
            // 
            // groupHomeStats
            // 
            this.groupHomeStats.Controls.Add(this.lblHomeFouls);
            this.groupHomeStats.Controls.Add(this.lblHomeShots);
            this.groupHomeStats.Controls.Add(this.lblHomeShotsOnTarget);
            this.groupHomeStats.Controls.Add(this.lblHomeYellowCards);
            this.groupHomeStats.Controls.Add(this.lblHomeRedCards);
            this.groupHomeStats.Controls.Add(this.lblHomeCorners);
            this.groupHomeStats.Controls.Add(this.lblHomeOffsides);
            this.groupHomeStats.Controls.Add(this.lblHomePossession);
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
            this.groupHomeStats.Size = new System.Drawing.Size(380, 326);
            this.groupHomeStats.TabIndex = 0;
            this.groupHomeStats.TabStop = false;
            this.groupHomeStats.Text = "홈팀 통계";
            // 
            // lblHomeFouls
            // 
            this.lblHomeFouls.AutoSize = true;
            this.lblHomeFouls.Location = new System.Drawing.Point(120, 30);
            this.lblHomeFouls.Name = "lblHomeFouls";
            this.lblHomeFouls.Size = new System.Drawing.Size(13, 15);
            this.lblHomeFouls.TabIndex = 0;
            this.lblHomeFouls.Text = "0";
            // 
            // lblHomeShots
            // 
            this.lblHomeShots.AutoSize = true;
            this.lblHomeShots.Location = new System.Drawing.Point(120, 60);
            this.lblHomeShots.Name = "lblHomeShots";
            this.lblHomeShots.Size = new System.Drawing.Size(13, 15);
            this.lblHomeShots.TabIndex = 1;
            this.lblHomeShots.Text = "0";
            // 
            // lblHomeShotsOnTarget
            // 
            this.lblHomeShotsOnTarget.AutoSize = true;
            this.lblHomeShotsOnTarget.Location = new System.Drawing.Point(120, 90);
            this.lblHomeShotsOnTarget.Name = "lblHomeShotsOnTarget";
            this.lblHomeShotsOnTarget.Size = new System.Drawing.Size(13, 15);
            this.lblHomeShotsOnTarget.TabIndex = 2;
            this.lblHomeShotsOnTarget.Text = "0";
            // 
            // lblHomeYellowCards
            // 
            this.lblHomeYellowCards.AutoSize = true;
            this.lblHomeYellowCards.Location = new System.Drawing.Point(120, 120);
            this.lblHomeYellowCards.Name = "lblHomeYellowCards";
            this.lblHomeYellowCards.Size = new System.Drawing.Size(13, 15);
            this.lblHomeYellowCards.TabIndex = 3;
            this.lblHomeYellowCards.Text = "0";
            // 
            // lblHomeRedCards
            // 
            this.lblHomeRedCards.AutoSize = true;
            this.lblHomeRedCards.Location = new System.Drawing.Point(120, 150);
            this.lblHomeRedCards.Name = "lblHomeRedCards";
            this.lblHomeRedCards.Size = new System.Drawing.Size(13, 15);
            this.lblHomeRedCards.TabIndex = 4;
            this.lblHomeRedCards.Text = "0";
            // 
            // lblHomeCorners
            // 
            this.lblHomeCorners.AutoSize = true;
            this.lblHomeCorners.Location = new System.Drawing.Point(120, 180);
            this.lblHomeCorners.Name = "lblHomeCorners";
            this.lblHomeCorners.Size = new System.Drawing.Size(13, 15);
            this.lblHomeCorners.TabIndex = 5;
            this.lblHomeCorners.Text = "0";
            // 
            // lblHomeOffsides
            // 
            this.lblHomeOffsides.AutoSize = true;
            this.lblHomeOffsides.Location = new System.Drawing.Point(120, 210);
            this.lblHomeOffsides.Name = "lblHomeOffsides";
            this.lblHomeOffsides.Size = new System.Drawing.Size(13, 15);
            this.lblHomeOffsides.TabIndex = 6;
            this.lblHomeOffsides.Text = "0";
            // 
            // lblHomePossession
            // 
            this.lblHomePossession.AutoSize = true;
            this.lblHomePossession.Location = new System.Drawing.Point(120, 240);
            this.lblHomePossession.Name = "lblHomePossession";
            this.lblHomePossession.Size = new System.Drawing.Size(19, 15);
            this.lblHomePossession.TabIndex = 7;
            this.lblHomePossession.Text = "0%";
            // 
            // label2
            // 
            this.label2.AutoSize = true;
            this.label2.Location = new System.Drawing.Point(6, 30);
            this.label2.Name = "label2";
            this.label2.Size = new System.Drawing.Size(35, 15);
            this.label2.TabIndex = 0;
            this.label2.Text = "파울:";
            // 
            // label3
            // 
            this.label3.AutoSize = true;
            this.label3.Location = new System.Drawing.Point(6, 60);
            this.label3.Name = "label3";
            this.label3.Size = new System.Drawing.Size(47, 15);
            this.label3.TabIndex = 1;
            this.label3.Text = "슈팅:";
            // 
            // label4
            // 
            this.label4.AutoSize = true;
            this.label4.Location = new System.Drawing.Point(6, 90);
            this.label4.Name = "label4";
            this.label4.Size = new System.Drawing.Size(71, 15);
            this.label4.TabIndex = 2;
            this.label4.Text = "유효슈팅:";
            // 
            // label5
            // 
            this.label5.AutoSize = true;
            this.label5.Location = new System.Drawing.Point(6, 120);
            this.label5.Name = "label5";
            this.label5.Size = new System.Drawing.Size(59, 15);
            this.label5.TabIndex = 3;
            this.label5.Text = "옐로카드:";
            // 
            // label6
            // 
            this.label6.AutoSize = true;
            this.label6.Location = new System.Drawing.Point(6, 150);
            this.label6.Name = "label6";
            this.label6.Size = new System.Drawing.Size(47, 15);
            this.label6.TabIndex = 4;
            this.label6.Text = "레드카드:";
            // 
            // label7
            // 
            this.label7.AutoSize = true;
            this.label7.Location = new System.Drawing.Point(6, 180);
            this.label7.Name = "label7";
            this.label7.Size = new System.Drawing.Size(47, 15);
            this.label7.TabIndex = 5;
            this.label7.Text = "코너킥:";
            // 
            // label8
            // 
            this.label8.AutoSize = true;
            this.label8.Location = new System.Drawing.Point(6, 210);
            this.label8.Name = "label8";
            this.label8.Size = new System.Drawing.Size(47, 15);
            this.label8.TabIndex = 6;
            this.label8.Text = "오프사이드:";
            // 
            // label9
            // 
            this.label9.AutoSize = true;
            this.label9.Location = new System.Drawing.Point(6, 240);
            this.label9.Name = "label9";
            this.label9.Size = new System.Drawing.Size(47, 15);
            this.label9.TabIndex = 7;
            this.label9.Text = "점유율:";
            // 
            // groupAwayStats
            // 
            this.groupAwayStats.Controls.Add(this.lblAwayFouls);
            this.groupAwayStats.Controls.Add(this.lblAwayShots);
            this.groupAwayStats.Controls.Add(this.lblAwayShotsOnTarget);
            this.groupAwayStats.Controls.Add(this.lblAwayYellowCards);
            this.groupAwayStats.Controls.Add(this.lblAwayRedCards);
            this.groupAwayStats.Controls.Add(this.lblAwayCorners);
            this.groupAwayStats.Controls.Add(this.lblAwayOffsides);
            this.groupAwayStats.Controls.Add(this.lblAwayPossession);
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
            this.groupAwayStats.Size = new System.Drawing.Size(380, 326);
            this.groupAwayStats.TabIndex = 1;
            this.groupAwayStats.TabStop = false;
            this.groupAwayStats.Text = "원정팀 통계";
            // 
            // lblAwayFouls
            // 
            this.lblAwayFouls.AutoSize = true;
            this.lblAwayFouls.Location = new System.Drawing.Point(120, 30);
            this.lblAwayFouls.Name = "lblAwayFouls";
            this.lblAwayFouls.Size = new System.Drawing.Size(13, 15);
            this.lblAwayFouls.TabIndex = 0;
            this.lblAwayFouls.Text = "0";
            // 
            // lblAwayShots
            // 
            this.lblAwayShots.AutoSize = true;
            this.lblAwayShots.Location = new System.Drawing.Point(120, 60);
            this.lblAwayShots.Name = "lblAwayShots";
            this.lblAwayShots.Size = new System.Drawing.Size(13, 15);
            this.lblAwayShots.TabIndex = 1;
            this.lblAwayShots.Text = "0";
            // 
            // lblAwayShotsOnTarget
            // 
            this.lblAwayShotsOnTarget.AutoSize = true;
            this.lblAwayShotsOnTarget.Location = new System.Drawing.Point(120, 90);
            this.lblAwayShotsOnTarget.Name = "lblAwayShotsOnTarget";
            this.lblAwayShotsOnTarget.Size = new System.Drawing.Size(13, 15);
            this.lblAwayShotsOnTarget.TabIndex = 2;
            this.lblAwayShotsOnTarget.Text = "0";
            // 
            // lblAwayYellowCards
            // 
            this.lblAwayYellowCards.AutoSize = true;
            this.lblAwayYellowCards.Location = new System.Drawing.Point(120, 120);
            this.lblAwayYellowCards.Name = "lblAwayYellowCards";
            this.lblAwayYellowCards.Size = new System.Drawing.Size(13, 15);
            this.lblAwayYellowCards.TabIndex = 3;
            this.lblAwayYellowCards.Text = "0";
            // 
            // lblAwayRedCards
            // 
            this.lblAwayRedCards.AutoSize = true;
            this.lblAwayRedCards.Location = new System.Drawing.Point(120, 150);
            this.lblAwayRedCards.Name = "lblAwayRedCards";
            this.lblAwayRedCards.Size = new System.Drawing.Size(13, 15);
            this.lblAwayRedCards.TabIndex = 4;
            this.lblAwayRedCards.Text = "0";
            // 
            // lblAwayCorners
            // 
            this.lblAwayCorners.AutoSize = true;
            this.lblAwayCorners.Location = new System.Drawing.Point(120, 180);
            this.lblAwayCorners.Name = "lblAwayCorners";
            this.lblAwayCorners.Size = new System.Drawing.Size(13, 15);
            this.lblAwayCorners.TabIndex = 5;
            this.lblAwayCorners.Text = "0";
            // 
            // lblAwayOffsides
            // 
            this.lblAwayOffsides.AutoSize = true;
            this.lblAwayOffsides.Location = new System.Drawing.Point(120, 210);
            this.lblAwayOffsides.Name = "lblAwayOffsides";
            this.lblAwayOffsides.Size = new System.Drawing.Size(13, 15);
            this.lblAwayOffsides.TabIndex = 6;
            this.lblAwayOffsides.Text = "0";
            // 
            // lblAwayPossession
            // 
            this.lblAwayPossession.AutoSize = true;
            this.lblAwayPossession.Location = new System.Drawing.Point(120, 240);
            this.lblAwayPossession.Name = "lblAwayPossession";
            this.lblAwayPossession.Size = new System.Drawing.Size(19, 15);
            this.lblAwayPossession.TabIndex = 7;
            this.lblAwayPossession.Text = "0%";
            // 
            // label10
            // 
            this.label10.AutoSize = true;
            this.label10.Location = new System.Drawing.Point(6, 30);
            this.label10.Name = "label10";
            this.label10.Size = new System.Drawing.Size(35, 15);
            this.label10.TabIndex = 0;
            this.label10.Text = "파울:";
            // 
            // label11
            // 
            this.label11.AutoSize = true;
            this.label11.Location = new System.Drawing.Point(6, 60);
            this.label11.Name = "label11";
            this.label11.Size = new System.Drawing.Size(47, 15);
            this.label11.TabIndex = 1;
            this.label11.Text = "슈팅:";
            // 
            // label12
            // 
            this.label12.AutoSize = true;
            this.label12.Location = new System.Drawing.Point(6, 90);
            this.label12.Name = "label12";
            this.label12.Size = new System.Drawing.Size(71, 15);
            this.label12.TabIndex = 2;
            this.label12.Text = "유효슈팅:";
            // 
            // label13
            // 
            this.label13.AutoSize = true;
            this.label13.Location = new System.Drawing.Point(6, 120);
            this.label13.Name = "label13";
            this.label13.Size = new System.Drawing.Size(59, 15);
            this.label13.TabIndex = 3;
            this.label13.Text = "옐로카드:";
            // 
            // label14
            // 
            this.label14.AutoSize = true;
            this.label14.Location = new System.Drawing.Point(6, 150);
            this.label14.Name = "label14";
            this.label14.Size = new System.Drawing.Size(47, 15);
            this.label14.TabIndex = 4;
            this.label14.Text = "레드카드:";
            // 
            // label15
            // 
            this.label15.AutoSize = true;
            this.label15.Location = new System.Drawing.Point(6, 180);
            this.label15.Name = "label15";
            this.label15.Size = new System.Drawing.Size(47, 15);
            this.label15.TabIndex = 5;
            this.label15.Text = "코너킥:";
            // 
            // label16
            // 
            this.label16.AutoSize = true;
            this.label16.Location = new System.Drawing.Point(6, 210);
            this.label16.Name = "label16";
            this.label16.Size = new System.Drawing.Size(47, 15);
            this.label16.TabIndex = 6;
            this.label16.Text = "오프사이드:";
            // 
            // label17
            // 
            this.label17.AutoSize = true;
            this.label17.Location = new System.Drawing.Point(6, 240);
            this.label17.Name = "label17";
            this.label17.Size = new System.Drawing.Size(47, 15);
            this.label17.TabIndex = 7;
            this.label17.Text = "점유율:";
            // 
            // MatchOverlayForm
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(7F, 15F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(800, 450);
            this.Controls.Add(this.panelStats);
            this.Controls.Add(this.panelTop);
            this.FormBorderStyle = System.Windows.Forms.FormBorderStyle.None;
            this.Name = "MatchOverlayForm";
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
            this.Text = "경기 오버레이";
            this.panelTop.ResumeLayout(false);
            this.panelTop.PerformLayout();
            this.panelStats.ResumeLayout(false);
            this.groupHomeStats.ResumeLayout(false);
            this.groupHomeStats.PerformLayout();
            this.groupAwayStats.ResumeLayout(false);
            this.groupAwayStats.PerformLayout();
            this.ResumeLayout(false);
        }

        #endregion

        private System.Windows.Forms.Panel panelTop;
        private System.Windows.Forms.Label lblHomeTeam;
        private System.Windows.Forms.Label lblAwayTeam;
        private System.Windows.Forms.Label lblHomeScore;
        private System.Windows.Forms.Label lblAwayScore;
        private System.Windows.Forms.Label label1;
        private System.Windows.Forms.Panel panelStats;
        private System.Windows.Forms.GroupBox groupHomeStats;
        private System.Windows.Forms.Label lblHomeFouls;
        private System.Windows.Forms.Label lblHomeShots;
        private System.Windows.Forms.Label lblHomeShotsOnTarget;
        private System.Windows.Forms.Label lblHomeYellowCards;
        private System.Windows.Forms.Label lblHomeRedCards;
        private System.Windows.Forms.Label lblHomeCorners;
        private System.Windows.Forms.Label lblHomeOffsides;
        private System.Windows.Forms.Label lblHomePossession;
        private System.Windows.Forms.Label label2;
        private System.Windows.Forms.Label label3;
        private System.Windows.Forms.Label label4;
        private System.Windows.Forms.Label label5;
        private System.Windows.Forms.Label label6;
        private System.Windows.Forms.Label label7;
        private System.Windows.Forms.Label label8;
        private System.Windows.Forms.Label label9;
        private System.Windows.Forms.GroupBox groupAwayStats;
        private System.Windows.Forms.Label lblAwayFouls;
        private System.Windows.Forms.Label lblAwayShots;
        private System.Windows.Forms.Label lblAwayShotsOnTarget;
        private System.Windows.Forms.Label lblAwayYellowCards;
        private System.Windows.Forms.Label lblAwayRedCards;
        private System.Windows.Forms.Label lblAwayCorners;
        private System.Windows.Forms.Label lblAwayOffsides;
        private System.Windows.Forms.Label lblAwayPossession;
        private System.Windows.Forms.Label label10;
        private System.Windows.Forms.Label label11;
        private System.Windows.Forms.Label label12;
        private System.Windows.Forms.Label label13;
        private System.Windows.Forms.Label label14;
        private System.Windows.Forms.Label label15;
        private System.Windows.Forms.Label label16;
        private System.Windows.Forms.Label label17;
    }
} 