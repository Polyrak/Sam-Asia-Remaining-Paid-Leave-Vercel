import { Router } from 'express';
import { getJoinDates, setJoinDate, removeJoinDate } from '../services/joinDatesStore.js';
import { cacheClear } from '../cache.js';

export const joinDatesRouter = Router();

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

joinDatesRouter.get('/join-dates', async (req, res, next) => {
  try {
    res.json(await getJoinDates());
  } catch (err) {
    next(err);
  }
});

joinDatesRouter.put('/join-dates/:userId', async (req, res, next) => {
  try {
    const { date } = req.body;
    if (!DATE_PATTERN.test(date)) {
      return res.status(400).json({ message: 'date must be in YYYY-MM-DD format' });
    }
    const store = await setJoinDate(req.params.userId, date);
    cacheClear();
    res.json(store);
  } catch (err) {
    next(err);
  }
});

joinDatesRouter.delete('/join-dates/:userId', async (req, res, next) => {
  try {
    const store = await removeJoinDate(req.params.userId);
    cacheClear();
    res.json(store);
  } catch (err) {
    next(err);
  }
});
