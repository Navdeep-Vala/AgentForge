import express from 'express';
import cors from 'cors';
import { loggerMiddleware } from './middleware/logger.middleware';
import { errorMiddleware } from './middleware/error.middleware';
import routes from './routes';

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(loggerMiddleware);

app.use('/api', routes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorMiddleware);

export default app;
