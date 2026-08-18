import { Router } from 'express';
import { getEmployeeOrder, setEmployeeOrder } from '../services/employeeOrderStore.js';
import { cacheClear } from '../cache.js';

export const employeeOrderRouter = Router();

employeeOrderRouter.get('/employee-order', async (req, res, next) => {
  try {
    res.json({ order: await getEmployeeOrder() });
  } catch (err) {
    next(err);
  }
});

employeeOrderRouter.put('/employee-order', async (req, res, next) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) {
      return res.status(400).json({ message: 'order must be an array of employee ids' });
    }
    const store = await setEmployeeOrder(order);
    cacheClear();
    res.json(store);
  } catch (err) {
    next(err);
  }
});
