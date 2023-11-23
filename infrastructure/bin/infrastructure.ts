#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { InfrastructureStack } from '../lib/infrastructure-stack';
import State from "../util/state";
import Config from "../util/config";
import App from "../util/app";
import Laravel from "../util/laravel";
import {PasswordGenerator} from "../generator";
import {Values} from "../generator/PasswordGenerator";

const app = new cdk.App();

App.initialize({ app });

const env = App.getEnvironment();

Config.initialize({
    root: App.getConfigRoot(),
    additionalProperties: {
        env,
    }
}, ...App.getConfigFiles());

async function main() {

    await State.initialize({
        key: Config.get('app.context.key'),
        data: {
            APP_KEY: Laravel.generateAppKey(),
            DB_PASSWORD: new PasswordGenerator(32, [ Values.ALPHA_NUMERIC ]),
            DB_ROOT_PASSWORD: new PasswordGenerator(32, [ Values.ALPHA_NUMERIC ]),
        }
    });

    new InfrastructureStack(app, 'InfrastructureStack', {
        /* If you don't specify 'env', this stack will be environment-agnostic.
         * Account/Region-dependent features and context lookups will not work,
         * but a single synthesized template can be deployed anywhere. */

        /* Uncomment the next line to specialize this stack for the AWS Account
         * and Region that are implied by the current CLI configuration. */
        env: {
            account: process.env.CDK_DEFAULT_ACCOUNT,
            region: process.env.CDK_DEFAULT_REGION
        },

        /* Uncomment the next line if you know exactly what Account and Region you
         * want to deploy the stack to. */
        // env: { account: '123456789012', region: 'us-east-1' },

        /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
    });
}

main();