# Checkpoint Submission Flow - Integration Test Guide

## Overview

This document details the complete flow from checkpoint display through submission, backend analysis, and return to normal learning flow.

---

## Test Scenario 1: Checkpoint Photo Submission

### Prerequisites
- Aurora session active with status = `'active'`
- Backend sends checkpoint with `checkpoint_type: 'photo'`
- User has taken a photo or selected one from gallery

### Expected Flow

#### Step 1: Checkpoint Card Displays
```
Session Status: 'active'
aiTurn contains:
{
  "narration": "Now let's apply what you learned...",
  "checkpoint": {
    "required": true,
    "checkpoint_type": "photo",
    "instructions": "Take a photo of your answer showing the steps"
  },
  "comprehension_check": null
}

auroraDisplayState computes:
{
  mode: 'active',
  showNarration: true,
  showQuestion: false,      // No question
  showCheckpoint: true,     // Checkpoint present
  showSuggestions: false    // Suggestions hidden while checkpoint active
}

Display: ✅ Narration + ✅ Checkpoint card (with "Take Photo" or "Choose from Gallery" button)
```

#### Step 2: User Submits Photo
```
User clicks "Submit" on checkpoint card
Frontend calls:
POST /api/ai-tutor/sessions/{sessionId}/checkpoint
{
  checkpoint_type: 'photo',
  file_uri: 'file:///path/to/image.jpg',
  file_name: 'IMG_20250423_123456.jpg',
  mime_type: 'image/jpeg',
  notes?: 'Optional notes from learner'
}

Response:
{
  checkpoint_id: 12345,
  status: 'PROCESSING',
  ai_feedback?: { ... }
}
```

#### Step 3: Backend Analyzes Photo
```
Backend:
1. Receives file upload
2. Extracts image content
3. Sends to Gemini with checkpoint criteria
4. Receives analysis feedback
5. Updates aiTutorCheckpoint table
6. Decides: Accept or Ask for resubmission

Time: 2-5 seconds typically
```

#### Step 4: Session Status Changes
```
Frontend receives new session snapshot via polling/subscription:

Old: status = 'active'
New: status = 'awaiting_checkpoint'  ← Backend analyzing

auroraDisplayState recomputes:
{
  mode: 'awaiting_checkpoint',
  showNarration: true,
  showQuestion: false,
  showCheckpoint: true,    // Still show checkpoint
  showSuggestions: false
}

Display: ✅ Narration + ✅ Checkpoint card (now shows "Analyzing..." or submission status)
```

#### Step 5: Analysis Complete - Accepted
```
Backend sends new TutorTurn with feedback:

{
  "turn_id": "turn_456",
  "narration": "Great work! Your photo shows excellent understanding. Let me explain the next concept...",
  "checkpoint": null,          // No more checkpoint
  "comprehension_check": null,
  "follow_up_prompts": ["Tell me more", "Show an example"]
}

Session status: 'active' (back to normal)

auroraDisplayState recomputes:
{
  mode: 'active',
  showNarration: true,
  showQuestion: false,
  showCheckpoint: false,   // Checkpoint complete, hidden
  showSuggestions: true    // Now show suggestions
}

Display: ✅ Narration + ✅ Suggestion buttons
```

---

## Test Scenario 2: Checkpoint Reflection (Text)

### Flow
```
1. Backend sends checkpoint with checkpoint_type: 'reflection'
   → Display checkpoint with text input field

2. User types response and submits
   → POST /api/ai-tutor/sessions/{id}/checkpoint
      { checkpoint_type: 'reflection', notes: 'My response...' }

3. Status → 'awaiting_checkpoint'
   → Checkpoint card shows "Analyzing your response..."

4. Backend analyzes text with Gemini
   → Updates checkpoint record with feedback

5. Status → 'active'
   → New TutorTurn received with feedback + next content
   → auroraDisplayState recomputes
   → Display progresses to next segment
```

---

## Test Scenario 3: Resubmission Required

### Flow
```
1. User submits checkpoint

2. Status → 'awaiting_checkpoint'
   → Backend analyzes

3. Analysis shows: needs_review = true
   → User needs to resubmit

4. Backend sends TutorTurn with:
   {
     "narration": "Good effort! I notice you need to include the diagram...",
     "checkpoint": {
       "required": true,
       "checkpoint_type": "photo",
       "instructions": "Please resubmit, including the diagram this time"
     }
   }

5. Status → 'active' (back to learning mode)

6. auroraDisplayState shows checkpoint again
   → User can resubmit

Display: ✅ Narration (with feedback) + ✅ Checkpoint card (resubmit prompt)
```

---

## Test Scenario 4: No Checkpoint Needed

### Flow
```
1. Backend sends content without checkpoint:
   {
     "narration": "Here's another concept...",
     "comprehension_check": null,
     "checkpoint": null,
     "follow_up_prompts": ["More detail", "Example"]
   }

2. auroraDisplayState:
   {
     showNarration: true,
     showQuestion: false,
     showCheckpoint: false,
     showSuggestions: true
   }

3. Display: ✅ Narration + ✅ Suggestion buttons
   → No checkpoint shown at all
```

---

## Manual Testing Steps

### Test 1: Basic Checkpoint Display

```
1. Open Aurora session for any course/lesson
2. Complete first narration
3. Observe: Does narration show with suggestion buttons?
   ✓ YES - Continue
   ✗ NO - Check console for errors

4. Wait for or trigger next turn
5. Observe: Does checkpoint card appear with instructions?
   ✓ YES - Continue
   ✗ NO - Check auroraDisplayState in console:
           console.log(airoraDisplayState)
           Should have showCheckpoint: true

6. Verify suggestion buttons hide when checkpoint shows
   ✓ YES - Correct behavior
   ✗ NO - showSuggestions might not be false
```

### Test 2: Photo Checkpoint Submission

```
1. Display checkpoint card with checkpoint_type: 'photo'
2. Click "Take Photo" or "Choose from Gallery"
3. Select/capture image
4. Click "Submit"
5. Observe: Does checkpoint card update to show "Analyzing..."?
   ✓ YES - Good
   ✗ NO - Check network tab for POST request

6. Wait 2-5 seconds for backend analysis
7. Observe: Does narration update with feedback?
   ✓ YES - Analysis complete
   ✗ NO - Check backend logs

8. Observe: Does checkpoint card hide?
   ✓ YES - Status changed correctly
   ✗ NO - Frontend might not be polling/listening for status updates
```

### Test 3: Question Flow Before Checkpoint

```
1. Narration displays
2. Next turn arrives with comprehension_check
3. Observe: Does question card appear?
   ✓ YES - Continue
   ✗ NO - Check showQuestion flag

4. Observe: Do suggestion buttons hide?
   ✓ YES - Correct
   ✗ NO - showSuggestions should be false

5. Answer question or send text
6. Next turn arrives with checkpoint
7. Observe: Does checkpoint card appear (not question)?
   ✓ YES - Correct progression
   ✗ NO - showCheckpoint should be true
```

---

## Debugging Commands

### In Chrome DevTools Console

```javascript
// Check current session snapshot
console.log(aiSessionSnapshot);
// Should show status: 'active' | 'awaiting_checkpoint' | 'completed'

// Check current display state
console.log(auroraDisplayState);
// Should show { mode: '...', showNarration: ..., showQuestion: ..., showCheckpoint: ..., showSuggestions: ... }

// Check current turn data
console.log(aiTurn);
// Should show { narration, comprehension_check?, checkpoint?, follow_up_prompts }

// Check if checkpoint data exists
console.log(aiTurn?.checkpoint);
// If null/undefined → showCheckpoint should be false
// If exists → showCheckpoint should be true (when not showing question)

// Monitor status changes
setInterval(() => {
    console.log('Status:', aiSessionSnapshot?.status, 'Show Checkpoint:', auroraDisplayState?.showCheckpoint);
}, 1000);
```

### Network Tab Monitoring

```
1. Open DevTools → Network tab
2. Submit checkpoint
3. Should see POST request to /checkpoint
4. Response should show: checkpoint_id, status

Successful:
{
  "checkpoint_id": 12345,
  "status": "PROCESSING" or "COMPLETED"
}

Error:
{
  "detail": "Error uploading file" or similar
}
```

---

## Common Issues and Fixes

### Issue: Checkpoint doesn't display even though backend sent it

**Debug**:
```javascript
console.log({
  aiTurnHasCheckpoint: !!aiTurn?.checkpoint,
  checkpointRequired: aiTurn?.checkpoint?.required,
  showCheckpointFlag: auroraDisplayState?.showCheckpoint,
  status: aiSessionSnapshot?.status,
});
```

**Possible Causes**:
1. `aiTurn.checkpoint` is null → Backend didn't send checkpoint
2. `showCheckpoint` is false → Logic in useMemo is wrong
3. `status !== 'active'` → Session in wrong state

---

### Issue: Suggestion buttons show while checkpoint visible

**Debug**:
```javascript
console.log({
  hasCheckpoint: !!aiTurn?.checkpoint,
  hasQuestion: !!aiTurn?.comprehension_check,
  showSuggestions: auroraDisplayState?.showSuggestions,
});
```

**Should be**: If checkpoint or question exists, `showSuggestions` must be false

---

### Issue: Checkpoint doesn't hide after submission

**Debug**:
```javascript
console.log({
  statusBefore: 'active',
  statusAfter: aiSessionSnapshot?.status,
  checkpointSubmitted: true,
});
```

**Possible Causes**:
1. Frontend not polling/listening for status updates
2. Backend not changing status to 'awaiting_checkpoint'
3. useMemo not recomputing

---

## Test Results Template

### Test Run Date: ___________

| Test | Expected | Actual | Pass/Fail | Notes |
|------|----------|--------|-----------|-------|
| Narration displays | Text + Buttons | | | |
| Checkpoint card shows | Checkpoint instructions | | | |
| Suggestions hide on checkpoint | Hidden | | | |
| Photo upload works | Form shows photo picker | | | |
| Submit sends POST | Network request visible | | | |
| Status changes to awaiting | 'awaiting_checkpoint' | | | |
| Analysis completes | New narration + feedback | | | |
| Checkpoint hides after | Checkpoint hidden | | | |
| Question flow works | Question card shows | | | |
| Question hides checkpoint | Checkpoint not shown | | | |
| Resubmission prompt works | Can resubmit checkpoint | | | |

---

## Success Criteria

✅ **Checkpoint Submission Test PASSED if**:
1. Checkpoint card displays with correct instructions
2. Photo upload form appears and accepts selection
3. Submit button sends POST request to correct endpoint
4. Backend receives file and analyzes
5. Status changes to 'awaiting_checkpoint' during analysis
6. Feedback displays in narration after analysis
7. Checkpoint card hides after acceptance
8. User can proceed to next segment

✅ **Progressive Disclosure Test PASSED if**:
1. Narration shows first
2. Question shows (when present) hiding suggestions
3. Checkpoint shows (when present) hiding suggestions and questions
4. Only one "phase" shows at a time
5. Transitions happen smoothly without flickering

---

## Next Actions After Testing

- [ ] Document any issues found
- [ ] Create bug reports for failures
- [ ] Adjust logic if needed
- [ ] Test on different devices
- [ ] Verify network handling (slow/offline)
- [ ] Monitor performance (re-render frequency)

