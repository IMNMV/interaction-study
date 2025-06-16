// FILE: static/script.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Phase and High-Level Elements ---
    const API_BASE_URL = 'https://ai-turing-test-production.up.railway.app';
    const initialSetupDiv = document.getElementById('initial-setup');
    const chatInterfaceDiv = document.getElementById('chat-interface');
    const finalPageDiv = document.getElementById('final-page');
    const errorMessageArea = document.getElementById('error-message-area');

    // --- Initial Form Elements ---
    const initialForm = document.getElementById('initial-form');
    const initLoadingDiv = document.getElementById('init-loading');

    // --- Chat Interface Elements ---
    const messageList = document.getElementById('message-list');
    const userMessageInput = document.getElementById('user-message-input');
    const sendMessageButton = document.getElementById('send-message-button');
    const typingIndicator = document.getElementById('typing-indicator');
    const chatInputContainer = document.getElementById('chat-input-container');

    // --- Mid-Study Assessment Elements ---
    const assessmentAreaDiv = document.getElementById('assessment-area');
    const confidenceSlider = document.getElementById('confidence-slider');
    const confidenceValueSpan = document.getElementById('confidence-value');
    const submitRatingButton = document.getElementById('submit-rating-button');
    const ratingLoadingDiv = document.getElementById('rating-loading');
    const feelsOffCheckbox = document.getElementById('feels-off-checkbox');
    const commentInputArea = document.getElementById('comment-input-area');
    const feelsOffCommentTextarea = document.getElementById('feels-off-comment');
    const submitCommentButton = document.getElementById('submit-comment-button');
    const commentLoadingDiv = document.getElementById('comment-loading');

    // --- Final Page Elements ---
    const finalDecisionText = document.getElementById('final-decision-text');
    // New elements for the final feedback form
    const finalCommentForm = document.getElementById('final-comment-form');
    const finalCommentTextarea = document.getElementById('final-comment-textarea');
    const submitFinalCommentButton = document.getElementById('submit-final-comment-button');
    const finalCommentLoading = document.getElementById('final-comment-loading');
    const finalCommentThanks = document.getElementById('final-comment-thanks');

    // --- LIKERT BUBBLE HANDLERS FOR INITIAL FORM (UNCHANGED) ---
    const likertBubbles = document.querySelectorAll('.likert-bubble');
    likertBubbles.forEach(bubble => {
        bubble.addEventListener('click', (e) => {
            e.preventDefault();
            const groupName = bubble.dataset.name;
            const value = bubble.dataset.value; 

            document.querySelectorAll(`.likert-bubble[data-name="${groupName}"]`).forEach(b => {
                b.classList.remove('selected');
            });
            bubble.classList.add('selected');
            document.querySelector(`input[type="hidden"][name="${groupName}"]`).value = value;
        });
    });

    // --- Session State ---
    let sessionId = null;
    let currentTurn = 0;
    let aiResponseTimestamp = null;

    // --- SLIDER VALUE DISPLAY LOGIC FOR INITIAL FORM (UNCHANGED) ---
    const allSliders = document.querySelectorAll('#initial-form input[type="range"]');
    allSliders.forEach(slider => {
        const valueSpan = slider.nextElementSibling;
        if (valueSpan && valueSpan.classList.contains('slider-value')) {
            valueSpan.textContent = slider.value;
            slider.addEventListener('input', () => {
                valueSpan.textContent = slider.value;
            });
        }
    });

    // --- Helper Functions (UNCHANGED) ---
    function showError(message) {
        errorMessageArea.textContent = message;
        errorMessageArea.style.display = 'block';
        setTimeout(() => {
            errorMessageArea.style.display = 'none';
        }, 5000);
    }

    function showMainPhase(phase) {
        console.log(`Showing main phase: ${phase}`);
        initialSetupDiv.style.display = 'none';
        chatInterfaceDiv.style.display = 'none';
        finalPageDiv.style.display = 'none';
        if (phase === 'initial') initialSetupDiv.style.display = 'block';
        else if (phase === 'chat_and_assessment_flow') chatInterfaceDiv.style.display = 'block';
        else if (phase === 'final') finalPageDiv.style.display = 'block';
    }

    function addMessageToUI(text, sender) {
        const messageBubble = document.createElement('div');
        messageBubble.classList.add('message-bubble', sender);
        messageBubble.textContent = text;
        messageList.appendChild(messageBubble);
        messageList.scrollTop = messageList.scrollHeight;
        console.log(`Added message from ${sender}. messageList.childElementCount: ${messageList.childElementCount}`);
    }

    // --- Event Listeners ---
    initialForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        initLoadingDiv.style.display = 'block';
        initialForm.querySelector('button').disabled = true;

        const formData = new FormData(initialForm); 
        
        const requiredLikerts = ['ai_detection_confidence_self', 'ai_detection_confidence_others', 'ai_capabilities_rating', 'trust_in_ai'];
        for (const field of requiredLikerts) {
            //if (!formData.get(field)) {
            if (!formData.get(field) || formData.get(field) === '') {
                showError(`Please select a value for all rating questions.`);
                initLoadingDiv.style.display = 'none';
                initialForm.querySelector('button').disabled = false;
                return;
            }
        }
        
        const ai_models_used = formData.getAll('ai_models_used');
        const ethnicity = formData.getAll('ethnicity');
        
        const data = {
            ai_usage_frequency: parseInt(formData.get('ai_usage_frequency')),
            ai_models_used: ai_models_used,
            ai_detection_confidence_self: parseInt(formData.get('ai_detection_confidence_self')),
            ai_detection_confidence_others: parseInt(formData.get('ai_detection_confidence_others')),
            ai_capabilities_rating: parseInt(formData.get('ai_capabilities_rating')),
            trust_in_ai: parseInt(formData.get('trust_in_ai')),
            age: parseInt(formData.get('age')),
            gender: formData.get('gender'),
            education: formData.get('education'),
            ethnicity: ethnicity,
            income: formData.get('income')
        };

        try {
            const response = await fetch(`${API_BASE_URL}/initialize_study`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (response.ok) {
                sessionId = result.session_id;
                // Keep session ID in case of accidental refresh during study
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

    async function handleSendMessage() {
        const messageText = userMessageInput.value.trim();
        if (!messageText || !sessionId) return;

        addMessageToUI(messageText, 'user');
        userMessageInput.value = '';
        userMessageInput.disabled = true;
        sendMessageButton.disabled = true;
        chatInputContainer.style.display = 'none';
        assessmentAreaDiv.style.display = 'none';

        // ADVANCED TYPING INDICATOR DELAY (UNCHANGED)
        const indicatorDelay = Math.random() * (5000 - 2000) + 2000;
        console.log(`Setting timeout to show typing indicator in ${indicatorDelay / 1000} seconds.`);
        setTimeout(() => {
            if (assessmentAreaDiv.style.display === 'none' && chatInputContainer.style.display === 'none') {
                 typingIndicator.style.display = 'block';
                 console.log("Typing indicator shown after delay.");
            }
        }, indicatorDelay);

        console.log('Sending message to server:', { session_id: sessionId, message: messageText });

        try {
            const response = await fetch(`${API_BASE_URL}/send_message`, {
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

    sendMessageButton.addEventListener('click', handleSendMessage);
    userMessageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSendMessage(); });
    confidenceSlider.addEventListener('input', () => {
            let value = parseFloat(confidenceSlider.value);
            
            // NEW: Enforce the 5-turn minimum before allowing a final decision
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
        let decisionTimeSeconds = aiResponseTimestamp ? (new Date().getTime() / 1000) - aiResponseTimestamp : null;

        try {
            const response = await fetch('${API_BASE_URL}/submit_rating', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId, confidence, decision_time_seconds }),
            });
            const result = await response.json();
            console.log('Rating submission response from server:', result);

            if (response.ok) {
                if (result.study_over) {
                    localStorage.removeItem('sessionId'); // Clean up session on study completion
                    showMainPhase('final');
                    // MODIFIED to call the new simpler function
                    displayFinalPage(result); 
                } else {
                    if (feelsOffCheckbox.checked && feelsOffCommentTextarea.value.trim() !== '') {
                        submitCommentButton.click(); // Fire-and-forget mid-study comment
                    }
                    assessmentAreaDiv.style.display = 'none';
                    chatInputContainer.style.display = 'flex';
                    userMessageInput.disabled = false;
                    sendMessageButton.disabled = false;
                    userMessageInput.focus();
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
        if (!sessionId) return;
        if (!feelsOffCheckbox.checked) return;
        const commentText = feelsOffCommentTextarea.value.trim();
        if (commentText === '') return;

        commentLoadingDiv.style.display = 'block';
        submitCommentButton.disabled = true;
        feelsOffCheckbox.disabled = true;

        try {
            await fetch('${API_BASE_URL}/submit_comment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId, comment: commentText }),
            });
            console.log("Mid-study comment submitted successfully.");
            feelsOffCommentTextarea.value = '';
            feelsOffCheckbox.checked = false;
            commentInputArea.style.display = 'none';
        } catch (error) {
            showError('Error submitting comment: ' + error.message);
            console.error('Catch block error in submitCommentButton:', error);
        } finally {
            commentLoadingDiv.style.display = 'none';
            submitCommentButton.disabled = false;
            feelsOffCheckbox.disabled = false;
        }
    });

    feelsOffCheckbox.addEventListener('change', () => {
        commentInputArea.style.display = feelsOffCheckbox.checked ? 'block' : 'none';
    });

    // REPLACED function to be simpler for production
    function displayFinalPage(summary) {
        finalDecisionText.textContent = `You determined that you were ${summary.ai_detected ? 'talking to an AI' : 'talking to a human'}.`;
    }

    // NEW event listener for the final comment form
    finalCommentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const commentText = finalCommentTextarea.value.trim();
        if (!commentText || !sessionId) return;

        finalCommentLoading.style.display = 'block';
        submitFinalCommentButton.disabled = true;
        finalCommentTextarea.disabled = true;

        try {
            const response = await fetch('${API_BASE_URL}/submit_final_comment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId, comment: commentText }),
            });
            if (response.ok) {
                finalCommentThanks.style.display = 'block';
            } else {
                const result = await response.json();
                showError(result.detail || 'Failed to submit final feedback.');
                submitFinalCommentButton.disabled = false;
                finalCommentTextarea.disabled = false;
            }
        } catch (error) {
            showError('Error submitting final feedback: ' + error.message);
            submitFinalCommentButton.disabled = false;
            finalCommentTextarea.disabled = false;
        } finally {
            finalCommentLoading.style.display = 'none';
        }
    });

    // --- Initial Page Load ---
sessionId = localStorage.getItem('sessionId');
if (sessionId) {
    // A session ID exists, which means the user has refreshed the page mid-study.
    // This invalidates their session.
    console.error("Stale session detected on page load. Terminating and redirecting.");
    // First, clear the invalid session from storage to prevent a refresh loop.
    localStorage.removeItem('sessionId');
    
    // TODO: Replace the URL below with Prolific error/completion URL when ready.
    // For now, redirecting to the home page to start over.
    window.location.href = '/'; 
} else {
    // No session ID found, this is a new user. Start the initial setup.
    showMainPhase('initial');
}
});