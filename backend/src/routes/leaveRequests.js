import { Router } from 'express';
import { getPaidLeaveEntries } from '../services/openProjectService.js';

export const leaveRequestsRouter = Router();

leaveRequestsRouter.get('/leave-requests', async (req, res, next) => {
  try {
    const { userId } = req.query;
    res.json(await getPaidLeaveEntries({ userId }));
  } catch (err) {
    next(err);
  }
});
