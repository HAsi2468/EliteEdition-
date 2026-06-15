const express = require('express');
require('./polyfills/crypto');
const helmet = require('helmet');
const xss = require('xss-clean');
const compression = require('compression');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const httpStatus = require('http-status').default;
const config = require('./config/config');
const morgan = require('./config/morgan');
const jwt = require('./config/jwt');
const { authLimiter } = require('./middlewares/rateLimiter');
const routes = require('./routes/v1');
require('./schedule/fetchFromAPISScheduler');
const { errorConverter, errorHandler } = require('./middlewares/error');
const ApiError = require('./utils/ApiError');
const userModel = require('./db/models/user.model');

const app = express();

if (config.env !== 'test') {
	app.use(morgan.successHandler);
	app.use(morgan.errorHandler);
}

// set security HTTP headers
// app.use(helmet());

// parse json request body
app.use(express.json({ limit: '50mb' }));

// parse urlencoded request body
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// sanitize request data
// app.use(xss()); // disabled due to incompatibility with Node/Express version

// gzip compression
app.use(compression());

// enable cors
app.use(cors());
// CORS preflight handled by app.use(cors())

app.use(cookieParser());

// jwt authentication
// app.use(jwt());



// limit repeated failed requests to auth endpoints
if (config.env === 'production') {
	app.use('/v1/auth', authLimiter);
}
// v1 api routes
app.use('/v1', routes);

// send back a 404 error for any unknown api request
app.use((req, res, next) => {
	next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// convert error to ApiError, if needed
app.use(errorConverter);

// handle error
app.use(errorHandler);

module.exports = app;
