from fastapi import FastAPI
from app.core.database import connect_to_mongo,close_mongo_connection
app=FastAPI()

# Register the every routes


# connecting to mongodb when the server starts
@app.on_event("startup")
async def startup_event():
    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown_event():
    await close_mongo_connection()
# 
@app.get("/")
def server():
  return {"message":"Server running ! 🚀"}