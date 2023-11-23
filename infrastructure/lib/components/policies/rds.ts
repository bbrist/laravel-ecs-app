import {Effect, PolicyStatement} from "aws-cdk-lib/aws-iam";

export class RdsConnectPolicy extends PolicyStatement {

    constructor(arn: string) {
        super({
            sid: 'RdsConnectPolicy',
            effect: Effect.ALLOW,
            actions: [
                'rds-db:connect',
            ],
            resources: [
                arn
            ]
        });
    }

}