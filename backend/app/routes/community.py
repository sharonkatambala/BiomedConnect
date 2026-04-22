from typing import List, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.services.auth import AuthenticatedUser, get_current_user
from app.services.community_db import get_posts, add_post
from app.services.db import ensure_profile

router = APIRouter(prefix="/api/community", tags=["community"])

class PostCreate(BaseModel):
    room: Literal["discussion", "expert_qna"]
    content: str = Field(min_length=1, max_length=2000)

class PostResponse(BaseModel):
    id: int
    room: str
    user_id: str
    user_name: str
    user_role: str
    avatar_label: str
    content: str
    created_at: str

# GET is public — anyone (including guests) can read community posts
@router.get("/{room}", response_model=List[PostResponse])
async def get_community_posts(room: str) -> List[PostResponse]:
    return get_posts(room)

# POST requires a signed-in user
@router.post("/", response_model=PostResponse)
async def create_community_post(post: PostCreate, current_user: AuthenticatedUser = Depends(get_current_user)) -> PostResponse:
    profile = ensure_profile(current_user)
    return add_post(
        room=post.room,
        user_id=current_user.id,
        user_name=current_user.full_name,
        user_role=profile.get("role_label", "Student"),
        avatar_label=current_user.avatar_label,
        content=post.content
    )
