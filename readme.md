# MoneyLogger - Indian Stock Market Platform

A modern, scalable stock market website for Indian stocks with a beautiful UI featuring glassmorphism, animations, and real-time data.

## Features

- Real-time stock market data for NSE & BSE
- Mutual fund and IPO tracking
- Global market sentiments
- News analysis
- Stock screeners
- Stock research tools
- Indian ETF screener
- AI-powered stock prediction (future implementation)
- Portfolio optimization (future implementation)
- User authentication (login/signup)

## Tech Stack

### Frontend
- React with TypeScript
- Vite for build tool
- TailwindCSS for styling
- Framer Motion for animations
- Lucide React for icons
- React Router for navigation

### Backend
- Node.js with TypeScript
- Express.js
- MongoDB with Mongoose
- JWT for authentication
- Bcrypt for password hashing

### UI/UX Features
- Glassmorphism design
- Backdrop blur effects
- Gradient backgrounds
- Smooth animations and transitions
- Responsive layout
- Dark/light mode

## Project Structure

```
/money-logger-root
│
├── frontend/                      # Frontend (React + Vite + TypeScript)
│   ├── public/
│   ├── src/
│   │   ├── assets/                # Images, fonts, global SVGs
│   │   ├── components/            # Shared UI components
│   │   │   ├── ui/                # Design system: buttons, inputs, cards
│   │   │   ├── charts/            # TradingView, Recharts components
│   │   │   └── layout/            # Navbar, Sidebar, Footer
│   │   ├── contexts/              # Theme, Auth, Global state
│   │   ├── hooks/                 # Custom hooks (useStockData, etc.)
│   │   ├── pages/                 # Page-level views
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Screener.tsx
│   │   │   ├── Research.tsx
│   │   │   └── Portfolio.tsx
│   │   ├── services/              # Axios services, API layer
│   │   ├── types/                 # TS interfaces (Stock, User)
│   │   ├── utils/                 # Helper functions, formatters
│   │   ├── App.tsx                # App routes
│   │   └── main.tsx               # Entry point
│   ├── tailwind.config.js         # Custom theme, glassmorphism
│   └── package.json
│
├── backend/                       # Backend (Node + Express + TypeScript)
│   ├── src/
│   │   ├── config/                # Env vars, DB connection
│   │   ├── controllers/           # Route handlers
│   │   ├── models/                # Mongoose schemas (User, Watchlist)
│   │   ├── routes/                # API routes (/api/v1/stocks)
│   │   ├── middleware/            # Auth, error handlers
│   │   └── server.ts              # Express setup
│   ├── ml_engine/                 # Python ML models (predictions)
│   └── package.json
│
└── README.md
```

## Getting Started

### Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

### Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## Future Enhancements

- Integration with real stock market APIs (Yahoo Finance, Alpha Vantage)
- Advanced portfolio analytics
- AI-powered stock predictions
- News sentiment analysis
- Custom screener functionality
- Detailed financial reports
- Mobile app version

## License

This project is licensed under the MIT License.
