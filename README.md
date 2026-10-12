# SupplyFlow Optimizer — Customer Portal Edition

## Run
1. Extract the ZIP.
2. Open this folder in VS Code.
3. Run `py -m http.server 8000` in the terminal.
4. Open `http://localhost:8000/supplyflow_optimizer/` if serving the parent folder, or `http://localhost:8000/` if serving this folder directly.
5. Internet is needed for Chart.js charts.

## Customer ordering demo
1. Click **Customer Portal** in the sidebar.
2. Search/filter products and choose a quantity.
3. Click **Add to cart**.
4. Adjust quantities or remove cart items.
5. Click **Proceed to checkout**.
6. Enter customer/business name and delivery address.
7. Click **Place order**.
8. The app creates an order ID, decreases inventory, and opens the Orders page. The order status starts at Pending.
9. Return to Dashboard to see metrics and alerts update.

## Features
- Dashboard KPIs, category chart, recent orders, alerts.
- Inventory add/edit/delete/search/filter and CSV export.
- Staff order form plus customer-facing portal with cart and checkout.
- Stock validation and inventory deduction at order placement.
- Order status updates; cancelling an order restores reserved stock.
- Route ordering heuristic using fictional coordinates.
- Three-month moving-average demand forecast.
- Reports and CSV export.
- Browser localStorage persistence.

## Scope limitations
This is a front-end prototype. It has no server database, customer login, online payment, live shipping, or shared data across different browsers/devices. Data is stored in the current browser profile. For production, implement a backend API, database, authentication, payment integration and real routing service. The forecast is a moving average, not a trained ML model.
