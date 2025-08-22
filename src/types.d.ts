declare const APP_BASE_URL: URL
type AppId = string & { readonly AppId: unique symbol }
declare const APP_NS: `${typeof import('./_prefix.ts')._prefix}${AppId}`
