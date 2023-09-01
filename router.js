import express from "express";
const router = express.Router();
import {getResponse} from './controller.js';

router.route("/identify").post(getResponse);

export default router;