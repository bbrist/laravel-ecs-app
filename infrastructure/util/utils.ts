import {Construct} from "constructs";
import {Tags} from "aws-cdk-lib";

export function isObject(item: any) {
    return item && typeof item === 'object' && !Array.isArray(item);
}

export function mergeDeep(target: any, ...sources: any[]): any {
    if (!sources.length) return target;
    const source = sources.shift();

    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                mergeDeep(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }

    return mergeDeep(target, ...sources);
}

export class PathNotFoundError extends Error {
    constructor(path: string) {
        super(`Path not found: ${path}`);
    }
}

export function resolvePath(obj: any, path: string) {
    const keys = path.split('.');
    let value = obj;
    for (let key of keys) {
        if (!value.hasOwnProperty(key)) {
            throw new PathNotFoundError(path);
        }

        value = value[key];
        if (value === undefined) {
            break;
        }
    }
    return value;
}

export function required(value: any, message: string) {
    if (!value) {
        throw new Error(message);
    }

    return value;
}

export function tag(scope: Construct, tags: Record<string, string>) {
    const resource = Tags.of(scope);
    Object.keys(tags).forEach((key) => {
        resource.add(key, tags[key]);
    });
}