# Backend Patch Kit: Allow block-only submissions

This patch kit helps update the FastAPI + SQLAlchemy + Postgres backend so uploads/submissions can be associated with a block without requiring `lesson_id`.

## Goals
- Make `as_ai_submissions.lesson_id` nullable
- Add a partial uniqueness/validation rule: at least one of `lesson_id` or `block_id` must be provided
- Ensure upload handler accepts and uses `block_id`/`assignment_id` metadata

## 1) Alembic migration (DDL)
Create a new Alembic revision in your backend repo. Example migration body:

```py
# revision identifiers, used by Alembic.
revision = "2025_09_30_allow_block_only_submissions"
down_revision = "<fill_previous_revision>"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade():
    # 1. Make lesson_id nullable on as_ai_submissions
    op.alter_column(
        'as_ai_submissions',
        'lesson_id',
        existing_type=sa.Integer(),
        nullable=True
    )

    # 2. Add a CHECK constraint enforcing at least one of lesson_id or block_id
    # Some Postgres versions need naming; change the name if it conflicts.
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'ck_as_ai_submissions_lesson_or_block'
            ) THEN
                ALTER TABLE as_ai_submissions
                ADD CONSTRAINT ck_as_ai_submissions_lesson_or_block
                CHECK ((lesson_id IS NOT NULL) OR (block_id IS NOT NULL));
            END IF;
        END $$;
        """
    )


def downgrade():
    # Drop CHECK constraint if exists
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'ck_as_ai_submissions_lesson_or_block'
            ) THEN
                ALTER TABLE as_ai_submissions
                DROP CONSTRAINT ck_as_ai_submissions_lesson_or_block;
            END IF;
        END $$;
        """
    )

    # Revert lesson_id to NOT NULL (only if your data guarantees backfill)
    op.alter_column(
        'as_ai_submissions',
        'lesson_id',
        existing_type=sa.Integer(),
        nullable=False
    )
```

Run the migration in your backend project after generating the revision header:

```powershell
# In your backend repo
alembic revision -m "Allow block-only submissions"; alembic upgrade head
```

## 2) SQLAlchemy model update
In your `AsAISubmission` model (or equivalent), make `lesson_id` optional and ensure relationships reflect this:

```py
class AsAISubmission(Base):
    __tablename__ = "as_ai_submissions"

    id = sa.Column(sa.Integer, primary_key=True)
    course_id = sa.Column(sa.Integer, sa.ForeignKey("as_courses.id"), nullable=False)
    # lesson can be optional now
    lesson_id = sa.Column(sa.Integer, sa.ForeignKey("as_lessons.id"), nullable=True)
    # block support (already present). Ensure FK points to blocks table
    block_id = sa.Column(sa.Integer, sa.ForeignKey("as_course_blocks.id"), nullable=True)
    session_id = sa.Column(sa.Integer, sa.ForeignKey("as_study_sessions.id"), nullable=False)
    assignment_id = sa.Column(sa.Integer, sa.ForeignKey("as_assignments.id"), nullable=True)
    submission_type = sa.Column(sa.String, nullable=False)
    # ... other fields ...

    __table_args__ = (
        sa.CheckConstraint('(lesson_id IS NOT NULL) OR (block_id IS NOT NULL)',
                           name='ck_as_ai_submissions_lesson_or_block'),
    )
```

If you use Pydantic schemas, update them to make `lesson_id` optional where appropriate.

## 3) Upload handler tweak
In the `bulk_upload_to_pdf` handler under `/after-school/uploads`, accept and propagate the new metadata:

```py
@router.post("/bulk-upload-to-pdf")
async def bulk_upload_to_pdf(
    session_id: int = Form(...),
    submission_type: str = Form(...),
    files: List[UploadFile] = File(...),
    # New contextual metadata
    course_id: Optional[int] = Form(None),
    lesson_id: Optional[int] = Form(None),
    block_id: Optional[int] = Form(None),
    assignment_id: Optional[int] = Form(None),
    storage_mode: Optional[str] = Form(None),
    skip_db: Optional[bool] = Form(False),
    current_user: User = Depends(get_current_user),
):
    # ... combine to PDF ...

    if not skip_db:
        submission = AsAISubmission(
            user_id=current_user.id,
            course_id=course_id or resolved_course_id_from_session(session_id),
            lesson_id=lesson_id,  # can be None now
            block_id=block_id,    # supported
            session_id=session_id,
            assignment_id=assignment_id,
            submission_type=submission_type,
            original_filename=pdf_filename,
            file_path=stored_path,
            file_type='application/pdf',
            ai_processed=False,
            requires_review=False,
        )
        db.add(submission)
        db.commit()
        db.refresh(submission)

    # ... trigger AI processing ...
```

Optionally, if `course_id` isn’t sent, you can derive it from the session. Keep the new check constraint to ensure at least one anchor is present.

## 4) Validation layer (FastAPI / Pydantic)
If you validate inputs with Pydantic models, update the schema for create/write operations to:

- make `lesson_id: Optional[int]` and `block_id: Optional[int]`
- add a validator to ensure at least one is provided

```py
@validator('lesson_id', always=True)
def lesson_or_block(cls, v, values):
    if v is None and not values.get('block_id'):
        raise ValueError('Either lesson_id or block_id must be provided')
    return v
```

## 5) Rollout notes
- Run the migration before deploying the API change.
- Ensure any background consumers that read `lesson_id` handle NULLs.
- Update analytics/queries to use `(lesson_id IS NOT NULL OR block_id IS NOT NULL)`.

---

If you share the backend repo’s paths for the model and router, I can tailor the diffs precisely to your code structure.
