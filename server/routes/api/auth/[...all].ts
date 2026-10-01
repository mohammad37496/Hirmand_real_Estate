import { defineEventHandler, toWebRequest } from "h3";
import { auth } from "@/lib/auth/server";

export default defineEventHandler((event) => auth.handler(toWebRequest(event)));
