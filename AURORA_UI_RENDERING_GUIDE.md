# Aurora Guide UI - Complete Rendering Reference

## What Users Will Now See

### Before (Current Implementation)
Aurora Guide panel only shows:
```
┌─────────────────────────────┐
│ Aurora Guide                 │
├─────────────────────────────┤
│                              │
│ [Narration text...]          │
│                              │
│ [Suggestion Button 1] [Btn2] │
│ [Suggestion Button 3] [Btn4] │
│                              │
└─────────────────────────────┘
```

### After (This Fix)
Aurora Guide panel now shows:

```
┌────────────────────────────────────────┐
│ Aurora Guide                            │
├────────────────────────────────────────┤
│                                        │
│ [Narration text...]                    │
│                                        │
│ ┌─ Check Your Understanding ───────┐   │
│ │ Question: Can you give me an      │   │
│ │ example of X?                    │   │
│ │                                  │   │
│ │ A: Option 1                       │   │
│ │ B: Option 2                       │   │
│ │ C: Option 3                       │   │
│ │ D: Option 4                       │   │
│ └──────────────────────────────────┘   │
│                                        │
│ ┌─ Complete a Checkpoint ──────────┐   │
│ │         [  PHOTO  ]              │   │
│ │ Find and photograph 5 different  │   │
│ │ types of plants in your yard     │   │
│ │                                  │   │
│ │ Tips:                            │   │
│ │ • Look in multiple locations     │   │
│ │ • Try different plant species    │   │
│ │ • Ensure good lighting           │   │
│ └──────────────────────────────────┘   │
│                                        │
│ [Suggestion Button 1] [Suggestion 2]  │
│ [Suggestion Button 3] [Suggestion 4]  │
│                                        │
│ [← Previous] [Next →]                 │
│                                        │
└────────────────────────────────────────┘
```

## Component Breakdown

### 1. Narration Section
- **Source**: `aiTurn.narration` from Gemini API
- **Display**: Plain text in `panelMessage` style
- **Status**: ✓ Already working, preserved

### 2. Comprehension Check Card (NEW)
- **Visibility**: Shows only when `aiTurn.comprehension_check?.question` exists
- **Components**:
  - **Title**: "Check Your Understanding" (blue, #1D4ED8)
  - **Question**: The comprehension question text
  - **Choices**: Multiple choice options formatted as:
    - A: First option
    - B: Second option
    - C: Third option
    - D: Fourth option
- **Styling**:
  - Light blue background (rgba(59, 130, 246, 0.12))
  - Blue border (rgba(59, 130, 246, 0.35))
  - Rounded corners (borderRadius: 8)
  - Padding: 12px
  - Vertical margin: 10px

### 3. Checkpoint Card (NEW)
- **Visibility**: Shows only when `aiTurn.checkpoint?.instructions` exists
- **Components**:
  - **Title**: Custom title or "Complete a Checkpoint"
  - **Type Badge**: Color-coded by checkpoint type:
    - Photo: Red badge (#DC2626 text, #FEE2E2 background)
    - Quiz: Blue badge (#0284C7 text, #DBEAFE background)
    - Reflection: Purple badge (#7C3AED text, #F3E8FF background)
  - **Instructions**: The checkpoint instructions text
  - **Tips**: Optional list of tips, each prefixed with "•"
- **Styling**:
  - Orange/warm background (rgba(249, 115, 22, 0.12))
  - Orange border (rgba(249, 115, 22, 0.35))
  - Rounded corners (borderRadius: 8)
  - Padding: 12px
  - Vertical margin: 10px

### 4. Suggestions Section
- **Source**: `auroraSuggestions` from StudySessionScreen
- **Order of preference**:
  1. `aiTurn.follow_up_prompts` (from Gemini - NEW)
  2. `aiTurn.follow_up_options` (fallback for older responses)
  3. Generic defaults: ["Explain differently", "Quiz me on this", "Give a real-world example"]
- **Display**: Up to 4 suggestion buttons
- **Status**: ✓ Working, now with proper field mapping

### 5. Walkthrough Controls
- **Visibility**: Shows when `walkthroughActive` is true
- **Components**: Previous/Next buttons and step indicator
- **Status**: ✓ Already working, preserved

## Data Flow

```
┌──────────────────────────────────────────────────────────┐
│ Backend: Gemini API Response (TutorTurn)                │
└──────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────┐
│ aiTutorService.ts                                        │
│ • Defines TutorTurn type with all fields                │
│ • Supports both follow_up_prompts and follow_up_options │
│ • Supports checkpoint and comprehension_check           │
└──────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────┐
│ StudySessionScreen.tsx                                   │
│ • aiTurn state receives full API response               │
│ • Extracts narration → auroraMessage                    │
│ • Extracts follow_up_prompts → auroraSuggestions        │
│ • Extracts comprehension_check → pass to AuroraGuide    │
│ • Extracts checkpoint → pass to AuroraGuide             │
└──────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────┐
│ AuroraGuide.tsx                                          │
│ • Receives all props from StudySessionScreen            │
│ • Renders narration (existing)                          │
│ • Renders comprehension_check card (NEW)                │
│ • Renders checkpoint card (NEW)                         │
│ • Renders suggestions (existing)                        │
│ • Renders walkthrough controls (existing)               │
└──────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────┐
│ User sees complete, fully-featured Aurora Guide panel   │
└──────────────────────────────────────────────────────────┘
```

## Props Contract

### AuroraGuide Component Now Receives:
```typescript
{
  // Existing props
  enabled: boolean;
  anchorOpen: boolean;
  status: 'idle' | 'loading' | 'ready' | 'error';
  title?: string;
  summary?: string;
  message?: string;                    // narration text
  suggestions?: string[];              // follow-up prompts
  cue?: AuroraCueData | null;
  walkthroughActive?: boolean;
  walkthroughLoading?: boolean;
  
  // NEW PROPS
  comprehensionCheck?: {               // NEW
    question: string;
    choices?: string[];
    expected_answers?: string[];
    hint?: string;
  };
  checkpoint?: {                        // NEW
    required: boolean;
    checkpoint_type?: 'photo' | 'quiz' | 'reflection';
    title?: string;
    instructions?: string;
    tips?: string[];
  };
  
  // Callback functions (existing)
  onToggleAnchor: () => void;
  onSuggestionPress?: (suggestion: string) => void;
  onCuePromptPress?: (prompt: string) => void;
  onDismissCue?: () => void;
  onWalkNext?: () => void;
  onWalkPrev?: () => void;
  onPostWalkthroughAction?: () => void;
}
```

## Future Enhancement: Interactivity

Currently, the comprehension check and checkpoint cards are **display-only**. To make them interactive:

1. **Comprehension Check**: 
   - Add `onAnswerSubmit?: (answer: string) => void` callback
   - Add press handlers to choice buttons
   - Check against `expected_answers`
   - Show feedback (correct/incorrect)

2. **Checkpoint**:
   - Add `onCheckpointStart?: () => void` callback
   - Add submit/capture button
   - Handle file upload or quiz submission
   - Show completion status

## Verification Checklist

- [x] TypeScript compiles without errors
- [x] TutorTurn interface supports both field names
- [x] AuroraGuide receives new props correctly
- [x] Comprehension check card has proper styling
- [x] Checkpoint card has proper styling
- [x] All styles are defined in StyleSheet
- [x] Data flows from backend to UI correctly
- [x] Backward compatibility maintained (fallbacks work)
- [ ] Test with real backend responses
- [ ] Verify UI layout on different screen sizes
- [ ] Test with null/undefined optional fields
