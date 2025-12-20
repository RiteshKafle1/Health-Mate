import logging
from fastapi import FastAPI
from app.core.database import connect_to_mongo,close_mongo_connection
from app.routes.user_routes import router as user_router
from app.routes.doctor_routes import router as doctor_router

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s | %(message)s"
)
#creating the instance of fastapi
app=FastAPI()

# Register the every routes
app.inlcude_router(user_router,prefix="/api/v1/users")
app.inlcude_router(doctor_router,prefix="/api/v1/doctors")


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