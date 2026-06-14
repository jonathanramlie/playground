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

Local HTTP intentionally omits the `Secure` cookie attribute for `/aswebauth/start` because browsers do not store Secure cookies from plain HTTP.

## Vercel deployment

Deploy this project to the domain:

```text
https://playground.natum.dev
```

The clean POC URLs are:

- https://playground.natum.dev/aswebauth
- https://playground.natum.dev/aswebauth/start
- https://playground.natum.dev/aswebauth/check?expected=<nonce>

## ASWebAuthenticationSession cookie POC

`/aswebauth/start` generates a UUID nonce, sets this cookie, then redirects to the iOS app callback:

```http
Set-Cookie: nonce=<uuid>; Path=/; Max-Age=600; HttpOnly; SameSite=Lax; Secure
Location: playgroundauth://callback?nonce=<uuid>
```

`/aswebauth/check?expected=<uuid>` renders whether the external browser sent the matching `nonce` cookie.

Expected behavior:

- Non-ephemeral `ASWebAuthenticationSession`: the cookie may be visible if the final browser uses the same browser/auth cookie store.
- Ephemeral `ASWebAuthenticationSession`: the cookie should not persist to the final browser.
- Safari and Chrome on iOS should not be assumed to share a universal cookie jar.
