# EliteEditionMongo – Detailed Documentation

## 1. Project Overview
EliteEditionMongo is a Node.js/Express REST API that provides product, sales, and filter data for an e‑commerce platform. The project is a fork of the original EliteEdition codebase, refactored to use **MongoDB** via **Mongoose** instead of Sequelize/SQL. It integrates with the **Unicommerce** API for export jobs and CSV data ingestion.

## 2. High‑Level Architecture
```
Client (Postman / Front‑end) → HTTP → Express Server → Controllers → Services → Mongoose Models ↔ MongoDB
                                     │                     │
                                     │                     └─ External API (Unicommerce)
                                     └─ Logger (Winston)
```
- **Express** handles routing, middleware, and error handling.
- **Controllers** are thin wrappers that receive HTTP requests, invoke service functions, and return JSON responses.
- **Services** contain business logic, external‑API calls, and data‑processing utilities.
- **Mongoose Models** define the MongoDB schema for each entity (Product, SaleOrder, User, etc.).
- **Winston logger** provides timestamped logs for debugging and production monitoring.

## 3. Technology Stack
| Layer | Technology |
|-------|------------|
| Runtime | Node.js (>=12) |
| Web Framework | Express |
| Database | MongoDB (via Mongoose) |
| Validation | @hapi/joi |
| Logging | Winston (with console transport) |
| Testing | Jest, Supertest |
| Report Generation | ExcelJS (XLSX) |
| Environment | dotenv |
| Security Middleware | helmet, compression, cors, xss‑clean |
| Rate Limiting | express-rate-limit |

## 4. Directory Structure
```
EliteEditionMongo/
├─ src/
│  ├─ config/               # Configuration files (logger, morgan, jwt, config)
│  ├─ controllers/          # Request handlers (auth, products, filters, salesList, user)
│  ├─ db/                    # Mongoose model definitions
│  ├─ middlewares/          # Error handling, rate limiting, JWT verification
│  ├─ routes/                # API route definitions (v1/*)
│  ├─ services/              # Business logic (api.service.js, user.service.js, salesList.service.js)
│  ├─ utils/                 # Helper utilities (catchAsync, ApiError, dataParser, constant)
│  ├─ tests/                 # Jest test suite and XLSX report generator
│  ├─ app.js                 # Express app configuration (middlewares, routes)
│  └─ index.js               # HTTP server entry point (creates http.Server)
├─ .env.example               # Template for environment variables
├─ .env                       # Local environment (not committed)
├─ package.json                # Scripts, dependencies, devDependencies
├─ DOCUMENTATION.md            # High‑level documentation (generated earlier)
├─ DETAILED_DOCUMENTATION.md  # **This file** – exhaustive documentation
└─ README.md                   # Short project overview on GitHub
```

## 5. Setup & Installation
1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd EliteEditionMongo
   ```
2. **Install dependencies**
   ```bash
   npm install
   ```
   - `exceljs` is included for XLSX report generation.
3. **Create an `.env` file** based on `.env.example` and fill in required values:
   - `MONGODB_URL` – MongoDB connection string.
   - `JWT_SECRET` – Secret for signing JWT tokens.
   - `UNICOMMERCE_CLIENT_ID` & `UNICOMMERCE_CLIENT_SECRET` – API credentials.
   - `SMTP_*` – Email server configuration (if email features are used).
4. **Start MongoDB** (local installation or Atlas cluster) and ensure the URI is reachable.
5. **Run the development server**
   ```bash
   npm run dev
   ```
   The API will be available at `http://0.0.0.0:3000` (default). Adjust `PORT` in `.env` if needed.

## 6. Environment Variables (Full List)
| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment (`development`, `production`, `test`). | `development` |
| `PORT` | Port on which the server listens. | `3000` |
| `MONGODB_URL` | MongoDB connection string. | `mongodb://localhost:27017/eliteedition` |
| `JWT_SECRET` | Secret for JWT signing. | `mySuperSecretKey` |
| `UNICOMMERCE_CLIENT_ID` | Unicommerce API client ID. | `abcd1234` |
| `UNICOMMERCE_CLIENT_SECRET` | Unicommerce API secret. | `secretXYZ` |
| `UNICOMMERCE_BASE_URL` | Base URL for Unicommerce services. | `https://eliteedition.unicommerce.com` |
| `SMTP_HOST` | SMTP host for sending emails. | `smtp.mailtrap.io` |
| `SMTP_PORT` | SMTP port. | `2525` |
| `SMTP_USER` | SMTP username. | `user123` |
| `SMTP_PASS` | SMTP password. | `pass456` |

## 7. Configuration Files
- **src/config/config.js** – Reads environment variables, exports a configuration object used throughout the app.
- **src/config/logger.js** – Configures Winston with console transport. Levels are `debug` in development, `info` otherwise.
- **src/config/morgan.js** – Sets up request logging (success and error handlers) using `morgan`.
- **src/config/jwt.js** – JWT verification middleware (currently disabled; can be enabled for protected routes).

## 8. Mongoose Models (src/db/models)
| Model | Fields | Description |
|-------|--------|-------------|
| **Product** | `sku`, `name`, `categoryName`, `brand`, `color`, `size`, `price`, ... | Stores product catalog data. |
| **SaleOrder** | `orderId`, `orderDate`, `shippingAddressState`, `shippingAddressCity`, `saleOrderStatus`, `items`, ... | Represents a sales order. |
| **User** | `name`, `email`, `password`, `role`, `isActive` | Application users for authentication. |
| **SalesList** | Mirrors CSV columns from Unicommerce export (e.g., `orderId`, `itemSKUCode`, `mrp`, `discount`, `totalPrice`, etc.) | Used for bulk CSV import. |

Models are defined in separate files under `src/db/models/` and exported via `index.js`.

## 9. Controllers (src/controllers)
### 9.1 `products.controller.js`
- **fetchFromAPIS** – Initiates an export job with Unicommerce, polls for completion, downloads the CSV, and returns the file location.
- **fetchProductsSales** – Retrieves paginated product sales data from MongoDB with optional sorting, date range, and filters.
- **Other CRUD endpoints** (create, read, update, delete) are present but omitted here for brevity.

All controller functions are wrapped with `catchAsync` to forward errors to the global error handler.

### 9.2 `auth.controller.js`
- **register** – Creates a new user, hashes password, and returns JWT tokens.
- **login** – Validates credentials and returns JWT tokens.
- **forgotPassword / resetPassword** – Generates a reset token, sends email, and updates password.

### 9.3 `filters.controller.js`
- **getUniqueFilters** – Queries distinct values for categories, colors, brands, sizes, cities, and order status. Returns a structured JSON that the front‑end can use to populate filter UI components.

### 9.4 `salesList.controller.js`
- **getSalseList** – Provides paginated sales‑order list with sorting and filtering.
- **saveCsvData** – Downloads a CSV from a public S3 URL, parses it, and bulk‑inserts into `SalesList` collection.
- **dropTable** – Deletes all documents from `SalesList` (useful for resetting test data).

### 9.5 `user.controller.js`
- Basic user management (profile view, update, delete) – currently minimal.

## 10. Services (src/services)
### 10.1 `api.service.js`
Key functions:
- `getAccessToken` – Retrieves an OAuth token from Unicommerce using client credentials.
- `createExportJob(accessToken)` – Sends a POST request to `/export/job/create`. It first tries a **primary body** (including `exportFilters` for today). If the API returns an error, it falls back to a minimal body without filters.
- `checkJobStatus(accessToken, jobCode)` – Polls `/export/job/status` to obtain job status and file URL.
- `readFile(fileLocation, accessToken)` – Downloads the CSV file from the URL returned by Unicommerce.

All HTTP calls use **axios** with proper headers (`Authorization: Bearer <token>`, `Content-Type: application/json`). Errors are logged with stack traces.

### 10.2 `user.service.js`
- `createUser(req)` – Creates a new user document, hashes password with bcrypt.
- `loginUser(email, password)` – Validates credentials and returns the user object.
- `updateUser(req)` – Updates user fields.

### 10.3 `salesList.service.js`
- `readFileFromUrl(url, token)` – Downloads CSV from a given URL; token is unused here but kept for API compatibility.
- Uses the `csv-parser` library to stream‑parse CSV rows.
- `convertKeysV2` (utility) maps CSV column names to the MongoDB schema.

## 11. Routes (src/routes/v1)
Each route file imports its controller and registers Express endpoints.
- **auth.route.js** – `/v1/auth/*`
- **products.route.js** – `/v1/products/*` (including `/fetchFromAPIS` POST)
- **filters.route.js** – `/v1/filters`
- **salesList.route.js** – `/v1/salesList/*`
- **user.route.js** – `/v1/users/*`

All routes are mounted under the `/v1` prefix in `src/app.js`.

## 12. Middleware Stack (src/middlewares)
- **error.js** – `errorConverter` transforms any thrown error into an `ApiError`; `errorHandler` formats the JSON response with status code and message.
- **rateLimiter.js** – Limits repeated failed login attempts (active only in production).
- **jwt.js** – JWT verification middleware (currently commented out; can be enabled for protected routes).
- **asyncHandler (catchAsync)** – Higher‑order function that catches async errors and passes them to `next()`.

## 13. Logging (src/config/logger.js)
Winston configuration:
```js
const logger = winston.createLogger({
  level: config.env === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    enumerateErrorFormat(),
    config.env === 'development' ? winston.format.colorize() : winston.format.uncolorize(),
    winston.format.splat(),
    winston.format.printf(({ level, message }) => `${level}: ${message}`)
  ),
  transports: [new winston.transports.Console({ stderrLevels: ['error'] })],
});
```
- **info** logs are used for normal flow (e.g., request start, job polling).
- **error** logs capture stack traces for debugging.
- The logger is imported wherever logging is needed (`const logger = require('../config/logger');`).

## 14. Testing
### 14.1 Jest Test Suite (`src/tests/api.test.js`)
- Uses **supertest** to send HTTP requests to the Express app.
- Tests all major endpoints (auth, products, filters, salesList).
- Records response time and status.
- Stores raw results in `src/tests/api_test_results.json` for reporting.

Run tests and generate the XLSX report:
```bash
npm run test:api
```
### 14.2 XLSX Report (`src/tests/reportGenerator.js`)
- Reads `api_test_results.json`.
- Creates `test_report.xlsx` using **ExcelJS** with columns:
  - Endpoint, Method, Status, Response Time (ms), Passed (YES/NO).
- The file is saved in the same `tests` directory.

## 15. Error Handling & Debugging
- All async controller functions are wrapped with `catchAsync`.
- Global error handling normalises errors to a consistent JSON shape:
  ```json
  { "code": 500, "message": "Internal Server Error" }
  ```
- Uncaught exceptions and unhandled promise rejections are captured in `src/index.js` and logged via Winston.
- For performance debugging, `morgan` logs each HTTP request (status, response time) to the console.

## 16. Deployment Guide
1. **Production Build (optional)** – No build step needed for a pure Node app.
2. **Set environment variables** on the host (e.g., via Docker `ENV` or a cloud service config).
3. **Process Manager** – Recommended to run with PM2 or a container orchestrator.
   ```bash
   npm install -g pm2
   pm2 start src/index.js --name elite-edition-mongo
   ```
4. **SSL Termination** – Typically handled by a reverse proxy (Nginx, HAProxy) in front of the Node process.
5. **Database Migration** – Ensure MongoDB collections are created; the app will auto‑create them on first insert.
6. **Monitoring** – Forward Winston logs to a log aggregation service (ELK, Datadog) if needed.

## 17. Frequently Asked Questions (FAQ)
| Question | Answer |
|----------|--------|
| **How to change the export date range?** | Edit `exportFilters` in `src/services/api.service.js` – change `textRange` (`TODAY`, `YESTERDAY`, `LAST_7_DAYS`, etc.) according to Unicommerce API documentation.
| **Why does `fetchFromAPIS` sometimes return 500?** | The API may not immediately provide a `filePath`. The polling logic now waits up to 5 minutes and logs each status check. Increase `MAX_POLL_TIME_MS` if needed.
| **Can I run the tests without generating the XLSX report?** | Yes – simply run `npx jest src/tests/api.test.js`. The report generator is invoked separately via `node src/tests/reportGenerator.js`.
| **How to enable JWT protection on routes?** | Uncomment the `app.use(jwt());` line in `src/app.js` and ensure the `jwt` middleware is correctly configured in `src/config/jwt.js`.
| **Where are the CSV files stored after download?** | They are streamed directly to memory and processed; no local file is persisted. If you need to keep the file, modify `readFile` in `api.service.js` to write to disk.

## 18. Future Enhancements (Roadmap)
- Implement **Swagger UI** documentation (`swagger-jsdoc` already present).
- Add **rate‑limiting** on the export endpoint to avoid hitting Unicommerce quotas.
- Introduce **Docker** containerization for easier CI/CD.
- Extend logging to a file transport or external service (e.g., Loggly, Papertrail).
- Write integration tests that mock Unicommerce responses.
- Add a front‑end UI (React/Vue) that consumes the API and displays the XLSX report.

---

*End of Detailed Documentation*
