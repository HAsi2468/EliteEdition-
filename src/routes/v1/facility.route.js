const express = require('express');
const facilityController = require('../../controllers/facility.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');

const router = express.Router();

// SEC-010: Master data write permission guards
const requireFacilityWritePermission = (req, res, next) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', error: 'Authentication required' });
  }
  const role = String(user.role || '').toLowerCase();
  const isAdmin = user.isAdmin || user.isMainAdmin || role === 'admin' || role === 'super_admin';
  const hasInventoryPerm = Array.isArray(user.permissions) && (user.permissions.includes('inventory') || user.permissions.includes('admin'));

  if (!isAdmin && !hasInventoryPerm) {
    return res.status(403).json({
      success: false,
      code: 'PERMISSION_DENIED',
      error: 'Access denied: You do not have permission to create or modify storage facilities.'
    });
  }
  next();
};

const requireFacilityDeletePermission = (req, res, next) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', error: 'Authentication required' });
  }
  const role = String(user.role || '').toLowerCase();
  const isAdmin = user.isAdmin || user.isMainAdmin || role === 'admin' || role === 'super_admin';
  const hasInventoryPerm = Array.isArray(user.permissions) && (user.permissions.includes('inventory') || user.permissions.includes('admin'));

  if ((!isAdmin && !hasInventoryPerm) || user.canDeleteRecords === false) {
    return res.status(403).json({
      success: false,
      code: 'PERMISSION_DENIED',
      error: 'Access denied: You do not have permission to delete storage facilities.'
    });
  }
  next();
};

router
  .route('/')
  .get(facilityController.getFacilities)
  .post(requireAuth, requireFacilityWritePermission, facilityController.createFacility);

router
  .route('/:id')
  .put(requireAuth, requireFacilityWritePermission, facilityController.updateFacility)
  .delete(requireAuth, requireFacilityDeletePermission, facilityController.deleteFacility);

module.exports = router;
