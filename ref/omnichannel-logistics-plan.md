## Objective
Build a practical omni-channel logistics operating model that uses forecasted demand, dynamic safety stock, and ABC prioritization to keep service levels high while reducing stockouts and overstock across stores and channels.

## Network Setup
- Use a hub-and-spoke setup: one central replenishment node plus store-level fulfillment.
- Assign fast-moving A items to near-channel stock points; keep B/C items more centralized.
- Replenish by store-product demand signal, not static min/max only.
- Use store and product master data as the control backbone (store list + product list).

## Inventory Control in Omni-Channel
- Forecast demand by date range, store, and product; aggregate to weekly buying plans.
- Classify items with ABC analysis, then apply differentiated service targets:
  - A: highest availability, shortest review cycle.
  - B: balanced availability vs holding cost.
  - C: lean stock, tighter ordering discipline.
- Use reorder point and suggested order quantity as primary execution fields.
- Trigger escalation for items marked high stockout risk or `Order Now`.

## Dynamic Lead Time and Quantity Control
- Use dynamic lead time per item by combining baseline lead time with demand uncertainty and variability.
- Increase safety stock and review frequency when forecast uncertainty rises.
- Lower order frequency for stable items with low variability.
- Control quantity using:
  - predicted demand over review period,
  - safety stock buffer,
  - stockout risk band (High/Medium/Low).

## Logistics Plan
- Plan at weekly cadence with daily monitoring.
- Inbound:
  - Consolidate supplier POs by ABC class and route.
  - Prioritize A items for earliest receiving windows.
- Inter-store balancing:
  - Move surplus from low-risk stores to high-risk stores before new buy.
- Last-mile fulfillment:
  - Reserve top-demand SKU capacity for peak channel windows.
- Exception management:
  - Same-day action list for `Order Now` items.
  - 48-hour review list for `Monitor Closely` items.

## KPIs
- Service level by ABC class (% fill rate).
- Stockout risk mix (% High / Medium / Low).
- Forecast accuracy trend (MAPE, MAE, RMSE, R², Accuracy).
- Inventory health (required vs available, safety stock coverage days).
- Replenishment responsiveness (lead-time adherence, review cycle compliance).
- Revenue protection (lost-sales proxy from stockout events).

## Demo Walkthrough
- Endpoint list: `GET /health`, `GET /stores`, `GET /products`, `POST /forecast`, `POST /inventory`, `GET /abc-analysis`, `GET /evaluation`, `GET /forecast-logs`, `POST /actual-sales`, `GET /top-products-by-date`, `GET /bottom-products-by-date`, `GET /customer-portfolio`, `POST /retrain`.
- Step 1: Verify API status with `GET /health`.
- Step 2: Load master filters using `GET /stores` and `GET /products`.
- Step 3: Generate demand outlook using `POST /forecast` for next 7–14 days.
- Step 4: Generate replenishment actions using `POST /inventory` for same horizon.
- Step 5: Validate strategic mix using `GET /abc-analysis`.
- Step 6: Check model quality using `GET /evaluation`; retrain via `POST /retrain` if degradation is visible.
- Step 7: Compare forecast vs actual using `POST /actual-sales` and review recent runs with `GET /forecast-logs`.

## Weekly Operating Cadence
- Monday:
  - Run 14-day forecast and inventory for all key store-product scopes.
  - Approve PO and transfer plan for all `Order Now` and A-class risks.
- Tuesday–Thursday:
  - Monitor risk shifts daily; re-run targeted forecast/inventory for volatile items.
  - Execute inter-store balancing before placing additional purchase orders.
- Friday:
  - Review KPI pack (service, risk mix, model metrics, inventory health).
  - Capture exceptions and tune next week’s review periods and lead-time assumptions.
- Month-end:
  - Re-baseline ABC mix and retrain model when evaluation trend weakens.
