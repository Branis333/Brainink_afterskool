# BrainInk Backend Architecture - Complete Flow

## System Overview

The backend is a **FastAPI microservices architecture** hosted on Render. The AI Tutor feature follows a specific flow where the **Gemini API generates structured tutoring responses** that flow through the system to the frontend.

```
User Input → Backend API → Gemini Service → Response JSON → Database Log → Frontend
```

---

## Backend Architecture Layers

### 1. **FastAPI Endpoints** (`Endpoints/after_school/ai_tutor.py`)

**Base URL**: `https://brainink-backend.onrender.com/after-school/ai-tutor`

#### Key Endpoints:

```python
POST /sessions
├─ Starts a new AI tutor session
├─ Takes: course_id, block_id OR lesson_id, persona, preferred_learning_focus
└─ Returns: SessionStartResponse { session: TutorSessionSnapshot, tutor_turn: TutorTurn }

POST /sessions/{session_id}/message
├─ Student sends message (text, voice, or checkpoint response)
├─ Takes: message, input_type, metadata
└─ Returns: TutorTurn (next tutor response)

POST /sessions/{session_id}/checkpoint
├─ Student submits checkpoint work (photo, reflection, quiz)
├─ Takes: checkpoint_type, notes, artifact (file)
└─ Returns: TutorCheckpointResponse { status, ai_feedback, score }

GET /sessions/{session_id}
├─ Retrieves full session history
└─ Returns: TutorSessionDetail { session, interactions[] }

GET /sessions
├─ Lists all student's sessions
└─ Returns: TutorSessionListResponse { items[], total }

POST /sessions/{session_id}/complete
├─ Marks session as complete
└─ Returns: TutorSessionDetail with full history
```

---

### 2. **AI Tutor Service** (`services/ai_tutor_service.py`)

**Class**: `AITutorService` - Orchestrates the tutoring flow

#### Core Methods:

**`start_session(student_id, request, db)`**
1. Loads learning content (block or lesson)
2. **Segments content** into 180-word chunks (via `_segment_content`)
3. Creates `AITutorSession` record in database
4. Generates first `TutorTurn` via Gemini
5. Returns session + tutor turn

**`process_student_message(session_id, student_id, message_request, db)`**
1. Records student message as `AITutorInteraction`
2. Calls `_generate_tutor_turn` with new learner message
3. Returns next `TutorTurn`

**`_generate_tutor_turn(db, session, learner_message)`** ← **KEY METHOD**
1. Gets current content segment from session
2. Extracts last 10 interactions as history
3. **Calls Gemini** with structured prompt
4. Parses JSON response into `TutorTurn`
5. **Creates `AITutorCheckpoint`** if checkpoint required
6. Advances segment index if `advance_segment=true`
7. Logs interaction to database
8. Returns `TutorTurn` to frontend

**`submit_checkpoint(session_id, student_id, request, file_bytes, ...)`**
1. Retrieves latest open checkpoint
2. Saves file temporarily
3. **Calls Gemini** for analysis with file attachment
4. Stores AI feedback and score
5. Optionally advances to next segment
6. Returns `TutorCheckpointResponse`

---

### 3. **Gemini Service** (`services/gemini_service.py`)

**Class**: `GeminiService` - Direct Gemini API integration

#### Configuration:
- **Primary Model**: `gemini-2.5-flash-latest`
- **Fallback Model**: `gemini-2.5-flash`
- **No Safety Filters**: Explicitly disabled via prompt
- **Free-tier Optimization**: Uses fallback if primary fails

#### Key Methods:

**`async generate_ai_tutor_turn(persona, content_segment, history, learner_message, total_segments, current_index)`** ← **CORE AI METHOD**

**Input**:
```python
persona: {
  "persona": "friendly",  # tutor style
  "learning_focus": "balanced"  # teaching approach
}
content_segment: {
  "index": 0,
  "text": "The current 180-word content chunk"
}
history: [
  {
    "role": "tutor|student|system",
    "content": "previous message",
    "input_type": "text|voice|checkpoint",
    "created_at": "ISO timestamp"
  }
]
learner_message: "Student's latest input or null"
total_segments: 6
current_index: 2
```

**Gemini Prompt** (lines 2200-2250):
```
"You are {persona_label}.
You are guiding a learner through structured content with {total_segments} total segments.
You are currently guiding segment {current_index + 1}.

CONTENT SEGMENT:
\"\"\"{segment_text}\"\"\"

INTERACTION HISTORY (MOST RECENT FIRST):
{history_text}

LATEST LEARNER MESSAGE:
{learner_line}

TASK:
- Provide an engaging narration explaining the current segment...
- Optionally ask a concise comprehension question...
- Offer 1-3 short follow-up prompts...
- Decide if a checkpoint activity is needed...
- Indicate whether to advance to next segment...

Return a JSON object with the exact schema:
{
  "narration": string,
  "comprehension_check": string or null,
  "follow_up_prompts": [string],
  "checkpoint": {
    "required": boolean,
    "checkpoint_type": "photo" | "reflection" | "quiz",
    "instructions": string,
    "criteria": [string]
  } or null,
  "advance_segment": boolean
}

Always fill every field. Respond with pure JSON only."
```

**Output** (normalized):
```json
{
  "narration": "Welcome to our journey into...",
  "comprehension_check": "Can you explain what a vertebrate is?",
  "follow_up_prompts": [
    "What are some examples...",
    "Why do you think...",
    "How can assessment..."
  ],
  "checkpoint": {
    "required": true,
    "checkpoint_type": "reflection",
    "instructions": "Write a short paragraph about...",
    "criteria": [
      "Describe the situation",
      "Explain the approach",
      "Mention precautions"
    ]
  },
  "advance_segment": true
}
```

**`async analyze_student_work_with_gemini(prompt, file_path, mime_type, learner_notes)`**

**Input**:
- Original checkpoint instructions
- Uploaded file (photo, document, etc.)
- Student's notes/explanation

**Gemini Analysis Prompt**:
```
"You are an expert tutor reviewing a learner submission.
Instructions for the learner: {checkpoint.instructions}
Learner notes: {learner_notes}

Provide calm, actionable feedback...

Return JSON with schema:
{
  "feedback": {
    "summary": string,
    "strengths": [string],
    "improvements": [string],
    "next_steps": [string]
  },
  "score": number 0-100 or null,
  "needs_review": boolean,
  "tutor_message": string
}

Respond with JSON only."
```

---

## Data Models

### Database Models (`models/ai_tutor_models.py`)

**`AITutorSession`**
```python
id: int (PK)
student_id: int (FK)
course_id: int (FK)
block_id: int (FK, nullable)
lesson_id: int (FK, nullable)
status: TutorSessionStatus (INITIATED, IN_PROGRESS, AWAITING_CHECKPOINT, COMPLETED, ABANDONED, ERROR)
current_segment_index: int (0-based position in content segments)
content_segments: List[{index, text}] (segmented content)
persona_config: {persona, learning_focus}
tutor_settings: {source}
started_at: datetime
updated_at: datetime
completed_at: datetime (nullable)
interactions: Relationship → AITutorInteraction[]
checkpoints: Relationship → AITutorCheckpoint[]
```

**`AITutorInteraction`**
```python
id: int (PK)
session_id: int (FK)
role: TutorInteractionRole (TUTOR, STUDENT, SYSTEM)
content: str (the message text)
input_type: TutorInteractionInputType (TEXT, VOICE, CHECKPOINT)
metadata_payload: Dict (extra data, e.g., follow_up_prompts, checkpoint data)
created_at: datetime
```

**`AITutorCheckpoint`**
```python
id: int (PK)
session_id: int (FK)
checkpoint_type: str (photo, reflection, quiz)
prompt: str (instructions from tutor turn)
status: TutorCheckpointStatus (PENDING_ANALYSIS, ANALYZING, COMPLETED)
media_file_path: str (nullable, path to uploaded file)
media_mime_type: str (nullable, e.g., image/jpeg)
response_payload: Dict (notes, submitted_at)
ai_feedback: Dict (analysis results)
score: float (0-100, nullable)
completed_at: datetime (nullable)
```

---

## Response Schemas (`schemas/ai_tutor_schemas.py`)

### `TutorTurn` (Main Response)
```python
narration: str  # The explanation
comprehension_check: Optional[str]  # Question or null
follow_up_prompts: List[str]  # Array of suggested next questions
checkpoint: Optional[TutorTurnCheckpoint]  # Checkpoint task or null
# Note: advance_segment is in raw Gemini response but not in TutorTurn schema
```

### `TutorTurnCheckpoint`
```python
required: bool
checkpoint_type: TutorCheckpointType  # photo | reflection | quiz
instructions: str
criteria: Optional[List[str]]
```

### `SessionStartResponse`
```python
session: TutorSessionSnapshot
tutor_turn: TutorTurn
```

### `TutorSessionSnapshot`
```python
session_id: int
status: TutorSessionStatus
current_segment_index: int
total_segments: int
last_tutor_turn: Optional[TutorTurn]
created_at: datetime
updated_at: datetime
```

---

## Complete Request/Response Flow

### Scenario: Student Starts Aurora Mode

**1. Frontend Sends**:
```http
POST /after-school/ai-tutor/sessions
Content-Type: application/json
Authorization: Bearer {token}

{
  "course_id": 21,
  "block_id": 83,
  "persona": "friendly",
  "preferred_learning_focus": "step-by-step reasoning"
}
```

**2. Backend**:
- Loads block content from database
- Segments into ~180-word chunks: `[seg0, seg1, seg2, ...]`
- Creates session: `AITutorSession(student_id=2, course_id=21, block_id=83, current_segment_index=0, status=IN_PROGRESS)`
- Calls `_generate_tutor_turn(session, learner_message=None)`
  - Extracts seg0
  - Builds Gemini prompt
  - **Calls Gemini API**
  - Receives JSON response
  - Normalizes to TutorTurn

**3. Gemini Returns**:
```json
{
  "narration": "Welcome to our journey into the amazing world of living things!...",
  "comprehension_check": "Can you define what a vertebrate is?",
  "follow_up_prompts": [
    "What are some examples of vertebrates?",
    "Why do you think vertebrates have internal skeletons?",
    "How do invertebrates differ?"
  ],
  "checkpoint": null,
  "advance_segment": true
}
```

**4. Backend**:
- Logs to DB: `AITutorInteraction(role=TUTOR, content=narration, metadata={follow_up_prompts, checkpoint})`
- No checkpoint, so status stays IN_PROGRESS
- advance_segment=true, so `current_segment_index` → 1
- Returns response

**5. Frontend Receives**:
```json
{
  "session": {
    "session_id": 55,
    "status": "IN_PROGRESS",
    "current_segment_index": 1,
    "total_segments": 6,
    "created_at": "2025-10-21T12:07:00Z",
    "updated_at": "2025-10-21T12:07:05Z"
  },
  "tutor_turn": {
    "narration": "Welcome to our journey...",
    "comprehension_check": "Can you define what a vertebrate is?",
    "follow_up_prompts": [
      "What are some examples of vertebrates?",
      "Why do you think vertebrates have internal skeletons?",
      "How do invertebrates differ?"
    ],
    "checkpoint": null
  }
}
```

---

### Scenario: Student Answers Question + Aurora Shows Checkpoint

**1. Frontend Sends**:
```http
POST /after-school/ai-tutor/sessions/55/message
Content-Type: application/json

{
  "message": "A vertebrate is an animal with a backbone",
  "input_type": "text",
  "metadata": null
}
```

**2. Backend**:
- Logs student message: `AITutorInteraction(role=STUDENT, content="A vertebrate...")`
- Calls `_generate_tutor_turn(session, learner_message="A vertebrate...")`
  - History includes: [system, tutor(first), student(answer)]
  - Gets seg1
  - **Calls Gemini with full history + student answer**

**3. Gemini Returns** (with checkpoint):
```json
{
  "narration": "That's right! A vertebrate is an animal with a backbone, which...",
  "comprehension_check": null,
  "follow_up_prompts": [...],
  "checkpoint": {
    "required": true,
    "checkpoint_type": "reflection",
    "instructions": "Think of 3 vertebrates and 3 invertebrates you know. Write a short paragraph explaining the difference.",
    "criteria": [
      "Name at least 3 vertebrates",
      "Name at least 3 invertebrates",
      "Explain one key difference between them"
    ]
  },
  "advance_segment": false
}
```

**4. Backend**:
- Logs tutor response
- **Creates checkpoint**: `AITutorCheckpoint(session_id=55, checkpoint_type="reflection", prompt=instructions, status=PENDING_ANALYSIS)`
- **Sets session status = AWAITING_CHECKPOINT**
- Does NOT advance segment (advance_segment=false)

**5. Frontend Receives**:
```json
{
  "session": {
    "status": "AWAITING_CHECKPOINT",
    "current_segment_index": 1
  },
  "tutor_turn": {
    "narration": "That's right! A vertebrate is...",
    "comprehension_check": null,
    "follow_up_prompts": [...],
    "checkpoint": {
      "required": true,
      "checkpoint_type": "reflection",
      "instructions": "Think of 3 vertebrates...",
      "criteria": [...]
    }
  }
}
```

---

### Scenario: Student Submits Checkpoint

**1. Frontend Sends**:
```http
POST /after-school/ai-tutor/sessions/55/checkpoint
Content-Type: multipart/form-data

checkpoint_type: reflection
notes: "I found dogs and cats are vertebrates, beetles and ants are invertebrates. They differ because..."
artifact: (optional file upload)
```

**2. Backend**:
- Finds latest pending checkpoint
- Sets status = ANALYZING
- **Calls Gemini analyze API** with:
  - Original instructions
  - Student's notes
  - File (if provided)

**3. Gemini Returns** (analysis):
```json
{
  "feedback": {
    "summary": "Excellent work! You demonstrated a clear understanding...",
    "strengths": [
      "Correct identification of examples",
      "Clear explanation of the difference",
      "Good depth in your reflection"
    ],
    "improvements": [
      "Could have mentioned more examples"
    ],
    "next_steps": [
      "Explore adaptations of different animal types",
      "Research why certain animals are better adapted"
    ]
  },
  "score": 95,
  "needs_review": false,
  "tutor_message": "Great job! You're ready to move on..."
}
```

**4. Backend**:
- Updates checkpoint: status=COMPLETED, ai_feedback={...}, score=95
- `needs_review=false`, so advances segment: `current_segment_index` → 2
- Sets session status = IN_PROGRESS
- Returns response

**5. Frontend Receives**:
```json
{
  "checkpoint_id": 12,
  "status": "COMPLETED",
  "ai_feedback": {
    "summary": "Excellent work!...",
    "strengths": [...],
    "improvements": [...],
    "next_steps": [...]
  },
  "score": 95
}
```

---

## State Machine

```
INITIATED
  ↓
  ├─ START SESSION
  ↓
IN_PROGRESS ←→ (loop: student message → tutor response → advance segment)
  ↓
  ├─ [Gemini generates checkpoint with required=true]
  ↓
AWAITING_CHECKPOINT
  ├─ STUDENT SUBMITS CHECKPOINT
  ↓
  [Gemini analyzes, decides needs_review]
  ├─ true → IN_PROGRESS (stay on segment)
  └─ false → IN_PROGRESS (advance to next segment)
  ↓
IN_PROGRESS (continue until last segment)
  ↓
COMPLETED (student finishes session)
```

---

## Key Insights for Frontend

### What Controls Display Timing

1. **When Question Appears**:
   - Backend receives `comprehension_check` from Gemini
   - Only shows if `comprehension_check !== null`
   - Typically after narration finishes

2. **When Checkpoint Appears**:
   - Backend receives `checkpoint.required = true`
   - Sets session status to `AWAITING_CHECKPOINT`
   - Only shows checkpoint card, not follow-up suggestions
   - User submits, then feedback appears

3. **Follow-up Prompts**:
   - Shows as suggestion buttons
   - Only when `status = IN_PROGRESS` and no checkpoint awaiting
   - Array of 1-3 prompts from Gemini

4. **Segment Progression**:
   - `advance_segment` flag controls automatic progression
   - If `true`: next turn will be on next segment
   - If `false`: stay on current segment (e.g., for checkpoint)

---

## Frontend Integration Requirements

The frontend needs to:

1. **Track Session Status**: Use `session.status` to determine what to show
2. **Show Conditionally**:
   - `comprehension_check` only when present AND status = IN_PROGRESS
   - `checkpoint` only when status = AWAITING_CHECKPOINT
   - `follow_up_prompts` as buttons, but only when checkpoint not awaiting
3. **Handle State Transitions**: When checkpoint submitted, wait for response with new status
4. **Progressive Disclosure**: Show narration → question → checkpoint → follow-ups, not all at once

