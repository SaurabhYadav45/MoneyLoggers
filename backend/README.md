# MoneyLogger Backend API

This is the backend API for the MoneyLogger stock market application.

## Features

- User authentication (register/login)
- Stock market data API
- Portfolio management
- AI stock prediction integration
- IPO tracking
- Mutual fund data
- ETF information

## Tech Stack

- Node.js with TypeScript
- Express.js
- MongoDB with Mongoose
- JWT for authentication
- Bcrypt for password hashing

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MongoDB (local or cloud instance)

### Installation

1. Clone the repository
2. Navigate to the backend directory:
   ```bash
   cd backend
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a `.env` file based on `.env.example` (if available) or use the default values
5. Start the development server:
   ```bash
   npm run dev
   ```

### Available Scripts

- `npm run dev` - Start development server with nodemon
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start production server (after build)

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user

### Health Check

- `GET /api/health` - Check API health status

## Environment Variables

Create a `.env` file in the root of the backend directory with the following variables:

```
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/moneylogger
JWT_SECRET=your_jwt_secret_key
```

## Future Enhancements

- Real-time stock data integration
- Advanced portfolio analytics
- AI-powered stock predictions
- News sentiment analysis
- Custom screener functionality
- Detailed financial reports