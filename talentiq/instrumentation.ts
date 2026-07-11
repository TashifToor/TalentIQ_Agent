// // Next.js instrumentation hook — loads the right Sentry config depending on
// // whether this code is running in the Node.js server runtime or the Edge
// // runtime (middleware.ts). Required for sentry.server.config.ts /
// // sentry.edge.config.ts to actually get picked up in the App Router.
// export async function register() {
//   if (process.env.NEXT_RUNTIME === 'nodejs') {
//     await import('./sentry.server.config')
//   }
//   if (process.env.NEXT_RUNTIME === 'edge') {
//     await import('./sentry.edge.config')
//   }
// }