**LeetCode Auto-Push to Github Chrome Extension 🚀**

A Chrome extension that automatically pushes accepted LeetCode solutions to an auto-created GitHub repository named Leetcode-Problems. It tracks your coding progress with detailed statistics and securely stores your GitHub token using AES-GCM encryption.
Perfect for developers who want to save their LeetCode solutions effortlessly!

✨ Features:
No manual repo creation, you only submit code,  press yes to push and it will create a repo( only in first submission) and all future questions pushed there.

✅ Automatic Code Push
Pushes accepted LeetCode solutions to:
Leetcode-Problems/solutions/<problem-title>.<extension>

📊 Persistent Stats Tracking
Tracks:
Total pushes
Easy/Medium/Hard problem counts
Daily & weekly submissions
Streaks (with lifetime persistence)


✅ Prerequisites
Google Chrome: Version 90+
GitHub Account: With Personal Access Token (discussed below)
LeetCode Account

⚙️ Installation
It consist of 2 step: firstly Load extension to chrome and secondly get your github token

1)
⚙️ Clone or Download the Repository
Enable Developer Mode in Chrome
Visit: chrome://extensions/
Toggle Developer mode (top right)
To load the Extension, Click Load unpacked
Select the folder that you just downloaded, unzip it first
The extension will appear as "LeetCode Auto-Push"

Pin the Extension:
Click the 🧩 puzzle icon in Chrome
Pin LeetCode Auto-Push for easy access

2)
🔑 Generate GitHub Token
Go to GitHub.com
Navigate to Settings → Developer Settings → Personal Access Tokens
Click Generate new token (classic)
Set a name (e.g., LeetCode Auto Push Token)
Choose an expiration (e.g., 90 days or no expiration)
Check the box for repo scope only
Click Generate token and copy it securely

🚀 Usage
1. Sign In
Open the extension popup
Paste your GitHub token
Click Save Token
Your GitHub username and stats will appear

2. Submit LeetCode Problem
Submit your solution
On “Accepted”, a popup will ask:
“Push ‘<problem-name>’ to GitHub?”
Click Yes
A new repository will be created on first push and all future questions will be pushed here


📈 View Stats
Open the popup to see:
🧮 Total Pushed: 5
🟢 Easy: 2, 🟠 Medium: 2, 🔴 Hard: 1
📅 Today: 1, This Week: 3
🔥 Streak: 3 days

🔐 GitHub Token Security
Stored with AES-GCM encryption using a unique key per user
Only repo scope required
Token is never sent to any external server

🔄 Logout Process
When logging out and back in again:
All your stats and data are retained and restored
