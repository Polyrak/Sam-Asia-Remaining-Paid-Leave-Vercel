import { Router } from 'express';
import { computeLeaveSummary } from '../services/openProjectService.js';

export const leaveSummaryRouter = Router();

leaveSummaryRouter.get('/leave-summary', async (req, res, next) => {
  try {
    res.json(await computeLeaveSummary());
  } catch (err) {
    next(err);
  }
});
