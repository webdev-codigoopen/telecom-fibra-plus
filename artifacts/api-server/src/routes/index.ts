import { Router, type IRouter } from "express";
import healthRouter from "./health";
import plansRouter from "./plans";
import clicksRouter from "./clicks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(plansRouter);
router.use(clicksRouter);

export default router;
