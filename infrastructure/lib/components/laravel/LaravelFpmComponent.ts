import {Construct} from "constructs";
import {
    ContainerDefinition,
    ContainerImage,
    FargateService,
    FargateTaskDefinition,
    LogDriver, ScalableTaskCount,
    Secret
} from "aws-cdk-lib/aws-ecs";
import {ICluster as Cluster} from "aws-cdk-lib/aws-ecs/lib/cluster";
import {ISecurityGroup} from "aws-cdk-lib/aws-ec2";
import {Capacity, CpuScalingStrategy, dnsName, Limits, LogProps, ScalingStrategy} from ".";
import {IRole} from "aws-cdk-lib/aws-iam";

export interface FpmComponentProps {
    name: string;
    namespace: string;
    image: ContainerImage;
    limits?: Limits;
    capacity?: Capacity;
    cluster: Cluster;
    securityGroup: ISecurityGroup;
    env?: Record<string, string>;
    secrets?: Record<string, Secret>;
    scalingStrategy?: ScalingStrategy;
    log?: LogProps;
    taskRole: IRole;
    executionRole: IRole;
    assignPublicIp?: boolean;
    enableExecuteCommand?: boolean;
}

const defaultCapacity: Capacity = {
    min: 1,
    max: 1,
    desired: 1,
}

export class LaravelFpmComponent extends Construct {

    readonly name: string;
    readonly namespace: string;
    readonly dnsName: string;
    readonly port: number;
    readonly cluster: Cluster;
    readonly service: FargateService;
    readonly container: ContainerDefinition;
    readonly taskDefinition: FargateTaskDefinition;
    readonly scaling: ScalableTaskCount;

    constructor(scope: Construct, id: string, props: FpmComponentProps) {
        super(scope, id);

        this.name = props.name;
        this.namespace = props.namespace;
        this.dnsName = dnsName(this.name, this.namespace);
        this.cluster = props.cluster;
        this.port = 9000;

        this.taskDefinition = new FargateTaskDefinition(this, 'TaskDefinition', {
            memoryLimitMiB: props.limits?.memory ?? 512,
            cpu: props.limits?.cpu ?? 256,
            taskRole: props.taskRole,
            executionRole: props.executionRole,
        });

        this.container = this.taskDefinition.addContainer('Container', {
            containerName: this.name,
            image: props.image,
            logging: props.log?.driver ?? LogDriver.awsLogs({
                streamPrefix: this.name,
                logGroup: props.log?.group,
                logRetention: props.log?.retention,
            }),
            environment: {
                ...props.env
            },
            secrets: {
                ...props.secrets,
            },
            portMappings: [
                {
                    name: 'default',
                    containerPort: this.port,
                }
            ],
        });

        this.service = new FargateService(this, 'Service', {
            serviceName: this.name,
            cluster: this.cluster,
            taskDefinition: this.taskDefinition,
            desiredCount: props.capacity?.desired ?? defaultCapacity.desired,
            securityGroups: [
                props.securityGroup
            ],
            assignPublicIp: props.assignPublicIp ?? false,
            enableExecuteCommand: props.enableExecuteCommand ?? false,
        });

        this.scaling = this.service.autoScaleTaskCount({
            minCapacity: props.capacity?.min ?? defaultCapacity.min,
            maxCapacity: props.capacity?.max ?? defaultCapacity.max as number,
        });

        const scalingStrategy = props.scalingStrategy ?? new CpuScalingStrategy();
        scalingStrategy.apply(this.scaling);

        this.service.enableServiceConnect({
            namespace: this.namespace,
            services: [
                {
                    dnsName: dnsName(this.name, this.namespace),
                    discoveryName: 'fpm',
                    portMappingName: 'default',
                }
            ]
        });

    }

}