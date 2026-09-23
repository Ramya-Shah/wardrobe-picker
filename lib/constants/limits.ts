/** Limits shared by the web server and the mobile app. */
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const THUMBNAIL_WIDTH = 480;

/** IDs are used in file names, so they must stay filesystem-safe. */
export const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
