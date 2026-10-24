/**
 * A fresh random id, for marking one action so that a resend of it can be recognised.
 *
 * Used for each ball sent to the scoring API: the id travels with the delivery, and if
 * the request has to be repeated (the reply was lost, the connection dropped) the SAME
 * id is sent again, which is how the server knows it has already counted that ball.
 *
 * randomUUID needs a secure context; the site is served over HTTPS, and plain
 * localhost counts as secure too. The fallback covers an older browser without it.
 * Both produce characters from [0-9a-f-], which the API accepts.
 */
export function newClientId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Whether a failed request might nonetheless have reached the server.
 *
 * No response at all (dropped connection, timeout) and server-side failures are
 * "unknown outcome": the safe thing is to send the same request again with the same
 * id. A refusal that carries a status below 500 (validation, permission, "match is not
 * live") is a definite answer, and repeating it would only repeat the refusal.
 * 429 is a definite "not recorded", so it is worth retrying too.
 */
export function isConnectionProblem(error) {
  const status = error?.status;
  return !status || status >= 500 || status === 408 || status === 429;
}
