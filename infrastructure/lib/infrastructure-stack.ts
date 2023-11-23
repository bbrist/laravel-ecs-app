import * as cdk from 'aws-cdk-lib';
import {aws_ec2 as ec2, aws_rds as rds} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {Cluster, ContainerImage, Secret} from "aws-cdk-lib/aws-ecs";
import {IImageResolver, LaravelEcsFargateApp} from "./components/laravel-ecs-app";
import {Bucket, BucketAccessControl} from "aws-cdk-lib/aws-s3";
import {AttributeType, BillingMode, Table} from "aws-cdk-lib/aws-dynamodb";
import {SqsQueue} from "./components/sqs-queue";
import Config from "../util/config";
import App from "../util/app";
import State from "../util/state";
import {LogGroup, RetentionDays} from "aws-cdk-lib/aws-logs";
import {Role, ServicePrincipal} from "aws-cdk-lib/aws-iam";
import {managedPolicies, policyDocument, RdsConnectPolicy} from "./components/policies";
import {S3BucketAccessPolicy} from "./components/policies/s3";
import {SecurityGroup} from "aws-cdk-lib/aws-ec2";
import {SecretsManagerAccessPolicy} from "./components/policies/sm";
import {LogGroupLoggingPolicy} from "./components/policies/cloudwatch";

interface ImageProps {
    tag?: string;
    repository: string;
    prefix?: string;
    suffix?: string;
}

class ImageResolver implements IImageResolver {

    readonly props: ImageProps;

    constructor(props: ImageProps) {
      this.props = props;
    }

    resolve(name: string): ContainerImage {
      const image = `${this.props.repository}/${this.props.prefix ?? ''}${name}${this.props.suffix ?? ''}:${this.props.tag ?? 'latest'}`;
      return ContainerImage.fromRegistry(image);
    }
}

export class InfrastructureStack extends cdk.Stack {

  // TODO:
  //  - Add individual security groups for each service
  //    - Open 9000 on fpm inbound/outbound
  //  - Update to use ECS Autoscaling Group
  //  - Modify/Add Deletion Policies
  //    - Make configurable
  //  - Add CodePipeline/CodeDeploy to add hooks
  //    - maintenance mode
  //    - migrations
  //    - in-place deployment
  //    - dns updates
  //      - associate domain with service, if not already, using resolved priority
  //      - create A record if necessary
  //      - update cert with SAN name if necessary
  //  - Figure out how to host soketi

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const appName = Config.get('app.identifier');
    const environment = App.getEnvironment();
    const namespaceName = Config.get('app.cluster.namespace', `${environment}.local`);
    const debugEnabled = Boolean(Config.get('app.debug', false));

    const stateSecret = State.getSecret(this, 'StateSecret');

    const vpc = ec2.Vpc.fromLookup(this, 'Vpc', {
      vpcId: Config.get('app.cluster.vpcId')
    });

    const cluster = new Cluster(this, 'Cluster', {
      clusterName: Config.get('app.cluster.name'),
      vpc,
      enableFargateCapacityProviders: true,
      containerInsights: Config.get('app.cluster.containerInsights', false),
      defaultCloudMapNamespace: {
        name: namespaceName,
        useForServiceConnect: true,
      },
    });

    const securityGroup = SecurityGroup.fromLookupById(this, 'SecurityGroup',
        Config.get('app.cluster.securityGroupId'));

    const dbStorageType = Config.get('app.database.storageType', 'GP2').toUpperCase();
    const dbUsername = Config.get('app.database.username');
    const databaseCredentials = rds.Credentials.fromPassword(
        dbUsername,
        State.secretRef('DB_PASSWORD') // TODO: Add versioning to this?
    );
    const db = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0_34
      }),
      instanceType: new ec2.InstanceType('t3.micro'),
      credentials: databaseCredentials,
      vpc: cluster.vpc,
      databaseName: Config.get('app.database.name'),
      publiclyAccessible: true,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      allocatedStorage: Number(Config.get('app.database.allocatedStorage', '100')),
      storageType: rds.StorageType[dbStorageType as keyof typeof rds.StorageType],
    });

    const filesystem = new Bucket(this, 'Filesystem', {
      bucketName: Config.get('app.filesystem.name'),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      accessControl: BucketAccessControl.PRIVATE,
    });

    const cacheTable = new Table(this, 'CacheTable', {
      tableName: Config.get('app.cache.name'),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
        partitionKey: {
            name: 'key',
            type: AttributeType.STRING,
        },
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

    const imageResolver = new ImageResolver({
      repository: Config.get('image.repository'),
      prefix: Config.get('image.prefix'),
      tag: Config.get('image.tag', 'latest'),
    });

    const queueConfigs = {
      default: {
        name: 'default',
        tries: 3,
        timeout: 60,
        backoff: 60,
        maxReceiveCount: 3,
      }
    }

    Object.keys(queueConfigs).map((queueName) => {
      // @ts-ignore
      const config = queueConfigs[queueName];
      return new SqsQueue(this, `${queueName}Queue`, {
        name: {
          name: queueName,
          prefix: `${appName}-`,
          suffix: `-queue-${environment}`,
        },
        dlq: {},
        maxReceiveCount: config.maxReceiveCount ?? 1,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
    });

    const logGroup = new LogGroup(this, 'LogGroup', {
      logGroupName: `${appName}-app-${environment}`,
      retention: RetentionDays.TWO_MONTHS,
    });

    // TODO: Tighten up permissions
    const taskRole = new Role(this, 'TaskRole', {
      roleName: `${appName}-task-role-${environment}`,
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
      inlinePolicies: {
        'rds': policyDocument(new RdsConnectPolicy(db.instanceArn)),
        's3': policyDocument(new S3BucketAccessPolicy(filesystem.bucketArn))
      },
      managedPolicies: [
          ...managedPolicies('AmazonDynamoDBFullAccess', 'AmazonSQSFullAccess'),
      ]
    });

    const executionRole = new Role(this, 'ExecutionRole', {
      roleName: `${appName}-execution-role-${environment}`,
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
      inlinePolicies: {
        'logging': policyDocument(new LogGroupLoggingPolicy(logGroup.logGroupArn)),
        'secrets-access': policyDocument(new SecretsManagerAccessPolicy(stateSecret.secretArn)),
      }
    });

    // TODO: Create Soketi service

    const webapp = new LaravelEcsFargateApp(this, 'WebApp', {
      name: appName,
      namespace: namespaceName,
      domainName: Config.get('app.domain.name'),
      imageResolver,
      cluster,
      securityGroup,
      roles: {
        tasks: taskRole,
        execution: executionRole,
      },
      env: {
        CACHE_DRIVER: 'dynamodb',
        DYNAMODB_CACHE_TABLE: cacheTable.tableName,
        SESSION_DRIVER: 'dynamodb',
        SESSION_STORE: 'dynamodb',
        QUEUE_CONNECTION: 'sqs',
        SQS_PREFIX: `https://sqs.us-east-1.amazonaws.com/${props?.env?.account}/${appName}-`,
        SQS_SUFFIX: `-queue-${environment}`,
        FILESYSTEM_DISK: 's3',
        AWS_BUCKET: filesystem.bucketName,
        DB_CONNECTION: 'mysql',
        DB_HOST: db.dbInstanceEndpointAddress,
        DB_PORT: db.dbInstanceEndpointPort,
        DB_DATABASE: Config.get('app.database.name'),
        DB_USERNAME: databaseCredentials.username,
        APP_DEBUG: String(debugEnabled),
      },
      secrets: {
        ...State.getEnvSecrets((key: string) => Secret.fromSecretsManager(stateSecret, key)),
      },
      queues: queueConfigs,
      log: {
        group: logGroup,
      },
      assignPublicIp: Boolean(Config.get('app.cluster.assignPublicIp', false)),
      enableExecuteCommand: debugEnabled,
    });

  }
}
