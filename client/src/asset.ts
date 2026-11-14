/**
 * A file from public/, resolved against the site's base URL. In the app the base
 * is "/", so asset('covers/x.png') is "/covers/x.png"; in the Storybook build it
 * is relative, so the same images load when Storybook is hosted in a subfolder.
 */
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
