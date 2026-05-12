import { Router, type IRouter } from "express";
import healthRouter from "./health";
import plansRouter from "./plans";
import clicksRouter from "./clicks";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(plansRouter);
router.use(clicksRouter);
router.use(storageRouter);

export default router;
