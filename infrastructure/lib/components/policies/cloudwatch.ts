import {Effect, PolicyStatement} from "aws-cdk-lib/aws-iam";

export class LogGroupLoggingPolicy extends PolicyStatement {

    constructor(...arns: string[]) {
        super({
            sid: 'LogGroupLoggingPolicy',
            effect: Effect.ALLOW,
            actions: [
                'logs:CreateLogStream',
                'logs:PutLogEvents'
            ],
            resources: [
                ...arns,
            ]
        })
    }

}