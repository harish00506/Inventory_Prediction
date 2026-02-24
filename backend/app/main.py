from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routes import forecast, inventory, evaluation, retrain, analysis, omnichannel
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Sales & Inventory Forecasting API", version="1.0.0")

# CORS - allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables on startup
@app.on_event("startup")
def startup():
    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables ready.")

# Include routers
app.include_router(forecast.router, tags=["Forecast"])
app.include_router(inventory.router, tags=["Inventory"])
app.include_router(evaluation.router, tags=["Evaluation"])
app.include_router(retrain.router, tags=["Retrain"])
app.include_router(analysis.router, tags=["Analysis"])
app.include_router(omnichannel.router, tags=["OmniChannel"])


@app.get("/")
def root():
    return {"message": "Sales & Inventory Forecasting API is running"}


@app.get("/health")
def health():
    return {"status": "healthy"}
