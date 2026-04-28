import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import vendors, orders, deals, voice, user
from app.routers.webhook import router as webhook_router
from app.routers.stripe_webhook import router as stripe_router

app = FastAPI(title="InfraStreet API")

origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
	CORSMiddleware,
	allow_origins=[o.strip() for o in origins if o.strip()],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

app.include_router(user.router, prefix="/users", tags=["users"])
app.include_router(vendors.router, prefix="/vendors", tags=["vendors"])
app.include_router(orders.router, prefix="/orders", tags=["orders"])
app.include_router(deals.router, prefix="/deals", tags=["deals"])
app.include_router(voice.router, tags=["voice"])
app.include_router(webhook_router, tags=["webhooks"])
app.include_router(stripe_router, tags=["stripe"])


@app.on_event("startup")
async def startup_event():
    from app.services.scheduler_service import create_scheduler
    scheduler = create_scheduler()
    if scheduler:
        scheduler.start()
        app.state.scheduler = scheduler
        print("✅ Scheduler started")


@app.on_event("shutdown")
async def shutdown_event():
    scheduler = getattr(app.state, "scheduler", None)
    if scheduler:
        scheduler.shutdown()


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "infrastreet-api"}


@app.get("/")
def root():
    return {"message": "InfraStreet API", "docs": "/docs"}
