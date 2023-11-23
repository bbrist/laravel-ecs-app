import {Construct} from "constructs";
import {Queue, QueueProps} from "aws-cdk-lib/aws-sqs";
import {Duration, RemovalPolicy} from "aws-cdk-lib";

export interface BaseSqsQueueProps {
    retentionPeriod?: Duration;
    visibilityTimeout?: Duration;
    removalPolicy?: RemovalPolicy;
}

export interface NameConfig {
    name: string;
    prefix?: string;
    suffix?: string;
}

export interface SqsQueueProps extends BaseSqsQueueProps {
    name: NameConfig;
    dlq?: BaseSqsQueueProps;
    maxReceiveCount?: number;
}

function createQueue(scope: Construct, id: string, props: SqsQueueProps, additionalProps?: QueueProps): Queue {
    const name = `${props.name.prefix ?? ''}${props.name.name}${props.name.suffix ?? ''}`;
    return new Queue(scope, id, {
        queueName: name,
        retentionPeriod: props.retentionPeriod ?? Duration.days(1),
        removalPolicy: props.removalPolicy ?? RemovalPolicy.DESTROY,
        visibilityTimeout: props.visibilityTimeout ?? Duration.seconds(30),
        ...additionalProps
    });
}

export class SqsQueue extends Construct {

    readonly instance: Queue
    readonly dlq: Queue

    constructor(scope: Construct, id: string, props: SqsQueueProps) {
        super(scope, id);

        this.dlq = createQueue(this, 'DeadLetterQueue', {
            name: {
                name: props.name.name,
                prefix: props.name.prefix,
                suffix: `${props.name.suffix ?? ''}-dlq`,
            },
            removalPolicy: props.removalPolicy,
            retentionPeriod: props.dlq?.retentionPeriod ?? Duration.days(3),
            ...props.dlq
        });

        this.instance = createQueue(this, 'Queue', props, {
            removalPolicy: props.removalPolicy,
            deadLetterQueue: {
                queue: this.dlq,
                maxReceiveCount: props.maxReceiveCount ?? 3
            }
        });

    }

}