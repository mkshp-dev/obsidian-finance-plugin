// src/api/client.ts
import { BackendProcess } from '../core/backend-process';

/**
 * ApiClient
 *
 * Handles communication with the backend Flask API.
 * Provides methods for making HTTP requests (GET, POST, PUT, DELETE) and ensuring the backend is running.
 */
export class ApiClient {
    private baseUrl: string = 'http://localhost:5013';
    private backendProcess: BackendProcess;

    /**
     * Creates an instance of ApiClient.
     * @param {BackendProcess} backendProcess - The backend process manager.
     */
    constructor(backendProcess: BackendProcess) {
        this.backendProcess = backendProcess;
    }

    /**
     * Checks if the backend API is reachable.
     * @returns {Promise<boolean>} True if the backend responds to the health check, false otherwise.
     */
    public async isHealthy(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/health`, { method: 'GET', timeout: 2000 } as any);
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Ensures the backend API is connected and running.
     * Tries to start the backend if it's not healthy and polls for readiness.
     * @returns {Promise<boolean>} True if the backend is connected (or successfully started), false otherwise.
     */
    public async ensureConnected(): Promise<boolean> {
        if (await this.isHealthy()) return true;
        await this.backendProcess.start();

        // Poll for readiness
        for (let i = 0; i < 20; i++) {
            if (await this.isHealthy()) return true;
            await new Promise(r => setTimeout(r, 500));
        }
        return false;
    }

    /**
     * Makes a generic HTTP request to the backend.
     * Automatically calls ensureConnected() before making the request.
     * @template T
     * @param {string} endpoint - The API endpoint (e.g., '/entries').
     * @param {RequestInit} [options={}] - The fetch options (method, headers, body, etc.).
     * @returns {Promise<T>} The JSON response body cast to type T.
     * @throws {Error} If the API request fails (non-2xx response).
     */
    public async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        await this.ensureConnected();

        const url = `${this.baseUrl}${endpoint}`;
        const response = await fetch(url, { ...options });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        return response.json() as Promise<T>;
    }

    /**
     * Helper for GET requests.
     * @template T
     * @param {string} endpoint - The API endpoint.
     * @returns {Promise<T>} The JSON response body.
     */
    public async get<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: 'GET' });
    }

    /**
     * Helper for POST requests.
     * @template T
     * @param {string} endpoint - The API endpoint.
     * @param {any} body - The data to send in the request body (will be JSON stringified).
     * @returns {Promise<T>} The JSON response body.
     */
    public async post<T>(endpoint: string, body: any): Promise<T> {
        return this.request<T>(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    }

     /**
      * Helper for PUT requests.
      * @template T
      * @param {string} endpoint - The API endpoint.
      * @param {any} body - The data to send in the request body (will be JSON stringified).
      * @returns {Promise<T>} The JSON response body.
      */
     public async put<T>(endpoint: string, body: any): Promise<T> {
        return this.request<T>(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    }

    /**
     * Helper for DELETE requests.
     * @template T
     * @param {string} endpoint - The API endpoint.
     * @returns {Promise<T>} The JSON response body.
     */
    public async delete<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: 'DELETE' });
    }
}
