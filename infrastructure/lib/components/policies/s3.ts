import {Effect, PolicyStatement} from "aws-cdk-lib/aws-iam";

export class S3BucketAccessPolicy extends PolicyStatement {

        constructor(bucketArn: string) {
            super({
                sid: 'S3BucketAccessPolicy',
                effect: Effect.ALLOW,
                actions: [
                    's3:*'
                ],
                resources: [
                    bucketArn
                ]
            })
        }

}