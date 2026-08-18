import { Router } from 'express';
import { getEmployees } from '../services/openProjectService.js';

export const employeesRouter = Router();

employeesRouter.get('/employees', async (req, res, next) => {
  try {
    res.json(await getEmployees());
  } catch (err) {
    next(err);
  }
});
