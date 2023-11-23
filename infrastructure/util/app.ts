import {IConstruct} from "constructs";

export interface AppProps {
    app: IConstruct;
}

class App {

    readonly app: IConstruct;

    static instance: App;

    constructor(props: AppProps) {
        this.app = props.app;
    }

    getEnvironment(): string {
        return this.app.node.tryGetContext('env') ?? process.env.ENVIRONMENT ?? 'dev';
    }

    getGeneralEnvironment(): string {
        const env = this.getEnvironment();

        if (env.startsWith('pr-')) {
            return 'pr';
        }

        return env;
    }

    getConfigRoot(): string {
        return __dirname + '/../config';
    }

    getConfigFiles(): string[] {
        const configs = ['config.yaml'];
        const env = this.getGeneralEnvironment();
        const envConfigFile = process.env.ENV_CONFIG_FILE ?? `env/${env}.yaml`;

        configs.push(envConfigFile);

        (process.env.ADDITIONAL_CONFIG_FILES ?? '').split(',').forEach(file => {
            if (file) {
                configs.push(file);
            }
        });

        return configs;
    }

}

export default {

    getInstance() {
        if (!App.instance) {
            throw new Error('App not initialized');
        }

        return App.instance;
    },

    initialize(props: AppProps) {
        App.instance = new App(props);
    },

    getEnvironment(): string {
        return this.getInstance().getEnvironment();
    },

    getGeneralEnvironment(): string {
        return this.getInstance().getGeneralEnvironment();
    },

    getConfigRoot(): string {
        return this.getInstance().getConfigRoot();
    },

    getConfigFiles(): string[] {
        return this.getInstance().getConfigFiles();
    },

}