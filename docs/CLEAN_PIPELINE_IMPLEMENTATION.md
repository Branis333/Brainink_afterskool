# Aurora AI Mode - Clean Backend-to-Frontend Pipeline

## Vision
**ONE clean, systematic pipeline** where backend Gemini responses flow directly to UI, with NO competing logic or duplication.

```
Gemini API Response
        ↓
    aiTurn State
        ↓
    AuroraGuide Component (display only)
        ↓
    User sees all data
```

## What the Backend Sends
Based on actual Gemini responses in logs:

```json
{
  "narration": "Welcome to our journey into the amazing world of living things!",
  "comprehension_check": "True or False: It's okay to take more medicine than instructed if still feeling sick?",
  "follow_up_prompts": [
    "Can you think of a time you or someone you know used medicine?",
    "Why do you think it's important for medicines to come in different forms?",
    "What are some things you can do to stay healthy besides taking medicine?"
  ],
  "checkpoint": {
    "required": true,
    "checkpoint_type": "reflection",
    "instructions": "Write a short paragraph about a time you or someone you know used medicine safely.",
    "criteria": [
      "Describe the situation where medicine was used",
      "Explain how correct dosage was determined",
      "Mention any precautions taken"
    ]
  },
  "advance_segment": true
}
```

## Files Changed

### 1. **aiTutorService.ts** - Type Definition
```typescript
export interface TutorTurn {
    turn_id: string;
    narration: string;
    summary?: string;
    reflection_prompt?: string;
    
    // Core fields from Gemini
    comprehension_check?: string | TutorComprehensionCheck | null;  // Can be string OR object
    checkpoint?: TutorCheckpointPrompt | null;
    follow_up_prompts?: string[];        // From Gemini (new)
    follow_up_options?: string[];        // Backward compatibility
    advance_segment?: boolean;           // For walkthrough progression
    
    next_action?: 'continue' | 'await_response' | 'await_checkpoint';
}
```

**Why this design:**
- `comprehension_check` supports BOTH strings (from Gemini) and objects (for future structured responses)
- Keeps both `follow_up_prompts` and `follow_up_options` for compatibility
- `advance_segment` tracks when to progress walkthrough

### 2. **AuroraGuide.tsx** - Clean Display Layer
```typescript
export interface AuroraGuideProps {
    // ... existing props ...
    comprehensionCheck?: string | null;      // Simple string display
    checkpoint?: TutorCheckpointPrompt | null;
}
```

**What it renders:**

```
┌─ Aurora Guide ─────────────────┐
│ [narration text]               │
│                                │
│ 💭 Question for you:           │
│ [comprehension_check question] │
│                                │
│ ✓ Checkpoint:                  │
│ [checkpoint instructions]       │
│                                │
│ [Suggestion buttons]           │
└────────────────────────────────┘
```

### 3. **StudySessionScreen.tsx** - Data Flow
```typescript
// Pass the backend data directly to AuroraGuide
<AuroraGuide
    message={auroraMessage}                    // narration
    suggestions={auroraSuggestions}             // follow_up_prompts
    comprehensionCheck={
        typeof aiTurn?.comprehension_check === 'string' 
            ? aiTurn.comprehension_check 
            : aiTurn?.comprehension_check?.question
    }
    checkpoint={aiTurn?.checkpoint}
/>
```

## The Pipeline (Actual)

```
┌─────────────────────────────────────────────────────────┐
│ Backend: Gemini API                                     │
│ Returns: TutorTurn JSON                                 │
│ • narration (string)                                    │
│ • comprehension_check (string)                          │
│ • follow_up_prompts (string[])                          │
│ • checkpoint (object with type, instructions, criteria) │
│ • advance_segment (boolean)                             │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ aiTutorService.ts                                       │
│ • Defines types to match Gemini response                │
│ • TutorTurn accepts both string and object for CC       │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ StudySessionScreen.tsx                                  │
│ • aiTurn state holds full Gemini response               │
│ • Extract fields:                                       │
│   - narration → auroraMessage                           │
│   - follow_up_prompts → auroraSuggestions               │
│   - comprehension_check → pass string directly          │
│   - checkpoint → pass object directly                   │
│   - advance_segment → use for walkthrough logic         │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ AuroraGuide.tsx (DISPLAY ONLY)                          │
│ • Receives narration as message                         │
│ • Receives comprehension question as string             │
│ • Receives checkpoint as object                         │
│ • Simple rendering, no logic                            │
│ • Just displays what backend sends                      │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ User sees complete Aurora Guide with all fields         │
└─────────────────────────────────────────────────────────┘
```

## Type Safety

All code has type checking enabled:
- ✅ TypeScript compiles without errors
- ✅ Handles string OR object for comprehension_check
- ✅ Supports both follow_up_prompts and follow_up_options
- ✅ Optional fields properly nullable

## No Duplication

- **ONE** definition of TutorTurn type ✓
- **ONE** data source (aiTurn state) ✓
- **ONE** rendering layer (AuroraGuide) ✓
- **NO** conflicting effects ✓
- **NO** competing state management ✓

## How It Works

1. **Backend sends response** with all fields
2. **aiTurn state** captures complete response
3. **StudySessionScreen** extracts and passes relevant fields
4. **AuroraGuide** displays them as-is
5. **User** sees everything the backend returned

## Testing the Pipeline

When backend sends:
```json
"comprehension_check": "True or False: Is it okay to take more medicine?"
```

User will see in Aurora panel:
```
💭 Question for you:
True or False: Is it okay to take more medicine?
```

When backend sends:
```json
"checkpoint": {
  "instructions": "Write about a time you used medicine safely",
  "checkpoint_type": "reflection"
}
```

User will see:
```
✓ Checkpoint:
Write about a time you used medicine safely
```

## Future Enhancements

- [ ] Add click handlers for comprehension check options (if choices provided)
- [ ] Add submit button for checkpoint (when ready for interactivity)
- [ ] Add animations for card entrance
- [ ] Add visual feedback for checkpoint completion status
- [ ] Track user responses against comprehension_check
- [ ] Send checkpoint submission to backend

## Key Principle

**Display ONLY** - The Aurora panel is now a pure display layer. It shows exactly what the backend sends, with no business logic. All logic (routing, state management, API calls) stays in StudySessionScreen.
