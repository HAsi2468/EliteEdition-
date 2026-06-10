const express = require('express');
const deliveryPartnerController = require('../../controllers/deliveryPartner.controller');

const router = express.Router();

router.route('/')
  .post(deliveryPartnerController.createDeliveryPartner)
  .get(deliveryPartnerController.getDeliveryPartners);

router.route('/:id')
  .put(deliveryPartnerController.updateDeliveryPartner)
  .delete(deliveryPartnerController.deleteDeliveryPartner);

module.exports = router;
