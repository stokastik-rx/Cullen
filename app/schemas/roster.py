"""
Roster schemas for request/response validation
"""

from typing import List
from pydantic import BaseModel, Field


class RosterCard(BaseModel):
    """
    A single roster card as used by the frontend.
    """

    id: str = Field(..., min_length=1, max_length=80, description="Client-side card id (uuid-like string)")
    name: str = Field(..., min_length=1, max_length=120, description="Name of interest")
    bg: str = Field("", max_length=2000, description="Context / background information")


class RosterCards(BaseModel):
    """
    Wrapper schema (useful if you want a stable response shape).
    Currently not used by the endpoints which return a plain list for convenience.
    """

    cards: List[RosterCard]


