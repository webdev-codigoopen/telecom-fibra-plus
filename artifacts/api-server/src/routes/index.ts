import { Router, type IRouter } from "express";
import authRouter from "./auth";
import healthRouter from "./health";
import plansRouter from "./plans";
import clicksRouter from "./clicks";
import storageRouter from "./storage";
import streamingBrandsRouter from "./streaming_brands";
import demandInterestsRouter from "./demand_interests";
import appSettingsRouter from "./app_settings";
import emailSubscriptionsRouter from "./email_subscriptions";
import contactRouter from "./contact";
import reviewsRouter from "./reviews";
import faqRouter from "./faq";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(plansRouter);
router.use(clicksRouter);
router.use(storageRouter);
router.use(streamingBrandsRouter);
router.use(demandInterestsRouter);
router.use(appSettingsRouter);
router.use(emailSubscriptionsRouter);
router.use(contactRouter);
router.use(reviewsRouter);
router.use(faqRouter);

export default router;
