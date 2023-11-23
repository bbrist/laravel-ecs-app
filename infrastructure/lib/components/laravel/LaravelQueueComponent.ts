import { CliComponentProps, LaravelCliComponent } from "./LaravelCliComponent";
import {Construct} from "constructs";

export interface QueueProps {
    name: string;
    tries?: number;
    timeout?: number;
    backoff?: number;
}

export interface QueueComponentProps extends CliComponentProps {
    queue: QueueProps;
}

function additionalQueueArgs(props: QueueProps): string[] {
    const args: string[] = [];

    if (props?.tries) {
        args.push(`--tries=${props.tries}`);
    }

    if (props?.timeout) {
        args.push(`--timeout=${props?.timeout}`);
    }

    if (props?.backoff) {
        args.push(`--backoff=${props?.backoff}`);
    }

    return args;
}

export class LaravelQueueComponent extends LaravelCliComponent {

    constructor(scope: Construct, id: string, props: QueueComponentProps) {
        super(scope, id, {
            ...props,
            name: `${props.name}-${props.queue.name}-queue`,
            command: [
                'php',
                'artisan',
                'queue:work',
                `--queue=${props.queue.name}`,
                ...additionalQueueArgs(props)
            ]
        });
    }

}