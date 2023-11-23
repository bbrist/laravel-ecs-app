import {Construct} from "constructs";
import {
    ContainerDefinition,
    ContainerImage,
    FargateService,
    FargateTaskDefinition,
    LogDriver,
    Secret
} from "aws-cdk-lib/aws-ecs";
import {Limits, LogProps} from ".";
import {ICluster as Cluster} from "aws-cdk-lib/aws-ecs/lib/cluster";
import {IRole} from "aws-cdk-lib/aws-iam";
import {ISecurityGroup} from "aws-cdk-lib/aws-ec2";

export interface CronComponentProps {
    name: string;
    namespace: string;
    limits?: Limits;
    image: ContainerImage;
    log?: LogProps;
    env?: Record<string, string>;
    secrets?: Record<string, Secret>;
    cluster: Cluster;
    taskRole: IRole;
    executionRole: IRole;
    assignPublicIp?: boolean;
    securityGroup: ISecurityGroup;
    enableExecuteCommand?: boolean;
}

export class LaravelCronComponent extends Construct {

    readonly name: string;
    readonly namespace: string;
    readonly cluster: Cluster;
    readonly taskDefinition: FargateTaskDefinition;
    readonly container: ContainerDefinition;
    readonly service: FargateService;
    readonly securityGroup: ISecurityGroup;

    constructor(scope: Construct, id: string, props: CronComponentProps) {
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
        });

        this.service = new FargateService(this, 'Service', {
            serviceName: this.name,
            cluster: this.cluster,
            taskDefinition: this.taskDefinition,
            desiredCount: 1,
            assignPublicIp: props.assignPublicIp ?? false,
            securityGroups: [
                this.securityGroup,
            ],
            enableExecuteCommand: props.enableExecuteCommand ?? false,
        });

    }

}