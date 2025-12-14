from pydantic import BaseModel, Field, EmailStr
from typing import Optional

class User(BaseModel):

    name: str = Field(
        ...,
        min_length=3,
        max_length=20
    )

    email: EmailStr

    password: str = Field(
        ...,
        min_length=8
    )

    image: Optional[str] = None

    phone: Optional[str] = Field(
        None,
        min_length=10,
        max_length=15
    )

    address: Optional[str] = None

    gender: str = Field(
        None

    )

    dob: Optional[str] = None

class UserResponse(BaseModel):
  id:str
  name:str
  email:str
  image:str
  phone:str
  address:str
  dob:str
