const Joi = require('@hapi/joi');

const createPrintLog = {
  body: Joi.object().keys({
    jobCardId: Joi.string().allow('', null).optional(),
    jobNo: Joi.string().trim().required(),
    machineName: Joi.string().trim().required(),
    pass: Joi.string().trim().allow('', null).optional(),
    meters: Joi.number().min(0.01).max(50000).required(),
    date: Joi.date().optional(),
    operatorName: Joi.string().allow('', null).optional(),
    shift: Joi.string().valid('Morning', 'Evening', 'Night', 'General', 'Day').optional(),
    notes: Joi.string().allow('', null).optional(),
    _id: Joi.any().optional(),
    id: Joi.any().optional(),
  }).unknown(true),
};

const updatePrintLog = {
  params: Joi.object().keys({
    id: Joi.string().required(),
  }),
  body: Joi.object().keys({
    _id: Joi.any().optional(),
    id: Joi.any().optional(),
    jobCardId: Joi.string().allow('', null).optional(),
    jobNo: Joi.string().trim().allow('', null).optional(),
    machineName: Joi.string().trim().optional(),
    pass: Joi.string().trim().allow('', null).optional(),
    meters: Joi.number().min(0.01).max(50000).optional(),
    date: Joi.date().optional(),
    operatorName: Joi.string().allow('', null).optional(),
    shift: Joi.string().valid('Morning', 'Evening', 'Night', 'General', 'Day').optional(),
    notes: Joi.string().allow('', null).optional(),
    matchedJob: Joi.any().optional(),
    created_date_time: Joi.any().optional(),
    updated_date_time: Joi.any().optional(),
  }).unknown(true),
};

module.exports = {
  createPrintLog,
  updatePrintLog,
};
