const common = require('./common.schemas');
const auth = require('./auth.schemas');
const user = require('./user.schemas');
const order = require('./order.schemas');

module.exports = {
  ...common,
  ...auth,
  ...user,
  ...order,
};

