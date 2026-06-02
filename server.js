const express = require('express');
const path = require('path');
const app = express();

app.use(express.static(path.join(__dirname)));

// Your redirects
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/LoginAuth', (req, res) => res.sendFile(path.join(__dirname, 'loginauth.html')));
app.get('/Profile', (req, res) => res.sendFile(path.join(__dirname, 'profile.html')));
app.get('/Profile_Edit', (req, res) => res.sendFile(path.join(__dirname, 'profileinfo.html')));
app.get('/MatchCreation', (req, res) => res.sendFile(path.join(__dirname, 'creatematchpage.html')));
app.get('/My_Matches', (req, res) => res.sendFile(path.join(__dirname, 'my-matches.html')));
app.get('/Match_Winner', (req, res) => res.sendFile(path.join(__dirname, 'select_winner.html')));
app.get('/Match_Success', (req, res) => res.sendFile(path.join(__dirname, 'match_completed.html')));
app.get('/Notifications', (req, res) => res.sendFile(path.join(__dirname, 'notifications.html')));
app.get('/About', (req, res) => res.sendFile(path.join(__dirname, 'about.html')));
app.get('/ReferEarn', (req, res) => res.sendFile(path.join(__dirname, 'referearn.html')));
app.get('/Support', (req, res) => res.sendFile(path.join(__dirname, 'support.html')));
app.get('/FairPlayPolicy', (req, res) => res.sendFile(path.join(__dirname, 'fairplaypolicy.html')));
app.get('/PrivacyPolicy', (req, res) => res.sendFile(path.join(__dirname, 'privacypolicy.html')));
app.get('/RefundPolicy', (req, res) => res.sendFile(path.join(__dirname, 'refundpolicy.html')));
app.get('/TermsConditions', (req, res) => res.sendFile(path.join(__dirname, 'termscondition.html')));
app.get('/inmatchjoin', (req, res) => res.sendFile(path.join(__dirname, 'inmatchjoin.html')));

app.listen(3000, () => console.log('Server running at http://localhost:3000'));