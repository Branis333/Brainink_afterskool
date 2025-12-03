# Aurora Frontend State Machine Implementation

## Architecture

The frontend now implements a **state machine** that mirrors the backend's session status. Instead of displaying all elements at once, Aurora now shows different content based on the backend's current session state.

```
Backend Session Status ←→ Frontend Display Mode ←→ UI Rendering
```

---

## State Machine Modes

### Mode 1: IDLE
- Backend session hasn't started
- **Display**: Nothing (Aurora panel closed or loading)
- **Trigger**: User hasn't enabled Aurora or session initialization in progress

### Mode 2: IN_PROGRESS

Backend Status: `IN_PROGRESS`

**Possible Sub-Scenarios**:

#### A. Narration Only
```
{
  "narration": "Let's explore...",
  "comprehension_check": null,
  "checkpoint": null,
  "follow_up_prompts": [...]
}
```
**Displays**:
- ✅ Narration (explanation text)
- ✅ Follow-up prompts (suggestion buttons)
- ❌ Question
- ❌ Checkpoint

---

#### B. Narration + Comprehension Check
```
{
  "narration": "Here's the concept...",
  "comprehension_check": "Can you define this?",
  "checkpoint": null,
  "follow_up_prompts": [...]
}
```
**Displays**:
- ✅ Narration
- ✅ Question (💭 Card)
- ❌ Checkpoint (hidden until question answered)
- ❌ Suggestions (hidden while question showing)

---

#### C. Narration + Checkpoint
```
{
  "narration": "Now let's do an activity...",
  "comprehension_check": null,
  "checkpoint": {
    "required": true,
    "checkpoint_type": "reflection",
    "instructions": "Write about what you learned...",
    "criteria": [...]
  },
  "follow_up_prompts": [...]
}
```
**Displays**:
- ✅ Narration
- ✅ Checkpoint (✓ Card with instructions)
- ❌ Question
- ❌ Suggestions (hidden while checkpoint active)

---

### Mode 3: AWAITING_CHECKPOINT

Backend Status: `AWAITING_CHECKPOINT`

Session is paused, waiting for user to submit checkpoint work.

```
{
  "narration": "Great! Now submit your work...",
  "checkpoint": {
    "required": true,
    "checkpoint_type": "photo",
    "instructions": "Take a photo of your answer...",
    "criteria": [...]
  },
  "comprehension_check": null,
  "follow_up_prompts": []
}
```

**Displays**:
- ✅ Narration
- ✅ Checkpoint card (with upload/submit UI)
- ❌ Question
- ❌ Suggestions (completely hidden)

**User Action**: Submits checkpoint work → Backend analyzes → Returns to IN_PROGRESS with next segment

---

### Mode 4: COMPLETED

Backend Status: `COMPLETED`

Session is finished.

**Displays**:
- ✅ Completion message
- ❌ Everything else

---

## Implementation Code

### 1. Compute Display State (StudySessionScreen.tsx)

```typescript
const auroraDisplayState = useMemo(() => {
    if (!aiSessionSnapshot) {
        return { 
            mode: 'idle' as const, 
            showNarration: false, 
            showQuestion: false, 
            showCheckpoint: false, 
            showSuggestions: false 
        };
    }

    const status = aiSessionSnapshot.status;

    // AWAITING_CHECKPOINT: Show checkpoint only
    if (status === 'AWAITING_CHECKPOINT') {
        return {
            mode: 'awaiting_checkpoint' as const,
            showNarration: true,
            showQuestion: false,
            showCheckpoint: true,
            showSuggestions: false,
            checkpointData: aiTurn?.checkpoint || null,
        };
    }

    // IN_PROGRESS: Conditional display based on what's in the turn
    if (status === 'IN_PROGRESS') {
        const hasQuestion = !!aiTurn?.comprehension_check;
        const hasCheckpoint = aiTurn?.checkpoint && aiTurn.checkpoint.required;

        return {
            mode: 'in_progress' as const,
            showNarration: true,
            showQuestion: hasQuestion,
            showCheckpoint: hasCheckpoint && !hasQuestion,  // After question
            showSuggestions: !hasCheckpoint && !hasQuestion,  // Only if no checkpoint/question
            questionText: aiTurn?.comprehension_check || null,
            checkpointData: hasCheckpoint ? aiTurn?.checkpoint : null,
        };
    }

    // COMPLETED
    if (status === 'COMPLETED') {
        return {
            mode: 'completed' as const,
            showNarration: false,
            showQuestion: false,
            showCheckpoint: false,
            showSuggestions: false,
        };
    }

    return { mode: 'idle' as const, showNarration: false, ... };
}, [aiSessionSnapshot, aiTurn]);
```

### 2. Pass Display State to Aurora Component

```typescript
<AuroraGuide
    // Pass content conditionally based on display state
    message={auroraDisplayState.showNarration ? auroraMessage : undefined}
    comprehensionCheck={auroraDisplayState.showQuestion ? aiTurn?.comprehension_check : undefined}
    checkpoint={auroraDisplayState.showCheckpoint ? aiTurn?.checkpoint : undefined}
    suggestions={auroraDisplayState.showSuggestions ? auroraSuggestions : undefined}
    // ... other props
/>
```

### 3. AuroraGuide Rendering

```typescript
{message ? (
    <Text style={styles.panelMessage}>{message}</Text>
) : null}

{comprehensionCheck ? (
    <View style={styles.checkCard}>
        <Text style={styles.checkCardTitle}>💭 Question for you:</Text>
        <Text style={styles.checkCardText}>{comprehensionCheck}</Text>
    </View>
) : null}

{checkpoint && checkpoint.instructions ? (
    <View style={styles.checkpointCard}>
        <Text style={styles.checkpointTitle}>✓ Checkpoint:</Text>
        <Text style={styles.checkpointText}>{checkpoint.instructions}</Text>
    </View>
) : null}

{status !== 'loading' && Array.isArray(suggestions) && suggestions.length > 0 ? (
    <View style={styles.panelSuggestions}>
        {suggestions.map((suggestion) => (
            <TouchableOpacity onPress={() => onSuggestionPress?.(suggestion)}>
                <Text>{suggestion}</Text>
            </TouchableOpacity>
        ))}
    </View>
) : null}
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────┐
│ Backend API Response (TutorTurn)    │
│ {narration, comprehension_check,    │
│  checkpoint, follow_up_prompts}     │
└────────────────┬────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│ StudySessionScreen                   │
│ • Receives TutorTurn in aiTurn state │
│ • Gets session status from           │
│   aiSessionSnapshot.status           │
└────────────────┬────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│ auroraDisplayState useMemo           │
│ Computes what to show based on:      │
│ - sessionStatus                      │
│ - aiTurn.comprehension_check exists? │
│ - aiTurn.checkpoint exists?          │
│ → returns {showNarration, showQ,     │
│    showCheckpoint, showSuggestions}  │
└────────────────┬────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│ <AuroraGuide /> receives:            │
│ message={showNarration ? text : undef}
│ comprehensionCheck={showQ ? q : undef}
│ checkpoint={showCP ? cp : undef}     │
│ suggestions={showSug ? sug : undef}  │
└────────────────┬────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│ AuroraGuide Component Renders:       │
│ • Only shows passed props            │
│ • Conditional rendering inside       │
│   {message ? <Text>... : null}       │
│   {comprehensionCheck ? ... : null}  │
│   {checkpoint ? ... : null}          │
│   {suggestions ? ... : null}         │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│ User sees:                           │
│ Progressive disclosure of Aurora     │
│ content based on learning flow       │
└─────────────────────────────────────┘
```

---

## User Experience Flow

### Scenario 1: Read Section + Answer Question + Move On

**Step 1: Aurora Explains**
```
Session Status: IN_PROGRESS
Display: [Narration] + [Follow-up Buttons]
User sees: "Let me break down vertebrates and invertebrates..."
```

**Step 2: Aurora Asks Question**
```
Next turn, AI decides question needed
Session Status: STILL IN_PROGRESS (no checkpoint yet)
Display: [Narration] + [Question Card] (buttons hidden)
User sees: "💭 Question for you: Can you define a vertebrate?"
```

**Step 3: User Answers**
```
User clicks "Here is my answer" or sends message
Backend evaluates, decides no checkpoint needed
Display: [Narration] + [Follow-up Buttons]
User sees: "Correct! Here's how we can explore this further..."
+ suggestion buttons
```

**Step 4: User Chooses Option or Moves On**
```
Segment auto-advances if advance_segment=true
OR waits for user action
```

---

### Scenario 2: Read Section + Attempt Checkpoint

**Step 1: Aurora Introduces Checkpoint**
```
Session Status: IN_PROGRESS
Display: [Narration] + [Checkpoint Card]
User sees: "Now let's apply this knowledge..."
         "✓ Checkpoint: Take a photo of..."
Buttons hidden.
```

**Step 2: User Submits Work**
```
Backend receives file, calls Gemini analysis
Session Status: AWAITING_CHECKPOINT
Display: Still shows checkpoint (with submit button state changing)
```

**Step 3: Backend Analyzes & Responds**
```
Gemini returns feedback
If needs_review=false:
  → Session Status: IN_PROGRESS (next segment)
  → Display resets for new segment
  → Shows feedback + new narration

If needs_review=true:
  → Session Status: IN_PROGRESS (same segment)
  → Display shows feedback + re-try guidance
```

---

## Key Principles

1. **Backend Controls Flow**: Session status from backend determines what shows
2. **Progressive Disclosure**: Elements appear when needed, not all at once
3. **No Duplicate Information**: Props are `undefined` when not relevant, AuroraGuide doesn't render them
4. **Single Source of Truth**: `aiSessionSnapshot.status` drives everything
5. **Predictable UX**: User can anticipate what comes next based on what's showing

---

## Testing Checklist

- [ ] Enable Aurora → Session starts, shows narration only
- [ ] Narration displays → Follow-up prompts show as buttons
- [ ] Student answers question → Question card shows (buttons hidden)
- [ ] Backend sends checkpoint with required=true → Checkpoint card shows, buttons hidden
- [ ] Student submits checkpoint → Status changes to AWAITING_CHECKPOINT
- [ ] Backend analyzes → Status returns to IN_PROGRESS with new segment
- [ ] Session completes → Completion message shows
- [ ] All transitions happen without flickering or display glitches

---

## Migration from Old System

**Removed**:
- ❌ Displaying all elements regardless of session state
- ❌ Manual conditionals scattered through AuroraGuide
- ❌ Frontend guessing what should show

**Added**:
- ✅ `auroraDisplayState` computed from backend status
- ✅ Props only passed when relevant
- ✅ AuroraGuide component stays simple (just renders what it receives)
- ✅ Backend status is single source of truth

