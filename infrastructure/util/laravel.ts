import {AppKeyGenerator} from "../generator";

export default {

    generateAppKey(): string {
        return AppKeyGenerator.generate(32);
    }

}