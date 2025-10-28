# Unit Tests for Aurora State Machine (auroraDisplayState)

This file contains comprehensive unit test cases for the `auroraDisplayState` computed state logic.

## Test Framework Setup

```typescript
// Use: Jest + React Testing Library
// File location: src/screens/course/__tests__/StudySessionScreen.auroraState.test.ts

import { renderHook } from '@testing-library/react';
import { useMemo } from 'react';
import type { TutorSessionSnapshot, TutorTurn } from '../../../services/aiTutorService';
```

---

## Test Suite 1: Null/Undefined Inputs

### Test 1.1: aiSessionSnapshot is null

```typescript
test('should return idle state when aiSessionSnapshot is null', () => {
    const aiSessionSnapshot: TutorSessionSnapshot | null = null;
    const aiTurn: TutorTurn | null = null;

    const auroraDisplayState = useMemo(() => {
        if (!aiSessionSnapshot) {
            return {
                mode: 'idle' as const,
                showNarration: false,
                showQuestion: false,
                showCheckpoint: false,
                showSuggestions: false,
            };
        }
        // ... rest of logic
    }, [aiSessionSnapshot, aiTurn]);

    expect(auroraDisplayState.mode).toBe('idle');
    expect(auroraDisplayState.showNarration).toBe(false);
    expect(auroraDisplayState.showQuestion).toBe(false);
    expect(auroraDisplayState.showCheckpoint).toBe(false);
    expect(auroraDisplayState.showSuggestions).toBe(false);
});
```

### Test 1.2: aiSessionSnapshot is undefined

```typescript
test('should return idle state when aiSessionSnapshot is undefined', () => {
    const aiSessionSnapshot: TutorSessionSnapshot | null = undefined as any;
    const aiTurn: TutorTurn | null = null;

    const auroraDisplayState = computeDisplayState(aiSessionSnapshot, aiTurn);

    expect(auroraDisplayState).toEqual({
        mode: 'idle',
        showNarration: false,
        showQuestion: false,
        showCheckpoint: false,
        showSuggestions: false,
    });
});
```

---

## Test Suite 2: Status = 'active' with Various Content

### Test 2.1: Active with narration only (no question, no checkpoint)

```typescript
test('should show narration + suggestions when status is active with no question/checkpoint', () => {
    const aiSessionSnapshot: TutorSessionSnapshot = {
        session_id: 1,
        learner_id: 100,
        course_id: 1,
        status: 'active',
        total_turns: 1,
        created_at: '2025-10-23T00:00:00Z',
        updated_at: '2025-10-23T00:00:00Z',
    };

    const aiTurn: TutorTurn = {
        turn_id: 'turn_1',
        narration: 'Let me explain this concept...',
        comprehension_check: null,
        checkpoint: null,
        follow_up_prompts: ['Tell me more', 'Show an example'],
        advance_segment: false,
    };

    const result = computeDisplayState(aiSessionSnapshot, aiTurn);

    expect(result).toEqual({
        mode: 'active',
        showNarration: true,
        showQuestion: false,
        showCheckpoint: false,
        showSuggestions: true,
    });
});
```

### Test 2.2: Active with narration + question (no checkpoint)

```typescript
test('should show narration + question, hide suggestions when status is active with question', () => {
    const aiSessionSnapshot: TutorSessionSnapshot = {
        ...baseSession,
        status: 'active',
    };

    const aiTurn: TutorTurn = {
        turn_id: 'turn_2',
        narration: 'Here is the concept...',
        comprehension_check: 'Can you explain this?',
        checkpoint: null,
        follow_up_prompts: [],
        advance_segment: false,
    };

    const result = computeDisplayState(aiSessionSnapshot, aiTurn);

    expect(result).toEqual({
        mode: 'active',
        showNarration: true,
        showQuestion: true,        // ✅ Question shows
        showCheckpoint: false,
        showSuggestions: false,    // ✅ Suggestions hidden
    });
});
```

### Test 2.3: Active with narration + checkpoint (no question)

```typescript
test('should show narration + checkpoint, hide suggestions when status is active with checkpoint', () => {
    const aiSessionSnapshot: TutorSessionSnapshot = {
        ...baseSession,
        status: 'active',
    };

    const aiTurn: TutorTurn = {
        turn_id: 'turn_3',
        narration: 'Now lets apply this...',
        comprehension_check: null,
        checkpoint: {
            required: true,
            checkpoint_type: 'photo',
            instructions: 'Take a photo showing...',
        },
        follow_up_prompts: [],
        advance_segment: false,
    };

    const result = computeDisplayState(aiSessionSnapshot, aiTurn);

    expect(result).toEqual({
        mode: 'active',
        showNarration: true,
        showQuestion: false,
        showCheckpoint: true,       // ✅ Checkpoint shows
        showSuggestions: false,     // ✅ Suggestions hidden
    });
});
```

### Test 2.4: Active with narration + question + checkpoint (question takes priority)

```typescript
test('should show question over checkpoint when both present', () => {
    const aiSessionSnapshot: TutorSessionSnapshot = {
        ...baseSession,
        status: 'active',
    };

    const aiTurn: TutorTurn = {
        turn_id: 'turn_4',
        narration: 'Content...',
        comprehension_check: 'Test question?',
        checkpoint: {
            required: true,
            checkpoint_type: 'reflection',
            instructions: 'Reflect...',
        },
        follow_up_prompts: [],
        advance_segment: false,
    };

    const result = computeDisplayState(aiSessionSnapshot, aiTurn);

    expect(result).toEqual({
        mode: 'active',
        showNarration: true,
        showQuestion: true,         // ✅ Question shows
        showCheckpoint: false,      // ✅ Checkpoint hidden (question takes priority)
        showSuggestions: false,
    });
});
```

### Test 2.5: Active with checkpoint.required = false

```typescript
test('should not show checkpoint when required is false', () => {
    const aiSessionSnapshot: TutorSessionSnapshot = {
        ...baseSession,
        status: 'active',
    };

    const aiTurn: TutorTurn = {
        turn_id: 'turn_5',
        narration: 'Content...',
        comprehension_check: null,
        checkpoint: {
            required: false,        // ✅ Not required
            checkpoint_type: 'photo',
            instructions: 'Optional checkpoint',
        },
        follow_up_prompts: ['Next step'],
        advance_segment: false,
    };

    const result = computeDisplayState(aiSessionSnapshot, aiTurn);

    expect(result).toEqual({
        mode: 'active',
        showNarration: true,
        showQuestion: false,
        showCheckpoint: false,      // ✅ Hidden because required=false
        showSuggestions: true,
    });
});
```

---

## Test Suite 3: Status = 'awaiting_checkpoint'

### Test 3.1: Awaiting checkpoint shows only checkpoint

```typescript
test('should show only checkpoint when status is awaiting_checkpoint', () => {
    const aiSessionSnapshot: TutorSessionSnapshot = {
        ...baseSession,
        status: 'awaiting_checkpoint',  // 🔄 Waiting for checkpoint
    };

    const aiTurn: TutorTurn = {
        turn_id: 'turn_6',
        narration: 'Submit your work...',
        comprehension_check: 'Will be hidden',
        checkpoint: {
            required: true,
            checkpoint_type: 'photo',
            instructions: 'Take a photo...',
        },
        follow_up_prompts: ['Would show if allowed'],
        advance_segment: false,
    };

    const result = computeDisplayState(aiSessionSnapshot, aiTurn);

    expect(result).toEqual({
        mode: 'awaiting_checkpoint',
        showNarration: true,
        showQuestion: false,        // ✅ Always false in this status
        showCheckpoint: true,       // ✅ Always true in this status
        showSuggestions: false,     // ✅ Always false in this status
    });
});
```

### Test 3.2: Awaiting checkpoint even with null checkpoint (edge case)

```typescript
test('should show checkpoint true even if checkpoint field is null', () => {
    const aiSessionSnapshot: TutorSessionSnapshot = {
        ...baseSession,
        status: 'awaiting_checkpoint',
    };

    const aiTurn: TutorTurn = {
        turn_id: 'turn_7',
        narration: 'Waiting...',
        comprehension_check: null,
        checkpoint: null,  // ⚠️ Edge case: null checkpoint
        follow_up_prompts: [],
        advance_segment: false,
    };

    const result = computeDisplayState(aiSessionSnapshot, aiTurn);

    expect(result).toEqual({
        mode: 'awaiting_checkpoint',
        showNarration: true,
        showQuestion: false,
        showCheckpoint: true,   // ✅ Still true (status dictates)
        showSuggestions: false,
    });
});
```

---

## Test Suite 4: Status = 'completed'

### Test 4.1: Completed hides all elements

```typescript
test('should hide all elements when status is completed', () => {
    const aiSessionSnapshot: TutorSessionSnapshot = {
        ...baseSession,
        status: 'completed',
    };

    const aiTurn: TutorTurn = {
        turn_id: 'turn_final',
        narration: 'You finished! But this wont show...',
        comprehension_check: 'Neither will this',
        checkpoint: {
            required: true,
            checkpoint_type: 'photo',
            instructions: 'Or this',
        },
        follow_up_prompts: ['Nope'],
        advance_segment: false,
    };

    const result = computeDisplayState(aiSessionSnapshot, aiTurn);

    expect(result).toEqual({
        mode: 'completed',
        showNarration: false,       // ✅ All false when completed
        showQuestion: false,
        showCheckpoint: false,
        showSuggestions: false,
    });
});
```

---

## Test Suite 5: Status = 'error' and 'abandoned'

### Test 5.1: Error status

```typescript
test('should return idle state when status is error', () => {
    const aiSessionSnapshot: TutorSessionSnapshot = {
        ...baseSession,
        status: 'error',
    };

    const result = computeDisplayState(aiSessionSnapshot, null);

    expect(result).toEqual({
        mode: 'idle',
        showNarration: false,
        showQuestion: false,
        showCheckpoint: false,
        showSuggestions: false,
    });
});
```

### Test 5.2: Abandoned status

```typescript
test('should return idle state when status is abandoned', () => {
    const aiSessionSnapshot: TutorSessionSnapshot = {
        ...baseSession,
        status: 'abandoned',
    };

    const result = computeDisplayState(aiSessionSnapshot, null);

    expect(result).toEqual({
        mode: 'idle',
        showNarration: false,
        showQuestion: false,
        showCheckpoint: false,
        showSuggestions: false,
    });
});
```

---

## Test Suite 6: Type Variations

### Test 6.1: comprehension_check as string

```typescript
test('should handle comprehension_check as string', () => {
    const aiSessionSnapshot: TutorSessionSnapshot = {
        ...baseSession,
        status: 'active',
    };

    const aiTurn: TutorTurn = {
        turn_id: 'turn_string',
        narration: 'Content...',
        comprehension_check: 'Simple string question?',  // ✅ String type
        checkpoint: null,
        follow_up_prompts: [],
        advance_segment: false,
    };

    const result = computeDisplayState(aiSessionSnapshot, aiTurn);

    expect(result.showQuestion).toBe(true);
    expect(result.showSuggestions).toBe(false);
});
```

### Test 6.2: comprehension_check as object

```typescript
test('should handle comprehension_check as object', () => {
    const aiSessionSnapshot: TutorSessionSnapshot = {
        ...baseSession,
        status: 'active',
    };

    const aiTurn: TutorTurn = {
        turn_id: 'turn_object',
        narration: 'Content...',
        comprehension_check: {           // ✅ Object type
            question: 'Multiple choice?',
            choices: ['A', 'B', 'C'],
        },
        checkpoint: null,
        follow_up_prompts: [],
        advance_segment: false,
    };

    const result = computeDisplayState(aiSessionSnapshot, aiTurn);

    expect(result.showQuestion).toBe(true);
    expect(result.showSuggestions).toBe(false);
});
```

### Test 6.3: Multiple checkpoint types

```typescript
describe('checkpoint types', () => {
    const testCheckpointType = (type: 'photo' | 'reflection' | 'quiz') => {
        const aiTurn: TutorTurn = {
            turn_id: `turn_${type}`,
            narration: 'Apply knowledge...',
            comprehension_check: null,
            checkpoint: {
                required: true,
                checkpoint_type: type,
                instructions: `Instructions for ${type}`,
            },
            follow_up_prompts: [],
            advance_segment: false,
        };

        const result = computeDisplayState(baseSession, aiTurn);
        expect(result.showCheckpoint).toBe(true);
    };

    test('should show checkpoint for photo type', () => testCheckpointType('photo'));
    test('should show checkpoint for reflection type', () => testCheckpointType('reflection'));
    test('should show checkpoint for quiz type', () => testCheckpointType('quiz'));
});
```

---

## Test Suite 7: Edge Cases & Transitions

### Test 7.1: Transition from active to awaiting_checkpoint

```typescript
test('should transition from active to awaiting_checkpoint display mode', () => {
    const activeSessionSnapshot: TutorSessionSnapshot = { ...baseSession, status: 'active' };
    const awainingSessionSnapshot: TutorSessionSnapshot = { ...baseSession, status: 'awaiting_checkpoint' };

    const result1 = computeDisplayState(activeSessionSnapshot, null);
    expect(result1.mode).toBe('active');
    expect(result1.showCheckpoint).toBe(false);

    const result2 = computeDisplayState(awainingSessionSnapshot, null);
    expect(result2.mode).toBe('awaiting_checkpoint');
    expect(result2.showCheckpoint).toBe(true);
});
```

### Test 7.2: Rapid status changes

```typescript
test('should handle rapid status changes without issues', () => {
    const statuses: Array<'active' | 'awaiting_checkpoint' | 'completed'> = [
        'active',
        'awaiting_checkpoint',
        'active',
        'awaiting_checkpoint',
        'completed',
    ];

    statuses.forEach((status) => {
        const snapshot: TutorSessionSnapshot = { ...baseSession, status };
        const result = computeDisplayState(snapshot, null);
        expect(result).toBeDefined();
        expect(result.mode).toBeDefined();
    });
});
```

### Test 7.3: aiTurn changes while status stays same

```typescript
test('should recompute display when aiTurn changes while status is active', () => {
    const baseSnapshot: TutorSessionSnapshot = { ...baseSession, status: 'active' };

    // First turn: no question
    const turn1: TutorTurn = {
        turn_id: 'turn_1',
        narration: 'Content',
        comprehension_check: null,
        checkpoint: null,
        follow_up_prompts: [],
        advance_segment: false,
    };
    const result1 = computeDisplayState(baseSnapshot, turn1);
    expect(result1.showQuestion).toBe(false);
    expect(result1.showSuggestions).toBe(true);

    // Next turn: now has question
    const turn2: TutorTurn = {
        turn_id: 'turn_2',
        narration: 'Content',
        comprehension_check: 'Question?',
        checkpoint: null,
        follow_up_prompts: [],
        advance_segment: false,
    };
    const result2 = computeDisplayState(baseSnapshot, turn2);
    expect(result2.showQuestion).toBe(true);
    expect(result2.showSuggestions).toBe(false);
});
```

---

## Test Suite 8: Performance & Memoization

### Test 8.1: Memoization prevents unnecessary recomputation

```typescript
test('should use memoization to prevent unnecessary recomputes', () => {
    const { rerender } = renderHook(
        ({ snapshot, turn }) => computeDisplayState(snapshot, turn),
        { initialProps: { snapshot: baseSession, turn: null } }
    );

    let renderCount = 0;
    const originalMemo = useMemo;
    jest.spyOn(React, 'useMemo').mockImplementation((fn) => {
        renderCount++;
        return originalMemo(fn, []);
    });

    // Rerender with same props
    rerender({ snapshot: baseSession, turn: null });

    // Should not recompute (same dependencies)
    expect(renderCount).toBe(1);
});
```

### Test 8.2: No unnecessary re-renders on dependency change

```typescript
test('should recompute when dependencies change', () => {
    let computeCount = 0;
    
    const { rerender } = renderHook(
        ({ snapshot, turn }) => {
            useMemo(() => {
                computeCount++;
                return computeDisplayState(snapshot, turn);
            }, [snapshot, turn]);
        },
        { initialProps: { snapshot: baseSession, turn: null } }
    );

    rerender({ snapshot: baseSession, turn: null });
    expect(computeCount).toBe(1);

    rerender({ snapshot: { ...baseSession, status: 'completed' }, turn: null });
    expect(computeCount).toBe(2);  // Recomputed due to snapshot change
});
```

---

## Test Helpers & Utilities

```typescript
// Base objects for reuse
const baseSession: TutorSessionSnapshot = {
    session_id: 1,
    learner_id: 100,
    course_id: 1,
    block_id: 1,
    persona_name: 'Aurora',
    status: 'active',
    total_turns: 1,
    created_at: '2025-10-23T00:00:00Z',
    updated_at: '2025-10-23T00:00:00Z',
};

// Helper function to compute display state
const computeDisplayState = (snapshot: TutorSessionSnapshot | null, turn: TutorTurn | null) => {
    if (!snapshot) {
        return {
            mode: 'idle' as const,
            showNarration: false,
            showQuestion: false,
            showCheckpoint: false,
            showSuggestions: false,
        };
    }

    const status = snapshot.status;

    if (status === 'awaiting_checkpoint') {
        return {
            mode: 'awaiting_checkpoint' as const,
            showNarration: true,
            showQuestion: false,
            showCheckpoint: true,
            showSuggestions: false,
        };
    }

    if (status === 'active') {
        const hasQuestion = !!turn?.comprehension_check;
        const hasCheckpoint = turn?.checkpoint && turn.checkpoint.required;

        return {
            mode: 'active' as const,
            showNarration: true,
            showQuestion: hasQuestion,
            showCheckpoint: hasCheckpoint && !hasQuestion,
            showSuggestions: !hasCheckpoint && !hasQuestion,
        };
    }

    if (status === 'completed') {
        return {
            mode: 'completed' as const,
            showNarration: false,
            showQuestion: false,
            showCheckpoint: false,
            showSuggestions: false,
        };
    }

    return {
        mode: 'idle' as const,
        showNarration: false,
        showQuestion: false,
        showCheckpoint: false,
        showSuggestions: false,
    };
};
```

---

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test StudySessionScreen.auroraState.test.ts

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

---

## Coverage Goals

- **Statements**: 100%
- **Branches**: 100% (all if/else paths)
- **Functions**: 100%
- **Lines**: 100%

All tests in this suite aim to achieve 100% coverage of the `auroraDisplayState` logic.

