import { Router } from 'express';
import {
  getEntitlements,
  setDefaultBaseDays,
  setOverride,
  removeOverride,
} from '../services/entitlementsStore.js';
import { cacheClear } from '../cache.js';

export const entitlementsRouter = Router();

function isValidNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

entitlementsRouter.get('/entitlements', async (req, res, next) => {
  try {
    res.json(await getEntitlements());
  } catch (err) {
    next(err);
  }
});

entitlementsRouter.put('/entitlements/default', async (req, res, next) => {
  try {
    const days = req.body.baseDays;
    if (!isValidNumber(days) || days < 0) {
      return res.status(400).json({ message: 'baseDays must be a non-negative number' });
    }
    const store = await setDefaultBaseDays(days);
    cacheClear();
    res.json(store);
  } catch (err) {
    next(err);
  }
});

entitlementsRouter.put('/entitlements/:userId', async (req, res, next) => {
  try {
    const { baseDays, adjustment, adjustmentNote } = req.body;
    if (baseDays === undefined && adjustment === undefined) {
      return res.status(400).json({ message: 'provide baseDays and/or adjustment' });
    }
    if (baseDays !== undefined && !isValidNumber(baseDays)) {
      return res.status(400).json({ message: 'baseDays must be a valid number' });
    }
    if (adjustment !== undefined && !isValidNumber(adjustment)) {
      return res.status(400).json({ message: 'adjustment must be a valid number' });
    }
    if (adjustmentNote !== undefined && typeof adjustmentNote !== 'string') {
      return res.status(400).json({ message: 'adjustmentNote must be a string' });
    }
    const store = await setOverride(req.params.userId, { baseDays, adjustment, adjustmentNote });
    cacheClear();
    res.json(store);
  } catch (err) {
    next(err);
  }
});

entitlementsRouter.delete('/entitlements/:userId', async (req, res, next) => {
  try {
    const store = await removeOverride(req.params.userId);
    cacheClear();
    res.json(store);
  } catch (err) {
    next(err);
  }
});
