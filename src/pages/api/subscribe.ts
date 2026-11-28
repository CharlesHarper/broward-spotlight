import type { APIRoute } from 'astro';
import { env, isEmail, looksLikeBot, str } from '../../lib/util';
import { subscribe } from '../../lib/newsletter';
import { CITY_NAMES } from '../../lib/shared';

// Newsletter signup. Back to the page the form was on, with a thank-you flag.
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const e = env(locals);
  const f = await request.formData();
  const email = str(f.get('email'), 200).toLowerCase();
  const cityRaw = str(f.get('city'), 60);
  const city = CITY_NAMES[cityRaw] ? cityRaw : null;
  const from = str(f.get('from'), 200);
  const back = from.startsWith('/') && !from.startsWith('//') ? from.split('#')[0] : '/';
  const sep = back.includes('?') ? '&' : '?';
  if (looksLikeBot(f) || !isEmail(email)) return redirect(`${back}${sep}subscribed=0#subscribe`, 303);
  await subscribe(e, email, city, str(f.get('source'), 40) || back);
  return redirect(`${back}${sep}subscribed=1#subscribe`, 303);
};
