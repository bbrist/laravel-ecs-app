import { AppKeyGenerator } from "./AppKeyGenerator";
import { PasswordGenerator } from "./PasswordGenerator";

export interface IGenerator {
    generate(): any;
}

export {
    AppKeyGenerator,
    PasswordGenerator,
}