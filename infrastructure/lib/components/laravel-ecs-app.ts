import {Construct} from "constructs";
import {ContainerImage, ICluster as Cluster, Secret} from "aws-cdk-lib/aws-ecs";
import {
    CpuScalingStrategy,
    LaravelCronComponent,
    LaravelFpmComponent,
    LaravelQueueComponent,
    LaravelWebComponent,
    LogProps
} from "./laravel";
import {IRole} from "aws-cdk-lib/aws-iam";
import {ISecurityGroup} from "aws-cdk-lib/aws-ec2";
import {tag} from "../../util/utils";

export interface IImageResolver {
    resolve(name: string): ContainerImage;
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

export interface ServiceProps {
    limits?: Limits;
    capacity?: Capacity;
    env?: Record<string, string>;
    secrets?: Record<string, Secret>;
}

export interface QueueProps extends ServiceProps {
    name?: string;
    tries?: number;
    timeout?: number;
    backoff?: number;
}

export interface RoleProps {
    tasks: IRole,
    execution: IRole,
}

function serviceProps(service?: ServiceProps, defaultOverrides?: ServiceProps): ServiceProps {
    return {
        limits: {
            memory: 512,
            cpu: 256,
            ...defaultOverrides?.limits,
            ...service?.limits,
        },
        capacity: {
            min: 1,
            max: 4,
            desired: 1,
            ...defaultOverrides?.capacity,
            ...service?.capacity,
        },
    }
}

interface CreateQueueProps {
    name: string,
    namespace: string;
    cluster: Cluster;
    imageResolver: IImageResolver;
    env?: Record<string, string>;
    secrets?: Record<string, Secret>;
    limits?: Limits;
    capacity?: Capacity;
    log?: LogProps;
    roles: RoleProps;
    assignPublicIp?: boolean;
    securityGroup: ISecurityGroup;
    enableExecuteCommand?: boolean;
}

function createQueueWorkers(scope: Construct, queues: Record<string, QueueProps>|undefined, defaults: QueueProps|undefined, props: CreateQueueProps): Record<string, LaravelQueueComponent> {
    const components: Record<string, LaravelQueueComponent> = {};

    queues = queues ?? {
        default: {},
    };

    if (!queues.default) {
        queues.default = {};
    }

    Object.keys(queues).forEach((queueName) => {
        // @ts-ignore
        const config = queues[queueName];

        components[queueName] = new LaravelQueueComponent(scope, `${queueName}Queue`, {
            name: props.name,
            namespace: props.namespace,
            cluster: props.cluster,
            securityGroup: props.securityGroup,
            image: props.imageResolver.resolve('cli'),
            taskRole: props.roles.tasks,
            executionRole: props.roles.execution,
            env: {
                ...props.env,
                ...config.env,
            },
            secrets: {
                ...props.secrets,
                ...config.secrets,
            },
            limits: config.limits ?? props.limits,
            capacity: config.capacity ?? props.capacity,
            queue: {
                name: queueName,
                tries: config.tries ?? defaults?.tries,
                timeout: config.timeout ?? defaults?.timeout,
                backoff: config.backoff ?? defaults?.backoff,
            },
            log: props.log,
            assignPublicIp: props.assignPublicIp,
            enableExecuteCommand: props.enableExecuteCommand,
        });
    });

    return components;
}

function env(props: LaravelEcsFargateAppProps, additional?: Record<string, string>): any {
    return {
        env: {
            ...props.env,
            ...additional,
        },
        secrets: {
            ...props.secrets,
        }
    }
}

export interface LaravelEcsFargateAppProps {
    name: string;
    namespace: string;
    domainName: string;
    imageResolver: IImageResolver;
    env: Record<string, string>;
    secrets: Record<string, Secret>;
    cluster: Cluster;
    securityGroup: ISecurityGroup;
    roles: RoleProps;
    fpm?: ServiceProps;
    web?: ServiceProps;
    cron?: ServiceProps;
    queues?: Record<string, QueueProps>;
    queueWorkerDefaults?: QueueProps;
    log?: LogProps;
    assignPublicIp?: boolean;
    enableExecuteCommand?: boolean;
}

export class LaravelEcsFargateApp extends Construct {

    readonly name: string;
    readonly namespace: string;
    readonly domainName: string;
    readonly cluster: Cluster;
    readonly securityGroup: ISecurityGroup;
    readonly env: Record<string, string>;
    readonly fpm: LaravelFpmComponent;
    readonly web: LaravelWebComponent;
    readonly cron: LaravelCronComponent;
    readonly queues: Record<string, LaravelQueueComponent>

    constructor(scope: Construct, id: string, props: LaravelEcsFargateAppProps) {
        super(scope, id);
        this.name = props.name;
        this.namespace = props.namespace;
        this.cluster = props.cluster;
        this.securityGroup = props.securityGroup;
        this.domainName = props.domainName;

        const imageResolver = props.imageResolver;

        this.fpm = new LaravelFpmComponent(this, 'fpm', {
            name: `${this.name}-fpm`,
            namespace: this.namespace,
            image: imageResolver.resolve('fpm'),
            cluster: this.cluster,
            securityGroup: this.securityGroup,
            ...serviceProps(props.fpm),
            ...env(props),
            scalingStrategy: CpuScalingStrategy.utilization(80),
            log: props.log,
            taskRole: props.roles.tasks,
            executionRole: props.roles.execution,
            assignPublicIp: props.assignPublicIp,
            enableExecuteCommand: props.enableExecuteCommand,
        });

        this.web = new LaravelWebComponent(this, 'web', {
            name: `${this.name}-web`,
            namespace: this.namespace,
            image: imageResolver.resolve('web'),
            cluster: this.cluster,
            securityGroup: this.securityGroup,
            ...serviceProps(props.web),
            ...env(props, {
                FPM_HOST: `${this.fpm.dnsName}:${this.fpm.port}`,
            }),
            log: props.log,
            scalingStrategy: CpuScalingStrategy.utilization(80),
            taskRole: props.roles.tasks,
            executionRole: props.roles.execution,
            assignPublicIp: props.assignPublicIp,
            enableExecuteCommand: props.enableExecuteCommand,
        });

        this.cron = new LaravelCronComponent(this, 'cron', {
            name: `${this.name}-cron`,
            namespace: this.namespace,
            image: imageResolver.resolve('cron'),
            cluster: this.cluster,
            securityGroup: this.securityGroup,
            ...serviceProps(props.cron),
            ...env(props),
            log: props.log,
            taskRole: props.roles.tasks,
            executionRole: props.roles.execution,
            assignPublicIp: props.assignPublicIp,
            enableExecuteCommand: props.enableExecuteCommand,
        });

        this.queues = createQueueWorkers(this, props.queues, props.queueWorkerDefaults, {
            name: this.name,
            namespace: this.namespace,
            cluster: this.cluster,
            securityGroup: this.securityGroup,
            imageResolver,
            ...serviceProps(props.queueWorkerDefaults),
            ...env(props),
            log: props.log,
            roles: props.roles,
            assignPublicIp: props.assignPublicIp,
            enableExecuteCommand: props.enableExecuteCommand,
        });

        tag(this.web.service, {
            'ecs:external-dns:discovery': 'true',
            'ecs:external-dns:domain': this.domainName,
            'ecs:external-dns:target-group': this.web.getTargetGroupArn(),
        });

        /*tag(this.web.service, {
            'ecs:external-dns:discovery': 'true',
            'ecs:external-dns:domain': this.domainName,
            'ecs:external-dns:port': this.web.getHttpPort().toString(),
            'ecs:external-dns:protocol': 'http',
            'ecs:external-dns:target-type': 'ip',
            'ecs:external-dns:health-check-path': '/',
        });*/

    }

}