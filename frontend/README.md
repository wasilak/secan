# Secan Frontend

Modern React-based frontend for Secan, an Elasticsearch cluster management tool.

## Overview

Secan provides a clean, intuitive interface for managing Elasticsearch clusters. Built with React 18, TypeScript, and Mantine UI, it offers a responsive and accessible user experience.

## Features

- **Multi-cluster Management**: Connect and manage multiple Elasticsearch clusters
- **Real-time Monitoring**: Live cluster health, node statistics, and index metrics
- **Index Management**: Create, configure, and manage indices with ease
- **REST Console**: Interactive console for executing Elasticsearch queries
- **Dark/Light Theme**: Automatic theme switching with system preference support
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices

## Technology Stack

- **React 18**: Modern React with hooks and concurrent features
- **TypeScript**: Type-safe development
- **Mantine UI**: Comprehensive component library
- **TanStack Query**: Powerful data fetching and caching
- **React Router**: Client-side routing
- **Zustand**: Lightweight state management
- **Vite**: Fast build tool and dev server
- **Vitest**: Unit testing framework

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Backend server running (see backend/README.md)

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

### Development

The development server runs on `http://localhost:5173` by default. It includes:

- Hot module replacement (HMR)
- Fast refresh for React components
- TypeScript type checking
- ESLint integration

### Building

```bash
npm run build
```

Builds are optimized and minified, ready for production deployment. The output is in the `dist/` directory.

## Project Structure

```
frontend/
├── src/
│   ├── api/           # API client and types
│   ├── components/    # Reusable React components
│   ├── contexts/      # React contexts
│   ├── hooks/         # Custom React hooks
│   ├── pages/         # Page components
│   ├── stores/        # Zustand stores
│   ├── styles/        # Global styles
│   ├── types/         # TypeScript type definitions
│   ├── utils/         # Utility functions
│   ├── App.tsx        # Root component
│   ├── main.tsx       # Application entry point
│   └── router.tsx     # Route definitions
├── public/            # Static assets
├── index.html         # HTML template
├── package.json       # Dependencies and scripts
├── tsconfig.json      # TypeScript configuration
└── vite.config.ts     # Vite configuration
```

## Configuration

The frontend connects to the backend API. Configuration is handled through environment variables:

- `VITE_API_URL`: Backend API URL (default: same origin)

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

Tests are written using Vitest and React Testing Library.

## Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run type-check
```

## Contributing

1. Follow the TypeScript and React best practices outlined in the project
2. Write tests for new features
3. Ensure all tests pass before submitting
4. Run linter and formatter before committing
5. Use conventional commit messages

## License

See LICENSE file in the root directory.

## About Secan

Secan (Old English: *sēcan* - to seek, to inquire) is a modern Elasticsearch cluster management tool, heavily inspired by Cerebro.
