// Encryption functions (same as in popup.js for decryption)
async function importKey(base64Key) {
  const keyData = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    true,
    ['encrypt', 'decrypt']
  );
}

async function decryptToken(encryptedToken, iv, key) {
  const encryptedData = Uint8Array.from(atob(encryptedToken), c => c.charCodeAt(0));
  const ivData = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivData },
    key,
    encryptedData
  );
  return new TextDecoder().decode(decrypted);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'pushToGitHub') {
    const { problemTitle, code, language, difficulty } = message;

    chrome.storage.local.get([
      'encryptedToken', 'iv', 'githubUsername', 'userStats', 'encryptionKey'
    ], async (data) => {
      const { encryptedToken, iv, githubUsername, userStats = {}, encryptionKey } = data;
      if (!encryptedToken || !iv || !githubUsername || !encryptionKey) {
        alert('Please sign in with your GitHub token in the extension popup.');
        return;
      }

      // Decrypt token
      let githubToken;
      try {
        const key = await importKey(encryptionKey);
        githubToken = await decryptToken(encryptedToken, iv, key);
      } catch (error) {
        alert('Error decrypting token: ' + error.message);
        return;
      }

      // Validate code length
      if (code.length < 50) {
        alert('Code is too short or empty. Please check the editor.');
        return;
      }

      // Normalize code
      const normalizedCode = code.replace(/\r\n|\r|\n/g, '\n');

      // Language mapping
      const languageMap = {
        'python3': { ext: 'py', comment: '#' },
        'python': { ext: 'py', comment: '#' },
        'cpp': { ext: 'cpp', comment: '//' },
        'java': { ext: 'java', comment: '//' },
        'javascript': { ext: 'js', comment: '//' },
        'c': { ext: 'c', comment: '//' },
        'csharp': { ext: 'cs', comment: '//' },
        'ruby': { ext: 'rb', comment: '#' },
        'go': { ext: 'go', comment: '//' }
      };
      const langInfo = languageMap[language] || { ext: normalizedCode.includes('def ') ? 'py' : 'cpp', comment: '//' };
      const filePath = `solutions/${problemTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}.${langInfo.ext}`;
      const metadata = `${langInfo.comment} LeetCode Problem: ${problemTitle}\n${langInfo.comment} Difficulty: ${difficulty || 'Unknown'}\n${langInfo.comment} Pushed on: ${new Date().toISOString().split('T')[0]}\n\n${normalizedCode}`;

      // Check if Leetcode-Problems repo exists
      const repoName = 'Leetcode-Problems';
      const repoResponse = await fetch(`https://api.github.com/repos/${githubUsername}/${repoName}`, {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      let repoData;
      if (repoResponse.status === 404) {
        const createResponse = await fetch(`https://api.github.com/user/repos`, {
          method: 'POST',
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
          },
          body: JSON.stringify({
            name: repoName,
            description: 'LeetCode solutions pushed by LeetCode Auto-Push extension. Free Palestine 🇵🇸',
            auto_init: true
          })
        });
        repoData = await createResponse.json();
      } else {
        repoData = await repoResponse.json();
      }

      if (repoData.id) {
        // Push code to repo
        const fileContent = btoa(unescape(encodeURIComponent(metadata)));
        const pushResponse = await fetch(`https://api.github.com/repos/${githubUsername}/${repoName}/contents/${filePath}`, {
          method: 'PUT',
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
          },
          body: JSON.stringify({
            message: `Add solution for ${problemTitle}`,
            content: fileContent,
            branch: 'main'
          })
        });
        const pushData = await pushResponse.json();

        if (pushData.content) {
          // Update stats
          const user = userStats[githubUsername] || {
            pushCount: 0,
            easyCount: 0,
            mediumCount: 0,
            hardCount: 0,
            submissionTimestamps: [],
            streak: 0,
            lastSolveDate: ''
          };
          const newTimestamps = [...user.submissionTimestamps, new Date().toISOString()];
          const updates = {
            pushCount: user.pushCount + 1,
            submissionTimestamps: newTimestamps,
            lastSolveDate: new Date().toISOString().split('T')[0]
          };
          if (difficulty.toLowerCase() === 'easy') updates.easyCount = user.easyCount + 1;
          else if (difficulty.toLowerCase() === 'medium') updates.mediumCount = user.mediumCount + 1;
          else if (difficulty.toLowerCase() === 'hard') updates.hardCount = user.hardCount + 1;
          userStats[githubUsername] = { ...user, ...updates };

          chrome.storage.local.set({ userStats }, () => {
            chrome.runtime.sendMessage({ 
              action: 'pushSuccess', 
              repoUrl: `https://github.com/${githubUsername}/${repoName}/tree/main/solutions`,
              problemTitle
            });
          });
        } else {
          alert('Failed to push code: ' + (pushData.message || 'Unknown error'));
        }
      } else {
        alert('Failed to access or create repository: ' + (repoData.message || 'Unknown error'));
      }
    });
  }
});