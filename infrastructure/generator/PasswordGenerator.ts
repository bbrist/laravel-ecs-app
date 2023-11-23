const ALPHA = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMERIC = '0123456789';
const ALPHA_NUMERIC = ALPHA + NUMERIC;
const SYMBOLS = '!@#$%^&*()_+-=[]{};:,./<>?';
const ALPHA_NUMERIC_SYMBOLS = ALPHA_NUMERIC + SYMBOLS;

export const Values = {
    ALPHA,
    NUMERIC,
    ALPHA_NUMERIC,
    SYMBOLS,
    ALPHA_NUMERIC_SYMBOLS,
}

export class PasswordGenerator {

    readonly size: number;
    readonly values: string;

    constructor(size: number = 32, values?: string[]) {
        this.size = size;
        this.values = values ? values.join('') : Values.ALPHA_NUMERIC;
    }

    generate(): string {
        return this.generatePasswordOfSize(this.size);
    }

    generatePasswordOfSize(size: number): string {
        const chars = this.randomChars(size);
        return chars.join('');
    }

    private randomChars(size: number): string[] {
        const chars = [];
        for (let i = 0; i < size; i++) {
            chars.push(this.randomChar());
        }
        return chars;
    }

    private randomChar(): string {
        return this.values.charAt(this.randomIndex());
    }

    private randomIndex(): number {
        return Math.floor(Math.random() * this.values.length);
    }

}