document.addEventListener('DOMContentLoaded', async () => {
  const tokenInput = document.getElementById('github-token');
  const saveButton = document.getElementById('save-token');
  const statusSection = document.getElementById('status');
  const usernameSpan = document.getElementById('username');
  const logoutButton = document.getElementById('logout');
  const pushCountSpan = document.getElementById('push-count');
  const easyCountSpan = document.getElementById('easy-count');
  const mediumCountSpan = document.getElementById('medium-count');
  const hardCountSpan = document.getElementById('hard-count');
  const todayCountSpan = document.getElementById('today-count');
  const weekCountSpan = document.getElementById('week-count');
  const streakCountSpan = document.getElementById('streak-count');
  const toggleThemeButton = document.getElementById('toggle-theme');

  // Encryption functions
  async function generateKey() {
    return await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  async function exportKey(key) {
    const exported = await crypto.subtle.exportKey('raw', key);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
  }

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

  async function encryptToken(token, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedToken = new TextEncoder().encode(token);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedToken
    );
    return {
      encryptedToken: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
      iv: btoa(String.fromCharCode(...iv))
    };
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

  // Load saved data
  chrome.storage.local.get([
    'encryptedToken', 'iv', 'githubUsername', 'userStats', 'theme'
  ], async (data) => {
    if (data.encryptedToken && data.iv && data.githubUsername) {
      const userStats = data.userStats && data.userStats[data.githubUsername] || {
        pushCount: 0,
        easyCount: 0,
        mediumCount: 0,
        hardCount: 0,
        submissionTimestamps: [],
        streak: 0,
        lastSolveDate: ''
      };
      statusSection.style.display = 'block';
      usernameSpan.textContent = data.githubUsername;
      tokenInput.style.display = 'none';
      saveButton.style.display = 'none';

      pushCountSpan.textContent = userStats.pushCount;
      easyCountSpan.textContent = userStats.easyCount;
      mediumCountSpan.textContent = userStats.mediumCount;
      hardCountSpan.textContent = userStats.hardCount;

      const timestamps = userStats.submissionTimestamps || [];
      const today = new Date().toISOString().split('T')[0];
      const todayCount = timestamps.filter(ts => ts.startsWith(today)).length;
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekCount = timestamps.filter(ts => new Date(ts) >= weekAgo).length;
      todayCountSpan.textContent = todayCount;
      weekCountSpan.textContent = weekCount;

      const streak = calculateStreak(timestamps, userStats.lastSolveDate);
      streakCountSpan.textContent = streak;
    }

    if (data.theme === 'dark') {
      document.body.classList.add('dark');
    }
  });

  // Save token and fetch username
  saveButton.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    if (!token) {
      alert('Please enter a valid GitHub token.');
      return;
    }

    // Verify token
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    const data = await response.json();

    if (!data.login) {
      alert('Invalid token. Please try again.');
      return;
    }

    // Generate or retrieve encryption key
    let key, keyBase64;
    const storedKey = await new Promise(resolve => chrome.storage.local.get(['encryptionKey'], resolve));
    if (storedKey.encryptionKey) {
      keyBase64 = storedKey.encryptionKey;
      key = await importKey(keyBase64);
    } else {
      key = await generateKey();
      keyBase64 = await exportKey(key);
      chrome.storage.local.set({ encryptionKey: keyBase64 });
    }

    // Encrypt token
    const { encryptedToken, iv } = await encryptToken(token, key);

    // Load existing user stats or initialize
    const storedStats = await new Promise(resolve => chrome.storage.local.get(['userStats'], resolve));
    const userStats = storedStats.userStats || {};
    if (!userStats[data.login]) {
      userStats[data.login] = {
        pushCount: 0,
        easyCount: 0,
        mediumCount: 0,
        hardCount: 0,
        submissionTimestamps: [],
        streak: 0,
        lastSolveDate: ''
      };
    }

    // Save data
    chrome.storage.local.set({
      encryptedToken,
      iv,
      githubUsername: data.login,
      userStats
    }, () => {
      statusSection.style.display = 'block';
      usernameSpan.textContent = data.login;
      tokenInput.style.display = 'none';
      saveButton.style.display = 'none';
      alert('Token saved! Signed in as ' + data.login);
    });
  });

  // Logout
  logoutButton.addEventListener('click', () => {
    chrome.storage.local.remove(['encryptedToken', 'iv', 'githubUsername'], () => {
      statusSection.style.display = 'none';
      tokenInput.style.display = 'block';
      saveButton.style.display = 'block';
      tokenInput.value = '';
      alert('Logged out.');
    });
  });

  // Toggle theme
  toggleThemeButton.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    chrome.storage.local.set({ theme: document.body.classList.contains('dark') ? 'dark' : 'light' });
  });

  // Calculate streak
  function calculateStreak(timestamps, lastSolveDate) {
    if (!timestamps.length) return 0;
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const solvedToday = timestamps.some(ts => ts.startsWith(todayStr));
    const solvedYesterday = timestamps.some(ts => ts.startsWith(yesterdayStr));

    if (solvedToday) {
      return lastSolveDate === yesterdayStr ? (streak || 0) + 1 : 1;
    } else if (solvedYesterday) {
      return streak || 0;
    } else {
      return 0; // Streak broken
    }
  }
});