const express = require('express');
const authRoute = require('./auth.route');
const userRoute = require('./user.route');
const docsRoute = require('./docs.route');
const productRoute = require('./products.route');
const filtersRoute = require('./filters.route');
const sleasList = require('./salesList.route');
const inventoryRoute = require('./inventory.route');
const vendorRoute = require('./vendor.route');
const partyRoute = require('./party.route');
const deliveryPartnerRoute = require('./deliveryPartner.route');
const stockOutRoute = require('./stockOut.route');
const router = express.Router();

router.use('/auth', authRoute);
router.use('/users', userRoute);
router.use('/docs', docsRoute);
router.use('/products', productRoute);
router.use('/filters_value', filtersRoute);
router.use('/salesList', sleasList);
router.use('/inventory', inventoryRoute);
router.use('/vendor', vendorRoute);
router.use('/party', partyRoute);
router.use('/deliveryPartner', deliveryPartnerRoute);
router.use('/stockOut', stockOutRoute);

module.exports = router;
