# Book Management Platform

A modern Next.js application with authentication, book management, and publishing features.

## Features

- 🔐 **Authentication** - Secure user authentication with Better Auth and Google SSO
- 📚 **Book Management** - Create, read, update, and delete books
- 📝 **Chapter Management** - Organize book content into chapters
- 🔄 **Real-time Updates** - Built with React Query for seamless data fetching
- 🎨 **Modern UI** - Built with Radix UI and Tailwind CSS

## Getting Started

1. Clone the repository

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Copy `.env.example` to `.env.local` and fill in the required environment variables

4. Run the development server:

   ```bash
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Authentication

This application uses Better Auth with Google SSO for authentication. See the [authentication documentation](docs/AUTHENTICATION.md) for more details.

## Environment Variables

See `.env.example` for a list of required environment variables.

## Development

- `pnpm dev` - Start the development server
- `pnpm build` - Build for production
- `pnpm start` - Start the production server
- `pnpm lint` - Run ESLint
- `pnpm typecheck` - Run TypeScript type checking

## License

MIT
