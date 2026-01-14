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
    // const skipFeedbackButton = document.getElementById('skip-feedback-button'); // REMOVED: Feedback is now mandatory
    const feedbackTextarea = document.getElementById('feedback-textarea');
    const mainContainer = document.querySelector('.container'); // For the disagree message

    // NEW: Human witness mode elements
    const roleAssignmentPhaseDiv = document.getElementById('role-assignment-phase');
    const waitingRoomPhaseDiv = document.getElementById('waiting-room-phase');
    const assignedRoleTitleSpan = document.getElementById('assigned-role-title');
    const interrogatorInstructionsDiv = document.getElementById('interrogator-instructions');
    const witnessInstructionsDiv = document.getElementById('witness-instructions');
    const enterWaitingRoomButton = document.getElementById('enter-waiting-room-button');
    const waitingStatusP = document.getElementById('waiting-status');
    const elapsedTimeSpan = document.getElementById('elapsed-time');
    const waitingTimeoutWarningDiv = document.getElementById('waiting-timeout-warning');
    const leaveWaitingRoomButton = document.getElementById('leave-waiting-room-button');
    const interrogatorRatingUI = document.getElementById('interrogator-rating-ui');
    const witnessWaitingUI = document.getElementById('witness-waiting-ui');
    const witnessStyleNameSpan = document.getElementById('witness-style-name');
    const witnessStyleDescriptionP = document.getElementById('witness-style-description');

    // NEW: Witness end-of-study modal
    const witnessEndModal = document.getElementById('witness-end-modal');
    const witnessEndTitle = document.getElementById('witness-end-title');
    const witnessEndMessage = document.getElementById('witness-end-message');
    const witnessEndContinueButton = document.getElementById('witness-end-continue-button');

    // NEW: Interrogator connection issue modal (human mode partner dropout)
    const interrogatorConnectionModal = document.getElementById('interrogator-connection-modal');
    const interrogatorConnectionContinueButton = document.getElementById('interrogator-connection-continue-button');

    // NEW: AI connection failure modal (API retry failures)
    const aiConnectionModal = document.getElementById('ai-connection-modal');
    const aiConnectionTitle = document.getElementById('ai-connection-title');
    const aiConnectionMessage = document.getElementById('ai-connection-message');
    const aiConnectionButton = document.getElementById('ai-connection-button');

    // 1. Prolific Placeholder URLs
    const PROLIFIC_COMPLETION_URL = "https://app.prolific.com/submissions/complete?cc=CR0KFVQO";
    const PROLIFIC_REJECTION_URL = "https://app.prolific.com/submissions/complete?cc=C120SCQ9";
    const PROLIFIC_TIMED_OUT_URL = "https://app.prolific.com/submissions/complete?cc=C1B54A7Q";


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
    let lastConfidenceValue = 50; // NEW: Changed to 50 (0-100 scale, default 50%)
    let finalSummaryData = null; // NEW: To store summary data before showing feedback form

    // NEW: Binary choice tracking variables
    let binaryChoiceStartTime = null; // When AI message appears
    let binaryChoice = null; // 'human' or 'ai'
    let binaryChoiceTime = null; // Time taken to make binary choice
    let buttonOrderRandomized = false; // For counterbalancing (currently disabled)

    // NEW: Enhanced reaction time tracking variables
    let confidenceStartTime = null; // When they first touch the slider (after binary choice)
    let sliderInteractionLog = []; // Log of all slider interactions
    
    // NEW: Fallback storage for failed network delay updates
    let pendingNetworkDelayUpdates = []; // Store failed updates for later retry
    
    // Timer variables
    let studyTimer = null;
    let studyStartTime = null;
    let synchronizedStartTimestamp = null; // NEW: Synchronized start time from backend (in milliseconds)
    let timeExpired = false;
    const STUDY_DURATION_MS = 7.5 * 60 * 1000; // 7.5 minutes in milliseconds

    // NEW: Tab visibility tracking
    let tabHiddenStartTime = null;
    let cumulativeTabHiddenMs = 0;

    // NEW: Human witness mode variables
    let currentRole = null;  // 'interrogator' or 'witness'
    let partnerSessionId = null;
    let firstMessageSender = null;
    let partnerDroppedFlag = false;  // Track when partner has dropped (for interrogator delayed handling)
    let isHumanPartner = false;
    let waitingForPartner = false;
    let matchCheckInterval = null;
    let waitingTimerInterval = null; // NEW: Separate interval for waiting room timer
    let partnerPollInterval = null;

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
        // NEW: Use synchronized timestamp from backend if available, otherwise fallback to local time
        studyStartTime = synchronizedStartTimestamp || Date.now();
        const timerDisplay = document.getElementById('timer-display');
        const countdownTimer = document.getElementById('countdown-timer');

        // Show the timer
        timerDisplay.style.display = 'block';

        // Log which timestamp source was used for debugging
        logToRailway({
            type: 'STUDY_TIMER_STARTED',
            message: synchronizedStartTimestamp ? 'Timer started with synchronized backend timestamp' : 'Timer started with local timestamp (fallback)',
            context: {
                synchronized_timestamp: synchronizedStartTimestamp,
                local_timestamp: Date.now(),
                difference_ms: synchronizedStartTimestamp ? (synchronizedStartTimestamp - Date.now()) : 0
            }
        });

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

                // NEW: Handle timer expiry for witnesses (show modal)
                if (currentRole === 'witness') {
                    logToRailway({
                        type: 'WITNESS_TIMER_EXPIRED',
                        message: 'Timer expired for witness - showing modal',
                        context: { role: currentRole }
                    });

                    // Stop partner polling
                    if (partnerPollInterval) {
                        clearInterval(partnerPollInterval);
                        partnerPollInterval = null;
                    }

                    // Hide chat UI
                    chatInputContainer.style.display = 'none';
                    timerDisplay.style.display = 'none';

                    // Show modal explaining time is up
                    witnessEndTitle.textContent = 'Time Expired';
                    witnessEndMessage.textContent = 'The conversation time limit has been reached. Thank you for your participation!';
                    witnessEndModal.style.display = 'flex';
                } else {
                    // Interrogator flow - existing logic
                    // Set initial timer message and show message if in rating phase
                    updateTimerMessage();
                    if (assessmentAreaDiv.style.display === 'block') {
                        // NEW: Updated message for binary choice system
                        showError('Time expired! Please complete your final rating (binary choice + confidence) to finish the study.');
                    }
                }
            }
        }, 1000);
    }

    // This function checks if both user and backend are ready, then proceeds
    function tryProceedToChat() {
        logToRailway({
            type: 'TRY_PROCEED_TO_CHAT',
            message: 'tryProceedToChat called',
            context: { isBackendReady, isUserReady }
        });

        if (isBackendReady && isUserReady) {
            // Stop and hide the loading animation at the last possible moment
            clearInterval(progressInterval);
            initLoadingDiv.style.display = 'none';

            // Ensure the instruction pop-up is hidden
            finalInstructionsModal.style.display = 'none';

            // Switch to the main chat page view
            showMainPhase('chat_and_assessment_flow');

            // Configure UI based on role
            assessmentAreaDiv.style.display = 'none';

            if (currentRole === 'witness') {
                // Witnesses don't see rating UI, only chat
                interrogatorRatingUI.style.display = 'none';
                witnessWaitingUI.style.display = 'none';
                chatInputContainer.style.display = 'flex';

                // Check if witness sends first message
                if (firstMessageSender === 'witness') {
                    userMessageInput.disabled = false;
                    sendMessageButton.disabled = false;
                    userMessageInput.focus();
                } else {
                    // Waiting for interrogator's first message
                    userMessageInput.disabled = true;
                    sendMessageButton.disabled = true;
                    waitingForPartner = true;
                    startPartnerResponsePolling();
                }
            } else {
                // Interrogators see normal UI (rating area shown after AI response)
                interrogatorRatingUI.style.display = 'block';
                witnessWaitingUI.style.display = 'none';
                chatInputContainer.style.display = 'flex';

                // Check if interrogator sends first message
                if (firstMessageSender === 'interrogator' || !isHumanPartner) {
                    userMessageInput.disabled = false;
                    sendMessageButton.disabled = false;
                    userMessageInput.focus();
                } else {
                    // Waiting for witness's first message (shouldn't happen since interrogator always goes first)
                    userMessageInput.disabled = true;
                    sendMessageButton.disabled = true;
                    waitingForPartner = true;
                    startPartnerResponsePolling();
                }
            }

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
        roleAssignmentPhaseDiv.style.display = 'none'; // NEW
        waitingRoomPhaseDiv.style.display = 'none'; // NEW
        chatInterfaceDiv.style.display = 'none';
        finalPageDiv.style.display = 'none';
        feedbackPhaseDiv.style.display = 'none';


        if (phase === 'consent') consentPhaseDiv.style.display = 'block';
        else if (phase === 'instructions') instructionsPhaseDiv.style.display = 'block';
        else if (phase === 'initial') initialSetupDiv.style.display = 'block';
        else if (phase === 'role-assignment') roleAssignmentPhaseDiv.style.display = 'block'; // NEW
        else if (phase === 'waiting-room') waitingRoomPhaseDiv.style.display = 'block'; // NEW
        else if (phase === 'chat_and_assessment_flow') chatInterfaceDiv.style.display = 'block';
        else if (phase === 'feedback') feedbackPhaseDiv.style.display = 'block';
        else if (phase === 'final') finalPageDiv.style.display = 'block';
    }



    function scrollToBottom() {
        const chatWindow = document.querySelector('.chat-window');
        // We use the setTimeout trick to make sure the browser has rendered the new content
        setTimeout(() => {
            chatWindow.scrollTop = chatWindow.scrollHeight;
        }, 0);
    }

    // NEW: Human witness mode functions
    async function enterWaitingRoom() {
        logToRailway({
            type: 'ENTER_WAITING_ROOM_CALLED',
            message: 'enterWaitingRoom function called',
            context: {}
        });
        try {
            const response = await fetch('/enter_waiting_room', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId })
            });
            const result = await response.json();
            logToRailway({
                type: 'ENTER_WAITING_ROOM_RESPONSE',
                message: 'Received response from enter_waiting_room',
                context: result
            });

            isHumanPartner = !result.ai_partner;

            // NEW FLOW: Don't show any intermediate screen
            // Just set the mode flag and wait for "I understand" click
            logToRailway({
                type: 'MODE_DETERMINED',
                message: 'Study mode determined, waiting for "I understand" click',
                context: { isHumanPartner, ai_partner: result.ai_partner }
            });

            // For AI mode, set role now
            if (result.ai_partner) {
                currentRole = 'interrogator';
            }
            // For human mode, role will be assigned when "I understand" is clicked
        } catch (error) {
            logToRailway({
                type: 'WAITING_ROOM_ERROR',
                message: `Failed to enter waiting room: ${error.message}`,
                context: { error: error }
            });
            showError('Failed to enter waiting room. Please refresh and try again.');
        }
    }

    function showReadyToJoinScreen() {
        // Show generic ready screen (for human mode - no role assigned yet)
        showMainPhase('role-assignment'); // Reuse same phase
        assignedRoleTitleSpan.textContent = 'READY TO JOIN';
        // Hide both instruction sets
        interrogatorInstructionsDiv.style.display = 'none';
        witnessInstructionsDiv.style.display = 'none';
        // Button text stays "Enter Waiting Room"
    }

    function showRoleInstructionsInWaitingRoom(role) {
        // Show role-specific instructions INSIDE the waiting room
        const instructionsDiv = document.getElementById('waiting-room-instructions');
        const roleTitleSpan = document.getElementById('waiting-room-role-title');
        const instructionsContent = document.getElementById('waiting-room-instructions-content');

        roleTitleSpan.textContent = role.toUpperCase();

        if (role === 'interrogator') {
            instructionsContent.innerHTML = `
                <p><strong>Your task:</strong> Have a conversation with your partner and decide if they are human or AI.</p>
                <ul style="text-align: left; margin: 15px 0;">
                    <li>You will start the conversation</li>
                    <li>Ask questions to determine if your partner is human or AI</li>
                    <li>After each message from your partner, you'll rate how human-like they seem</li>
                    <li>The conversation will last for 15 message exchanges</li>
                </ul>
                <p style="margin-top: 15px;"><strong>Please read these instructions carefully while you wait.</strong></p>
            `;
        } else {
            instructionsContent.innerHTML = `
                <p><strong>Your task:</strong> Have a conversation with your partner and convince them you are human.</p>
                <ul style="text-align: left; margin: 15px 0;">
                    <li>Your partner will start the conversation</li>
                    <li>Respond naturally to their questions</li>
                    <li>Try to convince them you are human (even though you are!)</li>
                    <li>Be yourself and chat naturally</li>
                </ul>
                <p style="margin-top: 15px;"><strong>Please read these instructions carefully while you wait.</strong></p>
            `;
        }

        instructionsDiv.style.display = 'block';

        logToRailway({
            type: 'INSTRUCTIONS_SHOWN_IN_WAITING_ROOM',
            message: 'Role instructions displayed in waiting room',
            context: { role }
        });
    }

    function waitUntilProceedTime(proceedAtTimestamp) {
        // DESIGN FIX: Both players wait until the same synchronized time
        // Backend calculates: max(interrogator_entered, witness_entered) + 10 seconds
        const now = Date.now();
        const proceedAtMs = proceedAtTimestamp * 1000; // Convert Unix timestamp (seconds) to milliseconds
        const waitTimeMs = proceedAtMs - now;

        // NEW: Store synchronized start timestamp for timer synchronization
        synchronizedStartTimestamp = proceedAtMs;

        if (waitTimeMs > 0) {
            const secondsRemaining = Math.ceil(waitTimeMs / 1000);
            waitingStatusP.innerHTML = `<span style="color: #28a745; font-weight: bold;">Match found! Please finish reading instructions (${secondsRemaining}s)...</span>`;

            logToRailway({
                type: 'WAITING_FOR_SYNCHRONIZED_PROCEED',
                message: 'Waiting for synchronized proceed time (both players >= 10s)',
                context: {
                    proceed_at_timestamp: proceedAtTimestamp,
                    wait_time_ms: waitTimeMs,
                    seconds_remaining: secondsRemaining
                }
            });

            // Update countdown every second
            const countdownInterval = setInterval(() => {
                const remaining = Math.ceil((proceedAtMs - Date.now()) / 1000);
                if (remaining > 0) {
                    waitingStatusP.innerHTML = `<span style="color: #28a745; font-weight: bold;">Match found! Please finish reading instructions (${remaining}s)...</span>`;
                } else {
                    clearInterval(countdownInterval);
                }
            }, 1000);

            // Wait until proceed time, then proceed
            setTimeout(() => {
                clearInterval(countdownInterval);
                logToRailway({
                    type: 'SYNCHRONIZED_PROCEED_TIME_REACHED',
                    message: 'Both players have had >=10s, proceeding to chat together',
                    context: {
                        instructions_shown_at: window.instructionsShownAt,
                        total_wait_ms: Date.now() - window.instructionsShownAt
                    }
                });
                tryProceedToChat();
            }, waitTimeMs);
        } else {
            // Proceed time already passed (shouldn't happen, but handle it)
            logToRailway({
                type: 'PROCEED_TIME_ALREADY_PASSED',
                message: 'Proceed time already elapsed, proceeding immediately',
                context: { wait_time_ms: waitTimeMs }
            });
            setTimeout(() => {
                tryProceedToChat();
            }, 1500);
        }
    }

    function showRoleAssignment(role) {
        logToRailway({
            type: 'SHOW_ROLE_ASSIGNMENT',
            message: 'showRoleAssignment called',
            context: { role }
        });
        showMainPhase('role-assignment');

        assignedRoleTitleSpan.textContent = role.toUpperCase();

        if (role === 'interrogator') {
            interrogatorInstructionsDiv.style.display = 'block';
            witnessInstructionsDiv.style.display = 'none';
        } else {
            interrogatorInstructionsDiv.style.display = 'none';
            witnessInstructionsDiv.style.display = 'block';
        }

        logUiEvent('role_assigned', { role: role });
    }

    function startMatchPolling() {
        const startTime = Date.now();

        // NEW: Separate timer update (runs every 1 second)
        waitingTimerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            elapsedTimeSpan.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }, 1000); // Update every 1 second

        // Match checking (runs every 3 seconds)
        matchCheckInterval = setInterval(async () => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);

            // Check for match
            try {
                const response = await fetch(`/check_match_status?session_id=${sessionId}`);
                const result = await response.json();

                if (result.matched) {
                    clearInterval(matchCheckInterval);
                    clearInterval(waitingTimerInterval); // Stop timer updates
                    partnerSessionId = result.partner_session_id;
                    firstMessageSender = result.first_message_sender;

                    // Get synchronized proceed time from backend (Unix timestamp in seconds)
                    const proceedAtTimestamp = result.proceed_to_chat_at;

                    logToRailway({
                        type: 'MATCH_FOUND_DEBUG',
                        message: 'Match found - checking proceed_at_timestamp',
                        context: {
                            proceed_at_timestamp: proceedAtTimestamp,
                            proceed_at_type: typeof proceedAtTimestamp,
                            proceed_at_is_null: proceedAtTimestamp === null,
                            proceed_at_is_undefined: proceedAtTimestamp === undefined,
                            current_time_seconds: Date.now() / 1000
                        }
                    });

                    logUiEvent('match_found', {
                        partner_id: partnerSessionId,
                        time_waiting: elapsed,
                        first_sender: firstMessageSender,
                        proceed_at: proceedAtTimestamp
                    });

                    // Backend is ready now that real match is found
                    isBackendReady = true;

                    // Brief delay to show "Match found!" message
                    waitingStatusP.innerHTML = '<span style="color: #28a745; font-weight: bold;">Match found! Starting conversation...</span>';

                    // DESIGN FIX: Wait until synchronized proceed time
                    if (proceedAtTimestamp && proceedAtTimestamp > 0) {
                        waitUntilProceedTime(proceedAtTimestamp);
                    } else {
                        logToRailway({
                            type: 'PROCEED_TIME_MISSING',
                            message: 'proceed_to_chat_at is null/undefined - proceeding immediately (BUG!)',
                            context: { proceed_at: proceedAtTimestamp }
                        });
                        // Fallback: proceed immediately (this is the bug!)
                        // Use current time as synchronized start since backend didn't provide one
                        synchronizedStartTimestamp = Date.now();
                        tryProceedToChat();
                    }
                }

                // Show timeout warning after 4 minutes
                if (elapsed >= 240 && elapsed < 300) {
                    waitingTimeoutWarningDiv.style.display = 'block';
                }

                // Hard timeout after 5 minutes
                if (elapsed >= 300) {
                    clearInterval(matchCheckInterval);
                    clearInterval(waitingTimerInterval); // Stop timer updates
                    handleMatchTimeout();
                }
            } catch (error) {
                logToRailway({
                    type: 'MATCH_CHECK_ERROR',
                    message: `Error checking match status: ${error.message}`,
                    context: { elapsed_seconds: elapsed }
                });
            }
        }, 3000); // Poll every 3 seconds
    }

    function handleMatchTimeout() {
        logUiEvent('match_timeout');

        waitingStatusP.innerHTML = '<span style="color: #d9534f;">Unable to find a match</span>';
        waitingTimeoutWarningDiv.style.display = 'block';

        showError('No match found after 5 minutes. Please use the "Report Issue & Exit" button.');
    }

    function simulateAIMatch() {
        // Simulate finding AI partner after 5-10 seconds
        const simulatedWaitTime = Math.random() * 5000 + 5000; // 5-10 seconds

        // Update elapsed time display during simulated wait
        const startTime = Date.now();
        const timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            elapsedTimeSpan.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);

        setTimeout(() => {
            clearInterval(timerInterval);
            waitingStatusP.innerHTML = '<span style="color: #28a745; font-weight: bold;">Match found! Starting conversation...</span>';

            // Backend is ready now that "match" is found
            logToRailway({
                type: 'SIMULATED_MATCH_FOUND',
                message: 'Simulated match found - setting isBackendReady to true',
                context: { isBackendReady_before: isBackendReady, isUserReady }
            });
            isBackendReady = true;
            logToRailway({
                type: 'FLAGS_AFTER_SIMULATED_MATCH',
                message: 'Flags after setting isBackendReady',
                context: { isBackendReady, isUserReady }
            });

            setTimeout(() => {
                tryProceedToChat();
            }, 1500);
        }, simulatedWaitTime);
    }

    function addSystemMessage(text) {
        const messageBubble = document.createElement('div');
        messageBubble.classList.add('message-bubble', 'system');
        messageBubble.textContent = text;
        messageBubble.style.cssText = 'background-color: #f8f9fa; color: #666; text-align: center; font-style: italic; border: 1px dashed #ddd; padding: 10px; margin: 10px 0; border-radius: 5px;';
        messageList.appendChild(messageBubble);
        scrollToBottom();
    }

    function startPartnerResponsePolling() {
        if (partnerPollInterval) {
            clearInterval(partnerPollInterval);
        }

        // Start with typing indicator hidden - will show when partner actually types
        typingIndicator.style.display = 'none';
        scrollToBottom();

        // Track how long we've been waiting for partner
        let lastActivityTime = Date.now();
        const PARTNER_TIMEOUT_MS = 120000; // 2 minutes (resets if partner is typing, catches real dropouts)

        partnerPollInterval = setInterval(async () => {
            // Check if partner has been inactive too long
            const elapsedMs = Date.now() - lastActivityTime;
            if (elapsedMs >= PARTNER_TIMEOUT_MS) {
                clearInterval(partnerPollInterval);
                partnerPollInterval = null;

                logToRailway({
                    type: 'PARTNER_TIMEOUT',
                    message: 'Partner inactive for 2 minutes - assuming dropout',
                    context: { elapsed_ms: elapsedMs }
                });

                handlePartnerDropout();
                return;
            }

            try {
                // Check for both typing status AND new messages in parallel
                const [messageResponse, typingResponse] = await Promise.all([
                    fetch(`/check_partner_message?session_id=${sessionId}`),
                    fetch(`/check_partner_typing?session_id=${sessionId}`)
                ]);

                const result = await messageResponse.json();
                const typingResult = await typingResponse.json();

                // Update typing indicator based on partner's REAL typing status
                // IMPORTANT: If partner is typing, reset inactivity timer (they're still active!)
                if (typingResult.is_typing) {
                    lastActivityTime = Date.now(); // Reset timer - partner is active
                    typingIndicator.style.display = 'flex';
                    scrollToBottom();
                } else {
                    typingIndicator.style.display = 'none';
                }

                if (result.new_message) {
                    // NEW: Verify message is actually newer (prevent duplicates/out-of-order)
                    if (result.turn <= currentTurn) {
                        logToRailway({
                            type: 'MESSAGE_ORDER_WARNING',
                            message: 'Received message with turn <= currentTurn (possible duplicate)',
                            context: { received_turn: result.turn, current_turn: currentTurn }
                        });
                        return; // Skip this message, keep polling
                    }

                    clearInterval(partnerPollInterval);
                    partnerPollInterval = null;

                    // Add partner's message to UI
                    addMessageToUI(result.message_text, 'assistant');

                    currentTurn = result.turn;
                    aiResponseTimestamp = result.timestamp;
                    waitingForPartner = false;

                    // Hide typing indicator (important for clean UI)
                    typingIndicator.style.display = 'none';

                    // Show appropriate UI based on role
                    if (currentRole === 'interrogator') {
                        // Show rating UI for interrogator
                        assessmentAreaDiv.style.display = 'block';
                        chatInputContainer.style.display = 'none';
                        assessmentAreaDiv.querySelector('h4').textContent = "Your Assessment";

                        // Update timer message for rating phase
                        updateTimerMessage();

                        // Show binary choice section, hide confidence section
                        binaryChoiceSection.style.display = 'block';
                        confidenceSection.style.display = 'none';
                        confidenceSlider.disabled = false;

                        // Reset binary choice tracking for new turn
                        binaryChoice = null;
                        binaryChoiceStartTime = Date.now();
                        binaryChoiceTime = null;
                        binaryChoiceInProgress = false; // Reset double-click protection
                        choiceHumanButton.disabled = false; // Re-enable buttons
                        choiceAiButton.disabled = false;
                    } else {
                        // Witness - enable message input
                        chatInputContainer.style.display = 'flex';
                        userMessageInput.disabled = false;
                        sendMessageButton.disabled = false;
                        userMessageInput.focus();
                    }
                }

                // Check for study completion first (partner finished normally)
                if (result.study_completed) {
                    clearInterval(partnerPollInterval);
                    partnerPollInterval = null;
                    handleStudyCompleted();
                    return;
                }

                // Check for partner dropout (partner actually disconnected)
                if (result.partner_dropped) {
                    clearInterval(partnerPollInterval);
                    partnerPollInterval = null;
                    handlePartnerDropout();
                }

            } catch (error) {
                logToRailway({
                    type: 'PARTNER_POLLING_ERROR',
                    message: `Error polling for partner message: ${error.message}`
                });
            }
        }, 2000); // Poll every 2 seconds
    }

    function handleStudyCompleted() {
        logUiEvent('partner_completed_study');

        // Clean up timer
        if (studyTimer) {
            clearInterval(studyTimer);
        }
        document.getElementById('timer-display').style.display = 'none';

        // Stop partner polling
        if (partnerPollInterval) {
            clearInterval(partnerPollInterval);
            partnerPollInterval = null;
        }

        // NEW: Only witnesses should see this (interrogator completed)
        if (currentRole === 'witness') {
            chatInputContainer.style.display = 'none';
            assessmentAreaDiv.style.display = 'none';

            logToRailway({
                type: 'WITNESS_SEES_PARTNER_COMPLETED',
                message: 'Witness shown modal - interrogator completed study',
                context: { role: currentRole }
            });

            // Show modal explaining what happened
            witnessEndTitle.textContent = 'Study Complete';
            witnessEndMessage.textContent = 'Your conversation partner has finished the study. Thank you for your participation!';
            witnessEndModal.style.display = 'flex';
        } else {
            // This shouldn't happen for interrogators (they trigger their own completion)
            logToRailway({
                type: 'UNEXPECTED_STUDY_COMPLETED_FOR_INTERROGATOR',
                message: 'WARNING: Interrogator received study_completed signal - should not happen',
                context: { role: currentRole }
            });
        }
    }

    function handlePartnerDropout() {
        logUiEvent('partner_dropped');

        // Stop partner polling
        if (partnerPollInterval) {
            clearInterval(partnerPollInterval);
            partnerPollInterval = null;
        }

        // NEW: Different handling based on role
        if (currentRole === 'witness') {
            // WITNESS: Show modal immediately - their study is over
            // Clean up timer
            if (studyTimer) {
                clearInterval(studyTimer);
            }
            document.getElementById('timer-display').style.display = 'none';

            chatInputContainer.style.display = 'none';
            assessmentAreaDiv.style.display = 'none';

            logToRailway({
                type: 'WITNESS_SEES_PARTNER_DROPOUT',
                message: 'Witness shown modal immediately - partner was inactive/dropped',
                context: { role: currentRole }
            });

            // Show modal explaining what happened
            witnessEndTitle.textContent = 'Study Ended';
            witnessEndMessage.textContent = 'Your conversation partner was inactive for too long. The study has ended. Thank you for your participation!';
            witnessEndModal.style.display = 'flex';

        } else {
            // INTERROGATOR: Set flag only - modal shown later when they try to interact
            partnerDroppedFlag = true;

            logToRailway({
                type: 'INTERROGATOR_PARTNER_DROPPED_FLAG_SET',
                message: 'Partner dropped - flag set, will show modal when interrogator tries to send message or finishes rating',
                context: { role: currentRole }
            });

            // Don't show modal yet - they might be in middle of rating or typing
            // Modal will show when they try to send message or after they submit rating
        }
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
- The total time commitment will be approximately 10 minutes.
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

    // NEW: Witness modal continue button - route to debrief form
    witnessEndContinueButton.addEventListener('click', () => {
        logUiEvent('witness_modal_continue_clicked');

        // Hide modal
        witnessEndModal.style.display = 'none';

        // Route witness to debrief form
        showMainPhase('final');
        debriefPhaseDiv.style.display = 'block';
        summaryPhaseDiv.style.display = 'none';

        logToRailway({
            type: 'WITNESS_ROUTED_TO_DEBRIEF',
            message: 'Witness clicked continue on modal - routing to debrief form',
            context: { role: currentRole }
        });
    });

    // NEW: Interrogator connection issue modal continue button - proceed to feedback form
    interrogatorConnectionContinueButton.addEventListener('click', () => {
        logUiEvent('interrogator_connection_modal_continue_clicked');

        // Hide modal
        interrogatorConnectionModal.style.display = 'none';

        // Clean up timer
        if (studyTimer) {
            clearInterval(studyTimer);
        }
        document.getElementById('timer-display').style.display = 'none';

        // Go directly to feedback form (skip rating - no new response to evaluate)
        showMainPhase('feedback');

        logToRailway({
            type: 'INTERROGATOR_PROCEEDED_TO_FEEDBACK',
            message: 'Interrogator clicked continue on connection modal - showing feedback form',
            context: { role: currentRole }
        });
    });

    // NEW: AI connection failure modal button - handles both scenarios
    aiConnectionButton.addEventListener('click', () => {
        const scenario = aiConnectionButton.dataset.scenario;

        logUiEvent('ai_connection_modal_button_clicked', { scenario: scenario });

        // Hide modal
        aiConnectionModal.style.display = 'none';

        if (scenario === 'end_study') {
            // Scenario 2: Timer expired - end study, go to feedback form
            // Clean up timer
            if (studyTimer) {
                clearInterval(studyTimer);
            }
            document.getElementById('timer-display').style.display = 'none';

            // Go to feedback form
            showMainPhase('feedback');

            logToRailway({
                type: 'AI_FAILURE_END_STUDY',
                message: 'AI connection failed with timer expired - routing to feedback form',
                context: { scenario: 'end_study' }
            });

        } else {
            // Scenario 1: Time remaining - just dismiss, user can retry sending message
            logToRailway({
                type: 'AI_FAILURE_RETRY',
                message: 'AI connection failed but time remaining - user can retry sending message',
                context: { scenario: 'retry' }
            });
            // Chat input is already enabled from catch block - user can just send again
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

    finalInstructionsButton.addEventListener('click', async () => {
        logUiEvent('final_instructions_understand_clicked');
        logToRailway({
            type: 'I_UNDERSTAND_CLICKED',
            message: '"I understand" button clicked - NOW starting initialization',
            context: {}
        });

        // Hide the modal
        finalInstructionsModal.style.display = 'none';

        // Get the pending form data
        const data = window.pendingStudyData;
        if (!data) {
            showError('No form data found. Please refresh and try again.');
            return;
        }

        // NOW perform initialization (after user clicked "I understand")
        try {
            const response = await fetch('/initialize_study', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
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

            // Activate the early exit listener now that the study has officially begun
            if (isProduction) {
                window.addEventListener('beforeunload', handleEarlyExit);
            }

            // NOW enter waiting room (handles both AI and human partner modes)
            await enterWaitingRoom();

            // After enterWaitingRoom sets isHumanPartner, proceed with appropriate flow
            if (isHumanPartner) {
                // HUMAN MODE: Assign role + go to waiting room
                try {
                    // Call backend to assign role atomically
                    const roleResponse = await fetch('/join_waiting_room', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ session_id: sessionId })
                    });
                    const roleResult = await roleResponse.json();

                    if (!roleResponse.ok) {
                        throw new Error(roleResult.detail || 'Failed to assign role');
                    }

                    // Role assigned
                    currentRole = roleResult.role;

                    // NEW: If witness, populate social style instructions
                    if (currentRole === 'witness' && roleResult.social_style) {
                        witnessStyleNameSpan.textContent = roleResult.social_style;
                        witnessStyleDescriptionP.textContent = roleResult.social_style_description;

                        logToRailway({
                            type: 'WITNESS_SOCIAL_STYLE_ASSIGNED',
                            message: 'Witness assigned social style',
                            context: {
                                style: roleResult.social_style,
                                description: roleResult.social_style_description
                            }
                        });
                    }

                    logToRailway({
                        type: 'ROLE_ASSIGNED_ON_I_UNDERSTAND',
                        message: 'Role assigned when "I understand" clicked',
                        context: { role: currentRole }
                    });

                    // Go to waiting room immediately
                    showMainPhase('waiting-room');

                    // Show role instructions IN waiting room
                    showRoleInstructionsInWaitingRoom(currentRole);

                    // Start 10-second timer
                    window.instructionsShownAt = Date.now();

                    // Set user as ready (they've read instructions and clicked "I understand")
                    isUserReady = true;

                    logToRailway({
                        type: 'HUMAN_MODE_USER_READY',
                        message: 'Human mode - setting isUserReady to true after instructions',
                        context: { isBackendReady, isUserReady: true }
                    });

                    // Start polling for match automatically
                    startMatchPolling();

                } catch (error) {
                    logToRailway({
                        type: 'ROLE_ASSIGNMENT_ERROR',
                        message: `Failed to assign role: ${error.message}`,
                        context: { error: error }
                    });
                    showError('Failed to start matching. Please refresh and try again.');
                }
            } else {
                // AI MODE: Set flags and proceed as before
                isUserReady = true;
                currentRole = 'interrogator';

                logToRailway({
                    type: 'AI_MODE_I_UNDERSTAND',
                    message: 'AI mode - setting isUserReady to true',
                    context: { isBackendReady, isUserReady }
                });

                // Show waiting room briefly before match
                showMainPhase('waiting-room');

                // Simulate finding AI partner
                simulateAIMatch();
            }

        } catch (error) {
            // This block runs if any part of the 'try' block fails
            logToRailway({
                type: 'INITIALIZATION_ERROR',
                message: `Study initialization failed: ${error.message}`,
                context: { error: error }
            });
            finalInstructionsModal.style.display = 'none';
            const formButton = initialForm.querySelector('button');
            if (formButton) formButton.disabled = false;
            // Unlock the form so the participant can correct inputs
            setInitialFormControlsDisabled(false);
            showError('Failed to initialize study. Please refresh and try again.');
        }
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

        // Validate new demographics
        const politicalAffiliationVal = formData.get('political_affiliation');
        if (!politicalAffiliationVal) {
            showError("Please select your political affiliation.");
            return;
        }
        const socialMediaVals = formData.getAll('social_media');
        if (socialMediaVals.length === 0) {
            showError("Please select at least one social media platform option (or 'None').");
            return;
        }
        // Enforce 'None' as an exclusive selection
        if (socialMediaVals.includes('none') && socialMediaVals.length > 1) {
            showError("If you select 'None', please don’t select other platforms.");
            return;
        }
        const internetUsageVal = formData.get('internet_usage_per_week');
        if (!internetUsageVal) {
            showError("Please select your hours of internet use per week.");
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
            political_affiliation: politicalAffiliationVal,
            social_media_platforms: socialMediaVals,
            internet_usage_per_week: parseInt(internetUsageVal, 10),
            // Identifiers
            participant_id: participantId,
            prolific_pid: prolificPid
        };

        // Reset state flags for this attempt
        isBackendReady = false;
        isUserReady = false;
        logToRailway({
            type: 'FORM_SUBMITTED_FLAGS_RESET',
            message: 'Form submitted - reset flags to false',
            context: { isBackendReady, isUserReady }
        });

        // Show the final instructions pop-up
        logToRailway({
            type: 'SHOWING_INSTRUCTIONS_MODAL',
            message: 'Showing final instructions modal',
            context: {}
        });
        finalInstructionsModal.style.display = 'flex';

        // NO LOADING BAR - The waiting room IS the loading screen
        initialForm.querySelector('button').disabled = true;
        // Lock all demographics controls after capturing values
        setInitialFormControlsDisabled(true);

        // Store the form data to be used when "I understand" is clicked
        window.pendingStudyData = data;
    });
    
    // *** FIX: ADDING THE MISSING EVENT LISTENERS BACK ***
    sendMessageButton.addEventListener('click', handleSendMessage);
    userMessageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSendMessage();
        }
    });

    // NEW: Real typing detection for human-human conversations
    let typingSignalTimeout = null;
    userMessageInput.addEventListener('input', () => {
        // Only send typing signals in human partner mode
        if (!isHumanPartner || !sessionId || waitingForPartner) {
            return;
        }

        // Debounce: Send signal at most once per second
        if (typingSignalTimeout) {
            clearTimeout(typingSignalTimeout);
        }

        // Send typing signal
        fetch('/signal_typing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId })
        }).catch(err => {
            // Silent fail - typing indicators are not critical
            console.log('Typing signal failed:', err);
        });

        // Set timeout to stop sending if user stops typing for 2 seconds
        typingSignalTimeout = setTimeout(() => {
            typingSignalTimeout = null;
        }, 2000);
    });

    // OLD: "Enter Waiting Room" button - NO LONGER USED
    // Role assignment now happens when "I understand" is clicked
    // Keeping this for backward compatibility but should never be triggered
    enterWaitingRoomButton.addEventListener('click', async () => {
        logUiEvent('enter_waiting_room_clicked');
        logToRailway({
            type: 'ENTER_WAITING_ROOM_BUTTON_CLICKED_LEGACY',
            message: '⚠️ LEGACY: "Enter Waiting Room" button clicked (should not happen in new flow)',
            context: { isHumanPartner }
        });
        showMainPhase('waiting-room');

        if (isHumanPartner) {
            logToRailway({
                type: 'STARTING_REAL_MATCH_POLLING',
                message: 'Starting real match polling (HUMAN_WITNESS mode)',
                context: {}
            });
            // Call backend to assign role + mark as waiting + attempt match
            try {
                const response = await fetch('/join_waiting_room', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: sessionId })
                });
                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.detail || 'Failed to join waiting room');
                }

                // NOW we have the role assigned
                currentRole = result.role;

                logToRailway({
                    type: 'ROLE_ASSIGNED_IN_WAITING_ROOM',
                    message: 'Role assigned atomically',
                    context: { role: currentRole }
                });

                // Show role-specific instructions IN the waiting room
                showRoleInstructionsInWaitingRoom(currentRole);

                // Start 10-second minimum timer
                window.instructionsShownAt = Date.now();

                // FIXED BUG #1: Only start polling if role assignment succeeded
                startMatchPolling();

            } catch (error) {
                logToRailway({
                    type: 'JOIN_WAITING_ROOM_ERROR',
                    message: `Failed to join waiting room: ${error.message}`,
                    context: { error: error }
                });
                // TODO: Show error to user - for now, waiting room will appear frozen
                showError('Failed to join waiting room. Please refresh and try again.');
            }
        } else {
            logToRailway({
                type: 'STARTING_SIMULATED_MATCH',
                message: 'Starting simulated match (AI_WITNESS mode)',
                context: {}
            });
            // AI_WITNESS mode - simulate finding a match after 5-10 seconds
            simulateAIMatch();
        }
    });

    leaveWaitingRoomButton.addEventListener('click', async () => {
        logUiEvent('leave_waiting_room_clicked');

        // Redirect to Prolific with timeout code
        if (isProduction) {
            window.location.href = PROLIFIC_TIMED_OUT_URL;
        } else {
            alert('DEV MODE: Would redirect to Prolific timeout URL');
        }
    });

    // NEW: Binary choice button event listeners
    const choiceHumanButton = document.getElementById('choice-human-button');
    const choiceAiButton = document.getElementById('choice-ai-button');
    const binaryChoiceSection = document.getElementById('binary-choice-section');
    const confidenceSection = document.getElementById('confidence-section');
    const chosenLabel = document.getElementById('chosen-label');

    // COMMENTED OUT: Counterbalancing button order - can be enabled if advisor approves
    // function randomizeButtonOrder() {
    //     const buttonsContainer = document.getElementById('binary-choice-buttons');
    //     if (Math.random() < 0.5) {
    //         buttonsContainer.appendChild(choiceHumanButton);
    //         buttonsContainer.appendChild(choiceAiButton);
    //         buttonOrderRandomized = false;
    //     } else {
    //         buttonsContainer.appendChild(choiceAiButton);
    //         buttonsContainer.appendChild(choiceHumanButton);
    //         buttonOrderRandomized = true;
    //     }
    // }
    // randomizeButtonOrder(); // Call this when assessment area is first shown

    // NEW: Flag to prevent double-clicking binary choice buttons
    let binaryChoiceInProgress = false;

    choiceHumanButton.addEventListener('click', () => {
        handleBinaryChoice('human');
    });

    choiceAiButton.addEventListener('click', () => {
        handleBinaryChoice('ai');
    });

    function handleBinaryChoice(choice) {
        // PROTECTION: Prevent double-clicking - only process first click
        if (binaryChoiceInProgress) {
            logToRailway({
                type: 'BINARY_CHOICE_DOUBLE_CLICK_PREVENTED',
                message: `Double-click prevented - already processing choice`,
                context: {
                    attempted_choice: choice,
                    locked_choice: binaryChoice,
                    turn: currentTurn
                }
            });
            return; // Ignore subsequent clicks
        }

        // Lock immediately on first click
        binaryChoiceInProgress = true;

        // Disable both buttons immediately to prevent double-clicking
        choiceHumanButton.disabled = true;
        choiceAiButton.disabled = true;

        // Record the choice and timing
        binaryChoice = choice;
        binaryChoiceTime = Date.now() - binaryChoiceStartTime;

        // Log the choice
        logToRailway({
            type: 'BINARY_CHOICE_MADE',
            message: `User selected: ${choice}`,
            context: {
                choice: choice,
                time_taken_ms: binaryChoiceTime,
                turn: currentTurn
            }
        });

        // Hide binary choice, show confidence slider
        binaryChoiceSection.style.display = 'none';
        confidenceSection.style.display = 'block';
        // Ensure slider is enabled for interaction on this step
        confidenceSlider.disabled = false;
        // Capitalize properly: "ai" → "AI", "human" → "Human"
        chosenLabel.textContent = choice === 'ai' ? 'AI' : choice.charAt(0).toUpperCase() + choice.slice(1);

        // Reset confidence slider to 50% for new choice
        confidenceSlider.value = 50;
        confidenceValueSpan.textContent = '50';

        // NEW: Hide slider thumb initially to avoid bias from previous round
        confidenceSlider.classList.add('pristine');

        confidenceStartTime = Date.now(); // Start tracking confidence slider timing
        sliderInteractionLog = []; // Reset slider interaction log
        submitRatingButton.disabled = false; // Enable submit button
    }

    // NEW: Track when user first interacts with confidence slider
    confidenceSlider.addEventListener('mousedown', () => {
        // Remove pristine class to show thumb on first interaction
        confidenceSlider.classList.remove('pristine');

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
        // Remove pristine class to show thumb on first interaction
        confidenceSlider.classList.remove('pristine');

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
        let value = parseInt(confidenceSlider.value); // Now 0-100 scale

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

        // Update the displayed value
        confidenceValueSpan.textContent = value;

        // Submit button is already enabled by handleBinaryChoice
        // No special restrictions - any value 0-100 is valid
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
                // NEW: Reduced timeout to 60 seconds to prevent excessive waits
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds timeout (reduced from 120s)
                
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
                    return { response, result, networkDelaySeconds, attempts: attempt };
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
    async function updateNetworkDelayWithRetry(sessionId, turn, networkDelaySeconds, sendAttempts = 1, maxRetries = 2) {
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
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout (increased from 15s)
                
                const response = await fetch('/update_network_delay', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session_id: sessionId,
                        turn: turn,
                        network_delay_seconds: networkDelaySeconds,
                        send_attempts: sendAttempts,
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

                // Wait briefly before retry (reduced backoff)
                const backoffMs = 2000; // Fixed 2 second delay instead of exponential
                metadata.retry_delays.push(backoffMs);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
        }
    }

    async function handleSendMessage() {
        const messageText = userMessageInput.value.trim();
        if (!messageText || !sessionId) return;

        // NEW: Check if partner has dropped - show modal instead of sending
        if (partnerDroppedFlag) {
            logToRailway({
                type: 'INTERROGATOR_TRIED_TO_SEND_AFTER_DROPOUT',
                message: 'Interrogator tried to send message after partner dropped - showing connection modal',
                context: { role: currentRole }
            });

            // Show connection issue modal
            interrogatorConnectionModal.style.display = 'flex';
            return; // Don't send the message
        }

        // Check if it's our turn (for human-human conversations)
        if (waitingForPartner) {
            showError("Please wait for your partner to respond first.");
            return;
        }

        addMessageToUI(messageText, 'user');

        userMessageInput.value = '';
        userMessageInput.disabled = true;
        sendMessageButton.disabled = true;
        chatInputContainer.style.display = 'none';
        assessmentAreaDiv.style.display = 'none';

        // NEW: No typing indicator for human-human conversations (both roles)
        const indicatorDelay = isHumanPartner ? 0 : Math.random() * (7000 - 5000) + 5000;
        
        // Log to Railway only
        logToRailway({
            type: 'TYPING_INDICATOR_DEBUG',
            message: `Waiting ${(indicatorDelay/1000).toFixed(1)}s before showing typing indicator`,
            context: { delay_seconds: indicatorDelay/1000 }
        });
        
        setTimeout(() => {
            if (assessmentAreaDiv.style.display === 'none' && chatInputContainer.style.display === 'none' && !isHumanPartner) {
                // Start the typing animation (AI mode only)
                animateTypingIndicator(messageText.length);
                // Update timer message for State 1→2 transition (now waiting for AI response)
                updateTimerMessage();
            }
        }, indicatorDelay);

        try {
            // Use new retry logic that returns network delay and attempt count
            const { response, result, networkDelaySeconds, attempts } = await sendMessageWithRetry(messageText, indicatorDelay / 1000);

            // If we get here, the retry succeeded - hide typing indicator and process response
            typingIndicator.dataset.runId = String((Number(typingIndicator.dataset.runId) || 0) + 1);
            typingIndicator.style.display = 'none';

            // NEW: Check if this is a human partner conversation
            if (result.human_partner) {
                // Message routed to partner - now wait for their response
                waitingForPartner = true;
                currentTurn = result.turn;

                // Start polling for partner's response
                startPartnerResponsePolling();
                return; // Exit early - don't process AI response
            }

            // AI response (normal flow)
            addMessageToUI(result.ai_response, 'assistant');

            // NEW: Add backend retry time and attempts to totals
            const backendRetryData = result.backend_retry_metadata || { retry_attempts: 0, retry_time_seconds: 0 };
            const totalNetworkDelaySeconds = networkDelaySeconds + backendRetryData.retry_time_seconds;
            const totalAttempts = attempts + backendRetryData.retry_attempts;

            // Update the backend with TOTAL network delay data AND TOTAL send attempts using retry logic
            const updateResult = await updateNetworkDelayWithRetry(sessionId, result.turn, totalNetworkDelaySeconds, totalAttempts);
            
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

            // Reset tab visibility tracking for new turn
            cumulativeTabHiddenMs = 0;

            // --- MODIFIED: Binary choice + slider setup logic ---
            assessmentAreaDiv.style.display = 'block';
            chatInputContainer.style.display = 'none';
            assessmentAreaDiv.querySelector('h4').textContent = "Your Assessment";

            // Update timer message for State 2→3 transition (now rating phase)
            updateTimerMessage();

            // NEW: Show binary choice section, hide confidence section
            binaryChoiceSection.style.display = 'block';
            confidenceSection.style.display = 'none';
            // Ensure slider is interactable for the upcoming choice step
            confidenceSlider.disabled = false;

            // NEW: Reset binary choice tracking for new turn
            binaryChoice = null;
            binaryChoiceStartTime = Date.now(); // Start timing for binary choice
            binaryChoiceTime = null;
            binaryChoiceInProgress = false; // Reset double-click protection
            choiceHumanButton.disabled = false; // Re-enable buttons
            choiceAiButton.disabled = false;

            // Reset timing variables for this turn
            confidenceStartTime = null;
            sliderInteractionLog = [];

            // REMOVED: Old slider initialization logic - now handled by handleBinaryChoice()
            // Slider is no longer shown initially - binary choice comes first

            // Reset other UI elements
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

            // Hide typing indicator and reset UI
            typingIndicator.style.display = 'none';
            userMessageInput.disabled = false;
            sendMessageButton.disabled = false;
            chatInputContainer.style.display = 'flex';
            assessmentAreaDiv.style.display = 'none';

            // NEW: Show appropriate modal based on whether time expired
            if (timeExpired) {
                // Scenario 2: Timer expired - end study
                aiConnectionMessage.textContent = "The connection between you and your partner failed. Click below to complete the study.";
                aiConnectionButton.textContent = "Complete Study";
                aiConnectionButton.dataset.scenario = "end_study";

                logToRailway({
                    type: 'AI_CONNECTION_FAILURE_TIME_EXPIRED',
                    message: 'AI connection failed after timer expired - showing end study modal',
                    context: { timeExpired: true }
                });
            } else {
                // Scenario 1: Time remaining - allow retry
                aiConnectionMessage.textContent = "Looks like the connection between you and your partner isn't stable. Try sending your message again, please.";
                aiConnectionButton.textContent = "OK";
                aiConnectionButton.dataset.scenario = "retry";

                logToRailway({
                    type: 'AI_CONNECTION_FAILURE_CAN_RETRY',
                    message: 'AI connection failed with time remaining - showing retry modal',
                    context: { timeExpired: false }
                });
            }

            aiConnectionModal.style.display = 'flex';
        }
    }


    submitRatingButton.addEventListener('click', async () => {
        if (!sessionId) return;

        // NEW: Validate binary choice was made
        if (!binaryChoice) {
            logToRailway({
                type: 'SUBMIT_ERROR',
                message: 'Submit attempt without binary choice',
                context: { turn: currentTurn }
            });
            return; // Should not happen due to UI flow, but safety check
        }

        // NEW: For time expired, we no longer restrict confidence values
        // The binary choice (Human/AI) is the main decision, confidence is always 0-100%

        if (feelsOffCheckbox.checked && feelsOffCommentTextarea.value.trim() === '') {
            // SILENT: No participant-visible error - just prevent submission
            return;
        }

        ratingLoadingDiv.style.display = 'block';
        submitRatingButton.disabled = true;
        confidenceSlider.disabled = true;

        const confidencePercent = parseInt(confidenceSlider.value); // 0-100 scale
        const confidence = confidencePercent / 100; // Convert to 0-1 for backend compatibility
        lastConfidenceValue = confidencePercent; // NEW: Save the submitted value (0-100) for the next round

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
                // User touched slider: split into reading + active time
                readingTimeSeconds = (confidenceStartTime - baseMs) / 1000;
                activeDecisionTimeSeconds = (Date.now() - confidenceStartTime) / 1000;
            } else {
                // User never touched slider: all time is reading, zero active
                readingTimeSeconds = decisionTimeSeconds;
                activeDecisionTimeSeconds = 0;
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
            message: 'Submitting rating with binary choice and timing metrics',
            context: {
                binary_choice: binaryChoice,
                binary_choice_time_ms: binaryChoiceTime,
                confidence_percent: confidencePercent,
                confidence_normalized: confidence,
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
                    binary_choice: binaryChoice, // 'human' or 'ai'
                    binary_choice_time_ms: binaryChoiceTime, // Time taken to make binary choice
                    confidence: confidence, // 0-1 scale (converted from 0-100)
                    confidence_percent: confidencePercent, // 0-100 scale (original)
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
                    // NEW: Check if partner has dropped after rating submission
                    if (partnerDroppedFlag) {
                        logToRailway({
                            type: 'INTERROGATOR_FINISHED_RATING_AFTER_DROPOUT',
                            message: 'Interrogator finished rating after partner dropped - showing connection modal',
                            context: { role: currentRole }
                        });

                        // Hide rating UI
                        assessmentAreaDiv.style.display = 'none';

                        // Show connection issue modal
                        interrogatorConnectionModal.style.display = 'flex';

                    } else if (feelsOffCheckbox.checked && feelsOffCommentTextarea.value.trim() !== '') {
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

        // Validate that feedback is provided (mandatory)
        if (!commentText) {
            showError('Please provide feedback about the conversation before continuing.');
            return;
        }

        submitFeedbackButton.disabled = true;

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

        // Proceed to the final page
        showMainPhase('final');
        displayFinalPage(finalSummaryData);
    });

    // Skip button removed - feedback is now mandatory for interrogators

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
        referrer: document.referrer || null,
        isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
        screenWidth: screen.width,
        screenHeight: screen.height
    });

    // NEW: Tab visibility tracking
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            tabHiddenStartTime = Date.now();
            logUiEvent('tab_hidden', {
                turn: currentTurn,
                timestamp: tabHiddenStartTime
            });
        } else {
            if (tabHiddenStartTime) {
                const hiddenDuration = Date.now() - tabHiddenStartTime;
                cumulativeTabHiddenMs += hiddenDuration;
                logUiEvent('tab_visible', {
                    turn: currentTurn,
                    hidden_duration_ms: hiddenDuration,
                    cumulative_hidden_ms: cumulativeTabHiddenMs,
                    timestamp: Date.now()
                });
                tabHiddenStartTime = null;
            }
        }
    });

});
