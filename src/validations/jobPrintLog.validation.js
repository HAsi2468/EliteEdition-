const Joi = require('@hapi/joi');

const createPrintLog = {
  body: Joi.object().keys({
    jobCardId: Joi.string().allow('', null).optional(),
    jobNo: Joi.string().trim().required(),
    machineName: Joi.string().trim().required(),
    pass: Joi.string().trim().allow('', null).optional(),
    meters: Joi.number().min(0.01).max(50000).required(),
    date: Joi.date().max('now').required(),
    operatorName: Joi.string().allow('', null).optional(),
    shift: Joi.string().valid('Morning', 'Evening', 'Night', 'General').optional(),
    notes: Joi.string().allow('', null).optional(),
  }),
};

const updatePrintLog = {
  params: Joi.object().keys({
    id: Joi.string().required(),
  }),
  body: Joi.object().keys({
    machineName: Joi.string().trim().optional(),
    pass: Joi.string().trim().allow('', null).optional(),
    meters: Joi.number().min(0.01).max(50000).optional(),
    date: Joi.date().max('now').optional(),
    operatorName: Joi.string().allow('', null).optional(),
    shift: Joi.string().valid('Morning', 'Evening', 'Night', 'General').optional(),
    notes: Joi.string().allow('', null).optional(),
  }),
};

module.exports = {
  createPrintLog,
  updatePrintLog,
};
