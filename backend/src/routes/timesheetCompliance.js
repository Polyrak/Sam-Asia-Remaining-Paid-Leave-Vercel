import { Router } from 'express';
import { getMonthlyTimesheetCompliance, getMonthlyTimeEntriesForUser } from '../services/openProjectService.js';

export const timesheetComplianceRouter = Router();

timesheetComplianceRouter.get('/timesheet-compliance', async (req, res, next) => {
  try {
    res.json(await getMonthlyTimesheetCompliance());
  } catch (err) {
    next(err);
  }
});

timesheetComplianceRouter.get('/timesheet-compliance/:userId', async (req, res, next) => {
  try {
    res.json(await getMonthlyTimeEntriesForUser(req.params.userId));
  } catch (err) {
    next(err);
  }
});
