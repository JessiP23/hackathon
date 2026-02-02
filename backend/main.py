import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import vendors, orders, deals, voice

app = FastAPI(title="InfraStreet API")

origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
	CORSMiddleware,
	allow_origins=[o.strip() for o in origins if o.strip()],
	allow_credentials=True,
	allow_methods=["*"] ,
	allow_headers=["*"],
)

app.include_router(vendors.router, prefix="/vendors", tags=["vendors"])
app.include_router(orders.router, prefix="/orders", tags=["orders"])
app.include_router(deals.router, prefix="/deals", tags=["deals"])
app.include_router(voice.router, tags=["voice"])