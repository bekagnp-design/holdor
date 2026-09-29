// Supabase Edge Function `stars` (deploy with verify_jwt = false: Telegram sends no JWT; the webhook is checked by its secret header,
// the app's request by its session token inside pay_create). All logic: handler.js.
import { makeHandler } from './handler.js';
const handle = makeHandler({ url: Deno.env.get('SUPABASE_URL')!, key: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! });
Deno.serve((req: Request) => handle(req));
