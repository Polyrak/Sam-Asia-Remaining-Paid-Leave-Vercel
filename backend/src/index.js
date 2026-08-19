import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { healthRouter } from './routes/health.js';
import { discoverRouter } from './routes/discover.js';
import { employeesRouter } from './routes/employees.js';
import { leaveRequestsRouter } from './routes/leaveRequests.js';
import { leaveSummaryRouter } from './routes/leaveSummary.js';
import { entitlementsRouter } from './routes/entitlements.js';
import { employeeOrderRouter } from './routes/employeeOrder.js';
import { joinDatesRouter } from './routes/joinDates.js';
import { timesheetComplianceRouter } from './routes/timesheetCompliance.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', healthRouter);
app.use('/api', discoverRouter);
app.use('/api', employeesRouter);
app.use('/api', leaveRequestsRouter);
app.use('/api', leaveSummaryRouter);
app.use('/api', entitlementsRouter);
app.use('/api', employeeOrderRouter);
app.use('/api', joinDatesRouter);
app.use('/api', timesheetComplianceRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status && err.status < 600 ? err.status : 500).json({ message: err.message });
});

app.listen(config.port, () => {
  console.log(`Remaining paid leave API listening on http://localhost:${config.port}`);
});
