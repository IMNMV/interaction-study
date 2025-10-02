// FILE: static/script.js
// This is the corrected version with error handling improvements.
// All console statements removed to prevent participant contamination.
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
    const PROLIFIC_COMPLETION_URL = "https://app.prolific.com/submissions/complete?cc=TBD";
    const PROLIFIC_REJECTION_URL = "https://app.prolific.com/submissions/complete?cc=TBD";
    const PROLIFIC_TIMED_OUT_URL = "https://app.prolific.com/submissions/complete?cc=TBD";


    // 2. Production Mode Check
    const isProduction = (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1');

    // --- Railway API adapter (add right after `isProduction`) ---
    
    // DEBUG: Railway-only error logging function
    async function logToRailway(errorInfo) {
        try {
            const debugPayload = {
                error_type: errorInfo.type || 'Unknown',
                error_message: errorInfo.message || 'No message',
                session_id: sessionId || 'No session',
                current_turn: currentTurn || 'No turn',
                timestamp: new Date().toISOString(),
                stack_trace: errorInfo.stack || 'No stack trace',
                additional_context: errorInfo.context || {}
            };
            
            await fetch(`${API_BASE_URL}/debug_log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(debugPayload)
            });
            // Silently fail - no logs or notifications to avoid participant contamination
        } catch (e) {
            // Silently fail - cannot risk any participant-visible errors
        }
    }
    
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
    
    // NEW: Enhanced reaction time tracking variables
    let confidenceStartTime = null; // When they first touch the slider
    let sliderInteractionLog = []; // Log of all slider interactions
    
    // NEW: Fallback storage for failed network delay updates
    let pendingNetworkDelayUpdates = []; // Store failed updates for later retry
    
    // Timer variables
    let studyTimer = null;
    let studyStartTime = null;
    let timeExpired = false;
    const STUDY_DURATION_MS = 7.5 * 60 * 1000; // 7.5 minutes in milliseconds


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
    // Normalize server timestamps that might be seconds or milliseconds.
    function tsToMs(ts) {
        if (ts == null) return null;
        const n = Number(ts);
        // If it's already in ms (>= ~2001-09), return as-is, else convert seconds -> ms
        return n >= 1e12 ? n : n * 1000;
    }

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
            // Silently fail - cannot risk any participant-visible errors
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
            // Silently fail - cannot risk any participant-visible errors
        }
    }

    // NEW: log when conversation actually starts (timer begins)
    async function logConversationStart() {
        try {
            await fetch('/log_conversation_start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId
                })
            });
            
            logToRailway({
                type: 'CONVERSATION_START',
                message: 'Conversation timer started - actual chat beginning',
                context: { session_id: sessionId }
            });
        } catch (e) {
            // Silently fail - cannot risk any participant-visible errors
            logToRailway({
                type: 'CONVERSATION_START_ERROR',
                message: 'Failed to log conversation start',
                context: { error: e.message }
            });
        }
    }

    

    // Update timer message based on current study state (called when time expired and state changes)
    function updateTimerMessage() {
        if (!timeExpired) return;
        
        const timerDisplay = document.getElementById('timer-display');
        let timeExpiredMessage;
        
        if (assessmentAreaDiv.style.display === 'block') {
            // State 3: Rating phase - user needs to submit confidence rating
            timeExpiredMessage = 'Time limit reached! Please make your final selection: 0 (Human) or 1 (AI)';
        } else if (typingIndicator.style.display === 'flex') {
            // State 2: Waiting for AI response
            timeExpiredMessage = 'Time limit reached! Waiting for response, then make final decision.';
        } else {
            // State 1: Before sending message
            timeExpiredMessage = 'Time limit reached! Please send your message to receive your last response to judge.';
        }
        
        timerDisplay.innerHTML = timeExpiredMessage;
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
            } else if (remaining <= 180000) { // Last 3 minutes - orange
                timerDisplay.style.background = 'rgba(255, 193, 7, 0.9)';
            }
            
            // Time expired
            if (remaining === 0) {
                clearInterval(studyTimer);
                timeExpired = true;
                timerDisplay.style.background = 'rgba(220, 53, 69, 0.9)';
                timerDisplay.style.fontSize = '14px';
                timerDisplay.style.width = '300px';
                
                // Set initial timer message and show error if in rating phase
                updateTimerMessage();
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
            
            // START THE 7.5-MINUTE TIMER AND LOG CONVERSATION START
            startStudyTimer();
            
            // Log when conversation actually begins
            logConversationStart();
        }
    }

    function showMainPhase(phase) {
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

        // Log to Railway only
        logToRailway({
            type: 'UI_DEBUG',
            message: `Added message from ${sender}. messageList.childElementCount: ${messageList.childElementCount}`,
            context: {
                function: 'addMessageToUI',
                sender: sender,
                message_count: messageList.childElementCount
            }
        });
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
            // Log to Railway only
            logToRailway({
                type: 'PDF_DOWNLOAD',
                message: `PDF "${filename}" download initiated`,
                context: { filename: filename }
            });

        } catch (error) {
            // Log to Railway only
            logToRailway({
                type: 'PDF_GENERATION_ERROR',
                message: error.message,
                stack: error.stack,
                context: { filename: filename }
            });
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
                // SILENT: Study initialization failure - Railway logs only
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

    // NEW: Track when user first interacts with confidence slider
    confidenceSlider.addEventListener('mousedown', () => {
        const baseMs = tsToMs(aiResponseTimestamp);
        if (!confidenceStartTime && baseMs) {
            confidenceStartTime = Date.now();
            sliderInteractionLog.push({
                event: 'slider_first_touch',
                timestamp: Date.now(),
                timestampFromResponse: Date.now() - baseMs,
                value: parseFloat(confidenceSlider.value)
            });
        }
    });
    
    confidenceSlider.addEventListener('touchstart', () => {
        const baseMs = tsToMs(aiResponseTimestamp);
        if (!confidenceStartTime && baseMs) {
            confidenceStartTime = Date.now();
            sliderInteractionLog.push({
                event: 'slider_first_touch',
                timestamp: Date.now(),
                timestampFromResponse: Date.now() - baseMs,
                value: parseFloat(confidenceSlider.value)
            });
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
        
        // NEW: Track all slider movements for enhanced timing analysis
        const baseMs = tsToMs(aiResponseTimestamp);
        if (confidenceStartTime && baseMs) {
            sliderInteractionLog.push({
                event: 'slider_move',
                timestamp: Date.now(),
                timestampFromResponse: Date.now() - baseMs,
                timestampFromFirstTouch: Date.now() - confidenceStartTime,
                value: value
            });
        }
        
        // NEW: No more 5-turn minimum - allow 0.0/1.0 selection anytime
        // (Removed the 5-turn restriction as requested)
        
        // After time expires, force only final decisions (0.0 or 1.0)
        if (timeExpired && value !== 0.0 && value !== 1.0) {
            // Snap to nearest final decision
            value = value < 0.5 ? 0.0 : 1.0;
            confidenceSlider.value = value;
        }
        
        confidenceValueSpan.textContent = value.toFixed(2);

        // Enable submit button, but only allow final decisions when time expired
        if (timeExpired) {
            // Only enable if slider is exactly 0.0 or 1.0 after time expires
            submitRatingButton.disabled = !(value === 0.0 || value === 1.0);
        } else {
            // Normal operation - any interaction enables submission
            submitRatingButton.disabled = false;
        }
    });

    function animateTypingIndicator(messageLength) {
        // Show indicator immediately
        typingIndicator.style.display = 'flex';
        scrollToBottom();

        // Tag this animation run so stale timeouts can't re-show the indicator later
        const runId = String(Date.now());
        typingIndicator.dataset.runId = runId;
        
        // That's it - just show it and leave it on until the message arrives
        return null;
    }
            



    // NEW: Retry logic for API requests - now returns network delay
    async function sendMessageWithRetry(messageText, typingDelaySeconds, maxRetries = 3) {
        const apiCallStartTime = Date.now();
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Log retry attempt to Railway
                logToRailway({
                    type: 'API_REQUEST_ATTEMPT',
                    message: `Sending message to server (attempt ${attempt}/${maxRetries})`,
                    context: {
                        session_id: sessionId,
                        message_length: messageText.length,
                        attempt: attempt,
                        max_retries: maxRetries
                    }
                });

                // Create AbortController for timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes timeout
                
                const response = await fetch('/send_message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session_id: sessionId,
                        message: messageText,
                        typing_indicator_delay_seconds: typingDelaySeconds
                    }),
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                const result = await response.json();

                if (response.ok) {
                    // Calculate network delay for successful response
                    const apiCallEndTime = Date.now();
                    const networkDelayMs = apiCallEndTime - apiCallStartTime;
                    const networkDelaySeconds = networkDelayMs / 1000;
                    
                    // Success - log and return with network delay
                    logToRailway({
                        type: 'API_RESPONSE_SUCCESS',
                        message: `Received response from /send_message (attempt ${attempt})`,
                        context: {
                            response_ok: response.ok,
                            turn: result.turn,
                            ai_response_length: result.ai_response ? result.ai_response.length : 0,
                            attempt: attempt,
                            network_delay_ms: networkDelayMs,
                            network_delay_seconds: networkDelaySeconds
                        }
                    });
                    return { response, result, networkDelaySeconds };
                } else {
                    // API error - log and continue to retry
                    logToRailway({
                        type: 'API_ERROR',
                        message: `API error on attempt ${attempt}/${maxRetries}`,
                        context: {
                            response_ok: response.ok,
                            response_status: response.status,
                            result: result,
                            attempt: attempt
                        }
                    });
                    if (attempt === maxRetries) throw new Error(`API error after ${maxRetries} attempts: ${response.status}`);
                }
            } catch (error) {
                // Network/fetch error - log and continue to retry
                logToRailway({
                    type: 'NETWORK_ERROR',
                    message: `Network error on attempt ${attempt}/${maxRetries}: ${error.message}`,
                    context: {
                        error_name: error.name,
                        error_message: error.message,
                        attempt: attempt,
                        max_retries: maxRetries
                    }
                });
                if (attempt === maxRetries) throw error;
                
                // No delay - retry immediately
            }
        }
    }

    // NEW: Retry logic for network delay updates with fallback storage and metadata tracking
    async function updateNetworkDelayWithRetry(sessionId, turn, networkDelaySeconds, maxRetries = 3) {
        const metadata = {
            status: null,
            attempts_required: 0,
            failure_types: [],
            fallback_reason: null,
            retry_delays: []
        };
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            metadata.attempts_required = attempt;
            try {
                logToRailway({
                    type: 'NETWORK_DELAY_UPDATE_ATTEMPT',
                    message: `Updating network delay (attempt ${attempt}/${maxRetries})`,
                    context: {
                        session_id: sessionId,
                        turn: turn,
                        network_delay_seconds: networkDelaySeconds,
                        attempt: attempt
                    }
                });

                // Create AbortController for timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout
                
                const response = await fetch('/update_network_delay', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session_id: sessionId,
                        turn: turn,
                        network_delay_seconds: networkDelaySeconds,
                        metadata: metadata
                    }),
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);

                if (response.ok) {
                    // Success - set status and return metadata
                    metadata.status = attempt === 1 ? 'primary_success' : 'retry_success';
                    logToRailway({
                        type: 'NETWORK_DELAY_UPDATED',
                        message: `Network delay successfully updated (attempt ${attempt})`,
                        context: {
                            network_delay_seconds: networkDelaySeconds,
                            turn: turn,
                            session_id: sessionId,
                            attempt: attempt,
                            metadata: metadata
                        }
                    });
                    return { success: true, metadata };
                } else {
                    // API error - track error type and continue to retry
                    const errorType = `${response.status}_error`;
                    metadata.failure_types.push(errorType);
                    
                    logToRailway({
                        type: 'NETWORK_DELAY_API_ERROR',
                        message: `Network delay update API error (attempt ${attempt}/${maxRetries})`,
                        context: {
                            response_status: response.status,
                            attempt: attempt,
                            turn: turn,
                            error_type: errorType
                        }
                    });
                    if (attempt === maxRetries) throw new Error(`API error after ${maxRetries} attempts: ${response.status}`);
                }
            } catch (error) {
                // Network/fetch error - track error type and continue to retry
                const errorType = error.name === 'AbortError' ? 'timeout' : 
                                 error.name === 'TypeError' ? 'network_error' : 
                                 error.name || 'unknown_error';
                metadata.failure_types.push(errorType);
                
                logToRailway({
                    type: 'NETWORK_DELAY_NETWORK_ERROR',
                    message: `Network delay update network error (attempt ${attempt}/${maxRetries}): ${error.message}`,
                    context: {
                        error_name: error.name,
                        error_message: error.message,
                        error_type: errorType,
                        attempt: attempt,
                        turn: turn
                    }
                });
                
                if (attempt === maxRetries) {
                    // All retries failed - set fallback status and store for fallback
                    metadata.status = 'fallback_used';
                    metadata.fallback_reason = `All ${maxRetries} retries failed: ${error.message}`;
                    
                    const fallbackData = {
                        session_id: sessionId,
                        turn: turn,
                        network_delay_seconds: networkDelaySeconds,
                        failure_reason: error.message,
                        calculated_at: Date.now(),
                        retry_attempts: maxRetries,
                        metadata: metadata
                    };
                    pendingNetworkDelayUpdates.push(fallbackData);
                    
                    logToRailway({
                        type: 'NETWORK_DELAY_FALLBACK_STORED',
                        message: 'All retries failed - stored for fallback processing',
                        context: {
                            fallback_data: fallbackData,
                            pending_count: pendingNetworkDelayUpdates.length
                        }
                    });
                    return { success: false, metadata };
                }
                
                // Wait briefly before retry (exponential backoff)
                const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                metadata.retry_delays.push(backoffMs);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
        }
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

        const indicatorDelay = Math.random() * (7000 - 5000) + 5000;
        
        // Log to Railway only
        logToRailway({
            type: 'TYPING_INDICATOR_DEBUG',
            message: `Waiting ${(indicatorDelay/1000).toFixed(1)}s before showing typing indicator`,
            context: { delay_seconds: indicatorDelay/1000 }
        });
        
        setTimeout(() => {
            if (assessmentAreaDiv.style.display === 'none' && chatInputContainer.style.display === 'none') {
                // Start the typing animation with periodic pauses
                animateTypingIndicator(messageText.length);
                // Update timer message for State 1→2 transition (now waiting for AI response)
                updateTimerMessage();
            }
        }, indicatorDelay);

        try {
            // Use new retry logic that returns network delay
            const { response, result, networkDelaySeconds } = await sendMessageWithRetry(messageText, indicatorDelay / 1000);
            
            // If we get here, the retry succeeded - hide typing indicator and process response
            typingIndicator.dataset.runId = String((Number(typingIndicator.dataset.runId) || 0) + 1);
            typingIndicator.style.display = 'none';
            
            // Process the successful response
            addMessageToUI(result.ai_response, 'assistant');
            
            // Update the backend with network delay data using retry logic
            const updateResult = await updateNetworkDelayWithRetry(sessionId, result.turn, networkDelaySeconds);
            
            if (!updateResult.success) {
                // All retries failed - data is stored in pendingNetworkDelayUpdates for later processing
                logToRailway({
                    type: 'NETWORK_DELAY_FINAL_FAILURE',
                    message: 'Network delay update failed after all retries - stored for fallback',
                    context: {
                        network_delay_seconds: networkDelaySeconds,
                        turn: result.turn,
                        session_id: sessionId,
                        pending_fallbacks: pendingNetworkDelayUpdates.length,
                        metadata: updateResult.metadata
                    }
                });
            }
            
            currentTurn = result.turn;
            aiResponseTimestamp = result.timestamp;
            
            // --- MODIFIED: Slider setup logic ---
            assessmentAreaDiv.style.display = 'block';
            chatInputContainer.style.display = 'none';
            assessmentAreaDiv.querySelector('h4').textContent = "Your Assessment";
            
            // Update timer message for State 2→3 transition (now rating phase)
            updateTimerMessage();
            
            // NEW: Reset timing variables for this turn
            confidenceStartTime = null;
            sliderInteractionLog = [];
                
                if (timeExpired) {
                    // Final turn: Show last value as visual reference, but require 0 or 1 selection
                    confidenceSlider.value = lastConfidenceValue;
                    sliderStartValueThisTurn = lastConfidenceValue;
                    confidenceSlider.classList.remove('pristine');
                    confidenceValueSpan.style.display = 'inline';
                    confidenceValueSpan.textContent = lastConfidenceValue.toFixed(2);
                    submitRatingButton.disabled = true; // Must move to 0 or 1 to enable
                } else {
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
                }

                confidenceSlider.disabled = false;
                submitRatingButton.style.display = 'block';
                feelsOffCheckbox.checked = false;
                commentInputArea.style.display = 'none';
                feelsOffCommentTextarea.value = '';
                messageList.scrollTop = messageList.scrollHeight;

        } catch (error) {
            // If we reach here, all retries failed - log the final failure
            logToRailway({
                type: 'CRITICAL_FAILURE',
                message: `All retries failed: ${error.message}`,
                stack: error.stack,
                context: {
                    function: 'handleSendMessage',
                    time_expired: timeExpired,
                    user_message_length: messageText.length,
                    final_error: true
                }
            });
            
            // Hide typing indicator and reset UI - but keep conversation going
            // The user can send another message to continue
            typingIndicator.style.display = 'none';
            userMessageInput.disabled = false;
            sendMessageButton.disabled = false;
            chatInputContainer.style.display = 'flex';
            assessmentAreaDiv.style.display = 'none';
            
            // IMPORTANT: We don't show any error to the user
            // They can just send another message and the conversation continues
        }
    }


    submitRatingButton.addEventListener('click', async () => {
        if (!sessionId) return;

        // NEW: Block non-final submissions after time expires
        if (timeExpired) {
            const confidence = parseFloat(confidenceSlider.value);
            
            // Use strict validation with tolerance for floating point precision
            const isExactly0 = Math.abs(confidence - 0.0) < 0.001;
            const isExactly1 = Math.abs(confidence - 1.0) < 0.001;
            
            // Log to Railway for debugging
            logToRailway({
                type: 'TIME_EXPIRED_VALIDATION',
                message: `Time expired validation check`,
                context: {
                    timeExpired: timeExpired,
                    confidence: confidence,
                    slider_value_raw: confidenceSlider.value,
                    is_exactly_0_strict: confidence === 0.0,
                    is_exactly_1_strict: confidence === 1.0,
                    is_exactly_0_tolerance: isExactly0,
                    is_exactly_1_tolerance: isExactly1,
                    will_block_strict: (confidence !== 0.0 && confidence !== 1.0),
                    will_block_tolerance: (!isExactly0 && !isExactly1)
                }
            });
            
            if (!isExactly0 && !isExactly1) {
                showError('Time expired! You must select exactly 0 (Human) or 1 (AI) to continue.');
                return; // Block the submission
            }
        }

        if (feelsOffCheckbox.checked && feelsOffCommentTextarea.value.trim() === '') {
            // SILENT: No participant-visible error - just prevent submission
            return;
        }

        ratingLoadingDiv.style.display = 'block';
        submitRatingButton.disabled = true;
        confidenceSlider.disabled = true;

        const confidence = parseFloat(confidenceSlider.value);
        lastConfidenceValue = confidence; // NEW: Save the submitted value for the next round

        // NEW: Calculate enhanced timing data
        let decisionTimeSeconds = null;
        let readingTimeSeconds = null;
        let activeDecisionTimeSeconds = null;

        const baseMs = tsToMs(aiResponseTimestamp);
        if (baseMs) {
            // NEW: Log the final submitted value to ensure data integrity
            sliderInteractionLog.push({
                event: 'slider_submit',
                timestamp: Date.now(),
                timestampFromResponse: Date.now() - baseMs,
                timestampFromFirstTouch: confidenceStartTime ? Date.now() - confidenceStartTime : null,
                value: confidence
            });
            
            decisionTimeSeconds = (Date.now() - baseMs) / 1000;
            if (confidenceStartTime) {
                readingTimeSeconds = (confidenceStartTime - baseMs) / 1000;
                activeDecisionTimeSeconds = (Date.now() - confidenceStartTime) / 1000;
            }
        } else {
            // Log to Railway only
            logToRailway({
                type: 'TIMING_WARNING',
                message: 'aiResponseTimestamp missing; timing metrics will be null',
                context: { function: 'submitRatingButton' }
            });
        }

        // Log to Railway only
        logToRailway({
            type: 'RATING_SUBMISSION',
            message: 'Submitting rating with timing metrics',
            context: {
                confidence: confidence,
                decision_time_seconds: decisionTimeSeconds,
                reading_time_seconds: readingTimeSeconds,
                active_decision_time_seconds: activeDecisionTimeSeconds,
                turn: currentTurn
            }
        });

        try {
            // Create AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds for rating submission
            
            const response = await fetch('/submit_rating', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    confidence: confidence,
                    decision_time_seconds: decisionTimeSeconds,
                    reading_time_seconds: readingTimeSeconds,
                    active_decision_time_seconds: activeDecisionTimeSeconds,
                    slider_interaction_log: sliderInteractionLog
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            const result = await response.json();
            // Log to Railway only
            logToRailway({
                type: 'RATING_RESPONSE',
                message: 'Rating submission response from server',
                context: {
                    study_over: result.study_over,
                    response_ok: response.ok
                }
            });

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
                        
                        // Update timer message for State 3→1 transition (back to chat input)
                        updateTimerMessage();
                    }
                }
            } else {
                // SILENT: No participant-visible error - logged to Railway only
                submitRatingButton.disabled = false;
                confidenceSlider.disabled = false;
            }
        } catch (error) {
            // SILENT: No participant-visible error - logged to Railway only
            // Error already logged to Railway if needed
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
                // Log to Railway only
                logToRailway({
                    type: 'FEEDBACK_SUBMISSION_ERROR',
                    message: error.message,
                    stack: error.stack,
                    context: { function: 'submitFeedbackButton' }
                });
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
            // SILENT: No participant-visible error - just prevent submission
            return;
        }
        // LEGACY CODE REMOVED - this checkbox validation can never be reached in current UI flow

        const commentText = feelsOffCommentTextarea.value.trim();
        if (commentText === '') {
            // SILENT: No participant-visible error - just prevent submission
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
                // Log to Railway only
                logToRailway({
                    type: 'COMMENT_SUBMISSION_SUCCESS',
                    message: 'Comment submitted successfully',
                    context: { function: 'submitCommentButton' }
                });
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
                // SILENT: No participant-visible error - logged to Railway only
            }
        } catch (error) {
            // SILENT: No participant-visible error - logged to Railway only
            // Error already logged to Railway if needed
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
        // NEW: Reset timing variables
        confidenceStartTime = null;
        sliderInteractionLog = [];
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
            // Log to Railway only
            logToRailway({
                type: 'RESEARCHER_DATA_ERROR',
                message: error.message,
                stack: error.stack,
                context: { function: 'loadResearcherDataButton' }
            });
        } finally {
            loadResearcherDataButton.disabled = false;
        }
    });

    // --- Initial Page Load ---
    localStorage.removeItem('sessionId');
    aiResponseTimestamp = null;
    // NEW: Reset timing variables
    confidenceStartTime = null;
    sliderInteractionLog = [];
    showMainPhase('consent'); // Start with the consent form instead of 'initial'
    // Log page load event with basic metadata
    logUiEvent('page_load', {
        userAgent: navigator.userAgent,
        language: navigator.language,
        referrer: document.referrer || null
    });

});
