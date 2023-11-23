import {ManagedPolicy, PolicyDocument, PolicyStatement} from "aws-cdk-lib/aws-iam";

export * from './rds'

export function policyDocument(...statements: PolicyStatement[]) {
    return new PolicyDocument({
        statements: statements
    })
}

export function managedPolicies(...names: string[]) {
    return names.map(name => ManagedPolicy.fromAwsManagedPolicyName(name))
}