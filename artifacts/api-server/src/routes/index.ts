import { Router, type IRouter } from "express";
import healthRouter from "./health";
import plansRouter from "./plans";
import clicksRouter from "./clicks";
import storageRouter from "./storage";
import streamingBrandsRouter from "./streaming_brands";
import demandInterestsRouter from "./demand_interests";

const router: IRouter = Router();

router.use(healthRouter);
router.use(plansRouter);
router.use(clicksRouter);
router.use(storageRouter);
router.use(streamingBrandsRouter);
router.use(demandInterestsRouter);

export default router;
