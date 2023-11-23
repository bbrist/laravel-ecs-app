import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';
import {mergeDeep, resolvePath} from "./utils";

export interface ConfigProps {
    root?: string;
    additionalProperties: { [key: string]: any };
}

interface Interpolation {
    expand: (obj: any, context: any) => any;
}

class Config {

    public static instance: Config;

    private readonly root: string;
    private files: string[];
    private values: any = {};
    private readonly interpolation: Interpolation;

    constructor(props?: ConfigProps) {
        this.root = props?.root ?? __dirname + '/../config';
        this.values = props?.additionalProperties ?? {};

        this.interpolation = require('interpolate-json').interpolation;
    }

    load(...files: string[]) {
        this.files = files;

        this.refresh();
    }

    refresh() {
        const configs = this.files.map(file => {
            const filepath = path.resolve(`${this.root}/${file}`);

            let config = {} as any;
            try {
                if (fs.existsSync(filepath)) {
                    config = yaml.load(fs.readFileSync(filepath, 'utf8'));
                }
            } catch (e) {
                console.error(`Failed to load config file ${filepath}`, e);
            }

            console.debug(`Loaded config file ${filepath}`, config);
            return config;
        });

        mergeDeep(this.values, ...configs);
        this.values = this.interpolation.expand(this.values, process.env);
        this.values = this.interpolation.expand(this.values, this.values);

        console.debug("Resolved config", this.values);
    }

    get(property: string, defaultValue: any = undefined): any {
        let result: any;
        let error: any = new Error(`Failed to resolve config property ${property}`);

        try {
            result = resolvePath(this.values, property) ?? defaultValue;
        } catch (e) {
            //console.debug(`Failed to resolve config property ${property}. Returning default.`);
            result = defaultValue;
            error = e;
        }

        if (result instanceof Function) {
            result = result();
        }

        // If no result is found, and no default value is provided, assume value was required and throw error
        if (result === undefined) {
            throw error;
        }

        return result;
    }

}

export default {

    getInstance(): Config {
        if (!Config.instance) {
            throw new Error('Config not initialized');
        }

        return Config.instance;
    },

    initialize(props: ConfigProps, ...configFiles: string[]): void {
        Config.instance = new Config(props);
        Config.instance.load(...configFiles);
    },

    load(...files: string[]): void {
        this.getInstance().load(...files);
    },

    get(property: string, defaultValue: any = undefined): any {
        return this.getInstance().get(property, defaultValue);
    },

}