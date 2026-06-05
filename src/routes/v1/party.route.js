const express = require('express');
const partyController = require('../../controllers/party.controller');

const router = express.Router();

router.route('/')
  .post(partyController.createParty)
  .get(partyController.getParties);

router.route('/:id')
  .put(partyController.updateParty)
  .delete(partyController.deleteParty);

module.exports = router;
