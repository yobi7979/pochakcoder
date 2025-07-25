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
    public partial class MainForm : Form
    {
        private readonly ApplicationDbContext _context;

        public MainForm()
        {
            InitializeComponent();
            _context = new ApplicationDbContext();
            _context.Database.EnsureCreated();
            LoadMatches();
        }

        private void LoadMatches()
        {
            var matches = _context.Matches.OrderByDescending(m => m.CreatedAt).ToList();
            dataGridViewMatches.DataSource = matches;
        }

        private void btnCreateMatch_Click(object sender, EventArgs e)
        {
            var createMatchForm = new CreateMatchForm(_context);
            if (createMatchForm.ShowDialog() == DialogResult.OK)
            {
                LoadMatches();
            }
        }

        private void btnOpenControlPanel_Click(object sender, EventArgs e)
        {
            if (dataGridViewMatches.SelectedRows.Count > 0)
            {
                var match = (Match)dataGridViewMatches.SelectedRows[0].DataBoundItem;
                var controlPanelForm = new SoccerControlForm(_context, match);
                controlPanelForm.Show();
            }
            else
            {
                MessageBox.Show("경기를 선택해주세요.", "알림", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }

        private void btnOpenOverlay_Click(object sender, EventArgs e)
        {
            if (dataGridViewMatches.SelectedRows.Count > 0)
            {
                var match = (Match)dataGridViewMatches.SelectedRows[0].DataBoundItem;
                var overlayForm = new SoccerOverlayForm(match);
                overlayForm.Show();
            }
            else
            {
                MessageBox.Show("경기를 선택해주세요.", "알림", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }

        private void btnDeleteMatch_Click(object sender, EventArgs e)
        {
            if (dataGridViewMatches.SelectedRows.Count > 0)
            {
                var match = (Match)dataGridViewMatches.SelectedRows[0].DataBoundItem;
                var result = MessageBox.Show($"'{match.HomeTeam} vs {match.AwayTeam}' 경기를 삭제하시겠습니까?", 
                    "경기 삭제", MessageBoxButtons.YesNo, MessageBoxIcon.Question);
                
                if (result == DialogResult.Yes)
                {
                    _context.Matches.Remove(match);
                    _context.SaveChanges();
                    LoadMatches();
                }
            }
            else
            {
                MessageBox.Show("경기를 선택해주세요.", "알림", MessageBoxButtons.OK, MessageBoxIcon.Information);
            }
        }
    }
} 