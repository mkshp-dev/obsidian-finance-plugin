// src/api/endpoints.ts

/**
 * Constants defining the API endpoints available on the backend.
 */
export const ENDPOINTS = {
    /** Health check endpoint to verify backend status. */
    HEALTH: '/health',
    /** Endpoint for retrieving journal entries (transactions, notes, etc.). */
    ENTRIES: '/entries',
    /** Endpoint for managing specific transactions (GET, POST, PUT, DELETE). */
    TRANSACTIONS: '/transactions',
    /** Endpoint to trigger a reload of the Beancount file. */
    RELOAD: '/reload'
};
