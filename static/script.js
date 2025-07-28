// FILE: static/script.js
// This is the corrected version with ONLY the requested slider changes added.
// All original console.log statements have been preserved.

document.addEventListener('DOMContentLoaded', () => {
    const initialSetupDiv = document.getElementById('initial-setup');
    const chatInterfaceDiv = document.getElementById('chat-interface'); // Main div for chat + assessment
    const assessmentAreaDiv = document.getElementById('assessment-area'); // Now inside chatInterfaceDiv
    const finalPageDiv = document.getElementById('final-page');
    const errorMessageArea = document.getElementById('error-message-area');

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
    const downloadDebriefButton = document.getElementById('download-debrief-button');
    const mainContainer = document.querySelector('.container'); // For the disagree message
    

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

    let sessionId = null; // Changed from localStorage.getItem('sessionId') to ensure clean start
    let currentTurn = 0;
    let aiResponseTimestamp = null;

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

    function showMainPhase(phase) {
        console.log(`Showing main phase: ${phase}`);
        // Hide all phases first
        consentPhaseDiv.style.display = 'none';
        initialSetupDiv.style.display = 'none';
        chatInterfaceDiv.style.display = 'none';
        finalPageDiv.style.display = 'none';

        if (phase === 'consent') consentPhaseDiv.style.display = 'block';
        else if (phase === 'initial') initialSetupDiv.style.display = 'block';
        else if (phase === 'chat_and_assessment_flow') chatInterfaceDiv.style.display = 'block';
        else if (phase === 'final') finalPageDiv.style.display = 'block';
    }

    function showMainPhase(phase) {
        console.log(`Showing main phase: ${phase}`);
        // Hide all phases first
        consentPhaseDiv.style.display = 'none';
        initialSetupDiv.style.display = 'none';
        chatInterfaceDiv.style.display = 'none';
        finalPageDiv.style.display = 'none';

        if (phase === 'consent') consentPhaseDiv.style.display = 'block';
        else if (phase === 'initial') initialSetupDiv.style.display = 'block';
        else if (phase === 'chat_and_assessment_flow') chatInterfaceDiv.style.display = 'block';
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
            // This line gets the jsPDF object from the window, where the script tag made it available.
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Set font size for readability
            doc.setFontSize(12);

            // jsPDF's splitTextToSize is crucial for wrapping long text.
            // The second argument is the max width of a line in mm.
            const lines = doc.splitTextToSize(content, 180); 
            
            // Add the text lines to the PDF.
            doc.text(lines, 10, 10);
            
            // Trigger the download.
            doc.save(filename);
            console.log(`PDF "${filename}" download initiated.`);

        } catch (error) {
            console.error('Error creating PDF:', error);
            showError('There was a problem generating the PDF download. Please contact the researcher.');
        }
    }

    // --- NEW: Consent Logic ---
    agreeButton.addEventListener('click', () => {
        // When user agrees, hide the main text and buttons, and show the download prompt.
        consentContentDiv.style.display = 'none';
        consentActionsDiv.style.display = 'none';
        consentDownloadPromptDiv.style.display = 'block';
    });

    disagreeButton.addEventListener('click', () => {
        // If user disagrees, end the study.
        mainContainer.innerHTML = `
            <h2>Study Ended</h2>
            <p>You must consent to participate in this study. If this was a mistake, please refresh the page to start over.</p>
        `;
    });

    skipConsentDownloadButton.addEventListener('click', () => {
        // If they skip download, just move to the next phase.
        showMainPhase('initial');
    });

    downloadConsentButton.addEventListener('click', () => {
        // If they want to download, generate the PDF and then move to the next phase.
        const consentText = `
CONSENT TO PARTICIPATE IN RESEARCH
Title of Study: Interaction Study
Participant ID: ${participantId}

[CONSENT RECORDED: Participant agreed to participate on ${new Date().toLocaleString()}]

Purpose of Research
This research examines how people make judgments and interact in conversational settings. We are interested in understanding the dynamics of human-AI interaction.

What You Will Be Asked to Do
- Answer some initial questions about your background and experiences.
- Engage in a text-based conversation.
- Make judgments about the conversation after each turn.
- The total time commitment will be approximately 15-20 minutes.

Your Rights as a Participant
- Your participation is voluntary. You may stop at any time.
- You may choose not to answer any question.
- You may not be told everything about the purpose of this research study initially, but you will be fully informed after completion.

Risks and Benefits
- There are no known risks associated with participating in this study beyond those of everyday computer use.
- While there are no direct benefits to you, your participation helps advance our understanding of human-computer interaction.

Confidentiality
Your responses will be stored securely and anonymized. The data will be analyzed without any personal identifying information. Only researchers on this project will have access to the data.

Agreement to Participate
By agreeing, you indicate that you are at least 18 years old, have read and understood this consent form, and voluntarily agree to participate.

[PARTICIPANT ACCEPTED THE ABOVE TERMS ON ${new Date().toLocaleString()}]
        `;
        
        generateAndDownloadPdf(consentText, `Consent_Form_${participantId}.pdf`);
        
        // Move to the next phase after starting the download.
        showMainPhase('initial');
    });

    // --- NEW: Debrief Download Logic ---
    downloadDebriefButton.addEventListener('click', () => {
        // Note: The `sessionId` variable should be populated by this point from the server.
        const debriefText = `
STUDY DEBRIEF FORM
Date: ${new Date().toLocaleString()}
Session ID: ${sessionId || 'N/A'}

Purpose of the Research
This study examines "psychological tactics" in human-AI interaction. We are investigating whether an AI can appear more human-like by using specific conversational strategies, such as mimicking user behavior, using humor, or expressing mild opinions.

Why We Did Not Tell You Everything Initially
To get a natural assessment of your interaction, we could not tell you beforehand that the AI might be using specific tactics. Knowing this could have biased your judgments and conversation style. You were correctly told your task was to determine if you were talking to an AI or a human.

The Complete Picture
You were randomly assigned to interact with an AI using one of two personas: a "control" persona with neutral responses, or an "experimental" persona that actively used psychological tactics based on your initial survey answers and the flow of the conversation. By comparing confidence ratings and final decisions between these groups, we can understand which strategies, if any, make an AI more convincing.

Use of Your Data
If you are comfortable with us using your anonymized responses now that you know the full purpose of the study, you don't need to do anything. If you would prefer that we not use your responses, please contact the research team and we will delete your data.

Thank you again for your participation!
        `;
        
        generateAndDownloadPdf(debriefText, `Debrief_Form_${sessionId || participantId}.pdf`);
    });

    // --- Event Listeners ---
    initialForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        initLoadingDiv.style.display = 'block';
        initialForm.querySelector('button').disabled = true;

        const formData = new FormData(initialForm); 
        
        // Validate that all Likert scales have been selected
        const requiredLikerts = ['ai_detection_confidence_self', 'ai_detection_confidence_others', 'ai_capabilities_rating', 'trust_in_ai'];
        for (const field of requiredLikerts) {
            if (!formData.get(field)) {
                showError(`Please select a value for all rating questions.`);
                initLoadingDiv.style.display = 'none';
                initialForm.querySelector('button').disabled = false;
                return;
            }
        }
        
        const ai_models_used = formData.getAll('ai_models_used');
        const ethnicity = formData.getAll('ethnicity');
        
        const data = {
            // AI Experience
            ai_usage_frequency: parseInt(formData.get('ai_usage_frequency')),
            ai_models_used: ai_models_used,
            ai_detection_confidence_self: parseInt(formData.get('ai_detection_confidence_self')),
            ai_detection_confidence_others: parseInt(formData.get('ai_detection_confidence_others')),
            ai_capabilities_rating: parseInt(formData.get('ai_capabilities_rating')),
            
            // Original questions
            trust_in_ai: parseInt(formData.get('trust_in_ai')),
            
            // Demographics
            age: parseInt(formData.get('age')),
            gender: formData.get('gender'),
            education: formData.get('education'),
            ethnicity: ethnicity,
            income: formData.get('income')
        };

        try {
            const response = await fetch('/initialize_study', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (response.ok) {
                sessionId = result.session_id;
                localStorage.setItem('sessionId', sessionId);
                currentTurn = 0;
                messageList.innerHTML = '';
                showMainPhase('chat_and_assessment_flow');
                assessmentAreaDiv.style.display = 'none';
                chatInputContainer.style.display = 'flex';
                userMessageInput.disabled = false;
                sendMessageButton.disabled = false;
                userMessageInput.focus();
            } else {
                showError(result.detail || 'Failed to initialize study.');
            }
        } catch (error) {
            showError('Error initializing study: ' + error.message);
        } finally {
            initLoadingDiv.style.display = 'none';
            initialForm.querySelector('button').disabled = false;
        }
    });

    sendMessageButton.addEventListener('click', handleSendMessage);
    userMessageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSendMessage();
        }
    });

    // MODIFIED event listener for confidence slider to add clamping logic
    confidenceSlider.addEventListener('input', () => {
        let value = parseFloat(confidenceSlider.value);
        
        // Enforce the 5-turn minimum before allowing a final decision
        if (currentTurn < 5) {
            if (value === 0.0) {
                value = 0.01; // Clamp the lower bound
                confidenceSlider.value = value;
            } else if (value === 1.0) {
                value = 0.99; // Clamp the upper bound
                confidenceSlider.value = value;
            }
        }
        
        confidenceValueSpan.textContent = value.toFixed(2);
    });

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
        console.log(`Setting timeout to show typing indicator in ${indicatorDelay / 1000} seconds.`);
        setTimeout(() => {
            if (assessmentAreaDiv.style.display === 'none' && chatInputContainer.style.display === 'none') {
                 typingIndicator.style.display = 'flex'; // <<< CORRECTED VALUE
                 console.log("Typing indicator shown after delay.");
                 scrollToBottom();
        
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

            typingIndicator.style.display = 'none';

            if (response.ok) {
                addMessageToUI(result.ai_response, 'assistant');
                currentTurn = result.turn;
                aiResponseTimestamp = result.timestamp;
                assessmentAreaDiv.style.display = 'block';
                chatInputContainer.style.display = 'none'; 
                assessmentAreaDiv.querySelector('h4').textContent = "Your Assessment";
                confidenceSlider.value = 0.5;
                confidenceValueSpan.textContent = '0.50';
                confidenceSlider.disabled = false;
                submitRatingButton.style.display = 'block';
                submitRatingButton.disabled = false;
                feelsOffCheckbox.checked = false;
                commentInputArea.style.display = 'none';
                feelsOffCommentTextarea.value = '';
                messageList.scrollTop = messageList.scrollHeight;
            } else {
                showError(result.detail || 'Failed to send message or get AI response.');
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

        if (feelsOffCheckbox.checked && feelsOffCommentTextarea.value.trim() === '') {
            showError("Please provide a comment if 'Include a comment' is checked, or uncheck the box to proceed with rating only.");
            return;
        }

        ratingLoadingDiv.style.display = 'block';
        submitRatingButton.disabled = true;
        confidenceSlider.disabled = true;

        const confidence = parseFloat(confidenceSlider.value);
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
                    showMainPhase('final');
                    displayFinalPage(result.session_data_summary);
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
                showError(result.detail || 'Failed to submit rating.');
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
                showError(result.detail || 'Failed to submit comment. Please try again.');
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
    }

    newSessionButton.addEventListener('click', () => {
        localStorage.removeItem('sessionId');
        sessionId = null;
        currentTurn = 0;
        aiResponseTimestamp = null;
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

});
