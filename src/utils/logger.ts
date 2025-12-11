export class Logger {
    private static isDebugMode = false;

    static setDebugMode(enabled: boolean) {
        this.isDebugMode = enabled;
    }

    static log(message: string, ...args: any[]) {
        if (this.isDebugMode) {
            console.log(`[Beancount] ${message}`, ...args);
        }
    }

    static info(message: string, ...args: any[]) {
        // Info logs might be useful even without debug mode for critical info,
        // but user requested "Debug mode shows the console logs".
        // Let's stick to showing them only in debug mode to be clean,
        // or always show them if they are truly informational for the user?
        // Usually INFO is for everyone, DEBUG is for developers.
        // But user said "Toggle debug mode ON/OFF" implies silence otherwise.
        // Let's keep info always visible or just follow debug?
        // "Clean production code" suggests minimal logs.
        if (this.isDebugMode) {
            console.info(`[Beancount] ${message}`, ...args);
        }
    }

    static warn(message: string, ...args: any[]) {
        // Warnings should probably always be shown or at least in debug
        console.warn(`[Beancount] ${message}`, ...args);
    }

    static error(message: string, ...args: any[]) {
        // Errors should always be visible
        console.error(`[Beancount] ${message}`, ...args);
    }
}
