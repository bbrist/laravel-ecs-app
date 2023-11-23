import {Effect, PolicyStatement} from "aws-cdk-lib/aws-iam";

export class SecretsManagerAccessPolicy extends PolicyStatement {

    constructor(...arns: string[]) {
        super({
            sid: 'SMAccessPolicy',
            effect: Effect.ALLOW,
            actions: [
                'secretsmanager:DescribeSecret',
                'secretsmanager:GetSecretValue',
            ],
            resources: [
                ...arns,
            ]
        })
    }

}