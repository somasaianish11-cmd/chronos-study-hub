// Single source of truth for auth redirect URLs.
// Always uses the current origin so links return to whichever host the user is on.
export const getAppOrigin = () =>
  typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";

export const authRedirectTo = (path = "/") =>
  `${getAppOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
