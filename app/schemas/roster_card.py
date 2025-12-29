from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class RosterCardBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    bg: Optional[str] = ""


class RosterCardCreate(RosterCardBase):
    pass


class RosterCardUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    bg: Optional[str] = None


class RosterCardOut(BaseModel):
    id: int
    user_id: int
    name: str
    bg: str

    class Config:
        from_attributes = True
