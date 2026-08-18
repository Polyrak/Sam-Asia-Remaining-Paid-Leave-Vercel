import { Router } from 'express';
import { discoverConfiguration } from '../services/openProjectService.js';

export const discoverRouter = Router();

discoverRouter.get('/discover', async (req, res, next) => {
  try {
    res.json(await discoverConfiguration());
  } catch (err) {
    next(err);
  }
});
