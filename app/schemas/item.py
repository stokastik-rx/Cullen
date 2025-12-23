"""
Item schemas for request/response validation
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class ItemBase(BaseModel):
    """Base item schema with common fields"""
    name: str = Field(..., min_length=1, max_length=100, description="Item name")
    description: Optional[str] = Field(None, max_length=500, description="Item description")
    price: float = Field(..., gt=0, description="Item price")


class ItemCreate(ItemBase):
    """Schema for creating a new item"""
    pass


class ItemUpdate(BaseModel):
    """Schema for updating an item"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    price: Optional[float] = Field(None, gt=0)


class Item(ItemBase):
    """Schema for item response"""
    id: int
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}

