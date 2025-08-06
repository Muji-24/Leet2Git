# LeetCode Auto-Push to GitHub - Chrome Extension

LeetCode Auto-Push is a Chrome extension that automatically commits your accepted LeetCode solutions to a GitHub repository named `Leetcode-Problems`. It helps developers track their problem-solving progress efficiently, while securely storing GitHub credentials using AES-GCM encryption.

## Features

- Automatically creates a GitHub repository on first accepted submission, you dont have to make a repo
- Pushes future accepted LeetCode solutions to the same repository
- Tracks problem counts by difficulty (Easy, Medium, Hard)
- Displays daily, weekly, and total submission stats
- Maintains streaks and persists data across sessions
- Secure token storage using AES-GCM encryption

## Prerequisites

- Google Chrome (version 90 or later)
- GitHub account with a Personal Access Token(Discussed Below)
- LeetCode account

## Installation

### 1. Clone the Repository

Download or clone this repository to your local machine.

### 2. Load Extension in Chrome

- Open Chrome and go to `chrome://extensions/`
- Enable **Developer mode** (top right corner)
- Click **Load unpacked**
- Select the unzipped extension folder
- The extension will now appear in your Chrome toolbar

## 3. GitHub Token Setup

1. Go to [GitHub Settings](https://github.com/settings/tokens)
2. Navigate to **Developer Settings** → **Personal Access Tokens**
3. Click **Generate new token (classic)**
4. Set a name (e.g., `LeetCode Auto Push Token`)
5. Set expiration (90 days or no expiration)
6. Enable the `repo` scope
7. Generate the token and copy it securely

## Usage

### 1. Sign In

- Open the extension popup
- Paste your GitHub token
- Click **Save Token**
- Your GitHub username and submission stats will appear

### 2. Submit a LeetCode Problem

- Solve and submit a problem on LeetCode
- Upon "Accepted", a popup will appear: "Push `<Problem Name>` to GitHub?"
- Click **Yes** to push the code
- A repository will be created automatically on the first submission

### 3. View Submission Stats

- Open the extension popup to view:
  - Total problems pushed
  - Count of Easy / Medium / Hard problems
  - Today’s and This Week’s submissions
  - Current streak

## Token Security

- Tokens are stored securely using AES-GCM encryption
- Each user has a unique encryption key
- Only the `repo` scope is required
- Tokens are never transmitted to any external server

## Logout & Session Persistence

- When logging out and back in, all stats and token data are restored
- Your history and progress remain intact
