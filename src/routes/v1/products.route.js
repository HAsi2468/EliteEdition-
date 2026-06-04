const express = require('express');
const productsController = require('../../controllers/products.controller');
const { getSalseList } = require('../../controllers/salesList.controller');

const router = express.Router();
router.route('/list').get(productsController.getAllProductsList);
// router.route('/get_orders').get(productsController.getProductsSales);
router.route('/get_orders').get(getSalseList);
router.route('/get_ordersget_orders').get(getSalseList);
router.route('/fatchFromAPIS').get(productsController.fetchFromAPIS);
router.route('/fetchFromAPIS').get(productsController.fetchFromAPIS);
router.route('/get_sku_details').get(productsController.searchBySku);
router.route('/report').get(productsController.fetchSalesReport);

router.route('/fetchMissingProduct')
  .get(productsController.fetchMissingProduct)
  .post(productsController.fetchMissingProduct);
// router.route('/update').get(productsController.updateSaleCount);
// router.route('/delete').get(productsController.deletaAllProduct);
// router.route('/skim').get(productsController.deleteDuplicateProducts)

module.exports = router;
