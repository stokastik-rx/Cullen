"""
Chat service - business logic for chat operations
"""
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.chat import Chat
from app.schemas.chat import ChatCreate, ChatUpdate


class ChatService:
    """Service for chat operations"""
    
    def get_user_chats(self, user_id: int, db: Session) -> List[Chat]:
        """
        Get all chats for a user
        
        Args:
            user_id: User ID
            db: Database session
            
        Returns:
            List of Chat objects for the user
        """
        return db.query(Chat).filter(Chat.user_id == user_id).order_by(Chat.updated_at.desc()).all()
    
    def get_chat(self, chat_id: int, user_id: int, db: Session) -> Optional[Chat]:
        """
        Get a specific chat by ID (with user ownership check)
        
        Args:
            chat_id: Chat ID
            user_id: User ID (for ownership verification)
            db: Database session
            
        Returns:
            Chat object if found and owned by user, None otherwise
        """
        chat = db.query(Chat).filter(Chat.id == chat_id, Chat.user_id == user_id).first()
        return chat
    
    def create_chat(self, user_id: int, db: Session) -> Chat:
        """
        Create a new chat for a user
        
        Args:
            user_id: User ID
            db: Database session
            
        Returns:
            Created Chat object
        """
        db_chat = Chat(
            user_id=user_id,
            title="New chat",
            messages=[],
        )
        db.add(db_chat)
        db.commit()
        db.refresh(db_chat)
        return db_chat
    
    def update_chat(self, chat_id: int, user_id: int, chat_data: ChatUpdate, db: Session) -> Optional[Chat]:
        """
        Update a chat (with user ownership check)
        
        Args:
            chat_id: Chat ID
            user_id: User ID (for ownership verification)
            chat_data: Chat update data
            db: Database session
            
        Returns:
            Updated Chat object if found and owned by user, None otherwise
        """
        chat = self.get_chat(chat_id, user_id, db)
        if chat is None:
            return None
        
        if chat_data.title is not None:
            chat.title = chat_data.title
        
        if chat_data.messages is not None:
            # Convert ChatMessage objects to dicts for JSON storage
            chat.messages = [msg.model_dump() for msg in chat_data.messages]
        
        db.commit()
        db.refresh(chat)
        return chat
    
    def delete_chat(self, chat_id: int, user_id: int, db: Session) -> bool:
        """
        Delete a chat (with user ownership check)
        
        Args:
            chat_id: Chat ID
            user_id: User ID (for ownership verification)
            db: Database session
            
        Returns:
            True if deleted, False if not found or not owned by user
        """
        chat = self.get_chat(chat_id, user_id, db)
        if chat is None:
            return False
        
        db.delete(chat)
        db.commit()
        return True

