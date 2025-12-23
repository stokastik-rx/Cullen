"""
Chat endpoints
"""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter()


class ChatRequest(BaseModel):
    """Chat message request schema"""
    message: str = Field(..., min_length=1, max_length=4000, description="User message")


class ChatResponse(BaseModel):
    """Chat response schema"""
    response: str = Field(..., description="Assistant response")


@router.post("", response_model=ChatResponse, status_code=status.HTTP_200_OK)
async def chat(request: ChatRequest):
    """
    Process a chat message.
    
    This is a placeholder endpoint. You can connect your local model here.
    """
    # Placeholder response - replace with your model logic
    response = f"I received your message: '{request.message}'. This is a placeholder response. Connect your local model to generate real responses."
    
    return ChatResponse(response=response)

