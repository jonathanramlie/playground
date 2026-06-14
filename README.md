# Playground Web

Small Node/Vercel playground for web authentication and cookie experiments.

## Local development

```bash
npm test
npm start
```

Open:

- http://127.0.0.1:5173/
- http://127.0.0.1:5173/aswebauth
- http://127.0.0.1:5173/handoff/start

Local HTTP intentionally omits the `Secure` cookie attribute for `/aswebauth/start` and `/handoff/start` because browsers do not store Secure cookies from plain HTTP.

## Vercel deployment

Deploy this project to the domain:

```text
https://playground-211p.vercel.app
```

The clean POC URLs are:

- https://playground-211p.vercel.app/aswebauth
- https://playground-211p.vercel.app/aswebauth/start
- https://playground-211p.vercel.app/aswebauth/start?delayMs=2000
- https://playground-211p.vercel.app/aswebauth/start?autoRedirect=0
- https://playground-211p.vercel.app/aswebauth/check?expected=<nonce>
- https://playground-211p.vercel.app/handoff/start
- https://playground-211p.vercel.app/handoff/start?autoOpen=1
- https://playground-211p.vercel.app/handoff/complete?approval=<signed-approval>
- https://playground-211p.vercel.app/handoff/check

## ASWebAuthenticationSession cookie POC

`/aswebauth/start` generates a UUID nonce, sets this cookie, then redirects to the iOS app callback:

```http
Set-Cookie: nonce=<uuid>; Path=/; Max-Age=600; HttpOnly; SameSite=Lax; Secure
Location: playgroundauth://callback?nonce=<uuid>
```

`/aswebauth/start?delayMs=2000` sets the cookie, renders a waiting page with a **Continue to app** button, and auto-redirects to the callback after 2 seconds.

`/aswebauth/start?autoRedirect=0` sets the cookie and renders the same **Continue to app** button, but disables automatic redirect. This is useful for testing whether timing or first-party user interaction changes the result.

`/aswebauth/check?expected=<uuid>` renders whether the external browser sent the matching `nonce` cookie.

Expected behavior:

- Non-ephemeral `ASWebAuthenticationSession`: the cookie may be visible if the final browser uses the same browser/auth cookie store.
- Ephemeral `ASWebAuthenticationSession`: the cookie should not persist to the final browser.
- Safari and Chrome on iOS should not be assumed to share a universal cookie jar.

## Browser-owned handoff POC

This POC avoids a bearer login URL by making Safari/browser own a pending transaction first.

Flow:

1. Safari opens `/handoff/start` or `/handoff/start?autoOpen=1`.
2. Server sets `handoff_pending=<signed pending tx>` as a browser-owned `HttpOnly` cookie.
3. Safari shows **Open app to approve**. With `autoOpen=1`, the page also attempts to open the app automatically after 500ms while keeping the button as fallback.
4. App receives `playgroundauth://handoff/approve?tx=<browser_tx>&origin=<origin>`.
5. App calls `POST /handoff/approve` with the `tx` and demo native user.
6. Server returns `/handoff/complete?approval=<signed approval>`.
7. App opens that complete URL in Safari.
8. `/handoff/complete` only creates `safari_session` if the approval token matches the Safari-owned `handoff_pending` cookie.

This means an attacker-created approval URL should fail in a victim browser that does not have the matching pending cookie.

For production, replace the demo native user field with real app authentication, use a strong `HANDOFF_SECRET`, keep tokens short-lived and single-use if backed by storage, and add account-switch confirmation when Safari already has a different logged-in user.
