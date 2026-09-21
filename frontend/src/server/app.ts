import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import { productsRouter } from './routes/products.routes';
import { categoriesRouter } from './routes/categories.routes';
import { cartRouter } from './routes/cart.routes';
import { ordersRouter } from './routes/orders.routes';
import { paymentsRouter } from './routes/payments.routes';
import { adminRouter } from './routes/admin.routes';
import { cartSessionMiddleware } from './middleware/cart.middleware';
import { errorHandler } from './middleware/error.middleware';

export function createExpressApp(): Express {
  const app = express();

  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Health endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'modeza-boutique-backend',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API routers
  app.use('/api/products', productsRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/cart', cartSessionMiddleware, cartRouter);
  app.use('/api/orders', cartSessionMiddleware, ordersRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/admin', adminRouter);

  // Central error handling middleware (must be registered after all API routes)
  app.use(errorHandler);

  return app;
}
