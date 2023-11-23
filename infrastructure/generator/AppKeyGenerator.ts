import * as crypto from "crypto";
import {IGenerator} from "./index";

export class AppKeyGenerator implements IGenerator {

    readonly length: number;

    constructor(length: number = 32) {
        this.length = length;
    }

    generate(): string {
        return `base64:${this.generateKeyOfSize(this.length)}`;
    }

    generateKeyOfSize(length: number) {
        const bytes = this.randomBytes(length);
        return Buffer.from(bytes).toString('base64');
    }

    randomBytes(length: number): Uint8Array {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return array;
    }

    static generate(length: number = 32): string {
        return new AppKeyGenerator(length).generate();
    }

}