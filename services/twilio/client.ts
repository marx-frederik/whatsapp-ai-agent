import { env } from "@/data/env/server";
import twilio from "twilio"

export const twilioClient = twilio(env.TWILIO_SID, env.TWILIO_AUTH_TOKEN);
