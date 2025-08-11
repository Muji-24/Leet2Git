let lastSubmissionTime = 0;
const submissionCooldown = 10000;
let lastResultText = '';
let isProcessingSubmission = false;

function createCustomPopup(problemTitle, callback) {
  const existingPopup = document.getElementById('custom-popup');
  if (existingPopup) existingPopup.remove();

  const popup = document.createElement('div');
  popup.id = 'custom-popup';
  popup.innerHTML = `
     <img src="${chrome.runtime.getURL('icons/icons8-leetcode-48.png')}" alt="Logo">
    <h3>Push "${problemTitle}" to GitHub?</h3>
    <button class="btn btn-primary" id="push-yes">Yes</button>
    <button class="btn btn-secondary" id="push-no">No</button>
  `;
  document.body.appendChild(popup);

  document.getElementById('push-yes').addEventListener('click', () => {
    callback(true);
    popup.remove();
  });

  document.getElementById('push-no').addEventListener('click', () => {
    callback(false);
    popup.remove();
    isProcessingSubmission = false;
  });
}

function extractCodeSafely() {
  // Fallback to visual line extraction (scoped to editor container)
  async function tryExtractFromViewLines() {
    try {
      // Find the editor container first
      const editorContainer = document.querySelector('.monaco-editor, [class*="editor"], [class*="code-editor"]');
      if (!editorContainer) {
        console.error("No editor container found for view-line extraction");
        return null;
      }

      // Select view lines within the editor container, prioritizing .view-line
      let lines = editorContainer.querySelectorAll('.view-line');
      if (lines.length === 0) {
        console.error("No .view-line elements found in editor container, trying broader selectors");
        lines = editorContainer.querySelectorAll('[class*="view-line"], [class*="line"], [class*="code-line"]');
        if (lines.length === 0) {
          console.error("No view-line elements found in editor container");
          return null;
        }
      }

      // Extract text from each line and normalize whitespace
      let codeLines = Array.from(lines).map(line => 
        line.textContent
          .trim()
          .replace(/\s+/g, ' ') // Normalize multiple spaces/tabs to a single space
      );

      // Filter out empty lines and non-code content
      codeLines = codeLines.filter(line => 
        line.length > 0 && 
        !line.match(/^(Submit|Premium|Settings|Sign Out|Topics|Companies|Hint|Editorial|Solution|Case \d+)/i)
      );

      // Deduplicate lines, ignoring whitespace differences
      const uniqueLines = [];
      const seenLines = new Set();
      for (const line of codeLines) {
        // Normalize line for deduplication (remove all whitespace for comparison)
        const normalizedLine = line.replace(/\s+/g, '');
        if (!seenLines.has(normalizedLine)) {
          uniqueLines.push(line); // Keep original line with formatting
          seenLines.add(normalizedLine);
        }
      }

      // Join lines with newlines to preserve formatting
      const code = uniqueLines.join('\n');
      if (code.trim().length > 0) {
        console.log(`Extracted code from view lines: "${code.substring(0, 50)}..." (length: ${code.length}, lines: ${uniqueLines.length})`);
        return code;
      }
      console.error("View-line extraction resulted in empty code after filtering");
      return null;
    } catch (e) {
      console.error("View line extraction failed:", e);
      return null;
    }
  }

  // Main extraction logic (only using view lines)
  return tryExtractFromViewLines();
}

function monitorSubmission() {
  const observer = new MutationObserver(() => checkSubmission(observer, pollingInterval));
  const pollingInterval = setInterval(() => checkSubmission(observer, pollingInterval), 2000);

  async function checkSubmission(observer, pollingInterval) {
    if (isProcessingSubmission) return;

    const resultElement = document.querySelector('span[data-e2e-locator="submission-result"]');
    const currentResultText = resultElement?.textContent ?? '';

    if (currentResultText.includes('Accepted') && currentResultText !== lastResultText) {
      const now = Date.now();
      if (now - lastSubmissionTime < submissionCooldown) return;

      lastSubmissionTime = now;
      lastResultText = currentResultText;
      isProcessingSubmission = true;

      const titleElement = document.querySelector(
        'a[class*="title"], h1, h2, h3, h4, div[class*="title"], div[class*="problem-title"], a.h5'
      );
      const problemTitle = titleElement?.textContent.trim() || 'leetcode-problem';

      // Extract code (await the promise from extractCodeSafely)
      let code = await extractCodeSafely();
      if (!code || code.trim().length === 0) {
        console.error("Code extraction failed or code is empty:", code);
        alert('❌ Failed to extract code. Please try submitting again or check the console for details.');
        isProcessingSubmission = false;
        return;
      }

      code = code.replace(/^\d+\s*/gm, '').replace(/\r\n|\r|\n/g, '\n').trim();
      console.log(`Processed code: "${code.substring(0, 50)}..." (length: ${code.length})`);

      // Language detection
      const langElement = document.querySelector('select[data-cy="lang-select"], select[name="lang"], div[class*="language"]');
      const language = langElement?.value?.toLowerCase() || 
                     langElement?.textContent?.toLowerCase() || 
                     'unknown';

      // Difficulty detection
      const difficultyElement = document.querySelector('div[class*="difficulty"], span[class*="difficulty"]');
      const difficulty = difficultyElement?.textContent.trim() || 'Unknown';

      if (problemTitle && code) {
        if (observer) observer.disconnect();
        if (pollingInterval) clearInterval(pollingInterval);

        createCustomPopup(problemTitle, (shouldPush) => {
          if (shouldPush) {
            chrome.runtime.sendMessage({
              action: 'pushToGitHub',
              problemTitle,
              code,
              language,
              difficulty
            });
          } else {
            isProcessingSubmission = false;
          }
        });
      } else {
        console.error("Missing problem title or code:", { problemTitle, code });
        alert('⚠️ Missing problem title or code.');
        isProcessingSubmission = false;
      }
    }
  }

  const targetNode = document.querySelector('div[class*="submission"], div[class*="result"], div[class*="content"]') || document.body;
  if (targetNode) {
    observer.observe(targetNode, { childList: true, subtree: true, characterData: true });
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'pushSuccess') {
    const successPopup = document.createElement('div');
    successPopup.id = 'custom-popup';
    successPopup.innerHTML = `
       <img src="${chrome.runtime.getURL('icons/icons8-leetcode-48.png')}" alt="Logo">
      <h3>✅ Success!</h3>
      <p>Code pushed to <a href="${message.repoUrl}" target="_blank">GitHub</a>!</p>
      <button class="btn btn-primary" id="close-success">OK</button>
      <button class="btn btn-secondary" id="share-x">Share on X</button>
    `;
    document.body.appendChild(successPopup);

    document.getElementById('close-success').addEventListener('click', () => {
      successPopup.remove();
      isProcessingSubmission = false;
    });

    document.getElementById('share-x').addEventListener('click', () => {
      window.open(`https://x.com/intent/tweet?text=Solved ${message.problemTitle} on LeetCode! Check my solution: ${message.repoUrl}`);
      successPopup.remove();
      isProcessingSubmission = false;
    });
  } else if (message.action === 'pushError') {
    alert(`❌ Failed to push to GitHub: ${message.error}`);
    isProcessingSubmission = false;
  }
});

window.addEventListener('popstate', () => {
  lastSubmissionTime = 0;
  lastResultText = '';
  isProcessingSubmission = false;
});

// Start monitoring when injected
monitorSubmission();