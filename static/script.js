// FILE: static/script.js
// This is the corrected version with ONLY the requested slider changes added.
// All original console.log statements have been preserved.
document.addEventListener('DOMContentLoaded', () => {
    const initialSetupDiv = document.getElementById('initial-setup');
    const chatInterfaceDiv = document.getElementById('chat-interface'); // Main div for chat + assessment
    const assessmentAreaDiv = document.getElementById('assessment-area'); // Now inside chatInterfaceDiv
    const finalPageDiv = document.getElementById('final-page');
    const errorMessageArea = document.getElementById('error-message-area');
    const instructionsPhaseDiv = document.getElementById('instructions-phase');
    const confirmInstructionsButton = document.getElementById('confirm-instructions-button');
    const demographicsModal = document.getElementById('demographics-modal');
    const modalContinueButton = document.getElementById('modal-continue-button');

    const finalInstructionsModal = document.getElementById('final-instructions-modal');
    const finalInstructionsButton = document.getElementById('final-instructions-button');

    // State flags for the new parallel logic
    let isBackendReady = false;
    let isUserReady = false;

    const initialForm = document.getElementById('initial-form');
    const initLoadingDiv = document.getElementById('init-loading');

    const messageList = document.getElementById('message-list');
    const userMessageInput = document.getElementById('user-message-input');
    const sendMessageButton = document.getElementById('send-message-button');
    const typingIndicator = document.getElementById('typing-indicator');
    const chatInputContainer = document.getElementById('chat-input-container'); // Div containing text input and send button

    const confidenceSlider = document.getElementById('confidence-slider');
    const confidenceValueSpan = document.getElementById('confidence-value');
    const submitRatingButton = document.getElementById('submit-rating-button');
    const ratingLoadingDiv = document.getElementById('rating-loading');

    const feelsOffCheckbox = document.getElementById('feels-off-checkbox');
    const commentInputArea = document.getElementById('comment-input-area');
    const feelsOffCommentTextarea = document.getElementById('feels-off-comment');
    const submitCommentButton = document.getElementById('submit-comment-button');
    const commentLoadingDiv = document.getElementById('comment-loading');

    const finalDecisionText = document.getElementById('final-decision-text');
    const finalDecisionTimeText = document.getElementById('final-decision-time-text');
    const confidenceTrendData = document.getElementById('confidence-trend-data');
    const newSessionButton = document.getElementById('new-session-button');
    const loadResearcherDataButton = document.getElementById('load-researcher-data-button');
    const researcherDataContent = document.getElementById('researcher-data-content');
    const researcherDataSection = document.getElementById('researcher-data-section');

    const consentPhaseDiv = document.getElementById('consent-phase');
    const consentContentDiv = document.getElementById('consent-content');
    const consentActionsDiv = document.getElementById('consent-actions');
    const consentDownloadPromptDiv = document.getElementById('consent-download-prompt');
    const agreeButton = document.getElementById('agree-button');
    const disagreeButton = document.getElementById('disagree-button');
    const downloadConsentButton = document.getElementById('download-consent-button');
    const skipConsentDownloadButton = document.getElementById('skip-consent-download-button');
    
    // NEW: Debrief and Summary Phase Elements
    const debriefPhaseDiv = document.getElementById('debrief-phase');
    const summaryPhaseDiv = document.getElementById('summary-phase');
    const downloadDebriefButton = document.getElementById('download-debrief-button');
    const continueAfterDebriefButton = document.getElementById('continue-after-debrief-button');

    const feedbackPhaseDiv = document.getElementById('feedback-phase');
    const submitFeedbackButton = document.getElementById('submit-feedback-button');
    const skipFeedbackButton = document.getElementById('skip-feedback-button');
    const feedbackTextarea = document.getElementById('feedback-textarea');
    const mainContainer = document.querySelector('.container'); // For the disagree message

    // 1. Prolific Placeholder URLs
    const PROLIFIC_COMPLETION_URL = "https://app.prolific.com/submissions/complete?cc=YOUR_COMPLETION_CODE";
    const PROLIFIC_REJECTION_URL = "https://app.prolific.com/submissions/complete?cc=YOUR_REJECTION_CODE";
    const PROLIFIC_TIMED_OUT_URL = "https://app.prolific.com/submissions/complete?cc=YOUR_TIMED_OUT_CODE";

    // 2. Production Mode Check
    const isProduction = (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1');

    // --- Railway API adapter (add right after `isProduction`) ---
    const API_BASE_URL = isProduction ? 'https://ai-turing-test-production.up.railway.app' : '';

    // Monkey-patch fetch so relative paths (starting with "/") hit Railway in production.
    // Local dev (localhost/127.0.0.1) stays unchanged.
    (() => {
    const RAW_FETCH = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
        try {
        const url = typeof input === 'string' ? input : input.url;
        if (url.startsWith('/')) {
            return RAW_FETCH(`${API_BASE_URL}${url}`, init);
        }
        return RAW_FETCH(input, init);
        } catch {
        return RAW_FETCH(input, init);
        }
    };
    })();

    

    // --- LIKERT BUBBLE HANDLERS FOR INITIAL FORM ---
    const likertBubbles = document.querySelectorAll('.likert-bubble');
    likertBubbles.forEach(bubble => {
        bubble.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent form submission
            
            const groupName = bubble.dataset.name;
            const value = bubble.dataset.value;
            
            // Remove selected class from all bubbles in this group
            document.querySelectorAll(`.likert-bubble[data-name="${groupName}"]`).forEach(b => {
                b.classList.remove('selected');
            });
            
            // Add selected class to clicked bubble
            bubble.classList.add('selected');
            
            // Update the hidden input
            document.querySelector(`input[type="hidden"][name="${groupName}"]`).value = value;
        });
    });
    // --- END LIKERT BUBBLE HANDLERS ---

    // We generate a client-side ID for the consent form filename before the server gives us a session ID.
    const participantId = self.crypto.randomUUID(); 
    // Try to compute prolificPid from URL parameters if present
    const urlParams = new URLSearchParams(window.location.search);
    const prolificPid = urlParams.get('PROLIFIC_PID') || urlParams.get('prolific_pid') || urlParams.get('prolificPID') || null;

    let sessionId = null; // Changed from localStorage.getItem('sessionId') to ensure clean start
    let currentTurn = 0;
    let aiResponseTimestamp = null;
    let progressInterval; // Moved from inside the form listener
    let lastConfidenceValue = 0.5; // NEW: To store the last submitted rating
    let sliderStartValueThisTurn = 0.5; // NEW: To check if the slider has moved
    let finalSummaryData = null; // NEW: To store summary data before showing feedback form
    
    // Timer variables
    let studyTimer = null;
    let studyStartTime = null;
    let timeExpired = false;
    const STUDY_DURATION_MS = 20 * 60 * 1000; // 20 minutes in milliseconds


    // --- NEW: SLIDER VALUE DISPLAY LOGIC ---
    const allSliders = document.querySelectorAll('#initial-form input[type="range"]');
    allSliders.forEach(slider => {
        const valueSpan = slider.nextElementSibling;
        if (valueSpan && valueSpan.classList.contains('slider-value')) {
            // Set initial value on page load
            valueSpan.textContent = slider.value;

            // Add listener to update value in real-time
            slider.addEventListener('input', () => {
                valueSpan.textContent = slider.value;
            });
        }
    });
    // --- END NEW SLIDER LOGIC ---

    // --- Helper Functions ---
    function showError(message) {
        errorMessageArea.textContent = message;
        errorMessageArea.style.display = 'block';
        setTimeout(() => {
            errorMessageArea.style.display = 'none';
        }, 5000);
    }

    // Helper: extract a readable error message from API JSON result
    function getApiErrorMessage(result, fallback) {
        try {
            if (!result) return fallback || 'An unexpected error occurred.';
            const detail = result.detail;
            if (!detail) return fallback || 'An unexpected error occurred.';
            if (Array.isArray(detail)) {
                const msgs = detail.map(d => {
                    if (!d) return '';
                    const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : null;
                    const msg = d.msg || d.message || (typeof d === 'string' ? d : JSON.stringify(d));
                    return field ? `${field}: ${msg}` : msg;
                });
                return msgs.join(' ');
            }
            if (typeof detail === 'object') {
                const field = Array.isArray(detail.loc) ? detail.loc[detail.loc.length - 1] : null;
                const msg = detail.msg || detail.message || JSON.stringify(detail);
                return field ? `${field}: ${msg}` : msg;
            }
            return String(detail);
        } catch (e) {
            return fallback || 'An unexpected error occurred.';
        }
    }

    // Lock/unlock all controls inside the initial demographics form
    function setInitialFormControlsDisabled(disabled) {
        if (!initialForm) return;
        const controls = initialForm.querySelectorAll('input, select, textarea, button');
        controls.forEach(el => {
            if (el.tagName === 'INPUT' && el.type === 'hidden') {
                return; // keep hidden inputs enabled so values submit in FormData
            }
            el.disabled = disabled;
        });
    }

    // NEW: UI event logger
    async function logUiEvent(event, metadata = {}) {
        try {
            await fetch('/log_ui_event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event,
                    ts_client: Date.now() / 1000,
                    metadata,
                    participant_id: participantId,
                    prolific_pid: prolificPid,
                    session_id: sessionId
                })
            });
        } catch (e) {
            console.warn('Failed to log UI event', event, e);
        }
    }

    // NEW: finalize without session (e.g., consent declined)
    async function finalizeNoSession(reason) {
        try {
            await fetch('/finalize_no_session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    participant_id: participantId,
                    prolific_pid: prolificPid,
                    reason
                })
            });
        } catch (e) {
            console.warn('Failed to finalize without session', e);
        }
    }

    

    // Start the 20-minute countdown timer
    function startStudyTimer() {
        studyStartTime = Date.now();
        const timerDisplay = document.getElementById('timer-display');
        const countdownTimer = document.getElementById('countdown-timer');
        
        // Show the timer
        timerDisplay.style.display = 'block';
        
        studyTimer = setInterval(() => {
            const elapsed = Date.now() - studyStartTime;
            const remaining = Math.max(0, STUDY_DURATION_MS - elapsed);
            
            // Format time as MM:SS
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            const timeText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            countdownTimer.textContent = timeText;
            
            // Change color when time is running out
            if (remaining <= 60000) { // Last minute - red
                timerDisplay.style.background = 'rgba(220, 53, 69, 0.9)';
            } else if (remaining <= 300000) { // Last 5 minutes - orange
                timerDisplay.style.background = 'rgba(255, 193, 7, 0.9)';
            }
            
            // Time expired
            if (remaining === 0) {
                clearInterval(studyTimer);
                timeExpired = true;
                timerDisplay.style.background = 'rgba(220, 53, 69, 0.9)';
                timerDisplay.innerHTML = 'Time limit reached! Please make your final selection: 0 (Human) or 1 (AI)';
                timerDisplay.style.fontSize = '14px';
                timerDisplay.style.width = '300px';
                
                // Show time expired message if still in conversation
                if (assessmentAreaDiv.style.display === 'block') {
                    showError('Time expired! Your next rating must be a final decision (0 = Human or 1 = AI).');
                }
            }
        }, 1000);
    }

    // This function checks if both user and backend are ready, then proceeds
    function tryProceedToChat() {
        if (isBackendReady && isUserReady) {
            // Stop and hide the loading animation at the last possible moment
            clearInterval(progressInterval);
            initLoadingDiv.style.display = 'none';

            // Ensure the instruction pop-up is hidden
            finalInstructionsModal.style.display = 'none';
            
            // Switch to the main chat page view
            showMainPhase('chat_and_assessment_flow');

            // It fully prepares the chat interface for use.
            assessmentAreaDiv.style.display = 'none';
            chatInputContainer.style.display = 'flex';
            userMessageInput.disabled = false;
            sendMessageButton.disabled = false;
            userMessageInput.focus();
            
            // START THE 20-MINUTE TIMER
            startStudyTimer();
        }
    }

    function showMainPhase(phase) {
        console.log(`Showing main phase: ${phase}`);
        // Hide all phases first
        consentPhaseDiv.style.display = 'none';
        instructionsPhaseDiv.style.display = 'none';
        initialSetupDiv.style.display = 'none';
        chatInterfaceDiv.style.display = 'none';
        finalPageDiv.style.display = 'none';
        feedbackPhaseDiv.style.display = 'none'; // ADD THIS LINE


        if (phase === 'consent') consentPhaseDiv.style.display = 'block';
        else if (phase === 'instructions') instructionsPhaseDiv.style.display = 'block'; // THIS LINE IS ADDED
        else if (phase === 'initial') initialSetupDiv.style.display = 'block';
        else if (phase === 'chat_and_assessment_flow') chatInterfaceDiv.style.display = 'block';
        else if (phase === 'feedback') feedbackPhaseDiv.style.display = 'block'; // ADD THIS LINE
        else if (phase === 'final') finalPageDiv.style.display = 'block';
    }



    function scrollToBottom() {
        const chatWindow = document.querySelector('.chat-window');
        // We use the setTimeout trick to make sure the browser has rendered the new content
        setTimeout(() => {
            chatWindow.scrollTop = chatWindow.scrollHeight;
        }, 0);
    }

    function addMessageToUI(text, sender) {
        const messageBubble = document.createElement('div');
        messageBubble.classList.add('message-bubble', sender);
        messageBubble.textContent = text;
        messageList.appendChild(messageBubble);

        // FIX: Wait for the browser to render the new message before scrolling.
        // This ensures scrollHeight has the correct, updated value.
        scrollToBottom();

        console.log(`Added message from ${sender}. messageList.childElementCount: ${messageList.childElementCount}`);
    }

    function generateAndDownloadPdf(content, filename) {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // --- NEW: Page Layout Logic ---
            const leftMargin = 15;
            const topMargin = 20;
            const bottomMargin = 20;
            const lineHeight = 7; // Adjust this value to increase/decrease line spacing
            let y = topMargin; // This will be our vertical cursor

            // Get the dimensions of the page
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const usableWidth = pageWidth - (leftMargin * 2);

            doc.setFontSize(12);

            // Split the text into lines that fit the page width
            const lines = doc.splitTextToSize(content, usableWidth);
            
            // Loop through each line of text
            lines.forEach(line => {
                // Check if adding the next line would go off the page
                if (y + lineHeight > pageHeight - bottomMargin) {
                    doc.addPage();      // If so, add a new page
                    y = topMargin;      // and reset our vertical cursor to the top
                }
                
                // Add the line of text to the page
                doc.text(line, leftMargin, y);
                
                // Move the vertical cursor down for the next line
                y += lineHeight;
            });
            // --- END: New Logic ---

            doc.save(filename);
            console.log(`PDF "${filename}" download initiated.`);

        } catch (error) {
            console.error('Error creating PDF:', error);
            showError('There was a problem generating the PDF download. Please contact the researcher.');
        }
    }

    // --- NEW: Consent Logic ---
    agreeButton.addEventListener('click', () => {
        logUiEvent('consent_agree_clicked');
        // When user agrees, hide the main text and buttons, and show the download prompt.
        consentContentDiv.style.display = 'none';
        consentActionsDiv.style.display = 'none';
        consentDownloadPromptDiv.style.display = 'block';
    });

    disagreeButton.addEventListener('click', async () => {
        logUiEvent('consent_disagree_clicked');
        await finalizeNoSession('consent_disagreed');

        // --- MODIFICATION START ---
        if (isProduction) {
            window.location.href = PROLIFIC_REJECTION_URL;
        } else {
            // Keep the original behavior for local testing
            mainContainer.innerHTML = `
                <h2>Study Ended (DEV MODE)</h2>
                <p>You must consent to participate. In production, you would be redirected to Prolific.</p>
            `;
        }
    });

    skipConsentDownloadButton.addEventListener('click', () => {
        logUiEvent('consent_skip_download_clicked');
        // If they skip download, just move to the next phase.
        showMainPhase('instructions'); // CHANGE 'initial' to 'instructions'

    });

    downloadConsentButton.addEventListener('click', () => {
        logUiEvent('consent_download_clicked');
        const timestamp = new Date().toLocaleString();


        // If they want to download, generate the PDF and then move to the next phase.
        const consentText = `
CONSENT TO PARTICIPATE IN RESEARCH
Title of Study: Interaction Study
Participant ID: ${participantId}
Prolific ID: ${prolificPid || 'N/A'}

[CONSENT RECORDED: Participant agreed to participate on ${timestamp}]

About this Study
You are being asked to participate in a research study. This form provides you with information about the study.

Purpose of Research
This research examines how people make judgments during conversational interactions and how these judgments change over time.

What You Will Be Asked to Do
If you agree to participate, you will:
- Engage in a text-based conversation with a conversational partner.
- After each message exchange, rate your confidence about whether you believe you are talking to a human or an AI using a sliding scale (0 = definitely human, 1 = definitely AI).
- Optionally provide brief comments about your experience during the conversation.
- Complete a brief demographic questionnaire at the beginning.
- The conversation will end when you reach complete certainty (0 or 1 on the scale) or after 20 minutes, whichever comes first.
- The total time commitment will be approximately 20 minutes.
- You are free to share information as you see fit during the conversation but should not share more than you would be willing to share with a stranger.

Your Rights as a Participant
- Your participation is voluntary.
- You may stop at any time.
- You may choose not to answer any question.
- You may not be told everything about the purpose of this research study initially, but you will be fully informed after completion.

Risks and Benefits
- There are no known risks associated with participating in this study beyond those encountered in normal daily conversation.
- While there are no direct benefits to you, your participation helps advance our understanding of human-AI interaction and judgment processes.

Compensation
- You will receive compensation equivalent to $8.00 per hour for your participation through the online platform.

Confidentiality
- Your responses will be stored securely.
- Data will be analyzed without any identifying information.
- Only researchers will have access to the data.
- Anonymized results derived from your data may be shared in OpenScience frameworks for transparency of our research progress.
- Any personally identifying information you may share during conversations will be removed from analyses and will not be used in research outputs.
- Analyses (quantitative and qualitative) will be carried out on any text you write during the study.

Questions or Concerns?
- For questions about the research: Contact the Principal Investigator at nvitali@fas.harvard.edu
- For questions about your rights as a participant: Contact cuhs@harvard.edu

Agreement to Participate
By clicking "I agree" below, you indicate that:
- You are at least 18 years old.
- You have read and understood this consent form.
- You voluntarily agree to participate.
- You understand you can withdraw at any time.

[PARTICIPANT ACCEPTED THE ABOVE TERMS ON ${new Date().toLocaleString()}]
        `;
        
        generateAndDownloadPdf(consentText, `Consent_Form_${participantId}.pdf`);
        
        // Move to the next phase after starting the download.
        showMainPhase('instructions'); // CHANGE 'initial' to 'instructions'

    });

    // --- Prolific Dropout and Completion Logic ---
    let handleEarlyExit = null; // Declare the variable first
    
    if (isProduction) {
        // 1. DEFINE the function that will handle premature exits
        handleEarlyExit = (event) => {
            // This redirects the user to Prolific if they refresh or close the tab mid-study.
            window.location.href = PROLIFIC_TIMED_OUT_URL;
        };
    }

    // 1. First, we define the function that shows the summary page.
    // It MUST come before the buttons that use it.
    function showSummaryPhase() {
        debriefPhaseDiv.style.display = 'none';
        summaryPhaseDiv.style.display = 'block';
    }

    // 2. Now, we create the event listener for the debrief download button.
    downloadDebriefButton.addEventListener('click', () => {
        const debriefText = `
STUDY DEBRIEF FORM
Date: ${new Date().toLocaleString()}
Participant ID: ${participantId}
Prolific ID: ${prolificPid || 'N/A'}
Session ID: ${sessionId || 'N/A'}

Study Debrief Form

Thank you for participating in our research study. Now that you have completed the study, we would like to explain its purpose in more detail.

Purpose of the Research
This study examines how people detect AI-generated communication and the cognitive processes underlying these judgments. We are specifically interested in understanding whether individuals possess implicit detection abilities, such as gut feelings, for identifying AI, even when they cannot explicitly articulate their suspicions. We also are investigating which specific conversational tactics most effectively lead humans to believe they are interacting with another human rather than AI.

Why We Did Not Tell You Everything Initially
When participants know exactly what researchers are studying, it can sometimes influence their responses and make them hyper-aware of potential AI "tells" or tactics. To get natural responses about your evolving confidence during the conversation, we did not tell you specifically that we were studying particular humanization tactics or measuring implicit detection processes. You were told the study involved determining whether you were talking to a human or AI, which was true, but we did not disclose our specific interest in how particular conversational strategies influence your moment-to-moment judgments.

The Complete Picture
In this study, you engaged in a conversation while providing continuous confidence ratings about whether you believed you were interacting with a human or AI. What you may not have realized is that:

1) You were always interacting with an AI system. Specifically, a large language model designed to appear human-like in conversation.

2) The AI used specific tactics. Based on your initial demographic responses, our system selected from various humanization tactics such as mirroring your language style, sharing personal anecdotes, expressing opinions, using humor, or subtly varying its typing style. These tactics were logged throughout your conversation.

3) Your continuous confidence ratings and the time you took to make each rating allow us to model how evidence accumulated in your mind toward an "AI" or "human" decision. This helps us understand the cognitive processes behind AI detection.

Our hypothesis is that people possess subtle, implicit abilities to detect AI-generated communication that may not always rise to conscious awareness. We also predict that certain conversational tactics (like personal anecdotes or opinion expression) will be more effective at convincing humans they are talking to another person. By analyzing your moment-to-moment confidence changes alongside the specific tactics the AI used, we can better understand which strategies most effectively influence human judgment of AI authenticity.

Questions or Concerns
If you have any questions about this research, please contact the Principal Investigator, Nykko Vitali, at nvitali@fas.harvard.edu. If you have any concerns about your rights as a research participant, you may contact cuhs@harvard.edu

Use of Your Data
If you are comfortable with us using your responses now that you know the full purpose of the study, you don't need to do anything. If you would prefer that we not use your responses, please reach out to the Principal Investigator and let them know. We will then remove your data from the study and delete it.

Thank you again for your participation!

        `;
        generateAndDownloadPdf(debriefText, `Debrief_Form_${sessionId || participantId}.pdf`);

        if (isProduction) {
            // DEACTIVATE the listener so this final redirect isn't blocked
            window.removeEventListener('beforeunload', handleEarlyExit);
            
            // Redirect to Prolific after a short delay to ensure download starts
            setTimeout(() => {
                window.location.href = PROLIFIC_COMPLETION_URL;
            }, 500);
        } else {
            // For local testing, just proceed to the summary page
            showSummaryPhase();
        }
    });

    // 3. We create the event listener for the continue button.
    continueAfterDebriefButton.addEventListener('click', () => {
        if (isProduction) {
            // DEACTIVATE the listener before the final redirect
            window.removeEventListener('beforeunload', handleEarlyExit);
            window.location.href = PROLIFIC_COMPLETION_URL;
        } else {
            // For local testing, just proceed to the summary page
            showSummaryPhase();
        }
    });

    confirmInstructionsButton.addEventListener('click', () => {
        logUiEvent('instructions_understand_clicked');
        // Show the modal pop-up instead of the next page
        demographicsModal.style.display = 'flex';
    });

    modalContinueButton.addEventListener('click', () => {
        logUiEvent('demographics_modal_continue_clicked');
        demographicsModal.style.display = 'none'; // Hide the modal
        showMainPhase('initial'); // Now, show the demographics page
    });

    finalInstructionsButton.addEventListener('click', () => {
        logUiEvent('final_instructions_understand_clicked');
        // Hides the pop-up and sets the flag. That is its only job.
        finalInstructionsModal.style.display = 'none';
        isUserReady = true;
        // After the user is ready, we immediately check if we can proceed.
        // This handles the case where the user clicks *before* the backend is ready.
        tryProceedToChat();
    });
    // --- Event Listeners ---
    // handleEarlyExit already declared above, no need to redeclare

    initialForm.addEventListener('submit', (e) => {
        e.preventDefault();
        logUiEvent('initial_form_begin_conversation_clicked');

        // Pre-validate and build data before locking UI or opening modals
        const formData = new FormData(initialForm);

        // Validate required Likert bubbles
        const requiredLikerts = ['self_detection_speed', 'others_detection_speed', 'ai_capabilities_rating', 'trust_in_ai'];
        for (const field of requiredLikerts) {
            if (!formData.get(field)) {
                showError("Please select a value for all rating questions.");
                return;
            }
        }

        // Validate AI usage frequency and models
        const ai_usage_frequency_val = formData.get('ai_usage_frequency');
        if (!ai_usage_frequency_val) {
            showError("Please select your AI usage frequency.");
            return;
        }
        const ai_models_used_vals = formData.getAll('ai_models_used');
        if (ai_usage_frequency_val !== '0' && ai_models_used_vals.length === 0) {
            showError("Since you use AI chatbots, please select at least one model you have used.");
            return;
        }
        if (ai_usage_frequency_val === '0' && ai_models_used_vals.length > 0) {
            showError("You selected 'Never' for AI usage, but also selected specific models. Please correct your selection.");
            return;
        }

        // Validate demographics
        const ageStr = formData.get('age');
        const genderVal = formData.get('gender');
        const educationVal = formData.get('education');
        const incomeVal = formData.get('income');
        const ethnicityVals = formData.getAll('ethnicity');  // ADD THIS LINE


        const ageNum = parseInt(ageStr, 10);
        if (!ageStr || Number.isNaN(ageNum) || ageNum < 18 || ageNum > 100) {
            showError("Please enter a valid age (18-100).");
            return;
        }
        if (!genderVal) {
            showError("Please select a gender.");
            return;
        }
        if (!educationVal) {
            showError("Please select your highest education level.");
            return;
        }
        if (!incomeVal) {
            showError("Please select your annual household income.");
            return;
        }
        if (ethnicityVals.length === 0) {
        showError("Please select at least one ethnicity option.");
        return;
    }

        const data = {
            ai_usage_frequency: parseInt(ai_usage_frequency_val, 10),
            ai_models_used: ai_models_used_vals,
            self_detection_speed: parseInt(formData.get('self_detection_speed'), 10),
            others_detection_speed: parseInt(formData.get('others_detection_speed'), 10),
            ai_capabilities_rating: parseInt(formData.get('ai_capabilities_rating'), 10),
            trust_in_ai: parseInt(formData.get('trust_in_ai'), 10),
            age: ageNum,
            gender: genderVal,
            education: educationVal,
            ethnicity: formData.getAll('ethnicity'),
            income: incomeVal,
            // NEW: identifiers
            participant_id: participantId,
            prolific_pid: prolificPid
        };

        // Reset state flags for this attempt
        isBackendReady = false;
        isUserReady = false;
        
        // Show the final instructions pop-up
        finalInstructionsModal.style.display = 'flex';

        // Show loading indicator and disable form button
        initLoadingDiv.style.display = 'flex';
        initialForm.querySelector('button').disabled = true;
        // Lock all demographics controls after capturing values
        setInitialFormControlsDisabled(true);

        // This self-contained function handles the entire async process
        const performInitialization = async (payload) => {
            try {
                // Start progress bar animation
                const progressBar = document.getElementById('progress-bar');
                if (progressBar) {
                    progressBar.style.width = '0%';
                    let currentProgress = 0;
                    progressInterval = setInterval(() => {
                        const increment = Math.random() * 5;
                        currentProgress = Math.min(currentProgress + increment, 99);
                        progressBar.style.width = currentProgress + '%';
                    }, 800);
                }

                const response = await fetch('/initialize_study', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const result = await response.json();

                if (!response.ok) {
                    throw new Error(getApiErrorMessage(result, 'Failed to initialize study.'));
                }

                // --- FULL, RESTORED SESSION SETUP LOGIC ---
                sessionId = result.session_id;
                localStorage.setItem('sessionId', sessionId);
                currentTurn = 0;
                messageList.innerHTML = '';
                
                // Backend is now ready, set the flag and try to proceed
                isBackendReady = true;
                // After the backend is ready, we immediately check if we can proceed.
                // This handles the case where the backend finishes *before* the user has clicked.
                tryProceedToChat();


            } catch (error) {
                // This block runs if any part of the 'try' block fails
                showError('Error: ' + error.message);
                finalInstructionsModal.style.display = 'none';
                initLoadingDiv.style.display = 'none';
                clearInterval(progressInterval);
                initialForm.querySelector('button').disabled = false;
                // Unlock the form so the participant can correct inputs
                setInitialFormControlsDisabled(false);
            }
        };

        // Run the async function
        performInitialization(data);

        // 2. ACTIVATE the early exit listener now that the study has officially begun
        if (isProduction) {
            window.addEventListener('beforeunload', handleEarlyExit);
        }
    });
    
    // *** FIX: ADDING THE MISSING EVENT LISTENERS BACK ***
    sendMessageButton.addEventListener('click', handleSendMessage);
    userMessageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSendMessage();
        }
    });

    // MODIFIED event listener for confidence slider to handle activation and enabling submit
    confidenceSlider.addEventListener('input', () => {
        // On first interaction, remove the pristine class to show the thumb and value
        if (confidenceSlider.classList.contains('pristine')) {
            confidenceSlider.classList.remove('pristine');
            confidenceValueSpan.style.display = 'inline';
        }

        let value = parseFloat(confidenceSlider.value);
        
        // NEW: No more 5-turn minimum - allow 0.0/1.0 selection anytime
        // (Removed the 5-turn restriction as requested)
        
        // After time expires, force only final decisions (0.0 or 1.0)
        if (timeExpired && value !== 0.0 && value !== 1.0) {
            // Snap to nearest final decision
            value = value < 0.5 ? 0.0 : 1.0;
            confidenceSlider.value = value;
            showError('Time expired! You must make a final decision: 0 = Human, 1 = AI');
        }
        
        confidenceValueSpan.textContent = value.toFixed(2);

        // ANY interaction with the slider enables the submit button.
        submitRatingButton.disabled = false;
    });

    function animateTypingIndicator(messageLength) {
        // Show indicator immediately
        typingIndicator.style.display = 'flex';
        scrollToBottom();

        // Tag this animation run so stale timeouts can't re-show the indicator later
        const runId = String(Date.now());
        typingIndicator.dataset.runId = runId;

        const startedAt = performance.now();
        const MIN_P = 0.15;      // 15% at start
        const MAX_P = 0.9;       // caps at 90%
        const SAT_MS = 15000;    // ~15s to reach MAX_P
        const MIN_PAUSE_MS = 1000;  // >= 1s as requested
        const MAX_PAUSE_MS = 2000;  // up to 2s (tweak if you like)

        const stillCurrent = () => typingIndicator.dataset.runId === runId;

        function scheduleNextCheck() {
            if (!stillCurrent()) return;
            const elapsed = performance.now() - startedAt;
            // Check frequency eases a bit as time goes on (you can keep it constant if you prefer)
            const nextCheckMs = Math.max(800, Math.min(2500, 1200 + elapsed / 12));
            setTimeout(maybePause, nextCheckMs);
        }

        function maybePause() {
            if (!stillCurrent()) return;

            const elapsed = performance.now() - startedAt;
            // Probability grows with elapsed time, saturating at MAX_P
            const growth = Math.min(1, elapsed / SAT_MS);
            let p = MIN_P + (MAX_P - MIN_P) * growth;

            // (Optional) tiny nudge from messageLength if you want:
            // p = Math.min(0.98, p + Math.min(0.15, (messageLength || 0) / 400));

            if (Math.random() < p) {
                // Perform a pause of at least 1s
                typingIndicator.style.display = 'none';
                const pauseMs = MIN_PAUSE_MS + Math.floor(Math.random() * (MAX_PAUSE_MS - MIN_PAUSE_MS + 1));
                setTimeout(() => {
                    if (!stillCurrent()) return;
                    typingIndicator.style.display = 'flex';
                    scrollToBottom();
                    scheduleNextCheck();
                }, pauseMs);
            } else {
                scheduleNextCheck();
            }
        }

        // First pause opportunity ~1.5s after starting (keeps original feel)
        setTimeout(maybePause, 1500);

        return null; // matches existing callsite
    }
            



    async function handleSendMessage() {
        const messageText = userMessageInput.value.trim();
        if (!messageText || !sessionId) return;

        addMessageToUI(messageText, 'user');

        userMessageInput.value = '';
        userMessageInput.disabled = true;
        sendMessageButton.disabled = true;
        chatInputContainer.style.display = 'none';
        assessmentAreaDiv.style.display = 'none';

        const indicatorDelay = Math.random() * (5000 - 2000) + 2000;
        
        console.log(`Waiting ${(indicatorDelay/1000).toFixed(1)}s before showing typing indicator`);
        
        setTimeout(() => {
            if (assessmentAreaDiv.style.display === 'none' && chatInputContainer.style.display === 'none') {
                // Start the typing animation with periodic pauses
                animateTypingIndicator(messageText.length);
            }
        }, indicatorDelay);

        console.log('Sending message to server:', { session_id: sessionId, message: messageText });

        try {
            const response = await fetch('/send_message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId, message: messageText }),
            });
            const result = await response.json();
            console.log('Received response from /send_message:', result);

            // Bump runId so pending timeouts won't bring the indicator back
            typingIndicator.dataset.runId = String((Number(typingIndicator.dataset.runId) || 0) + 1);
            typingIndicator.style.display = 'none';

            console.log('Typing indicator hidden');

            if (response.ok) {
                addMessageToUI(result.ai_response, 'assistant');
                currentTurn = result.turn;
                aiResponseTimestamp = result.timestamp;
                
                // --- MODIFIED: Slider setup logic ---
                assessmentAreaDiv.style.display = 'block';
                chatInputContainer.style.display = 'none'; 
                assessmentAreaDiv.querySelector('h4').textContent = "Your Assessment";
                
                confidenceSlider.value = lastConfidenceValue; // Set to last submitted value
                sliderStartValueThisTurn = lastConfidenceValue; // Store it for the "must-move" check

                if (currentTurn === 1) {
                    // First turn: hide thumb and value
                    confidenceSlider.classList.add('pristine');
                    confidenceValueSpan.style.display = 'none';
                    submitRatingButton.disabled = true; // Must interact to enable
                } else {
                    // Subsequent turns: show thumb and value, but disable submit until moved
                    confidenceSlider.classList.remove('pristine');
                    confidenceValueSpan.style.display = 'inline';
                    confidenceValueSpan.textContent = lastConfidenceValue.toFixed(2);
                    submitRatingButton.disabled = false; // Must move to enable
                }

                confidenceSlider.disabled = false;
                submitRatingButton.style.display = 'block';
                feelsOffCheckbox.checked = false;
                commentInputArea.style.display = 'none';
                feelsOffCommentTextarea.value = '';
                messageList.scrollTop = messageList.scrollHeight;

            } else { 
                showError(getApiErrorMessage(result, 'Failed to send message or get AI response.'));
                addMessageToUI("Sorry, I couldn't process that. Please try again.", 'assistant');
                userMessageInput.disabled = false;
                sendMessageButton.disabled = false;
                chatInputContainer.style.display = 'flex';
                assessmentAreaDiv.style.display = 'none';
            }
        } catch (error) {
            showError('Error sending message: ' + error.message);
            console.error('Catch block error in handleSendMessage:', error);
            typingIndicator.style.display = 'none';
            addMessageToUI("Sorry, a technical error occurred. Please try again.", 'assistant');
            userMessageInput.disabled = false;
            sendMessageButton.disabled = false;
            chatInputContainer.style.display = 'flex';
            assessmentAreaDiv.style.display = 'none';
        }
    }


    submitRatingButton.addEventListener('click', async () => {
        if (!sessionId) return;

        // NEW: Block non-final submissions after time expires
        if (timeExpired) {
            const confidence = parseFloat(confidenceSlider.value);
            if (confidence !== 0.0 && confidence !== 1.0) {
                showError('Time expired! You must select exactly 0 (Human) or 1 (AI) to continue.');
                return; // Block the submission
            }
        }

        if (feelsOffCheckbox.checked && feelsOffCommentTextarea.value.trim() === '') {
            showError("Please provide a comment if 'Include a comment' is checked, or uncheck the box to proceed with rating only.");
            return;
        }

        ratingLoadingDiv.style.display = 'block';
        submitRatingButton.disabled = true;
        confidenceSlider.disabled = true;

        const confidence = parseFloat(confidenceSlider.value);
        lastConfidenceValue = confidence; // NEW: Save the submitted value for the next round

        let decisionTimeSeconds = null;
        if (aiResponseTimestamp) {
            decisionTimeSeconds = (new Date().getTime() / 1000) - aiResponseTimestamp;
        } else {
            console.warn("aiResponseTimestamp was not set, decision time will be null.");
        }

        console.log('Submitting rating. Confidence:', confidence, 'Decision Time:', decisionTimeSeconds);

        try {
            const response = await fetch('/submit_rating', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId, confidence: confidence, decision_time_seconds: decisionTimeSeconds }),
            });
            const result = await response.json();
            console.log('Rating submission response from server:', result);

            if (response.ok) {
                if (result.study_over) {
                    // Clean up timer
                    if (studyTimer) {
                        clearInterval(studyTimer);
                    }
                    document.getElementById('timer-display').style.display = 'none';
                    
                    // MODIFICATION START
                    finalSummaryData = result.session_data_summary; // Store data
                    showMainPhase('feedback'); // Go to feedback phase first
                } else {
                    if (feelsOffCheckbox.checked && feelsOffCommentTextarea.value.trim() !== '') {
                        assessmentAreaDiv.querySelector('h4').textContent = "Rating Submitted. Now, please submit your comment:";
                        submitRatingButton.style.display = 'none';
                        confidenceSlider.style.display = 'none';
                        confidenceValueSpan.style.display = 'none';
                        document.getElementById('submit-rating-button').previousElementSibling.style.display = 'none';
                        document.getElementById('comment-section').style.display = 'block';
                        if (!commentInputArea.style.display || commentInputArea.style.display === 'none') {
                            commentInputArea.style.display = 'block';
                        }
                        feelsOffCommentTextarea.focus();
                        chatInputContainer.style.display = 'none';
                    } else {
                        assessmentAreaDiv.style.display = 'none';
                        chatInputContainer.style.display = 'flex';
                        userMessageInput.disabled = false;
                        sendMessageButton.disabled = false;
                        userMessageInput.focus();
                    }
                }
            } else { 
                showError(getApiErrorMessage(result, 'Failed to submit rating.'));
                submitRatingButton.disabled = false;
                confidenceSlider.disabled = false;
            }
        } catch (error) { 
            showError('Error submitting rating: ' + error.message);
            console.error('Catch block error in submitRatingButton:', error);
            submitRatingButton.disabled = false;
            confidenceSlider.disabled = false;
        } finally {
            ratingLoadingDiv.style.display = 'none';
        }
    });

    submitFeedbackButton.addEventListener('click', async () => {
        const commentText = feedbackTextarea.value.trim();
        submitFeedbackButton.disabled = true;
        skipFeedbackButton.disabled = true;

        if (commentText) {
            try {
                // Send final comment to the correct endpoint
                await fetch('/submit_final_comment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        session_id: sessionId, 
                        comment: commentText
                    }),
                });
            } catch (error) {
                console.error('Feedback submission error:', error);
            }
        }
        // Proceed to the final page
        showMainPhase('final');
        displayFinalPage(finalSummaryData);
    });

    skipFeedbackButton.addEventListener('click', () => {
        // Just proceed directly to the final page
        showMainPhase('final');
        displayFinalPage(finalSummaryData);
    });

    submitCommentButton.addEventListener('click', async () => {
        if (!sessionId) {
            showError("Session ID is missing. Please refresh.");
            return;
        }
        if (!feelsOffCheckbox.checked) {
            showError("Please check 'Include a comment' to submit a comment.");
            return;
        }

        const commentText = feelsOffCommentTextarea.value.trim();
        if (commentText === '') {
            showError("Comment cannot be empty if 'Include a comment' is checked.");
            return;
        }

        commentLoadingDiv.style.display = 'block';
        submitCommentButton.disabled = true;
        feelsOffCheckbox.disabled = true;

        try {
            const response = await fetch('/submit_comment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId, comment: commentText }),
            });
            const result = await response.json();
            if (response.ok) {
                console.log("Comment submitted successfully.");
                feelsOffCommentTextarea.value = '';
                feelsOffCheckbox.checked = false;
                commentInputArea.style.display = 'none';

                if (finalPageDiv.style.display === 'none') {
                    assessmentAreaDiv.style.display = 'none';
                    chatInputContainer.style.display = 'flex';
                    userMessageInput.disabled = false;
                    sendMessageButton.disabled = false;
                    userMessageInput.focus();
                }
            } else {
                showError(getApiErrorMessage(result, 'Failed to submit comment. Please try again.'));
            }
        } catch (error) {
            showError('Error submitting comment: ' + error.message);
            console.error('Catch block error in submitCommentButton:', error);
        } finally {
            commentLoadingDiv.style.display = 'none';
            if (commentInputArea.style.display !== 'none') {
                 submitCommentButton.disabled = false;
                 feelsOffCheckbox.disabled = false;
            }
        }
    });

    feelsOffCheckbox.addEventListener('change', () => {
        commentInputArea.style.display = feelsOffCheckbox.checked ? 'block' : 'none';
    });

    function displayFinalPage(summary) {
        // MODIFIED: This function now just populates the data.
        // The visibility is controlled by the new event listeners.
        finalDecisionText.textContent = `You determined that you were ${summary.ai_detected ? 'talking to an AI' : 'talking to a human'}.`;
        if (summary.final_decision_time) {
            finalDecisionTimeText.textContent = `Time taken to make final decision: ${parseFloat(summary.final_decision_time).toFixed(2)} seconds.`;
        }
        let trendText = "Turn | Confidence | Decision Time (s)\n";
        trendText += "---------------------------------------\n";
        if (summary.confidence_ratings) {
            summary.confidence_ratings.forEach(r => {
                trendText += `${String(r.turn).padEnd(4)} | ${parseFloat(r.confidence).toFixed(2).padEnd(10)} | ${r.decision_time_seconds ? parseFloat(r.decision_time_seconds).toFixed(2) : 'N/A'}\n`;
            });
        }
        confidenceTrendData.textContent = trendText;
        researcherDataSection.style.display = 'block';
        researcherDataContent.textContent = "";

        // Show the first part of the final page
        debriefPhaseDiv.style.display = 'block';
        summaryPhaseDiv.style.display = 'none';
    }

    newSessionButton.addEventListener('click', () => {
        localStorage.removeItem('sessionId');
        sessionId = null;
        currentTurn = 0;
        aiResponseTimestamp = null;
        lastConfidenceValue = 0.5; // Reset for new session
        messageList.innerHTML = '';
        initialForm.reset();
        
        // Manually reset sliders and their value displays to default
        allSliders.forEach(slider => {
            slider.value = slider.defaultValue;
            const valueSpan = slider.nextElementSibling;
            if (valueSpan && valueSpan.classList.contains('slider-value')) {
                valueSpan.textContent = slider.defaultValue;
            }
        });

        researcherDataSection.style.display = 'none';
        researcherDataContent.textContent = '';
        showMainPhase('consent'); 
        //  reset the consent form's state for the new session
        consentContentDiv.style.display = 'block';
        consentActionsDiv.style.display = 'block';
        consentDownloadPromptDiv.style.display = 'none';
    });

    loadResearcherDataButton.addEventListener('click', async () => {
        if (!sessionId) {
            researcherDataContent.textContent = "No active session ID to load data for.";
            return;
        }
        loadResearcherDataButton.disabled = true;
        researcherDataContent.textContent = "Loading researcher data...";
        try {
            const response = await fetch(`/get_researcher_data/${sessionId}`);
            if (!response.ok) {
                const errorText = await response.text();
                researcherDataContent.textContent = `Error loading researcher data: ${response.status} ${response.statusText}. Details: ${errorText}`;
                return;
            }
            const data = await response.json();
            researcherDataContent.textContent = JSON.stringify(data, null, 2);
        } catch (error) {
            researcherDataContent.textContent = `Error fetching or parsing researcher data: ${error.message}`;
            console.error("Error in loadResearcherDataButton:", error)
        } finally {
            loadResearcherDataButton.disabled = false;
        }
    });

    // --- Initial Page Load ---
    localStorage.removeItem('sessionId');
    aiResponseTimestamp = null;
    showMainPhase('consent'); // Start with the consent form instead of 'initial'
    // Log page load event with basic metadata
    logUiEvent('page_load', {
        userAgent: navigator.userAgent,
        language: navigator.language,
        referrer: document.referrer || null
    });

});
