# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Supabase

The hall invoice flow can write directly to Supabase using browser requests. Add these environment variables in a local `.env` file:

```bash
VITE_SUPABASE_URL=https://qjwiscenuwlntrfpzmov.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_exwyyTY5T1i-zDvlVbTzdA_8FRBRS2Q
```

The current integration persists:

- `invoices`
- `event_details`
- `invoice_services`
