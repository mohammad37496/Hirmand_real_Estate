import { defineEventHandler } from "h3";
import { auth } from "@/lib/auth/server";

export default defineEventHandler((event) => auth.handler(event.req));
