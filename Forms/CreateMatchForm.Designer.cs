namespace SportsCoderWinForm.Forms
{
    partial class CreateMatchForm
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
            this.labelTitle = new System.Windows.Forms.Label();
            this.labelHomeTeam = new System.Windows.Forms.Label();
            this.txtHomeTeam = new System.Windows.Forms.TextBox();
            this.labelAwayTeam = new System.Windows.Forms.Label();
            this.txtAwayTeam = new System.Windows.Forms.TextBox();
            this.btnSave = new System.Windows.Forms.Button();
            this.btnCancel = new System.Windows.Forms.Button();
            this.panelTop = new System.Windows.Forms.Panel();
            this.panelBottom = new System.Windows.Forms.Panel();
            this.panelMain = new System.Windows.Forms.Panel();
            this.panelTop.SuspendLayout();
            this.panelBottom.SuspendLayout();
            this.panelMain.SuspendLayout();
            this.SuspendLayout();
            // 
            // labelTitle
            // 
            this.labelTitle.AutoSize = true;
            this.labelTitle.Font = new System.Drawing.Font("Segoe UI", 16F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point);
            this.labelTitle.Location = new System.Drawing.Point(12, 12);
            this.labelTitle.Name = "labelTitle";
            this.labelTitle.Size = new System.Drawing.Size(200, 30);
            this.labelTitle.TabIndex = 0;
            this.labelTitle.Text = "새 경기 생성";
            // 
            // labelHomeTeam
            // 
            this.labelHomeTeam.AutoSize = true;
            this.labelHomeTeam.Location = new System.Drawing.Point(12, 20);
            this.labelHomeTeam.Name = "labelHomeTeam";
            this.labelHomeTeam.Size = new System.Drawing.Size(60, 15);
            this.labelHomeTeam.TabIndex = 1;
            this.labelHomeTeam.Text = "홈팀 이름:";
            // 
            // txtHomeTeam
            // 
            this.txtHomeTeam.Location = new System.Drawing.Point(12, 40);
            this.txtHomeTeam.Name = "txtHomeTeam";
            this.txtHomeTeam.Size = new System.Drawing.Size(200, 23);
            this.txtHomeTeam.TabIndex = 2;
            // 
            // labelAwayTeam
            // 
            this.labelAwayTeam.AutoSize = true;
            this.labelAwayTeam.Location = new System.Drawing.Point(12, 80);
            this.labelAwayTeam.Name = "labelAwayTeam";
            this.labelAwayTeam.Size = new System.Drawing.Size(60, 15);
            this.labelAwayTeam.TabIndex = 3;
            this.labelAwayTeam.Text = "원정팀 이름:";
            // 
            // txtAwayTeam
            // 
            this.txtAwayTeam.Location = new System.Drawing.Point(12, 100);
            this.txtAwayTeam.Name = "txtAwayTeam";
            this.txtAwayTeam.Size = new System.Drawing.Size(200, 23);
            this.txtAwayTeam.TabIndex = 4;
            // 
            // btnSave
            // 
            this.btnSave.Location = new System.Drawing.Point(12, 12);
            this.btnSave.Name = "btnSave";
            this.btnSave.Size = new System.Drawing.Size(100, 30);
            this.btnSave.TabIndex = 5;
            this.btnSave.Text = "저장";
            this.btnSave.UseVisualStyleBackColor = true;
            this.btnSave.Click += new System.EventHandler(this.btnSave_Click);
            // 
            // btnCancel
            // 
            this.btnCancel.Location = new System.Drawing.Point(118, 12);
            this.btnCancel.Name = "btnCancel";
            this.btnCancel.Size = new System.Drawing.Size(100, 30);
            this.btnCancel.TabIndex = 6;
            this.btnCancel.Text = "취소";
            this.btnCancel.UseVisualStyleBackColor = true;
            this.btnCancel.Click += new System.EventHandler(this.btnCancel_Click);
            // 
            // panelTop
            // 
            this.panelTop.Controls.Add(this.labelTitle);
            this.panelTop.Dock = System.Windows.Forms.DockStyle.Top;
            this.panelTop.Location = new System.Drawing.Point(0, 0);
            this.panelTop.Name = "panelTop";
            this.panelTop.Size = new System.Drawing.Size(384, 50);
            this.panelTop.TabIndex = 7;
            // 
            // panelBottom
            // 
            this.panelBottom.Controls.Add(this.btnSave);
            this.panelBottom.Controls.Add(this.btnCancel);
            this.panelBottom.Dock = System.Windows.Forms.DockStyle.Bottom;
            this.panelBottom.Location = new System.Drawing.Point(0, 200);
            this.panelBottom.Name = "panelBottom";
            this.panelBottom.Size = new System.Drawing.Size(384, 50);
            this.panelBottom.TabIndex = 8;
            // 
            // panelMain
            // 
            this.panelMain.Controls.Add(this.labelHomeTeam);
            this.panelMain.Controls.Add(this.txtHomeTeam);
            this.panelMain.Controls.Add(this.labelAwayTeam);
            this.panelMain.Controls.Add(this.txtAwayTeam);
            this.panelMain.Dock = System.Windows.Forms.DockStyle.Fill;
            this.panelMain.Location = new System.Drawing.Point(0, 50);
            this.panelMain.Name = "panelMain";
            this.panelMain.Size = new System.Drawing.Size(384, 150);
            this.panelMain.TabIndex = 9;
            // 
            // CreateMatchForm
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(7F, 15F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(384, 250);
            this.Controls.Add(this.panelMain);
            this.Controls.Add(this.panelBottom);
            this.Controls.Add(this.panelTop);
            this.FormBorderStyle = System.Windows.Forms.FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.Name = "CreateMatchForm";
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterParent;
            this.Text = "새 경기 생성";
            this.panelTop.ResumeLayout(false);
            this.panelTop.PerformLayout();
            this.panelBottom.ResumeLayout(false);
            this.panelMain.ResumeLayout(false);
            this.panelMain.PerformLayout();
            this.ResumeLayout(false);
        }

        #endregion

        private System.Windows.Forms.Label labelTitle;
        private System.Windows.Forms.Label labelHomeTeam;
        private System.Windows.Forms.TextBox txtHomeTeam;
        private System.Windows.Forms.Label labelAwayTeam;
        private System.Windows.Forms.TextBox txtAwayTeam;
        private System.Windows.Forms.Button btnSave;
        private System.Windows.Forms.Button btnCancel;
        private System.Windows.Forms.Panel panelTop;
        private System.Windows.Forms.Panel panelBottom;
        private System.Windows.Forms.Panel panelMain;
    }
} 