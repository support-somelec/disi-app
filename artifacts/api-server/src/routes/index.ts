import { Router, type IRouter } from "express";
import healthRouter from "./health";
import directionsRouter from "./directions";
import usersRouter from "./users";
import plansRouter from "./plans";
import employesRouter from "./employes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(directionsRouter);
router.use(usersRouter);
router.use(plansRouter);
router.use(employesRouter);

export default router;
