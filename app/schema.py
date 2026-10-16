"""Output schema for the meeting analysis + the prompts used by the pipeline."""
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


# ============================================================
# 1. OUTPUT SCHEMA
# ============================================================

class SectionStatus(str, Enum):
    DECIDED = "DECIDED"                # Ended with a decision
    PENDING = "PENDING"                # Still pending
    INFORMATIONAL = "INFORMATIONAL"    # Presentation / explanation only
    FOLLOW_UP = "FOLLOW_UP"            # Requires follow-up or another meeting


class MeetingType(str, Enum):
    DECISION = "DECISION"
    DEMO = "DEMO"
    PRESENTATION = "PRESENTATION"
    STATUS_UPDATE = "STATUS_UPDATE"
    DISCOVERY = "DISCOVERY"
    TRAINING = "TRAINING"
    OTHER = "OTHER"


class Participant(BaseModel):
    name: str = Field(
        description="Participant's name as mentioned in the meeting, or a description "
                    "(e.g., Main Speaker) if their name was not mentioned"
    )
    role: Optional[str] = Field(
        default=None,
        description="The participant's role or the organization they represent if explicitly mentioned, otherwise null"
    )
    contribution: Optional[str] = Field(
        default=None,
        description="The most important contribution made by this participant in one sentence, or null"
    )


class QAItem(BaseModel):
    question: str = Field(description="The question as it was asked during the meeting")
    answer: Optional[str] = Field(
        default=None,
        description="The answer that was provided, or null if the question remained unanswered"
    )
    asked_by: Optional[str] = Field(
        default=None,
        description="Who asked the question if clearly identifiable, otherwise null"
    )


class MeetingSection(BaseModel):
    """One section/topic of the meeting - the core of the detailed analysis."""

    section_number: int = Field(description="The section's order in the meeting, starting from 1")
    section_title: str = Field(
        description="A clear and specific title describing the topic discussed in this part of the meeting"
    )
    time_range: Optional[str] = Field(
        default=None,
        description="Time range of the section in HH:MM:SS - HH:MM:SS format, taken ONLY from the "
                    "transcript timestamps, or null if it cannot be determined"
    )
    purpose: str = Field(description="Why this topic was discussed and what its purpose was")
    detailed_discussion: str = Field(
        description=(
            "Detailed explanation (3 to 8 sentences) of what happened in this section: "
            "who spoke, what they said, the arguments and objections raised, "
            "and how the discussion developed until its conclusion"
        )
    )
    key_points: List[str] = Field(
        description="The main specific points raised in this section, with each point as a separate item"
    )
    screen_content: Optional[str] = Field(
        default=None,
        description=(
            "Description of what appeared on screen during this section and its relation "
            "to the discussion (screens, tables, numbers, slides). null if nothing appeared or it was unclear"
        )
    )
    numbers_mentioned: List[str] = Field(
        default_factory=list,
        description=(
            "Numbers, amounts, percentages, and dates explicitly mentioned in this section "
            "along with their context. Empty list if there are none"
        )
    )
    questions_and_answers: List[QAItem] = Field(
        default_factory=list,
        description="Questions asked in this section and their answers. Empty list if there are none"
    )
    concerns_raised: List[str] = Field(
        default_factory=list,
        description="Concerns, objections, or risks mentioned in this section. Empty list if there are none"
    )
    outcome: str = Field(
        description="What this section specifically concluded with: a decision, postponement, "
                    "explanation only, or preliminary agreement"
    )
    status: SectionStatus = Field(description="The status of the section at its conclusion")


class Decision(BaseModel):
    decision: str = Field(description="The decision that was actually agreed upon")
    context: str = Field(
        description="Why this decision was made and what alternatives were discussed beforehand"
    )
    decided_by: Optional[str] = Field(
        default=None,
        description="Who made or approved the decision if clearly identifiable, otherwise null"
    )
    related_section: Optional[int] = Field(
        default=None, description="The section number that resulted in this decision, or null"
    )


class ActionItem(BaseModel):
    task: str = Field(description="The required task described clearly and precisely")
    details: Optional[str] = Field(
        default=None, description="Additional details about the task as mentioned in the meeting, or null"
    )
    assignee: Optional[str] = Field(
        default=None, description="The person responsible for the task, or null if not specified"
    )
    deadline: Optional[str] = Field(
        default=None, description="The deadline mentioned in the meeting, or null if not specified"
    )
    related_section: Optional[int] = Field(
        default=None, description="The section number that resulted in this task, or null"
    )


class UnresolvedIssue(BaseModel):
    issue: str = Field(description="The topic that remained unresolved")
    why_unresolved: str = Field(
        description="Reason why it remained unresolved: missing information, disagreement, "
                    "postponement, or waiting for another party"
    )
    blocking: Optional[str] = Field(
        default=None, description="What this issue is blocking or who/what it is waiting for, or null"
    )
    related_section: Optional[int] = Field(default=None, description="The related section number, or null")


class MeetingAnalysis(BaseModel):
    title: str = Field(description="A concise and accurate title reflecting the main topic of the meeting")
    meeting_type: MeetingType = Field(description="The actual meeting type based on its content")
    meeting_purpose: str = Field(description="The main purpose of the meeting in no more than two sentences")
    duration_note: Optional[str] = Field(
        default=None, description="Approximate meeting duration based on the transcript timestamps, or null"
    )
    participants: List[Participant] = Field(
        default_factory=list,
        description="Participants who could actually be identified. Do not invent names. "
                    "Empty list if identification is not possible"
    )
    agenda: List[str] = Field(
        default_factory=list,
        description="A list of the topics covered in the meeting in chronological order, using short titles"
    )
    executive_summary: str = Field(
        description="Executive summary (5 to 10 sentences) explaining the purpose, key discussions, "
                    "final outcome, and next steps"
    )
    sections: List[MeetingSection] = Field(
        description="Detailed analysis of each meeting topic in chronological order"
    )
    key_decisions: List[Decision] = Field(
        default_factory=list, description="Only the decisions that were actually agreed upon"
    )
    action_items: List[ActionItem] = Field(
        default_factory=list, description="Tasks that were assigned to specific people"
    )
    unresolved_issues: List[UnresolvedIssue] = Field(
        default_factory=list, description="Topics that remained without a final decision"
    )
    risks_and_concerns: List[str] = Field(
        default_factory=list, description="Risks or concerns explicitly mentioned during the meeting"
    )
    next_steps: List[str] = Field(
        default_factory=list, description="Agreed-upon next steps after the meeting"
    )


# ============================================================
# 2. PROMPTS
# ============================================================

# FIX: the transcript now carries timestamps, so summaries and chatbot answers
# can cite real times instead of invented ones.
TRANSCRIBE_PROMPT = """
Transcribe the entire spoken conversation in this video.

Start every speaker turn with its timestamp (time from the start of the video)
in [HH:MM:SS] format, followed by the speaker name, then their words on the next line:

[00:00:05] Ahmad:
Hello everyone, today we'll discuss the project.

[00:00:12] Sara:
Yes, I have prepared the report.

Rules:
- Identify each speaker by their actual name whenever their name is explicitly mentioned
  or can be reliably determined from the conversation.
- If a speaker's name cannot be determined with confidence, use Speaker 1, Speaker 2, Speaker 3...
- Keep the same speaker name consistently throughout the entire transcript.
- If one speaker talks for a long time, start a new line with a fresh timestamp roughly
  every 60 seconds, repeating the speaker name.
- Include ALL spoken content exactly as spoken, in the original language (do not translate),
  including questions, answers, introductions, discussions, and short statements.
- Do not summarize, analyze, paraphrase, or omit spoken content.

Return ONLY the transcript.
"""

# FIX: removed the old free-text OUTPUT FORMAT block that contradicted the JSON schema.
ANALYSIS_PROMPT = """
You are a meeting analyst. You will receive a raw meeting transcript with [HH:MM:SS] timestamps.
The transcript may be in Arabic or mixed Arabic/English; always write the output in English.

STYLE RULES
- Third person, past tense, formal and neutral. Never use "I", "we", or "you".
- Refer to participants by their full name every time (e.g. "Mahdi Assar noted...").
- Expand acronyms on first use (e.g. "Customer Relationship Management (CRM)").
- No direct quotes, no filler, no small talk, no opinions, no evaluation of the meeting.
- Prefer nominalized, dense phrasing over conversational phrasing.

ACCURACY RULES
- Do not invent information: participants, decisions, action items, deadlines or numbers.
- If something was only mentioned as a placeholder or as unfinished, describe it as such.
- Use ONLY the timestamps that appear in the transcript for time ranges. Never guess times.
"""
