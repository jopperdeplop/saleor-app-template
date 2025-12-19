import * as fs from 'fs';

export function logDebug(msg: string, obj?: any) {
    const text = obj ? `${msg} ${JSON.stringify(obj)}` : msg;
    // We can also use Trigger.dev's logger here later if we want centralized logging
    console.log(text);
    try {
        fs.appendFileSync('debug_log.txt', text + '\n');
    } catch (e) {
        // Ignore file write errors
    }
}

export function normalizeUrl(url: string): string {
    return url.replace(/\/$/, "").trim().toLowerCase();
}

export interface OrderLine {
    id: string;
    variant: {
        product: {
            name: string;
            attributes: Array<{
                attribute: { slug: string };
                values: Array<{ name: string }>;
            }>;
        };
        weight?: { value: number; unit: string };
    };
    quantity: number;
}
