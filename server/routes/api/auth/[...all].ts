import { defineEventHandler, toRequest } from "h3";
import { auth } from "@/lib/auth/server";

export default defineEventHandler((event) => auth.handler(toRequest(event)));
