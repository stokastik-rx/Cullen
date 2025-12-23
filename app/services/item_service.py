"""
Item service - business logic for items
"""
from typing import List, Optional
from datetime import datetime

from app.schemas.item import Item, ItemCreate, ItemUpdate
from app.models.item import ItemModel


class ItemService:
    """Service for item operations"""
    
    def __init__(self):
        # In a real application, this would be a database session
        # For now, using in-memory storage as an example
        self._items: List[ItemModel] = []
        self._next_id = 1
    
    async def get_items(self, skip: int = 0, limit: int = 100) -> List[Item]:
        """Get all items with pagination"""
        items = self._items[skip : skip + limit]
        return [self._model_to_schema(item) for item in items]
    
    async def get_item(self, item_id: int) -> Optional[Item]:
        """Get a specific item by ID"""
        item = next((item for item in self._items if item.id == item_id), None)
        if item:
            return self._model_to_schema(item)
        return None
    
    async def create_item(self, item_create: ItemCreate) -> Item:
        """Create a new item"""
        now = datetime.utcnow()
        item = ItemModel(
            id=self._next_id,
            name=item_create.name,
            description=item_create.description,
            price=item_create.price,
            created_at=now,
            updated_at=now,
        )
        self._next_id += 1
        self._items.append(item)
        return self._model_to_schema(item)
    
    async def update_item(self, item_id: int, item_update: ItemUpdate) -> Optional[Item]:
        """Update an existing item"""
        item = next((item for item in self._items if item.id == item_id), None)
        if not item:
            return None
        
        if item_update.name is not None:
            item.name = item_update.name
        if item_update.description is not None:
            item.description = item_update.description
        if item_update.price is not None:
            item.price = item_update.price
        
        item.updated_at = datetime.utcnow()
        return self._model_to_schema(item)
    
    async def delete_item(self, item_id: int) -> bool:
        """Delete an item"""
        item = next((item for item in self._items if item.id == item_id), None)
        if not item:
            return False
        
        self._items.remove(item)
        return True
    
    def _model_to_schema(self, model: ItemModel) -> Item:
        """Convert model to schema"""
        return Item(
            id=model.id,
            name=model.name,
            description=model.description,
            price=model.price,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

