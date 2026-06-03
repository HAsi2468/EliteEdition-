# EliteEditionMongo – Project Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Directory Structure](#directory-structure)
4. [Setup & Installation](#setup--installation)
5. [Environment Variables](#environment-variables)
6. [Running the Application](#running-the-application)
7. [API Overview](#api-overview)
8. [Controllers & Services](#controllers--services)
9. [Logging](#logging)
10. [Testing](#testing)
11. [Test Report Generation (XLSX)](#test-report-generation-xlsx)
12. [Error Handling & Debugging](#error-handling--debugging)
13. [Deployment](#deployment)
14. [Future Enhancements](#future-enhancements)

---

## Project Overview
EliteEditionMongo is a Node.js/Express REST API that provides product, sales, and filter data for an e‑commerce platform. The project was forked from the original EliteEdition codebase and converted to use **MongoDB** via **Mongoose** instead of Sequelize/SQL.

Key features:
- Secure authentication (JWT based)
- Export job handling with Unicommerce API integration
- Comprehensive filtering endpoints
- Centralised logging using **winston**
- Automated API tests with Jest
- XLSX test report generation using **exceljs**

---

## Tech Stack
- **Node.js** (≥12) – runtime
- **Express** – web framework
- **MongoDB** + **Mongoose** – database & ODM
- **Joi** – request validation
- **Winston** – logging
- **Jest & Supertest** – test framework
- **ExcelJS** – XLSX report generation
- **dotenv** – environment configuration
- **Helmet, compression, cors, xss‑clean** – security & performance middlewares

---

## Directory Structure
```
├─ src
│  ├─ config          # configuration files (config.js, logger.js, morgan.js, jwt.js)
│  ├─ controllers     # request handlers (auth, products, filters, salesList, user)
│  ├─ db              # Mongoose models
│  ├─ middlewares     # error handling, rate limiting, etc.
│  ├─ routes          # API route definitions (v1/*)
│  ├─ services        # business logic (api.service.js, user.service.js, salesList.service.js)
│  ├─ utils           # helpers (dataParser, constant, catchAsync, ApiError)
│  ├─ tests           # Jest test suite and XLSX report generator
│  ├─ app.js          # Express application setup
│  └─ index.js        # HTTP server entry point
├─ .env                # runtime environment variables (not committed)
├─ .env.example        # example env file
├─ package.json        # npm scripts & dependencies
└─ README.md           # high‑level readme (this file supplements it)
```
---

## Setup & Installation
1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd EliteEditionMongo
   ```
2. **Install dependencies**
   ```bash
   npm install
   ```
   *Note:* `exceljs` was added for XLSX report generation.
3. **Create an `.env` file** based on `.env.example` and fill in the required values (MongoDB URI, JWT secret, Unicommerce credentials, etc.).
4. **Start MongoDB** (locally or via a cloud provider) and ensure the connection string matches `MONGODB_URL` in `.env`.

---

## Environment Variables
| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `development` / `production` / `test` |
| `PORT` | Port for the server (default 3000) |
| `MONGODB_URL` | MongoDB connection URI |
| `JWT_SECRET` | Secret key for signing JWT tokens |
| `UNICOMMERCE_CLIENT_ID` | Unicommerce API client ID |
| `UNICOMMERCE_CLIENT_SECRET` | Unicommerce API client secret |
| `UNICOMMERCE_BASE_URL` | Base URL for Unicommerce services |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | SMTP configuration for email service |

---

## Running the Application
```bash
npm run dev
```
The server will start on `http://0.0.0.0:<PORT>` (default 3000). Logs are emitted via Winston and also printed to the console via `morgan`.

---

## API Overview
All endpoints are prefixed with `/v1`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/auth/register` | Register a new user |
| `POST` | `/v1/auth/login`    | Login and receive JWT |
| `GET`  | `/v1/products`      | List products with pagination & filters |
| `POST` | `/v1/products/fetchFromAPIS` | Trigger Unicommerce export job (see **Export Job Flow**) |
| `GET`  | `/v1/filters`       | Retrieve distinct filter values (categories, colors, etc.) |
| `GET`  | `/v1/salesList`     | Paginated sales‑order list |
| `POST` | `/v1/salesList/saveCsvData` | Import CSV from Unicommerce into MongoDB |
| `DELETE`| `/v1/salesList/dropTable` | Delete all sales‑list documents |

*Full route definitions can be found in `src/routes/v1/*.route.js`.*

---

## Controllers & Services
- **Controllers** – thin layers that receive `req`/`res`, invoke service functions, and handle HTTP responses. They now use the central `logger` for informational and error logs.
- **Services** – contain business logic and external API calls.
  - `api.service.js` – handles Unicommerce token acquisition, export‑job creation, status polling, and file download. Updated to use a fallback body and improved error handling.
  - `user.service.js` – user CRUD and password hashing.
  - `salesList.service.js` – CSV parsing and bulk insertion of sales data.

---

## Logging
A Winston logger is configured in `src/config/logger.js` and exported as `logger`. It logs:
- **info** – request start/end, job status updates, server start/stop.
- **error** – stack traces for uncaught exceptions and API failures.

Example usage inside a controller:
```js
const logger = require('../config/logger');
logger.info('Fetching products…');
logger.error('Database error:', err);
```
The logger writes to **stdout** (console) and formats messages with timestamps. Feel free to extend transports (e.g., file, external log services) in `logger.js`.

---

## Testing
### Jest Test Suite
- Location: `src/tests/api.test.js`
- Uses **supertest** to issue HTTP calls against the Express app.
- After all tests, results are saved to `src/tests/api_test_results.json`.

Run the suite:
```bash
npm run test:api
```
The command runs Jest and then triggers the XLSX report generator.

### Test Coverage
The suite covers all public endpoints (auth, products, filters, salesList) and asserts a **2xx‑3xx** response range.

---

## Test Report Generation (XLSX)
`src/tests/reportGenerator.js` reads the JSON results from the Jest run and creates `test_report.xlsx` using **exceljs**.

**Columns**:
- Endpoint
- Method
- Status
- Response Time (ms)
- Passed (YES/NO)

The file is written to the same `src/tests` directory and can be opened directly in Excel.

---

## Error Handling & Debugging
- All async controller functions are wrapped with `catchAsync` to forward errors to the global error handler.
- Global error middleware (`src/middlewares/error.js`) normalises errors into `ApiError` objects and sends JSON responses.
- Uncaught exceptions and unhandled promise rejections are captured in `src/index.js` and logged via Winston.
- For performance debugging, the project already includes **morgan** request logging and **helmet** security headers.

---

## Deployment
1. **Build** (if you ever move to a compiled bundle) – not required for plain Node.
2. **Set environment variables** on the target host.
3. **Start the process** with a process manager (PM2, Docker, etc.). Example with PM2:
   ```bash
   npm install -g pm2
   pm2 start src/index.js --name elite-edition-mongo
   ```
4. Ensure the MongoDB instance is reachable and the Unicommerce credentials are valid.

---

## Future Enhancements
- Add **rate‑limiting** for export‑job endpoints to avoid hitting Unicommerce quotas.
- Implement **Swagger UI** documentation (already included via `swagger-jsdoc`).
- Migrate logging transports to a log aggregation service (e.g., ELK, Datadog).
- Expand test coverage to include edge‑case validation and error paths.
- Containerise the app with Docker for easier CI/CD.

---

*End of Documentation*
