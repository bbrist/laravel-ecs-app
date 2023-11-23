import {ILogGroup, RetentionDays} from "aws-cdk-lib/aws-logs";
import {LogDriver} from "aws-cdk-lib/aws-ecs";

export function dnsName(name: string, namespace: string): string {
    return `${name}.svc.${namespace}`;
}

export interface Limits {
    memory?: number;
    cpu?: number;
}

export interface Capacity {
    min?: number;
    max?: number;
    desired?: number;
}

export interface LogProps {
    driver?: LogDriver;
    group?: ILogGroup;
    retention?: RetentionDays;
}

export * from './LaravelWebComponent';
export * from './LaravelFpmComponent';
export * from './LaravelCronComponent';
export * from './LaravelQueueComponent';
export * from './LaravelCliComponent';

export * from './scaling';