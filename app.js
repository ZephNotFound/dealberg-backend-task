import dotenv from 'dotenv';
dotenv.config();

import express from "express";
import router from './router.js';

const app = express();

app.use(express.json());

app.use("/", router);

app.listen(process.env.PORT, () => {
  console.log("app-started");
});

export default app;
