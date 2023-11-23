import {SecretValue} from "aws-cdk-lib";
import {AWSError, SecretsManager} from 'aws-sdk';
import {GetSecretValueResponse, PutSecretValueResponse} from "aws-sdk/clients/secretsmanager";
import {IGenerator} from "../generator";
import {ISecret, Secret} from "aws-cdk-lib/aws-secretsmanager";
import {Construct} from "constructs";

export interface StateConfig {
    key: string;
    client?: SecretsManager;
    data?: Record<string, string|IGenerator>
}

class State {

    static instance: State;

    readonly key: string;
    readonly client: SecretsManager;

    data: Record<string, string>
    local: Record<string, any> = {};

    constructor(config: StateConfig) {
        this.key = config.key;
        this.client = config.client ?? new SecretsManager();
        this.data = {};

        const map = config.data ?? {};
        Object.keys(map).forEach(key => {
            let value = map[key];
            if (typeof value === 'string') {
                this.data[key] = value;
            }

            else if (typeof value === 'object') {
                this.data[key] = value.generate();
            }

            else {
                throw new Error(`Invalid state value for key '${key}': ${value}`);
            }
        });
    }

    async init() {
        const self = this;
        await new Promise((resolve) => {
            self.client.createSecret({
                Name: self.key,
                SecretString: JSON.stringify(self.data),
            }, (err: AWSError) => {
                if (err) {
                    throw new Error(`Unable to create secret: ${self.key}: ${err.message}`);
                }

                console.log(`Initialized state: ${self.key}`);

                setTimeout(() => {
                    console.debug(`Waiting for secret to be initialized: ${self.key}`)
                }, 5000);

                resolve(1);
            });
        });
    }

    async load(): Promise<void> {
        const self = this;
        await this.getSecretWithRetry(this.key, 1).then(data => {
            self.setData(data.SecretString);
            console.log(`Loaded state: ${self.key}`);
        }).catch(async () => await this.init());
    }

    async save(): Promise<void> {
        const self = this;
        await this.putSecretWithRetry(this.key, this.data, 5, 5000).then(() => {
            console.debug(`Saved state: ${self.key}`);
        }).catch(err => {
            throw new Error(`Unable to save state to secret '${self.key}': ${err.message}`);
        });
    }

    secretRef(key: string): SecretValue {
        return SecretValue.secretsManager(this.key, {
            jsonField: key,
        });
    }

    unsafeString(key: string): string {
        return this.data[key];
    }

    async getSecretWithRetry(key: string, retries: number = 1, delay: number = 2000): Promise<GetSecretValueResponse> {
        const self = this;
        return new Promise<GetSecretValueResponse>((resolve, reject) => {
            let retryCount = 0;

            function getSecret() {
                self.client.getSecretValue({ SecretId: key }, (err: AWSError, data: GetSecretValueResponse) => {
                    if (err) {
                        if (retryCount < retries) {
                            console.error(`Failed to get secret: ${key}: ${err.message}`);
                            retryCount++;
                            setTimeout(getSecret, delay);
                        } else {
                            reject(err);
                        }
                    } else {
                        resolve(data);
                    }
                });
            }

            getSecret();
        });
    }

    async putSecretWithRetry(key: string, data: any, retries: number = 1, delay: number = 2000): Promise<PutSecretValueResponse> {
        const self = this;
        return new Promise<PutSecretValueResponse>((resolve) => {
            let retryCount = 0;

            function putSecret() {
                self.client.putSecretValue({
                    SecretId: key,
                    SecretString: JSON.stringify(data),
                }, (err: AWSError, res: PutSecretValueResponse) => {
                    if (err) {
                        if (retryCount < retries) {
                            console.error(`Failed to save state to secret '${key}': ${err.message}`);
                            retryCount++;
                            setTimeout(putSecret, delay);
                        } else {
                            throw new Error(`Unable to save state to secret '${key}': ${err.message}`);
                        }
                    } else {
                        resolve(res);
                    }
                });
            }

            putSecret();
        });
    }

    setData(data?: string) {
        this.data = {
            ...JSON.parse(data ?? '{}'),
            ...this.data,
        };
    }

    store(key: string, supplier: Promise<any>): any {
        if (this.data[key]) {
            throw new Error(`State key already exists: ${key}`);
        }

        return supplier.then(value => {
            this.local[key] = value;
            return value;
        });
    }

    get(key: string) {
        if (this.data[key]) {
            return this.unsafeString(key);
        }

        if (this.local[key]) {
            return this.local[key];
        }

        throw new Error(`State key not found: ${key}`);
    }

    getEnvSecrets(mapper: (key: string, value: string) => any): Record<string, any> {
        const secrets = {} as Record<string, any>;
        Object.keys(this.data).map(key => {
            secrets[key] = mapper(key, this.data[key]);
        });
        return secrets;
    }

    static async initialize(config: StateConfig): Promise<State> {
        const state = new State(config);

        await state.load();
        await state.save();

        return state;
    }

}

export default {

    getInstance(): State {
        if (!State.instance) {
            throw new Error('State not initialized');
        }

        return State.instance;
    },

    getSecret(scope: Construct, id: string): ISecret {
        return Secret.fromSecretNameV2(scope, id, this.getInstance().key);
    },

    async initialize(config: StateConfig): Promise<State> {
        State.instance = await State.initialize(config);

        return this.getInstance();
    },

    async store(key: string, supplier: Promise<any>): Promise<void> {
        return this.getInstance().store(key, supplier);
    },

    get(key: string): any {
        return this.getInstance().get(key);
    },

    secretRef(key: string): SecretValue {
        return this.getInstance().secretRef(key);
    },

    unsafeString(key: string): string {
        return this.getInstance().unsafeString(key);
    },

    getEnvSecrets(mapper: (key: string, value: string) => any): Record<string, any> {
        return this.getInstance().getEnvSecrets(mapper);
    }

}