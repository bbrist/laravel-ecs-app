import {Construct} from "constructs";
import {
    ContainerDefinition,
    ContainerImage,
    FargateService,
    FargateTaskDefinition,
    LogDriver,
    ScalableTaskCount,
    Secret
} from "aws-cdk-lib/aws-ecs";
import {Capacity, CpuScalingStrategy, Limits, LogProps, ScalingStrategy} from ".";
import {ICluster as Cluster} from "aws-cdk-lib/aws-ecs/lib/cluster";
import {IRole} from "aws-cdk-lib/aws-iam";
import {ISecurityGroup} from "aws-cdk-lib/aws-ec2";

export interface CliComponentProps {
    name: string;
    namespace: string;
    limits?: Limits;
    capacity?: Capacity;
    image: ContainerImage;
    log?: LogProps;
    env?: Record<string, string>;
    secrets?: Record<string, Secret>;
    command?: string[];
    cluster: Cluster;
    scalingStrategy?: ScalingStrategy;
    taskRole: IRole;
    executionRole: IRole;
    assignPublicIp?: boolean;
    securityGroup: ISecurityGroup;
    enableExecuteCommand?: boolean;
}

const defaultCapacity: Capacity = {
    min: 1,
    max: 1,
    desired: 1,
}

export class LaravelCliComponent extends Construct {

    readonly name: string;
    readonly namespace: string;
    readonly cluster: Cluster;
    readonly taskDefinition: FargateTaskDefinition;
    readonly container: ContainerDefinition;
    readonly service: FargateService;
    readonly scaling: ScalableTaskCount;
    readonly securityGroup: ISecurityGroup;

    constructor(scope: Construct, id: string, props: CliComponentProps) {
        super(scope, id);

        this.name = props.name;
        this.namespace = props.namespace;
        this.cluster = props.cluster;
        this.securityGroup = props.securityGroup;

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
            command: props.command,
        });

        this.service = new FargateService(this, 'Service', {
            serviceName: this.name,
            cluster: this.cluster,
            taskDefinition: this.taskDefinition,
            desiredCount: props.capacity?.desired ?? defaultCapacity.desired,
            assignPublicIp: props.assignPublicIp ?? false,
            securityGroups: [
                this.securityGroup,
            ],
            enableExecuteCommand: props.enableExecuteCommand ?? false,
        });

        this.scaling = this.service.autoScaleTaskCount({
            minCapacity: props.capacity?.min ?? defaultCapacity.min,
            maxCapacity: props.capacity?.max ?? defaultCapacity.max as number,
        });

        const scalingStrategy = props.scalingStrategy ?? new CpuScalingStrategy();
        scalingStrategy.apply(this.scaling);
    }

}