"""
Item data model
"""
from datetime import datetime
from typing import Optional


class ItemModel:
    """Item data model"""
    
    def __init__(
        self,
        id: int,
        name: str,
        price: float,
        description: Optional[str] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
    ):
        self.id = id
        self.name = name
        self.description = description
        self.price = price
        self.created_at = created_at or datetime.utcnow()
        self.updated_at = updated_at or datetime.utcnow()

