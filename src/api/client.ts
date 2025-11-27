// src/api/client.ts
import { BackendProcess } from '../core/backend-process';

export class ApiClient {
    private baseUrl: string = 'http://localhost:5013';
    private backendProcess: BackendProcess;

    constructor(backendProcess: BackendProcess) {
        this.backendProcess = backendProcess;
    }

    public async isHealthy(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/health`, { method: 'GET', timeout: 2000 } as any);
            return response.ok;
        } catch {
            return false;
        }
    }

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

    // Helper for GET requests
    public async get<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: 'GET' });
    }

    // Helper for POST requests
    public async post<T>(endpoint: string, body: any): Promise<T> {
        return this.request<T>(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    }

     // Helper for PUT requests
     public async put<T>(endpoint: string, body: any): Promise<T> {
        return this.request<T>(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    }

    // Helper for DELETE requests
    public async delete<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: 'DELETE' });
    }
}
