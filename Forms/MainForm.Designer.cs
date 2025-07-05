namespace SportsCoderWinForm.Forms
{
    partial class MainForm
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
            this.dataGridViewMatches = new System.Windows.Forms.DataGridView();
            this.btnCreateMatch = new System.Windows.Forms.Button();
            this.btnOpenControlPanel = new System.Windows.Forms.Button();
            this.btnOpenOverlay = new System.Windows.Forms.Button();
            this.btnDeleteMatch = new System.Windows.Forms.Button();
            this.labelTitle = new System.Windows.Forms.Label();
            this.panelTop = new System.Windows.Forms.Panel();
            this.panelBottom = new System.Windows.Forms.Panel();
            this.panelMain = new System.Windows.Forms.Panel();
            ((System.ComponentModel.ISupportInitialize)(this.dataGridViewMatches)).BeginInit();
            this.panelTop.SuspendLayout();
            this.panelBottom.SuspendLayout();
            this.panelMain.SuspendLayout();
            this.SuspendLayout();
            // 
            // dataGridViewMatches
            // 
            this.dataGridViewMatches.AllowUserToAddRows = false;
            this.dataGridViewMatches.AllowUserToDeleteRows = false;
            this.dataGridViewMatches.AutoSizeColumnsMode = System.Windows.Forms.DataGridViewAutoSizeColumnsMode.Fill;
            this.dataGridViewMatches.BackgroundColor = System.Drawing.Color.White;
            this.dataGridViewMatches.BorderStyle = System.Windows.Forms.BorderStyle.None;
            this.dataGridViewMatches.ColumnHeadersHeightSizeMode = System.Windows.Forms.DataGridViewColumnHeadersHeightSizeMode.AutoSize;
            this.dataGridViewMatches.Dock = System.Windows.Forms.DockStyle.Fill;
            this.dataGridViewMatches.Location = new System.Drawing.Point(0, 0);
            this.dataGridViewMatches.MultiSelect = false;
            this.dataGridViewMatches.Name = "dataGridViewMatches";
            this.dataGridViewMatches.ReadOnly = true;
            this.dataGridViewMatches.RowTemplate.Height = 25;
            this.dataGridViewMatches.SelectionMode = System.Windows.Forms.DataGridViewSelectionMode.FullRowSelect;
            this.dataGridViewMatches.Size = new System.Drawing.Size(800, 400);
            this.dataGridViewMatches.TabIndex = 0;
            // 
            // btnCreateMatch
            // 
            this.btnCreateMatch.Location = new System.Drawing.Point(12, 12);
            this.btnCreateMatch.Name = "btnCreateMatch";
            this.btnCreateMatch.Size = new System.Drawing.Size(120, 30);
            this.btnCreateMatch.TabIndex = 1;
            this.btnCreateMatch.Text = "새 경기 생성";
            this.btnCreateMatch.UseVisualStyleBackColor = true;
            this.btnCreateMatch.Click += new System.EventHandler(this.btnCreateMatch_Click);
            // 
            // btnOpenControlPanel
            // 
            this.btnOpenControlPanel.Location = new System.Drawing.Point(12, 12);
            this.btnOpenControlPanel.Name = "btnOpenControlPanel";
            this.btnOpenControlPanel.Size = new System.Drawing.Size(120, 30);
            this.btnOpenControlPanel.TabIndex = 2;
            this.btnOpenControlPanel.Text = "컨트롤 패널 열기";
            this.btnOpenControlPanel.UseVisualStyleBackColor = true;
            this.btnOpenControlPanel.Click += new System.EventHandler(this.btnOpenControlPanel_Click);
            // 
            // btnOpenOverlay
            // 
            this.btnOpenOverlay.Location = new System.Drawing.Point(138, 12);
            this.btnOpenOverlay.Name = "btnOpenOverlay";
            this.btnOpenOverlay.Size = new System.Drawing.Size(120, 30);
            this.btnOpenOverlay.TabIndex = 3;
            this.btnOpenOverlay.Text = "오버레이 열기";
            this.btnOpenOverlay.UseVisualStyleBackColor = true;
            this.btnOpenOverlay.Click += new System.EventHandler(this.btnOpenOverlay_Click);
            // 
            // btnDeleteMatch
            // 
            this.btnDeleteMatch.Location = new System.Drawing.Point(264, 12);
            this.btnDeleteMatch.Name = "btnDeleteMatch";
            this.btnDeleteMatch.Size = new System.Drawing.Size(120, 30);
            this.btnDeleteMatch.TabIndex = 4;
            this.btnDeleteMatch.Text = "경기 삭제";
            this.btnDeleteMatch.UseVisualStyleBackColor = true;
            this.btnDeleteMatch.Click += new System.EventHandler(this.btnDeleteMatch_Click);
            // 
            // labelTitle
            // 
            this.labelTitle.AutoSize = true;
            this.labelTitle.Font = new System.Drawing.Font("Segoe UI", 16F, System.Drawing.FontStyle.Bold, System.Drawing.GraphicsUnit.Point);
            this.labelTitle.Location = new System.Drawing.Point(12, 12);
            this.labelTitle.Name = "labelTitle";
            this.labelTitle.Size = new System.Drawing.Size(200, 30);
            this.labelTitle.TabIndex = 5;
            this.labelTitle.Text = "스포츠 코더 관리";
            // 
            // panelTop
            // 
            this.panelTop.Controls.Add(this.labelTitle);
            this.panelTop.Dock = System.Windows.Forms.DockStyle.Top;
            this.panelTop.Location = new System.Drawing.Point(0, 0);
            this.panelTop.Name = "panelTop";
            this.panelTop.Size = new System.Drawing.Size(800, 50);
            this.panelTop.TabIndex = 6;
            // 
            // panelBottom
            // 
            this.panelBottom.Controls.Add(this.btnCreateMatch);
            this.panelBottom.Controls.Add(this.btnOpenControlPanel);
            this.panelBottom.Controls.Add(this.btnOpenOverlay);
            this.panelBottom.Controls.Add(this.btnDeleteMatch);
            this.panelBottom.Dock = System.Windows.Forms.DockStyle.Bottom;
            this.panelBottom.Location = new System.Drawing.Point(0, 450);
            this.panelBottom.Name = "panelBottom";
            this.panelBottom.Size = new System.Drawing.Size(800, 50);
            this.panelBottom.TabIndex = 7;
            // 
            // panelMain
            // 
            this.panelMain.Controls.Add(this.dataGridViewMatches);
            this.panelMain.Dock = System.Windows.Forms.DockStyle.Fill;
            this.panelMain.Location = new System.Drawing.Point(0, 50);
            this.panelMain.Name = "panelMain";
            this.panelMain.Size = new System.Drawing.Size(800, 400);
            this.panelMain.TabIndex = 8;
            // 
            // MainForm
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(7F, 15F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(800, 500);
            this.Controls.Add(this.panelMain);
            this.Controls.Add(this.panelBottom);
            this.Controls.Add(this.panelTop);
            this.Name = "MainForm";
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
            this.Text = "스포츠 코더";
            ((System.ComponentModel.ISupportInitialize)(this.dataGridViewMatches)).EndInit();
            this.panelTop.ResumeLayout(false);
            this.panelTop.PerformLayout();
            this.panelBottom.ResumeLayout(false);
            this.panelMain.ResumeLayout(false);
            this.ResumeLayout(false);
        }

        #endregion

        private System.Windows.Forms.DataGridView dataGridViewMatches;
        private System.Windows.Forms.Button btnCreateMatch;
        private System.Windows.Forms.Button btnOpenControlPanel;
        private System.Windows.Forms.Button btnOpenOverlay;
        private System.Windows.Forms.Button btnDeleteMatch;
        private System.Windows.Forms.Label labelTitle;
        private System.Windows.Forms.Panel panelTop;
        private System.Windows.Forms.Panel panelBottom;
        private System.Windows.Forms.Panel panelMain;
    }
} 