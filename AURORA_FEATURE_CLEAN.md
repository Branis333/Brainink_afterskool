# Aurora AI Mode - Fresh Implementation

## Overview
Aurora is a guided learning companion that helps learners understand study session content through AI-powered explanations. The system provides:
- **Guided Walkthroughs**: Break down sections into snippets, explain each step-by-step
- **On-Demand Explanations**: Quiz, context, and custom responses
- **Smart Suggestions**: Follow-up prompts based on content and learner progress
- **Interactive Cues**: Contextual tips and learning suggestions

---

## Architecture

### Core Components

1. **StudySessionScreen.tsx** - Main study interface
   - Manages AI session lifecycle
   - Orchestrates walkthrough flow
   - Handles highlight computation and display

2. **AuroraGuide.tsx** - Floating AI companion panel
   - Displays explanations, suggestions, and feedback
   - Manages walkthrough navigation UI
   - Shows contextual cues

3. **aiTutorService.ts** - Backend API wrapper
   - Handles all communication with AI Tutor backend
   - Multi-endpoint fallback strategy
   - Session management

### State Management

#### Aurora Enable/Disable
```typescript
const [auroraEnabled, setAuroraEnabled] = useState(false);

// Toggles Aurora on/off via "Enable Aurora" button
// On enable: Ensures AI session, opens guide panel, auto-primes current section
// On disable: Clears errors, resets walkthrough, closes guide
```

#### AI Session State
```typescript
const [aiState, setAiState] = useState<TutorSessionState | null>(null);
const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
const [aiError, setAiError] = useState<string | null>(null);

// Ensures session exists before any AI interaction
// Uses fallback endpoints for resilience
```

#### Walkthrough State
```typescript
const [walkIndex, setWalkIndex] = useState<number>(0);
const [walkSectionId, setWalkSectionId] = useState<string | null>(null);

const walkDataRef = useRef<{
    sectionId: string;
    snippets: string[];
    explanations: TutorTurn[];
} | null>(null);
```

---

## Feature Flow

### 1. Enable Aurora
```
User clicks "Enable Aurora"
    ↓
handleToggleAiAssist()
    ↓
ensureAiSession() → creates TutorSession on backend
    ↓
setAuroraEnabled(true)
    ↓
setAuroraAnchorOpen(true) → opens guide panel
    ↓
Auto-prime: handleStartExplainWalkthrough(currentSection)
```

### 2. Start Guided Walkthrough
```
User sees guide is active
    ↓ (or explicitly clicks "Explain")
handleStartExplainWalkthrough(sectionId)
    ↓
1. Extract section text
2. Compute 3-5 key snippets using sentence analysis
3. Show all snippets as highlights
4. Highlight first snippet exclusively
5. Start pre-computing explanations in background
6. Display first explanation immediately (or request if not ready)
```

### 3. Pre-Compute Explanations
```typescript
const preComputeExplanations = async (sectionId, snippets, state) => {
    for (let i = 0; i < snippets.length; i++) {
        // Request explanation for each snippet sequentially
        const response = await aiTutorService.sendMessage(...)
        
        // Store in walkDataRef.current.explanations[]
        explanations.push(response.tutor_turn)
        
        // If first step, display immediately
        if (i === 0) updateAiState(response)
    }
}
```

**Key Points:**
- Sequential (not parallel) to avoid API throttling
- Stores results immediately as they arrive
- First explanation displays as soon as ready
- No "Preparing..." delay after first step

### 4. Navigate Walkthrough
```
User clicks Next/Prev buttons
    ↓
handleWalkNext() / handleWalkPrev()
    ↓
1. Update walkIndex
2. Highlight new snippet
3. Check if explanation cached
4. If cached → updateAiState (instant display)
5. If not cached → requestAiResponse (fallback)
    ↓
User sees explanation immediately or with minimal delay
```

### 5. Complete Walkthrough
```
Last step → User clicks Next
    ↓
handleWalkNext() detects nextIdx >= snippets.length
    ↓
resetWalkthrough() → clears walk data
setAutoAdvanceEnabled(true)
queueWalkthroughRecap(sectionId) → offers recap button
    ↓
User can click "Recap" button for section summary
```

---

## API Endpoints Used

### Session Management
- `POST /tutor/session/start` - Initialize AI session
- `GET /tutor/session/{id}` - Get session state

### Message Exchange
- `POST /tutor/session/{id}/message` - Send prompt, get explanation

### Fallback Strategy
```typescript
// aiTutorService tries endpoints in order:
1. Primary: /tutor/session/{id}/message
2. Fallback: Alternative endpoint if primary fails
3. Retry: Exponential backoff for transient errors
```

---

## State Transitions

### Happy Path
```
idle 
  → auroraEnabled = true
  → aiStatus: idle → loading → ready
  → walkthrough: idle → active
  → walkthrough: step 1 → 2 → 3 → complete
  → walkthrough: idle (reset)
```

### Error Handling
```
Any error occurs
  → setAiError(message)
  → setAiStatus('error')
  → Show error in Aurora guide
  → User can click "Try again" or "Summarize this section"
  → Clear error, retry
```

### Auto-Prime Effect
```
auroraEnabled + activeSectionId changes
  → if not already walking this section
  → handleStartExplainWalkthrough(newSection)
  → begins auto-explanation
```

---

## Key Functions

### `handleToggleAiAssist()`
Toggles Aurora on/off, manages session lifecycle

### `handleStartExplainWalkthrough(sectionId)`
Initiates guided walkthrough for a section
- Extracts snippets
- Shows highlights
- Starts pre-compute

### `preComputeExplanations(sectionId, snippets, state)`
Sequentially generates and caches explanations

### `handleWalkNext() / handleWalkPrev()`
Navigate through walkthrough steps
- Updates highlight
- Displays cached or requests explanation

### `resetWalkthrough()`
Clears walkthrough state, prepares for next section

---

## UI Display

### Aurora Guide Panel
- **Status Indicator**: Shows idle/loading/ready/error
- **Message Area**: Displays current explanation
- **Suggestions**: Quick-tap prompts for follow-ups
- **Walkthrough Controls**: Next/Prev buttons (when active)
- **Cues**: Contextual learning tips
- **Recap Button**: Post-walkthrough summary

### Highlights
- **All Snippets**: Show when walkthrough starts
- **Current Snippet**: Exclusive highlight with `tone: 'success'`
- **Color Coding**: Green for active step

---

## Performance Optimizations

1. **Cache-First**: Check pre-computed explanations before requesting
2. **Sequential Requests**: Avoid API overload
3. **Instant First Step**: Display before full pre-compute
4. **Lazy Loading**: Only compute when walkthrough active
5. **Error Resilience**: Fallback to request if cache miss

---

## Testing Checklist

- [ ] Enable Aurora → session created, guide opens
- [ ] Navigate to new section → auto-primes with walkthrough
- [ ] First explanation displays quickly
- [ ] Click Next → instant or quick display
- [ ] Pre-computed explanations cached and reused
- [ ] Click Prev → reverses to previous step with explanation
- [ ] Complete walkthrough → recap offered
- [ ] API error → error message shown, can retry
- [ ] Disable Aurora → cleans up state
- [ ] Switch sections → walkthrough updates correctly

---

## Known Limitations

1. Pre-compute sequential (not parallel) - trades throughput for simplicity
2. Explanations cached only during session lifetime
3. No offline mode - requires live API
4. Maximum 5 snippets per section (configurable)

---

## Future Enhancements

- Persist explanations across sessions
- Parallel pre-compute with rate limiting
- Learner performance-based snippet selection
- Integration with spaced repetition
- Voice-based navigation
