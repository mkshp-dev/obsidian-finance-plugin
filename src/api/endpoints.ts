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
    /** Endpoint for retrieving list of accounts. */
    ACCOUNTS: '/accounts',
    /** Endpoint for retrieving list of payees. */
    PAYEES: '/payees',
    /** Endpoint for retrieving list of tags. */
    TAGS: '/tags',
    /** Endpoint for retrieving list of commodities/currencies. */
    COMMODITIES: '/commodities',
    /** Endpoint for retrieving ledger statistics. */
    STATISTICS: '/statistics',
    /** Endpoint to trigger a reload of the Beancount file. */
    RELOAD: '/reload'
};
