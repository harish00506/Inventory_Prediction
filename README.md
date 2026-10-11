# Sales & Inventory Forecasting System

AI-powered forecasting system using LightGBM to predict daily sales and inventory requirements.

**Case study — the problem, the models and the results: [www.harishg.com/works/stocksense-ai](https://www.harishg.com/works/stocksense-ai)**

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│   Frontend   │────▶│   Backend    │────▶│ PostgreSQL │
│ React + Vite │     │   FastAPI    │     │            │
│  Port 3000   │     │  Port 8000   │     │ Port 5432  │
└─────────────┘     └──────────────┘     └────────────┘
                          │
                    ┌─────┴─────┐
                    │  LightGBM │
                    │   Model   │
                    └───────────┘
```

## Quick Start with Docker

```bash
# Start all services
docker-compose up --build

# In another terminal, ingest data
docker-compose exec backend python -m ingest

# Train the model
docker-compose exec backend python -c "from app.ml.train import train_model; train_model()"

# Open dashboard
# http://localhost:3000
```

## Local Development (without Docker)

### Backend
```bash
cd backend
pip install -r requirements.txt

# Start PostgreSQL (must be running)
# Set DATABASE_URL env var if not using default

python -m ingest                    # Load data
python -c "from app.ml.train import train_model; train_model()"  # Train model
uvicorn app.main:app --reload       # Start API
```

### Frontend
```bash
cd frontend
npm install
npm run dev    # http://localhost:3000
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/forecast` | Predict daily sales (qty + revenue) for a date range |
| POST | `/inventory` | Compute inventory requirements with safety stock |
| GET | `/evaluation` | Get model metrics (MAPE, MAE, RMSE, R²) |
| POST | `/retrain` | Retrain the LightGBM model |
| GET | `/abc-analysis` | ABC product classification |
| GET | `/top-products` | Top 10 products by revenue |
| GET | `/stores` | List all stores |
| GET | `/products` | List products |

## ML Model

- **Algorithm**: LightGBM (global model)
- **Target**: Daily quantity per store-product
- **Revenue**: Derived as `predicted_quantity × avg_selling_price`
- **Forecasting**: Recursive multi-step (day-by-day)
- **Features**: Time (day_of_week, month, quarter), Lags (1,7,14,28,30,90), Rolling (mean_7/14/30, std_30), Encoded store/product IDs
- **Split**: Train 300d / Val 45d / Test 20d

## Inventory Formula

```
Safety Stock = Z × σ × √(Lead Time)
Required Inventory = Predicted Demand + Safety Stock
```
- Z = 1.65 (95% service level)
- σ = historical std dev of daily quantity
- Lead Time = per-product (3-14 days)

## Operational Limits (Timeout Protection)

- Unfiltered requests (`all stores + all products`) are limited to **31 days**.
- Backend adaptively limits product count by request size to keep forecast jobs responsive.
- Configure via environment variables:
      - `MAX_UNFILTERED_DAYS` (default: `31`)
      - `MAX_FORECAST_POINTS` (default: `12000`)

## Prediction Uplift

- Forecast output is uplifted by **7% to 8%** over raw model predictions by default.
- Configure via environment variables:
      - `PREDICTION_UPLIFT_MIN` (default: `0.07`)
      - `PREDICTION_UPLIFT_MAX` (default: `0.08`)

## Tech Stack

- **Backend**: Python, FastAPI, SQLAlchemy, LightGBM
- **Frontend**: React, Vite, TailwindCSS, Recharts, Lucide
- **Database**: PostgreSQL
- **Deploy**: Docker Compose

## Omni-Channel Demo Dataset

Generate a deterministic omni-channel dummy dataset (Offline, E-Commerce, Quick-Commerce) compatible with `backend/ingest.py`.

### Local

From project root:

```bash
python backend/generate_omnichannel_dummy.py \
      --output Data/omnichannel_dummy.csv \
      --days 120 \
      --start-date 2025-01-01 \
      --seed 42
```

To force year-on-year growth between 7% and 8% for multi-year generation, add:

```bash
      --yoy-min 0.07 \
      --yoy-max 0.08
```

Ingest and train using the generated file:

```bash
cd backend
DATA_PATH=../Data/omnichannel_dummy.csv python -m ingest
python -c "from app.ml.train import train_model; train_model()"
```

### Docker

From project root:

```bash
docker-compose up --build -d
docker-compose exec backend python generate_omnichannel_dummy.py \
      --output /data/omnichannel_dummy.csv \
      --days 120 \
      --start-date 2025-01-01 \
      --seed 42
docker-compose exec -e DATA_PATH=/data/omnichannel_dummy.csv backend python -m ingest
docker-compose exec backend python -c "from app.ml.train import train_model; train_model()"
```

### Demo API Calls

```bash
curl -X POST http://localhost:8000/forecast \
      -H "Content-Type: application/json" \
      -d '{"start_date":"2025-03-01","end_date":"2025-03-14"}'

curl -X POST http://localhost:8000/inventory \
      -H "Content-Type: application/json" \
      -d '{"start_date":"2025-03-01","end_date":"2025-03-14","store_id":101,"product_id":2001}'
```
