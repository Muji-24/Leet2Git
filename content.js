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
    <img src="${chrome.runtime.getURL('icons/icon48.png')}" alt="Logo" class="logo">
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
  // 1. DIRECT MONACO EDITOR ACCESS (most reliable)
  try {
    // New LeetCode (post-2023 UI)
    const monacoEditors = document.querySelectorAll('.monaco-editor');
    if (monacoEditors.length > 0) {
      // Access the Monaco editor instance through LeetCode's exposed properties
      const editor = monacoEditors[0]?.__vue__?.editor;
      if (editor?.getValue) {
        return editor.getValue();
      }
    }

    // Alternative access through window.monaco
    if (window.monaco?.editor?.getModels) {
      const models = monaco.editor.getModels();
      if (models.length > 0) {
        return models[0].getValue();
      }
    }
  } catch (e) {
    console.log("Monaco direct access failed:", e);
  }

  // 2. LEETCODE'S VUE COMPONENT STATE (very reliable)
  try {
    // Access Vue component state (works in both old and new UI)
    const vueApp = document.querySelector('#app').__vue__;
    if (vueApp) {
      // New UI (2023+)
      const codeModel = vueApp.$store?.state?.codeEditor?.codeModel;
      if (codeModel?.code) {
        return codeModel.code;
      }
      
      // Old UI (pre-2023)
      const code = vueApp.$children[0]?.$data?.code;
      if (code) return code;
    }
  } catch (e) {
    console.log("Vue state access failed:", e);
  }

  // 3. LOCALSTORAGE (works for most recent submission)
  try {
    const problemSlug = window.location.pathname.split('/')[2];
    if (problemSlug) {
      const localStorageKey = `problem_${problemSlug}`;
      const savedData = JSON.parse(localStorage.getItem(localStorageKey));
      if (savedData?.code) {
        return savedData.code;
      }
    }
  } catch (e) {
    console.log("LocalStorage access failed:", e);
  }

  // 4. HIDDEN TEXTAREA (fallback)
  const hiddenTextarea = document.querySelector('textarea.inputarea');
  if (hiddenTextarea?.value) {
    return hiddenTextarea.value;
  }

  // 5. LAST RESORT: LINE-BY-LINE EXTRACTION
  const lines = document.querySelectorAll('.view-line');
  if (lines.length > 0) {
    return Array.from(lines).map(line => line.textContent).join('\n');
  }

  console.error("All code extraction methods failed");
  return null;
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

      // Extract code with multiple fallbacks
      let code = extractCodeSafely();
      if (!code || code.length < 10) {
        // One final attempt by forcing hidden textarea value
        code = document.querySelector('textarea.inputarea')?.value || code;
        if (!code || code.length < 10) {
          alert('❌ Failed to extract code. Please try submitting again or report this issue.');
          isProcessingSubmission = false;
          return;
        }
      }

      code = code.replace(/^\d+\s*/gm, '').replace(/\r\n|\r|\n/g, '\n').trim();

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
      <img src="${chrome.runtime.getURL('icons/icon48.png')}" alt="Logo" class="logo">
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