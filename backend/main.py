from fastapi import FastAPI
from app.routers import vendors, orders, deals

app = FastAPI(title="InfraStreet API")

app.include_router(vendors.router, prefix="/vendors", tags=["vendors"])
app.include_router(orders.router, prefix="/orders", tags=["orders"])
app.include_router(deals.router, prefix="/deals", tags=["deals"])