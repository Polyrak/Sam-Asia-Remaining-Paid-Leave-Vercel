import { Router } from 'express';
import { isLeaveConfigured } from '../config.js';

export const healthRouter = Router();

healthRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', leaveConfigured: isLeaveConfigured() });
});
