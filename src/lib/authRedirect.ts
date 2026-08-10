// Single source of truth for auth redirect URLs.
// Uses the current origin so links always return to the app the user is on,
// falling back to the production URL if origin is unavailable.
const PRODUCTION_URL = "https://chronos-study-app.vercel.app";

export const getAppOrigin = () =>
  typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : PRODUCTION_URL;

export const authRedirectTo = (path = "/") =>
  `${getAppOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
