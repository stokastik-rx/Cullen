"""
Items endpoints - example CRUD operations
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas.item import Item, ItemCreate, ItemUpdate
from app.services.item_service import ItemService

router = APIRouter()


@router.get("", response_model=List[Item], status_code=status.HTTP_200_OK)
async def get_items(
    skip: int = 0,
    limit: int = 100,
    service: ItemService = Depends(),
):
    """Get all items with pagination"""
    items = await service.get_items(skip=skip, limit=limit)
    return items


@router.get("/{item_id}", response_model=Item, status_code=status.HTTP_200_OK)
async def get_item(
    item_id: int,
    service: ItemService = Depends(),
):
    """Get a specific item by ID"""
    item = await service.get_item(item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id {item_id} not found",
        )
    return item


@router.post("", response_model=Item, status_code=status.HTTP_201_CREATED)
async def create_item(
    item: ItemCreate,
    service: ItemService = Depends(),
):
    """Create a new item"""
    return await service.create_item(item)


@router.put("/{item_id}", response_model=Item, status_code=status.HTTP_200_OK)
async def update_item(
    item_id: int,
    item_update: ItemUpdate,
    service: ItemService = Depends(),
):
    """Update an existing item"""
    item = await service.update_item(item_id, item_update)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id {item_id} not found",
        )
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: int,
    service: ItemService = Depends(),
):
    """Delete an item"""
    success = await service.delete_item(item_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id {item_id} not found",
        )

